export const LANGUAGES = {
  ja: { label: "日本語", englishName: "Japanese" },
  en: { label: "英語", englishName: "English" },
  "zh-Hans": { label: "中国語（簡体字）", englishName: "Simplified Chinese" },
  "zh-Hant": { label: "中国語（繁体字）", englishName: "Traditional Chinese" },
  ko: { label: "韓国語", englishName: "Korean" },
  es: { label: "スペイン語", englishName: "Spanish" },
  fr: { label: "フランス語", englishName: "French" },
  de: { label: "ドイツ語", englishName: "German" },
  it: { label: "イタリア語", englishName: "Italian" },
  pt: { label: "ポルトガル語", englishName: "Portuguese" },
  ru: { label: "ロシア語", englishName: "Russian" },
  vi: { label: "ベトナム語", englishName: "Vietnamese" },
  th: { label: "タイ語", englishName: "Thai" },
  id: { label: "インドネシア語", englishName: "Indonesian" },
} as const satisfies Record<string, { label: string; englishName: string }>;

export type LanguageCode = keyof typeof LANGUAGES;

export const LANGUAGE_CODES = Object.keys(LANGUAGES) as LanguageCode[];

export function isLanguageCode(value: string): value is LanguageCode {
  return Object.hasOwn(LANGUAGES, value);
}
