import type { LanguageCode } from "@/utils/languages";
import { TranslateFailure, type PageState } from "@/utils/messages";
import type { Settings } from "@/utils/settings";

import { DomWatcher } from "./dom-watcher";
import { FAILURE_POLICY } from "./failure-policy";
import pendingCss from "./page-translator.css?inline";
import { pageInstructions } from "./prompts";
import { Segment, type SegmentState, type Showing } from "./segment";
import { collectRuns } from "./segmenter";
import { requestTranslation, StreamCancelled, type StreamHandle } from "./stream";

const MAX_CONCURRENCY = 4;
const BATCH_MAX_CHARS = 2000;
const BATCH_MAX_SEGMENTS = 25;
/** 閉じタグが欠けた seg が次の seg を飲み込まないよう、内容に <seg を含ませない */
const SEG_PATTERN = /<seg id="?(\d+)"?>((?:(?!<seg[\s>])[\s\S])*?)<\/seg>/g;

export interface PageTranslatorHooks {
  getSettings: () => Settings;
  onFatalFailure: (failure: TranslateFailure) => void;
  /** 翻訳できなかった部分がある。翻訳セッションごとに 1 回だけ呼ぶ */
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
  private pumpScheduled = false;
  private partialFailureNotified = false;
  private style: HTMLStyleElement | null = null;
  private readonly watcher: DomWatcher;

  constructor(private readonly hooks: PageTranslatorHooks) {
    this.watcher = new DomWatcher({
      isOwn: (node) => this.owner.has(node),
      onEnterView: (el) => {
        for (const seg of this.byParent.get(el) ?? []) this.enqueue(seg);
      },
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
    const counts: Record<SegmentState, number> = {
      idle: 0,
      queued: 0,
      pending: 0,
      done: 0,
      failed: 0,
    };
    for (const [parent, segs] of this.byParent) {
      if (parent.isConnected) for (const seg of segs) counts[seg.state]++;
    }
    return {
      active: this.active,
      showing: this.showing,
      busy: counts.queued + counts.pending,
      done: counts.done,
      failed: counts.failed,
    };
  }

  /** 翻訳を開始する。原文表示中なら訳文に戻して再開し、翻訳先の言語が変わっていれば最初から訳し直す */
  start() {
    const { targetLang } = this.hooks.getSettings();
    if (this.lang !== null && this.lang !== targetLang) this.reset();
    this.lang = targetLang;
    if (this.showing === "original") this.renderAll("translation");
    if (this.active) return;
    this.active = true;
    this.partialFailureNotified = false;
    this.ensureStyle();
    this.scan(document.body);
    for (const seg of this.segments()) if (seg.state === "failed") this.transition(seg, "idle");
    this.watcher.start(this.byParent.keys());
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
    const anchor = target.closest("[data-gt-tr]");
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
    for (const parent of this.byParent.keys()) parent.removeAttribute("data-gt-tr");
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
    this.watcher.observe(seg.parent);
    if (this.watcher.isVisible(seg.parent)) this.enqueue(seg);
  }

  /** ページ側が内容を書き換えたセグメントを破棄し、次の再スキャンで新しいセグメントとして拾い直す */
  private discard(seg: Segment) {
    seg.revert();
    this.transition(seg, "idle");
    this.byParent.get(seg.parent)?.delete(seg);
    for (const node of seg.ownedNodes()) this.owner.delete(node);
    this.watcher.markDirty(seg.parent);
  }

  /** DOM から外れたセグメントを捨てる。SPA や無限スクロールでのメモリ増加を防ぐ */
  private prune() {
    for (const [parent, segs] of this.byParent) {
      if (parent.isConnected) continue;
      for (const seg of segs) this.transition(seg, "idle");
      this.byParent.delete(parent);
      this.watcher.unobserve(parent);
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
    while (this.inflight.size < MAX_CONCURRENCY && this.queue.size > 0) {
      void this.runBatch(this.takeBatch(), lang);
    }
  }

  /** ビューポート上部 30% 付近に近いものから順に、文字数上限までまとめる */
  private takeBatch(): Segment[] {
    const anchorY = innerHeight * 0.3;
    const scored = [...this.queue].map((seg) => {
      const rect = seg.parent.getBoundingClientRect();
      const inView = rect.bottom > 0 && rect.top < innerHeight;
      let score = inView
        ? Math.abs(Math.min(Math.max(anchorY, rect.top), rect.bottom) - anchorY)
        : 100_000 + Math.min(Math.abs(rect.top - innerHeight), Math.abs(rect.bottom));
      if (seg.parent.closest("main, [role=main], article")) score -= 300;
      return { seg, score };
    });
    scored.sort((a, b) => a.score - b.score);

    const batch: Segment[] = [];
    let chars = 0;
    for (const { seg } of scored) {
      if (batch.length >= BATCH_MAX_SEGMENTS) break;
      const size = seg.serialized.markup.length;
      if (batch.length > 0 && chars + size > BATCH_MAX_CHARS) continue;
      batch.push(seg);
      chars += size;
    }
    for (const seg of batch) this.transition(seg, "pending");
    return batch;
  }

  private async runBatch(batch: Segment[], lang: LanguageCode) {
    const token = ++this.batchCounter;
    for (const seg of batch) seg.batch = token;
    const mine = (seg: Segment) => seg.batch === token && seg.state === "pending";
    const input = batch
      .map((seg, i) => `<seg id="${i + 1}">${seg.serialized.markup}</seg>`)
      .join("\n");
    let buffer = "";
    let cursor = 0;
    const handle = requestTranslation(
      { instructions: pageInstructions(lang, document.title), input },
      (delta) => {
        buffer += delta;
        SEG_PATTERN.lastIndex = cursor;
        for (let m = SEG_PATTERN.exec(buffer); m; m = SEG_PATTERN.exec(buffer)) {
          cursor = SEG_PATTERN.lastIndex;
          const seg = batch[Number(m[1]) - 1];
          if (seg && mine(seg)) this.applyResult(seg, m[2]!);
        }
      },
    );
    this.inflight.add(handle);
    try {
      await handle.done;
    } catch (e) {
      if (e instanceof StreamCancelled) return;
      if (!(e instanceof TranslateFailure)) throw e;
      if (FAILURE_POLICY[e.kind].fatal) {
        for (const seg of batch) if (mine(seg)) this.transition(seg, "failed");
        this.stop();
        this.hooks.onFatalFailure(e);
        return;
      }
    } finally {
      this.inflight.delete(handle);
    }
    // 一時的な失敗のほか、モデルが一部の seg を出力しなかった場合も含む
    const missing = batch.filter(mine);
    for (const seg of missing) this.transition(seg, "failed");
    if (missing.length && !this.partialFailureNotified) {
      this.partialFailureNotified = true;
      this.hooks.onPartialFailure();
    }
    this.schedulePump();
  }

  private applyResult(seg: Segment, markup: string) {
    seg.applyTranslation(markup);
    this.transition(seg, "done");
    for (const node of seg.ownedNodes()) this.owner.set(node, seg);
    this.render(seg);
  }

  private adjustPending(el: Element, delta: number) {
    const count = (this.pendingCount.get(el) ?? 0) + delta;
    if (count > 0) {
      this.pendingCount.set(el, count);
      if (this.hooks.getSettings().highlightPending) el.setAttribute("data-gt-pending", "");
    } else {
      this.pendingCount.delete(el);
      el.removeAttribute("data-gt-pending");
    }
  }

  private ensureStyle() {
    if (this.style?.isConnected) return;
    this.style = document.createElement("style");
    this.style.textContent = pendingCss;
    document.head.append(this.style);
  }
}
