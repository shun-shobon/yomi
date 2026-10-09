/** 翻訳の対象外とする要素。子孫も含めて走査しない */
const SKIP_TAGS = new Set([
  "SCRIPT",
  "STYLE",
  "NOSCRIPT",
  "TEMPLATE",
  "HEAD",
  "TITLE",
  "META",
  "LINK",
  "TEXTAREA",
  "INPUT",
  "SELECT",
  "OPTION",
  "PRE",
  "CODE",
  "KBD",
  "SAMP",
  "VAR",
  "MATH",
  "SVG",
  "CANVAS",
  "VIDEO",
  "AUDIO",
  "IFRAME",
  "OBJECT",
  "EMBED",
  "IMG",
  "PICTURE",
]);

/** 文中に現れ、前後の文と一続きで翻訳すべき要素 */
const INLINE_TAGS = new Set([
  "A",
  "ABBR",
  "B",
  "BDI",
  "BDO",
  "BIG",
  "CITE",
  "DATA",
  "DEL",
  "DFN",
  "EM",
  "FONT",
  "I",
  "INS",
  "LABEL",
  "MARK",
  "Q",
  "S",
  "SMALL",
  "SPAN",
  "STRONG",
  "SUB",
  "SUP",
  "TIME",
  "TT",
  "U",
]);

/** 文中にあっても中身を訳さず、位置だけ保つ要素 */
const ATOMIC_TAGS = new Set([
  "BR",
  "WBR",
  "IMG",
  "CODE",
  "KBD",
  "SAMP",
  "VAR",
  "MATH",
  "SVG",
  "INPUT",
  "PICTURE",
]);

/** 1 つの親要素の直下で連続するノード列。翻訳の最小単位 */
export interface Run {
  parent: Element;
  nodes: [Node, ...Node[]];
}

function isExcluded(el: Element): boolean {
  return (
    el.getAttribute("translate") === "no" ||
    el.classList.contains("notranslate") ||
    el.getAttribute("aria-hidden") === "true" ||
    el.hasAttribute("hidden") ||
    (el instanceof HTMLElement && el.isContentEditable)
  );
}

export function isAtomic(el: Element): boolean {
  return ATOMIC_TAGS.has(el.tagName) || isExcluded(el);
}

const inlineCache = new WeakMap<Element, boolean>();

function isInline(el: Element): boolean {
  const cached = inlineCache.get(el);
  if (cached !== undefined) return cached;
  const display = INLINE_TAGS.has(el.tagName) ? getComputedStyle(el).display : null;
  const result =
    (display === "inline" || display === "contents") &&
    Array.from(el.children).every((child) => isAtomic(child) || isInline(child));
  inlineCache.set(el, result);
  return result;
}

/** display: contents の要素は自身のボックスを持たず checkVisibility() が false になるが、子は表示されている */
export function isHidden(el: Element): boolean {
  return !el.checkVisibility() && getComputedStyle(el).display !== "contents";
}

const LETTER = /\p{L}/u;

function hasTranslatableText(nodes: Node[]): boolean {
  return nodes.some(
    (node) =>
      (node instanceof Text || (node instanceof Element && !isAtomic(node))) &&
      LETTER.test(node.textContent ?? ""),
  );
}

function isBlank(node: Node): boolean {
  return node instanceof Text && !node.data.trim();
}

/**
 * root 配下から翻訳単位を集める。
 * known に含まれるノード（翻訳済み・処理中）は区切りとして扱い、新しく現れたノードだけを拾う。
 * 非表示の部分木は訳さず、表示されたときに拾えるよう onHidden で知らせる。
 */
export function collectRuns(
  root: Element,
  known: (node: Node) => boolean,
  onHidden: (el: Element) => void,
): Run[] {
  const runs: Run[] = [];

  const visit = (el: Element) => {
    if (SKIP_TAGS.has(el.tagName) || isExcluded(el)) return;
    if (el !== document.body && isHidden(el)) {
      onHidden(el);
      return;
    }

    let run: Node[] = [];
    const flush = () => {
      const start = run.findIndex((n) => !isBlank(n));
      const end = run.findLastIndex((n) => !isBlank(n));
      const [first, ...rest] = run.slice(start, end + 1);
      if (start !== -1 && first && hasTranslatableText(run)) {
        runs.push({ parent: el, nodes: [first, ...rest] });
      }
      run = [];
    };

    for (const child of Array.from(el.childNodes)) {
      if (known(child)) {
        flush();
      } else if (child instanceof Text) {
        run.push(child);
      } else if (child instanceof Element) {
        if (isAtomic(child) || isInline(child)) {
          run.push(child);
        } else {
          flush();
          visit(child);
        }
      }
    }
    flush();
  };

  visit(root);
  return runs;
}

/** 追加・変更されたノードを含む最も近いブロック要素 */
export function blockAncestor(node: Node): Element | null {
  let el = node instanceof Element ? node : node.parentElement;
  while (el && el !== document.body && (isInline(el) || isAtomic(el))) {
    el = el.parentElement;
  }
  return el;
}
