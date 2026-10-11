import { LANGUAGES } from "@/domain/languages";
import type { LanguageCode } from "@/domain/languages";

export interface PageContext {
	title: string;
	description: string;
}

export function pageInstructions(targetLang: LanguageCode, page: PageContext): string {
	const lang = LANGUAGES[targetLang].englishName;
	const title = page.title.trim().slice(0, 200);
	const description = page.description.trim().slice(0, 300);
	return [
		`You are a professional translator embedded in a web browser. Translate web page text into natural, fluent ${lang}.`,
		"",
		'Input format: segments written as <seg id="N">...</seg>, separated by newlines. A segment may itself contain line breaks.',
		"Output rules:",
		`- Output every segment exactly once, in the same order and with the same id, as <seg id="N">translation</seg>, separated by newlines. Output nothing else.`,
		"- Keep line breaks inside a segment at the corresponding positions in the translation.",
		"- Tags like <g3>...</g3> mark links or formatting. Keep each one exactly once and wrap the translated words that correspond to it. Do not invent new tags.",
		"- Self-closing tags like <x5/> are untranslatable objects (code, images, line breaks). Keep each one exactly once at the appropriate position.",
		"- Keep URLs, code identifiers, file paths and numbers as they are. Keep the entities &lt; &gt; &amp; as they are.",
		`- If a segment is already in ${lang} or contains nothing to translate, output it unchanged.`,
		"- Segments come from the same page, so keep terminology consistent across them.",
		"",
		"Page context (for reference only, do not output it):",
		`- Title: ${title}`,
		...(description ? [`- Description: ${description}`] : []),
	].join("\n");
}

export function selectionInstructions(targetLang: LanguageCode): string {
	const lang = LANGUAGES[targetLang].englishName;
	const fallback = targetLang === "en" ? "Japanese" : "English";
	return [
		`You are a professional translator. Translate the user's text into natural, fluent ${lang}.`,
		`If the text is already in ${lang}, translate it into ${fallback} instead.`,
		"Output only the translation, without quotes, notes or explanations. Preserve line breaks.",
	].join("\n");
}
