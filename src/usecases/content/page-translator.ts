import { createBatchDecoder, encodeBatch } from "@/domain/batch-protocol";
import { packBatch, priorityScore } from "@/domain/batch-scheduler";
import { FAILURE_POLICY, TranslateFailure } from "@/domain/failure";
import type { LanguageCode } from "@/domain/languages";
import { summarizePage, type PageState, type SegmentState, type Showing } from "@/domain/page";
import { pageInstructions } from "@/domain/prompts";
import type { Settings } from "@/domain/settings";
import { cacheKey, type CachedTranslation } from "@/domain/translation-cache";
import { DomWatcher } from "@/infra/dom/dom-watcher";
import {
  ensurePendingStyle,
  isInMainContent,
  restoreContentLang,
  setPending,
  translatedAncestor,
  unmarkTranslated,
} from "@/infra/dom/markers";
import { Segment } from "@/infra/dom/segment";
import { collectRuns } from "@/infra/dom/segmenter";
import { callBackground } from "@/infra/messaging/background-client";
import {
  requestTranslation,
  StreamCancelled,
  type StreamHandle,
} from "@/infra/messaging/translation-stream";

const MAX_CONCURRENCY = 4;

function pageContext() {
  const description = document.querySelector<HTMLMetaElement>(
    'meta[name="description"], meta[property="og:description"]',
  );
  return { title: document.title, description: description?.content ?? "" };
}

async function lookupCache(keys: string[]): Promise<(string | null)[]> {
  try {
    return await callBackground("cache:lookup", { keys });
  } catch {
    return keys.map(() => null);
  }
}

function storeCache(entry: CachedTranslation) {
  callBackground("cache:store", { entries: [entry] }).catch(() => {});
}

export interface PageTranslatorHooks {
  getSettings: () => Settings;
  onFatalFailure: (failure: TranslateFailure) => void;
  onPartialFailure: () => void;
}

export class PageTranslator {
  private active = false;
  private showing: Showing = "translation";
  private lang: LanguageCode | null = null;
  private byParent = new Map<Element, Set<Segment>>();
  private owner = new WeakMap<Node, Segment>();
  private readonly queue = new Set<Segment>();
  private readonly inflight = new Set<StreamHandle>();
  private readonly pendingCount = new Map<Element, number>();
  private batchCounter = 0;
  private running = 0;
  private pumpScheduled = false;
  private partialFailureNotified = false;
  private readonly watcher: DomWatcher;

  constructor(private readonly hooks: PageTranslatorHooks) {
    this.watcher = new DomWatcher({
      isOwn: (node) => this.owner.has(node),
      onTextChanged: (node) => this.onTextChanged(node),
      rescan: (roots) => {
        for (const root of roots) this.scan(root);
        this.prune();
      },
    });
  }

  get isActive() {
    return this.active;
  }

  getState(): PageState {
    return summarizePage(this.active, this.showing, this.connectedStates());
  }

  private *connectedStates(): Generator<SegmentState> {
    for (const [parent, segs] of this.byParent) {
      if (parent.isConnected) for (const seg of segs) yield seg.state;
    }
  }

  start() {
    const { targetLang } = this.hooks.getSettings();
    if (this.lang !== null && this.lang !== targetLang) this.reset();
    this.lang = targetLang;
    if (this.showing === "original") this.renderAll("translation");
    if (this.active) return;
    this.active = true;
    this.partialFailureNotified = false;
    ensurePendingStyle();
    this.scan(document.body);
    for (const seg of this.segments()) {
      if (seg.state === "failed") this.transition(seg, "idle");
      this.enqueue(seg);
    }
    this.watcher.start();
  }

  stop() {
    if (!this.active) return;
    this.active = false;
    this.watcher.stop();
    for (const handle of this.inflight) handle.cancel();
    this.inflight.clear();
    for (const seg of this.segments()) {
      if (seg.state === "queued" || seg.state === "pending") this.transition(seg, "idle");
    }
  }

  showOriginal() {
    this.stop();
    this.renderAll("original");
  }

  toggleOriginal() {
    if (this.showing === "translation") this.showOriginal();
    else this.start();
  }

  hasTranslations(): boolean {
    for (const seg of this.segments()) if (seg.state === "done") return true;
    return false;
  }

  originalTextAt(target: Element): { anchor: Element; text: string } | null {
    if (this.showing !== "translation") return null;
    const anchor = translatedAncestor(target);
    if (!anchor) return null;
    const texts = [...(this.byParent.get(anchor) ?? [])]
      .filter((s) => s.state === "done")
      .map((s) => s.originalText.replace(/\s+/g, " ").trim());
    return texts.length ? { anchor, text: texts.join("\n") } : null;
  }

  private *segments(): Generator<Segment> {
    for (const segs of this.byParent.values()) yield* segs;
  }

  /** 状態の変更はすべてここを通し、待ち行列とハイライトを状態と常に一致させる */
  private transition(seg: Segment, next: SegmentState) {
    const prev = seg.state;
    if (prev === next) return;
    seg.state = next;
    if (prev === "queued") this.queue.delete(seg);
    if (next === "queued") {
      this.queue.add(seg);
      this.schedulePump();
    }
    if (prev === "pending") this.adjustPending(seg.parent, -1);
    if (next === "pending") this.adjustPending(seg.parent, 1);
  }

  private reset() {
    this.stop();
    this.renderAll("original");
    for (const parent of this.byParent.keys()) unmarkTranslated(parent);
    this.byParent = new Map();
    this.owner = new WeakMap();
    this.watcher.forgetHidden();
    this.showing = "translation";
  }

  private renderAll(showing: Showing) {
    this.showing = showing;
    // render() が discard() で byParent を変更するため、走査前に確定させる
    for (const seg of Array.from(this.segments())) {
      if (seg.state === "done") this.render(seg);
    }
  }

  private render(seg: Segment) {
    // 原文表示中・停止中は DOM を監視していない。その間にページが書き換えていたら訳し直す
    if (!seg.render(this.showing)) this.discard(seg);
  }

  private scan(root: Element) {
    const runs = collectRuns(
      root,
      (node) => this.owner.has(node),
      (el) => this.watcher.trackHidden(el),
    );
    for (const run of runs) this.register(new Segment(run));
  }

  private register(seg: Segment) {
    for (const node of seg.ownedNodes()) this.owner.set(node, seg);
    let siblings = this.byParent.get(seg.parent);
    if (!siblings) this.byParent.set(seg.parent, (siblings = new Set()));
    siblings.add(seg);
    this.enqueue(seg);
  }

  private discard(seg: Segment) {
    seg.revert();
    this.transition(seg, "idle");
    const siblings = this.byParent.get(seg.parent);
    siblings?.delete(seg);
    if (![...(siblings ?? [])].some((s) => s.state === "done")) restoreContentLang(seg.parent);
    for (const node of seg.ownedNodes()) this.owner.delete(node);
    this.watcher.markDirty(seg.parent);
  }

  /** SPA や無限スクロールでのメモリ増加を防ぐ */
  private prune() {
    for (const [parent, segs] of this.byParent) {
      if (parent.isConnected) continue;
      for (const seg of segs) this.transition(seg, "idle");
      this.byParent.delete(parent);
    }
  }

  private onTextChanged(node: Text) {
    const seg = this.owner.get(node);
    if (!seg) this.watcher.markDirty(node);
    else if (seg.classifyTextChange(node, this.showing) === "changed") this.discard(seg);
  }

  private enqueue(seg: Segment) {
    if (this.active && seg.state === "idle") this.transition(seg, "queued");
  }

  private schedulePump() {
    if (this.pumpScheduled) return;
    this.pumpScheduled = true;
    requestAnimationFrame(() => {
      this.pumpScheduled = false;
      this.pump();
    });
  }

  private pump() {
    const lang = this.lang;
    if (!this.active || !lang) return;
    while (this.running < MAX_CONCURRENCY && this.queue.size > 0) {
      void this.runBatch(this.takeBatch(), lang);
    }
  }

  private takeBatch(): Segment[] {
    const scored = [...this.queue].map((seg) => {
      const { top, bottom } = seg.parent.getBoundingClientRect();
      const inMainContent = isInMainContent(seg.parent);
      return { seg, score: priorityScore({ top, bottom, inMainContent }, innerHeight) };
    });
    scored.sort((a, b) => a.score - b.score);
    const batch = packBatch(
      scored.map(({ seg }) => seg),
      (seg) => seg.serialized.markup.length,
    );
    for (const seg of batch) this.transition(seg, "pending");
    return batch;
  }

  private async runBatch(batch: Segment[], lang: LanguageCode) {
    this.running++;
    try {
      await this.translateBatch(batch, lang);
    } finally {
      this.running--;
      this.schedulePump();
    }
  }

  private async translateBatch(batch: Segment[], lang: LanguageCode) {
    const token = ++this.batchCounter;
    for (const seg of batch) seg.batch = token;
    const mine = (seg: Segment) => seg.batch === token && seg.state === "pending";
    const pageUrl = location.href;
    const keyOf = (seg: Segment) => cacheKey(lang, pageUrl, seg.serialized.markup);

    const cached = await lookupCache(batch.map(keyOf));
    batch.forEach((seg, i) => {
      const hit = cached[i];
      if (hit != null && mine(seg)) this.applyResult(seg, hit, lang);
    });
    const misses = batch.filter(mine);
    if (misses.length === 0) return;

    const handle = requestTranslation(
      {
        instructions: pageInstructions(lang, pageContext()),
        input: encodeBatch(misses.map((seg) => seg.serialized.markup)),
      },
      createBatchDecoder((index, markup) => {
        const seg = misses[index];
        if (!seg || !mine(seg)) return;
        this.applyResult(seg, markup, lang);
        // バッチの完了を待って書き込むと、途中でページを離れたときに訳せた分まで失われる
        storeCache({ key: keyOf(seg), translation: markup });
      }),
    );
    this.inflight.add(handle);
    try {
      await handle.done;
    } catch (e) {
      if (e instanceof StreamCancelled) return;
      if (!(e instanceof TranslateFailure)) throw e;
      if (FAILURE_POLICY[e.kind].fatal) {
        for (const seg of misses) if (mine(seg)) this.transition(seg, "failed");
        this.stop();
        this.hooks.onFatalFailure(e);
        return;
      }
    } finally {
      this.inflight.delete(handle);
    }
    // 一時的な失敗のほか、モデルが一部の seg を出力しなかった場合も含む
    const missing = misses.filter(mine);
    for (const seg of missing) this.transition(seg, "failed");
    if (missing.length && !this.partialFailureNotified) {
      this.partialFailureNotified = true;
      this.hooks.onPartialFailure();
    }
  }

  private applyResult(seg: Segment, markup: string, lang: LanguageCode) {
    seg.applyTranslation(markup, lang);
    this.transition(seg, "done");
    for (const node of seg.ownedNodes()) this.owner.set(node, seg);
    this.render(seg);
  }

  private adjustPending(el: Element, delta: number) {
    const count = (this.pendingCount.get(el) ?? 0) + delta;
    if (count > 0) {
      this.pendingCount.set(el, count);
      if (this.hooks.getSettings().highlightPending) setPending(el, true);
    } else {
      this.pendingCount.delete(el);
      setPending(el, false);
    }
  }
}
