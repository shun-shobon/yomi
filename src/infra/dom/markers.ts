import pendingCss from "./pending.css?inline";

/** 翻訳済みのテキストを含む要素。ホバーで原文を出す対象 */
const TRANSLATED_ATTR = "data-gt-tr";
/** 翻訳中のテキストを含む要素。ハイライト表示に使う */
const PENDING_ATTR = "data-gt-pending";

export function markTranslated(el: Element) {
  el.setAttribute(TRANSLATED_ATTR, "");
}

export function unmarkTranslated(el: Element) {
  el.removeAttribute(TRANSLATED_ATTR);
}

export function translatedAncestor(el: Element): Element | null {
  return el.closest(`[${TRANSLATED_ATTR}]`);
}

export function setPending(el: Element, pending: boolean) {
  if (pending) el.setAttribute(PENDING_ATTR, "");
  else el.removeAttribute(PENDING_ATTR);
}

let style: HTMLStyleElement | null = null;

export function ensurePendingStyle() {
  if (style?.isConnected) return;
  style = document.createElement("style");
  style.textContent = pendingCss;
  document.head.append(style);
}

/** main / article など、本文と思われる領域の中にあるか */
export function isInMainContent(el: Element): boolean {
  return el.closest("main, [role=main], article") !== null;
}
