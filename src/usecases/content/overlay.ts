export interface Overlay {
  isOwnTarget(target: EventTarget | null): boolean;
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
