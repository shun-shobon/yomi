/** ページ上に重ねる UI。usecases はこのインターフェース越しに表示を指示し、描画方法には関知しない */
export interface Overlay {
  /** イベントの発生元がこの UI か。ページ側の操作と区別するのに使う */
  isOwnTarget(target: EventTarget | null): boolean;
  /** エラーや操作ボタン付きのトーストはユーザーが閉じるまで残す */
  toast(message: string, opts?: ToastOptions): void;
  showTooltip(anchor: DOMRect, label: string, text: string): void;
  hideTooltip(): void;
  showSelectionButton(anchor: DOMRect, label: string, onClick: () => void): void;
  hideSelectionButton(): void;
  readonly selectionButtonShown: boolean;
  openPanel(anchor: DOMRect, title: string, onClose: () => void): TranslationPanel;
}

export interface ToastOptions {
  error?: boolean;
  action?: { label: string; onClick: () => void };
}

export type PanelState =
  | { status: "translating"; text: string }
  | { status: "done"; text: string }
  | { status: "failed"; message: string };

export interface TranslationPanel {
  update(state: PanelState): void;
  remove(): void;
}
