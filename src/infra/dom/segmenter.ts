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

function hasSkippedAncestor(el: Element): boolean {
	for (let ancestor = el.parentElement; ancestor; ancestor = ancestor.parentElement) {
		if (SKIP_TAGS.has(ancestor.tagName) || isExcluded(ancestor)) return true;
	}
	return false;
}

/** 表示状態は後から変わるので、キャッシュする isInline の判定には非表示のインラインを含めない */
function isOpaque(el: Element): boolean {
	return ATOMIC_TAGS.has(el.tagName) || isExcluded(el);
}

export function isAtomic(el: Element): boolean {
	return isOpaque(el) || isHiddenInline(el);
}

// getComputedStyle の戻り値は生きたオブジェクトなので、保持しておけば表示状態が変わっても今の値を読める
const inlineStyles = new WeakMap<Element, CSSStyleDeclaration | null>();

function inlineStyle(el: Element): CSSStyleDeclaration | null {
	const cached = inlineStyles.get(el);
	if (cached !== undefined) return cached;
	const style = INLINE_TAGS.has(el.tagName) ? getComputedStyle(el) : null;
	const result =
		(style?.display === "inline" || style?.display === "contents") &&
		Array.from(el.children).every((child) => isOpaque(child) || isInline(child))
			? style
			: null;
	inlineStyles.set(el, result);
	return result;
}

function isInline(el: Element): boolean {
	return inlineStyle(el) != null;
}

/** 祖先のブロックは走査で表示を確かめ、隠れたインラインの中には立ち入らないので、自身の指定だけ見れば足りる */
function isHiddenInline(el: Element): boolean {
	const style = inlineStyle(el);
	return (
		style != null &&
		(style.visibility === "hidden" || style.visibility === "collapse" || style.opacity === "0")
	);
}

/** visibility は子孫で visible に戻せるので、子孫まで隠れる "hidden" と自身の文章だけ隠れる "ownText" を分ける */
type Hiding = "none" | "ownText" | "hidden";

function hidingOf(el: Element): Hiding {
	if (el.checkVisibility({ visibilityProperty: true, opacityProperty: true })) {
		// 閉じた details が隠す直下のテキストは、details 自身の表示状態には現れない
		return el instanceof HTMLDetailsElement && !el.open ? "ownText" : "none";
	}
	const style = getComputedStyle(el);
	if (style.display === "contents") {
		// 自身のボックスを持たず checkVisibility() が常に false になるので、直下のテキストは親の状態に従う
		const parent = el.parentElement ? hidingOf(el.parentElement) : "none";
		if (parent === "hidden") return "hidden";
		return parent === "none" && style.visibility === "visible" ? "none" : "ownText";
	}
	return el.checkVisibility({ opacityProperty: true }) ? "ownText" : "hidden";
}

export function isHidden(el: Element): boolean {
	return hidingOf(el) !== "none";
}

// white-space-collapse と text-wrap-mode の組み合わせによっては "preserve-breaks nowrap" のような値になる
const KEEPS_NEWLINES = /^(pre|pre-wrap|pre-line|break-spaces|preserve|preserve-breaks)(?![\w-])/u;

export function keepsNewlines(el: Element): boolean {
	return KEEPS_NEWLINES.test(getComputedStyle(el).whiteSpace);
}

const LETTER = /\p{L}/u;

function hasTranslatableText(nodes: Node[]): boolean {
	return nodes.some(
		(node) =>
			(node instanceof Text || (node instanceof Element && !isAtomic(node))) &&
			LETTER.test(node.textContent),
	);
}

function isBlank(node: Node): boolean {
	return node instanceof Text && !node.data.trim();
}

export function collectRuns(
	root: Element,
	known: (node: Node) => boolean,
	onHidden: (el: Element) => void,
): Run[] {
	const runs: Run[] = [];

	const watchHiddenInlines = (el: Element) => {
		if (isOpaque(el)) return;
		if (isHiddenInline(el)) onHidden(el);
		else for (const child of el.children) watchHiddenInlines(child);
	};

	const visit = (el: Element) => {
		if (SKIP_TAGS.has(el.tagName) || isExcluded(el)) return;
		const hiding = el === document.body ? "none" : hidingOf(el);
		if (hiding === "hidden") {
			onHidden(el);
			return;
		}

		let run: Node[] = [];
		const flush = () => {
			const start = run.findIndex((n) => !isBlank(n));
			const end = run.findLastIndex((n) => !isBlank(n));
			const [first, ...rest] = run.slice(start, end + 1);
			if (start !== -1 && first && hasTranslatableText(run)) {
				if (hiding === "none") runs.push({ parent: el, nodes: [first, ...rest] });
				else onHidden(el);
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
					if (hiding === "none") watchHiddenInlines(child);
				} else {
					flush();
					visit(child);
				}
			}
		}
		flush();
	};

	// DOM の変更で再走査するときは途中の要素から始まるので、祖先の除外指定は visit では見えない
	if (!hasSkippedAncestor(root)) visit(root);
	return runs;
}

export function blockAncestor(node: Node): Element | null {
	let el = node instanceof Element ? node : node.parentElement;
	while (el && el !== document.body && (isInline(el) || isAtomic(el))) {
		el = el.parentElement;
	}
	return el;
}
