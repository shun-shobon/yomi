export type Showing = "translation" | "original";

export interface PageState {
  /** 翻訳セッションが有効で、スクロールや DOM 変化に追従して翻訳し続けている */
  active: boolean;
  showing: Showing;
  /** 翻訳待ち + 翻訳中のセグメント数 */
  busy: number;
  done: number;
  failed: number;
}
