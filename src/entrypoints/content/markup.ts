import { isAtomic, type Run } from "./segmenter";

/**
 * ノード列 ⇄ 翻訳用マークアップの相互変換。
 * インライン要素は属性を落とした <gN>…</gN>、訳さない要素は <xN/> に置き換えてモデルに渡す。
 * モデル出力は HTML として解釈せず、テキストノードの生成と既存要素の複製だけで組み立てるので XSS にならない。
 */

/** タグとタグの間のテキスト領域。訳文を書き込む単位 */
export interface Slot {
  texts: Text[];
  /** 元のテキストノードが無い位置に訳文を入れる場合の挿入先 */
  parent: Node;
  before: Node | null;
}

export interface Serialized {
  markup: string;
  placeholders: Element[];
  /** タグ列（例: "g0 /g0 x1"）。訳文のタグ列が一致すれば要素を動かさずにテキストだけ書き換えられる */
  structure: string;
  slots: Slot[];
}

export function serialize({ parent, nodes }: Run): Serialized {
  const placeholders: Element[] = [];
  const tags: string[] = [];
  const slots: Slot[] = [{ texts: [], parent, before: nodes[0] }];
  const openSlot = (p: Node, before: Node | null) => slots.push({ texts: [], parent: p, before });

  const walk = (list: Iterable<Node>): string => {
    let out = "";
    for (const node of list) {
      if (node instanceof Text) {
        out += escapeText(node.data.replace(/\s+/g, " "));
        slots.at(-1)!.texts.push(node);
      } else if (node instanceof Element) {
        const id = placeholders.push(node) - 1;
        if (isAtomic(node)) {
          out += `<x${id}/>`;
          tags.push(`x${id}`);
        } else {
          tags.push(`g${id}`);
          openSlot(node, node.firstChild);
          out += `<g${id}>${walk(node.childNodes)}</g${id}>`;
          tags.push(`/g${id}`);
        }
        openSlot(node.parentNode!, node.nextSibling);
      }
    }
    return out;
  };
  const markup = walk(nodes).trim();
  return { markup, placeholders, structure: tags.join(" "), slots };
}

type Token =
  | { type: "text"; text: string }
  | { type: "tag"; kind: "open" | "close" | "atomic"; id: number };

const TAG = /<(\/?)([gx])(\d+)\s*\/?>/g;

function* tokenize(markup: string): Generator<Token> {
  let last = 0;
  for (const match of markup.matchAll(TAG)) {
    yield { type: "text", text: decodeEntities(markup.slice(last, match.index)) };
    last = match.index + match[0].length;
    const [, slash, letter, id] = match;
    yield {
      type: "tag",
      kind: letter === "x" ? "atomic" : slash ? "close" : "open",
      id: Number(id),
    };
  }
  yield { type: "text", text: decodeEntities(markup.slice(last)) };
}

const tagName = (token: Extract<Token, { type: "tag" }>) =>
  `${token.kind === "close" ? "/" : ""}${token.kind === "atomic" ? "x" : "g"}${token.id}`;

/** 訳文をタグ列と、タグの間のテキスト列に分ける。テキスト列の長さは常にタグ数 + 1 */
export function parse(markup: string): { structure: string; texts: string[] } {
  const tags: string[] = [];
  const texts: string[] = [];
  for (const token of tokenize(markup)) {
    if (token.type === "text") texts.push(token.text);
    else tags.push(tagName(token));
  }
  return { structure: tags.join(" "), texts };
}

/** タグ構造が変わった訳文を、元要素の複製で組み立てる */
export function build(markup: string, placeholders: Element[]): DocumentFragment {
  const fragment = document.createDocumentFragment();
  const stack: { node: Node; id: number }[] = [{ node: fragment, id: -1 }];
  const used = new Set<number>();
  const top = () => stack.at(-1)!.node;

  for (const token of tokenize(markup)) {
    if (token.type === "text") {
      if (token.text) top().appendChild(document.createTextNode(token.text));
      continue;
    }
    if (token.kind === "close") {
      const depth = stack.findLastIndex((s) => s.id === token.id);
      if (depth > 0) stack.length = depth;
      continue;
    }
    // モデルが存在しない id や同じ id を重複して出力した場合は、そのタグを捨てて中身のテキストだけ残す
    const original = placeholders[token.id];
    if (!original || used.has(token.id)) continue;
    used.add(token.id);
    if (token.kind === "atomic") {
      top().appendChild(original.cloneNode(true));
    } else {
      const el = original.cloneNode(false);
      top().appendChild(el);
      stack.push({ node: el, id: token.id });
    }
  }

  // モデルが落とした画像やコード片を消さないよう、末尾に補う
  placeholders.forEach((el, id) => {
    if (!used.has(id) && isAtomic(el) && !placeholders.some((p) => p !== el && p.contains(el))) {
      fragment.appendChild(el.cloneNode(true));
    }
  });
  return fragment;
}

function escapeText(text: string): string {
  return text.replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;");
}

const NAMED_ENTITIES: Record<string, string> = {
  amp: "&",
  lt: "<",
  gt: ">",
  quot: '"',
  apos: "'",
  nbsp: " ",
};

function decodeEntities(text: string): string {
  return text.replace(/&(#x[0-9a-f]+|#\d+|[a-z]+);/gi, (whole, body: string) => {
    if (body.startsWith("#")) {
      const code = /^#x/i.test(body) ? parseInt(body.slice(2), 16) : parseInt(body.slice(1), 10);
      return code <= 0x10ffff ? String.fromCodePoint(code) : whole;
    }
    return NAMED_ENTITIES[body.toLowerCase()] ?? whole;
  });
}
