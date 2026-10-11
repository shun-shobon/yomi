import { decodeHTMLStrict } from "entities";

export { escapeText } from "entities";

export const groupOpen = (id: number) => `<g${id}>`;
export const groupClose = (id: number) => `</g${id}>`;
export const atomic = (id: number) => `<x${id}/>`;

export type Token =
	| { type: "text"; text: string }
	| { type: "tag"; kind: "open" | "close" | "atomic"; id: number };

const TAG = /<(\/?)([gx])(\d+)\s*\/?>/gu;

export function* tokenize(markup: string): Generator<Token> {
	let last = 0;
	for (const match of markup.matchAll(TAG)) {
		yield { type: "text", text: decodeHTMLStrict(markup.slice(last, match.index)) };
		last = match.index + match[0].length;
		const [, slash, letter, id] = match;
		yield {
			type: "tag",
			kind: letter === "x" ? "atomic" : slash === "/" ? "close" : "open",
			id: Number(id),
		};
	}
	yield { type: "text", text: decodeHTMLStrict(markup.slice(last)) };
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
	if (!keepNewlines) return text.replaceAll(/\s+/gu, " ");
	return text.replaceAll(/[^\S\n]*\n[^\S\n]*/gu, "\n").replaceAll(/[^\S\n]+/gu, " ");
}
