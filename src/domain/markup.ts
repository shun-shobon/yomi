/**
 * 翻訳用マークアップの構文。
 * インライン要素は <gN>…</gN>、訳さない要素は <xN/> で表し、N は原文側の要素の番号。
 */

export const groupOpen = (id: number) => `<g${id}>`;
export const groupClose = (id: number) => `</g${id}>`;
export const atomic = (id: number) => `<x${id}/>`;

export type Token =
  | { type: "text"; text: string }
  | { type: "tag"; kind: "open" | "close" | "atomic"; id: number };

const TAG = /<(\/?)([gx])(\d+)\s*\/?>/g;

/** テキストとタグを交互に返す。テキストは常にタグ数 + 1 個で、エンティティはデコード済み */
export function* tokenize(markup: string): Generator<Token> {
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

/** タグ列の表現（例: "g0 /g0 x1"）。原文と訳文で一致すれば要素を動かさずにテキストだけ書き換えられる */
export function tagSignature(token: Extract<Token, { type: "tag" }>): string {
  return `${token.kind === "close" ? "/" : ""}${token.kind === "atomic" ? "x" : "g"}${token.id}`;
}

/** 訳文をタグ列と、タグの間のテキスト列に分ける。テキスト列の長さは常にタグ数 + 1 */
export function parse(markup: string): { structure: string; texts: string[] } {
  const tags: string[] = [];
  const texts: string[] = [];
  for (const token of tokenize(markup)) {
    if (token.type === "text") texts.push(token.text);
    else tags.push(tagSignature(token));
  }
  return { structure: tags.join(" "), texts };
}

export function escapeText(text: string): string {
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
