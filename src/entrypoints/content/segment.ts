import { build, parse, serialize, type Serialized } from "./markup";
import type { Run } from "./segmenter";

export type SegmentState = "idle" | "queued" | "pending" | "done" | "failed";

/** 既存のテキストノードへの書き込み。要素を差し替えないのでフレームワーク管理下の DOM を壊さない */
interface TextWrite {
  node: Text;
  original: string;
  translated: string;
}

type Applied = { mode: "inplace"; writes: TextWrite[] } | { mode: "replace"; nodes: Node[] };

export type Showing = "translation" | "original";

export class Segment {
  readonly parent: Element;
  readonly original: Run["nodes"];
  readonly originalText: string;
  readonly serialized: Serialized;
  state: SegmentState = "idle";
  /** 担当中のバッチ。古いバッチの結果で上書きしないための照合に使う */
  batch = 0;
  private applied: Applied | null = null;

  constructor(run: Run) {
    this.parent = run.parent;
    this.original = run.nodes;
    this.originalText = run.nodes.map((n) => n.textContent).join("");
    this.serialized = serialize(run);
  }

  /** このセグメントが所有するノード。MutationObserver で自分の書き込みを見分けるのに使う */
  ownedNodes(): Node[] {
    return [
      ...this.original,
      ...this.serialized.slots.flatMap((slot) => slot.texts),
      ...(this.applied?.mode === "inplace" ? this.applied.writes.map((w) => w.node) : []),
      ...(this.applied?.mode === "replace" ? this.applied.nodes : []),
    ];
  }

  /**
   * 訳文を反映する。タグ構造が原文と同じなら既存のテキストノードを書き換え、
   * 語順の変化などで構造が変わった場合だけ元要素の複製に置き換える。
   */
  applyTranslation(markup: string) {
    const parsed = parse(markup.trim());
    this.applied =
      parsed.structure === this.serialized.structure
        ? { mode: "inplace", writes: this.planWrites(parsed.texts) }
        : { mode: "replace", nodes: this.buildReplacement(markup.trim()) };
    this.parent.setAttribute("data-gt-tr", "");
  }

  /** 表示を切り替える。前回の表示からページ側が書き換えていた場合は false を返す */
  render(showing: Showing): boolean {
    const applied = this.applied;
    if (!applied) return true;
    const toTranslation = showing === "translation";
    if (applied.mode === "inplace") {
      const current = (w: TextWrite) => (toTranslation ? w.original : w.translated);
      if (applied.writes.some((w) => w.node.data !== current(w))) return false;
      for (const w of applied.writes) w.node.data = toTranslation ? w.translated : w.original;
      return true;
    }
    const [from, to] = toTranslation
      ? [this.original, applied.nodes]
      : [applied.nodes, this.original];
    const anchor = from.find((n) => n.parentNode === this.parent);
    if (!anchor) return true;
    for (const node of to) this.parent.insertBefore(node, anchor);
    for (const node of from) if (node.parentNode === this.parent) this.parent.removeChild(node);
    return true;
  }

  /** 書き込んだ訳文を原文に戻す。ページ側が書き換えた箇所はそのまま残す */
  revert() {
    if (this.applied?.mode !== "inplace") return;
    for (const w of this.applied.writes) if (w.node.data === w.translated) w.node.data = w.original;
  }

  /**
   * ページ側によるテキストノードの書き換えを判定する。
   * 自分の書き込みなら "own"、原文への書き戻しなら訳文を当て直して "own"、それ以外は "changed"。
   */
  classifyTextChange(node: Text, showing: Showing): "own" | "changed" {
    if (this.state !== "done") return "changed";
    // 複製に置き換えた場合、元のテキストノードは DOM から外れているので監視対象外
    if (this.applied?.mode !== "inplace") return "own";
    const write = this.applied.writes.find((w) => w.node === node);
    if (!write || node.data === write.translated) return "own";
    if (node.data === write.original && showing === "translation") {
      node.data = write.translated;
      return "own";
    }
    return "changed";
  }

  /** スロットごとに先頭のテキストノードへ訳文を入れ、残りは空にする。テキストノードが無いスロットには新規に挿入する */
  private planWrites(texts: string[]): TextWrite[] {
    const { slots } = this.serialized;
    const writes: TextWrite[] = [];
    slots.forEach((slot, i) => {
      // parse はタグ数 + 1 個のテキストを返し、structure が一致しているのでスロット数と等しい
      let text = texts[i]!.replace(/\s+/g, " ");
      const [head, ...rest] = slot.texts;
      if (head) {
        // 外側の空白は前後の要素との区切りなので原文のまま残す
        if (i === 0) text = /^\s*/.exec(head.data)![0] + text.trimStart();
        if (i === slots.length - 1)
          text = text.trimEnd() + /\s*$/.exec(slot.texts.at(-1)!.data)![0];
        writes.push({ node: head, original: head.data, translated: text });
        for (const node of rest) writes.push({ node, original: node.data, translated: "" });
      } else if (text.trim() && slot.parent.isConnected) {
        const node = document.createTextNode("");
        slot.parent.insertBefore(
          node,
          slot.before?.parentNode === slot.parent ? slot.before : null,
        );
        writes.push({ node, original: "", translated: text });
      }
    });
    return writes;
  }

  private buildReplacement(markup: string): Node[] {
    const nodes = Array.from(build(markup, this.serialized.placeholders).childNodes);
    const first = this.original[0];
    const last = this.original.at(-1);
    if (first instanceof Text && /^\s/.test(first.data))
      nodes.unshift(document.createTextNode(" "));
    if (last instanceof Text && /\s$/.test(last.data)) nodes.push(document.createTextNode(" "));
    return nodes;
  }
}
