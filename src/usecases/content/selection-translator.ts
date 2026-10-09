import { TranslateFailure } from "@/domain/failure";
import { LANGUAGES } from "@/domain/languages";
import { selectionInstructions } from "@/domain/prompts";
import type { Settings } from "@/domain/settings";
import { currentSelection } from "@/infra/dom/selection";
import {
  requestTranslation,
  StreamCancelled,
  type StreamHandle,
} from "@/infra/messaging/translation-stream";

import type { Overlay, TranslationPanel } from "./overlay";

const MAX_SELECTION_CHARS = 8000;
/** 右クリックメニュー経由で選択範囲の位置が取れない場合の、パネルの基準位置 */
const FALLBACK_TOP = 16;

export interface SelectionHooks {
  getSettings: () => Settings;
  onFailure: (failure: TranslateFailure) => void;
}

export class SelectionTranslator {
  private session: { panel: TranslationPanel; stream: StreamHandle } | null = null;

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
      if (this.overlay.selectionButtonShown && !currentSelection()) {
        this.overlay.hideSelectionButton();
      }
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
    this.open(text, currentSelection()?.rect ?? new DOMRect(innerWidth / 2, FALLBACK_TOP, 0, 0));
  }

  private onMouseDown(e: MouseEvent) {
    if (this.overlay.isOwnTarget(e.target)) return;
    this.closeAll();
  }

  private onMouseUp(e: MouseEvent) {
    if (this.overlay.isOwnTarget(e.target) || !this.hooks.getSettings().showSelectionButton) {
      return;
    }
    // mouseup 直後はまだ選択範囲が確定していないことがある
    setTimeout(() => {
      const sel = currentSelection();
      if (!sel) return;
      this.overlay.showSelectionButton(sel.rect, `${this.targetLabel()}に翻訳`, () => {
        this.overlay.hideSelectionButton();
        this.translateCurrent();
      });
    }, 0);
  }

  private targetLabel(): string {
    return LANGUAGES[this.hooks.getSettings().targetLang].label;
  }

  private open(text: string, anchor: DOMRect) {
    this.closePanel();
    const source = text.trim().slice(0, MAX_SELECTION_CHARS);
    if (!source) return;

    const panel = this.overlay.openPanel(anchor, `翻訳 → ${this.targetLabel()}`, () =>
      this.closePanel(),
    );
    panel.update({ status: "translating", text: "" });

    let result = "";
    const stream = requestTranslation(
      { instructions: selectionInstructions(this.hooks.getSettings().targetLang), input: source },
      (delta) => {
        result += delta;
        panel.update({ status: "translating", text: result });
      },
    );
    this.session = { panel, stream };

    stream.done.then(
      () => panel.update({ status: "done", text: result.trim() }),
      (e: unknown) => {
        if (e instanceof StreamCancelled) return;
        if (!(e instanceof TranslateFailure)) throw e;
        panel.update({ status: "failed", message: e.message });
        this.hooks.onFailure(e);
      },
    );
  }

  private closePanel() {
    this.session?.stream.cancel();
    this.session?.panel.remove();
    this.session = null;
  }

  private closeAll() {
    this.overlay.hideSelectionButton();
    this.closePanel();
  }
}
