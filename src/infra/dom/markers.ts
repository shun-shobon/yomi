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

const savedLang = new WeakMap<Element, { lang: string | null; dir: string | null }>();

export function setContentLang(el: Element, lang: string) {
  if (!savedLang.has(el)) {
    savedLang.set(el, { lang: el.getAttribute("lang"), dir: el.getAttribute("dir") });
  }
  el.setAttribute("lang", lang);
  el.setAttribute("dir", "auto");
}

export function restoreContentLang(el: Element) {
  const saved = savedLang.get(el);
  if (!saved) return;
  savedLang.delete(el);
  for (const [name, value] of Object.entries(saved)) {
    if (value == null) el.removeAttribute(name);
    else el.setAttribute(name, value);
  }
}

export function setPending(el: Element, pending: boolean) {
  if (pending) el.setAttribute(PENDING_ATTR, "");
  else el.removeAttribute(PENDING_ATTR);
}

let style: HTMLStyleElement | null = null;

export function ensurePendingStyle() {
  if (style == null || !style.isConnected) {
    style = document.createElement("style");
    style.textContent = pendingCss;
    document.head.append(style);
  }
}

export function isInMainContent(el: Element): boolean {
  return el.closest("main, [role=main], article") != null;
}
