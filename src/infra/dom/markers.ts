import pendingCss from "./pending.css?inline";

const TRANSLATED_ATTR = "data-gt-tr";
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

export function isInMainContent(el: Element): boolean {
  return el.closest("main, [role=main], article") !== null;
}
