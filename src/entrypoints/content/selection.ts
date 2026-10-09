import { TranslateFailure } from "@/domain/failure";
import { LANGUAGES } from "@/domain/languages";
import type { Settings } from "@/domain/settings";

import type { Overlay, PagePosition } from "./overlay";
import { selectionInstructions } from "./prompts";
import { requestTranslation, StreamCancelled, type StreamHandle } from "./stream";

const MAX_SELECTION_CHARS = 8000;
const BUTTON_SIZE = 30;
const PANEL_MAX_WIDTH = 440;
/** パネルを選択範囲の上下どちらに出すかの判定に使う見込みの高さ */
const PANEL_ESTIMATED_HEIGHT = 160;
const COPIED_FEEDBACK_MS = 1500;

const TRANSLATE_ICON = `<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="m5 8 6 6"/><path d="m4 14 6-6 2-3"/><path d="M2 5h12"/><path d="M7 2h1"/><path d="m22 22-5-10-5 10"/><path d="M14 18h6"/></svg>`;

const PANEL_HTML = `
  <header><span class="title"></span><button class="icon-btn close" aria-label="閉じる">✕</button></header>
  <div class="body" aria-live="polite"><span class="dots"><i></i><i></i><i></i></span></div>
  <footer><span class="status">翻訳中…</span><span class="spacer"></span><button class="copy" hidden>コピー</button></footer>`;

export interface SelectionHooks {
  getSettings: () => Settings;
  onFailure: (failure: TranslateFailure) => void;
}

export class SelectionTranslator {
  private button: HTMLButtonElement | null = null;
  private panel: { el: HTMLDivElement; stream: StreamHandle } | null = null;

  constructor(
    private readonly overlay: Overlay,
    private readonly hooks: SelectionHooks,
  ) {
    document.addEventListener("mouseup", (e) => this.onMouseUp(e), true);
    document.addEventListener("mousedown", (e) => this.onMouseDown(e), true);
    document.addEventListener("keydown", (e) => {
      if (e.key === "Escape") this.closeAll();
    });
    document.addEventListener("selectionchange", () => {
      if (this.button && !currentSelection()) this.hideButton();
    });
  }

  /** 現在の選択範囲を翻訳する。選択がなければ false */
  translateCurrent(): boolean {
    const sel = currentSelection();
    if (!sel) return false;
    this.open(sel.text, sel.rect);
    return true;
  }

  /** 右クリックメニュー経由。選択範囲の位置が取れない場合は画面上部中央に出す */
  translateText(text: string) {
    const rect =
      currentSelection()?.rect ??
      new DOMRect(innerWidth / 2 - PANEL_MAX_WIDTH / 2, 16, PANEL_MAX_WIDTH, 0);
    this.open(text, rect);
  }

  private onMouseDown(e: MouseEvent) {
    if (this.overlay.isHost(e.target)) return;
    this.closeAll();
  }

  private onMouseUp(e: MouseEvent) {
    if (this.overlay.isHost(e.target) || !this.hooks.getSettings().showSelectionButton) return;
    // mouseup 直後はまだ選択範囲が確定していないことがある
    setTimeout(() => {
      const sel = currentSelection();
      if (sel) this.showButton(sel.rect);
    }, 0);
  }

  private targetLabel(): string {
    return LANGUAGES[this.hooks.getSettings().targetLang].label;
  }

  private showButton(rect: DOMRect) {
    this.hideButton();
    const btn = document.createElement("button");
    btn.className = "sel-btn";
    btn.title = `${this.targetLabel()}に翻訳`;
    btn.setAttribute("aria-label", btn.title);
    btn.innerHTML = TRANSLATE_ICON;
    // 選択範囲を解除させない
    btn.addEventListener("mousedown", (e) => e.preventDefault());
    btn.addEventListener("click", () => {
      this.hideButton();
      this.translateCurrent();
    });
    this.overlay.place(btn, placeNear(rect, BUTTON_SIZE, BUTTON_SIZE));
    this.button = btn;
  }

  private hideButton() {
    this.button?.remove();
    this.button = null;
  }

  private open(text: string, rect: DOMRect) {
    this.closePanel();
    const source = text.trim().slice(0, MAX_SELECTION_CHARS);
    if (!source) return;

    const el = document.createElement("div");
    el.className = "panel";
    el.setAttribute("role", "dialog");
    el.innerHTML = PANEL_HTML;
    const q = <T extends Element>(selector: string) => el.querySelector<T>(selector)!;
    q("header .title").textContent = `翻訳 → ${this.targetLabel()}`;
    q("button.close").addEventListener("click", () => this.closePanel());
    const body = q<HTMLDivElement>(".body");
    const status = q<HTMLSpanElement>(".status");
    const copy = q<HTMLButtonElement>("button.copy");
    this.overlay.place(
      el,
      placeNear(rect, Math.min(PANEL_MAX_WIDTH, innerWidth - 24), PANEL_ESTIMATED_HEIGHT),
    );

    let result = "";
    const stream = requestTranslation(
      { instructions: selectionInstructions(this.hooks.getSettings().targetLang), input: source },
      (delta) => {
        if (!result) body.classList.add("cursor");
        result += delta;
        body.textContent = result;
      },
    );
    this.panel = { el, stream };

    stream.done.then(
      () => {
        const translation = result.trim();
        body.classList.remove("cursor");
        body.textContent = translation;
        status.textContent = "";
        copy.hidden = false;
        copy.addEventListener("click", () => {
          void navigator.clipboard.writeText(translation).then(() => {
            copy.textContent = "コピーしました";
            copy.classList.add("copied");
            setTimeout(() => {
              copy.textContent = "コピー";
              copy.classList.remove("copied");
            }, COPIED_FEEDBACK_MS);
          });
        });
      },
      (e: unknown) => {
        if (e instanceof StreamCancelled) return;
        if (!(e instanceof TranslateFailure)) throw e;
        body.classList.remove("cursor");
        body.classList.add("error");
        body.textContent = e.message;
        status.textContent = "";
        this.hooks.onFailure(e);
      },
    );
  }

  private closePanel() {
    this.panel?.stream.cancel();
    this.panel?.el.remove();
    this.panel = null;
  }

  private closeAll() {
    this.hideButton();
    this.closePanel();
  }
}

function currentSelection(): { text: string; rect: DOMRect } | null {
  const sel = getSelection();
  if (!sel || sel.isCollapsed || sel.rangeCount === 0) return null;
  const text = sel.toString().trim();
  if (!text) return null;
  const anchor = sel.anchorNode instanceof Element ? sel.anchorNode : sel.anchorNode?.parentElement;
  // 入力欄内の選択は編集操作の邪魔になるので対象外
  if (anchor?.closest("input, textarea, [contenteditable=''], [contenteditable=true]")) return null;
  const range = sel.getRangeAt(0);
  const rects = range.getClientRects();
  return { text, rect: rects[rects.length - 1] ?? range.getBoundingClientRect() };
}

/** 選択範囲の直下に置く。下に収まらなければ上に反転する */
function placeNear(rect: DOMRect, width: number, height: number): PagePosition {
  const gap = 8;
  const top =
    rect.bottom + gap + height <= innerHeight
      ? rect.bottom + gap
      : Math.max(8, rect.top - gap - height);
  const left = Math.max(
    8,
    Math.min(rect.right - width / 2, document.documentElement.clientWidth - width - 8),
  );
  return { left: left + scrollX, top: top + scrollY };
}
