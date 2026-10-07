import { LANGUAGES, type LanguageCode } from "@/utils/languages";

export function pageInstructions(targetLang: LanguageCode, pageTitle: string): string {
  const lang = LANGUAGES[targetLang].englishName;
  return [
    `You are a professional translator embedded in a web browser. Translate web page text into natural, fluent ${lang}.`,
    "",
    'Input format: one segment per line, written as <seg id="N">...</seg>.',
    "Output rules:",
    `- Output every segment exactly once, in the same order and with the same id, as <seg id="N">translation</seg>, one per line. Output nothing else.`,
    "- Tags like <g3>...</g3> mark links or formatting. Keep each one exactly once and wrap the translated words that correspond to it. Do not invent new tags.",
    "- Self-closing tags like <x5/> are untranslatable objects (code, images, line breaks). Keep each one exactly once at the appropriate position.",
    "- Keep URLs, code identifiers, file paths and numbers as they are. Keep the entities &lt; &gt; &amp; as they are.",
    `- If a segment is already in ${lang} or contains nothing to translate, output it unchanged.`,
    "- Segments come from the same page, so keep terminology consistent across them.",
    "",
    `Page title (context only, do not output it): ${pageTitle.slice(0, 200)}`,
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
