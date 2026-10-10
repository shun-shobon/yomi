export const groupOpen = (id: number) => `<g${id}>`;
export const groupClose = (id: number) => `</g${id}>`;
export const atomic = (id: number) => `<x${id}/>`;

export type Token =
  | { type: "text"; text: string }
  | { type: "tag"; kind: "open" | "close" | "atomic"; id: number };

const TAG = /<(\/?)([gx])(\d+)\s*\/?>/g;

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

export function tagSignature(token: Extract<Token, { type: "tag" }>): string {
  return `${token.kind === "close" ? "/" : ""}${token.kind === "atomic" ? "x" : "g"}${token.id}`;
}

export function parse(markup: string): { structure: string; texts: string[] } {
  const tags: string[] = [];
  const texts: string[] = [];
  for (const token of tokenize(markup)) {
    if (token.type === "text") texts.push(token.text);
    else tags.push(tagSignature(token));
  }
  return { structure: tags.join(" "), texts };
}

export function collapseWhitespace(text: string, keepNewlines: boolean): string {
  if (!keepNewlines) return text.replace(/\s+/g, " ");
  return text.replace(/[^\S\n]*\n[^\S\n]*/g, "\n").replace(/[^\S\n]+/g, " ");
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
