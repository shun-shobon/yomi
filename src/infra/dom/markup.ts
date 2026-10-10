import { atomic, escapeText, groupClose, groupOpen, tagSignature, tokenize } from "@/domain/markup";

import { isAtomic, type Run } from "./segmenter";

/**
 * ノード列 ⇄ 翻訳用マークアップの相互変換。
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
  /** タグ列。domain/markup の parse が返す structure と比較する */
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
          out += atomic(id);
          tags.push(tagSignature({ type: "tag", kind: "atomic", id }));
        } else {
          tags.push(tagSignature({ type: "tag", kind: "open", id }));
          openSlot(node, node.firstChild);
          out += groupOpen(id) + walk(node.childNodes) + groupClose(id);
          tags.push(tagSignature({ type: "tag", kind: "close", id }));
        }
        openSlot(node.parentNode!, node.nextSibling);
      }
    }
    return out;
  };
  const markup = walk(nodes).trim();
  return { markup, placeholders, structure: tags.join(" "), slots };
}

/** タグ構造が変わった訳文を、元要素の複製で組み立てる */
export function build(markup: string, placeholders: Element[]): DocumentFragment {
  const fragment = document.createDocumentFragment();
  const stack: { node: Node; id: number }[] = [{ node: fragment, id: -1 }];
  const used = new Set<number>();
  /** 元の要素 → 訳文に置いた複製。落ちた要素を元の親の複製に戻すのに使う */
  const clones = new Map<Node, Node>();
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
      clones.set(original, el);
      top().appendChild(el);
      stack.push({ node: el, id: token.id });
    }
  }

  // モデルが落とした画像やコード片を消さないよう、訳文に残った最も近い親の末尾（なければ全体の末尾）に補う。
  // 親の複製は浅いコピーなので、ここで補わないと親の中にあった要素は残らない
  placeholders.forEach((el, id) => {
    if (used.has(id) || !isAtomic(el)) return;
    let parent: Node = fragment;
    for (let p = el.parentNode; p; p = p.parentNode) {
      const clone = clones.get(p);
      if (clone) {
        parent = clone;
        break;
      }
    }
    parent.appendChild(el.cloneNode(true));
  });
  return fragment;
}
