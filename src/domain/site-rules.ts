import * as v from "valibot";

import type { LanguageCode } from "./languages";

/** 一部が壊れていても、その項目だけ空に戻して他のルールは残す */
export const SiteRulesSchema = v.object({
	alwaysTranslate: v.fallback(v.array(v.string()), []),
	neverOffer: v.fallback(v.array(v.string()), []),
	neverOfferLangs: v.fallback(v.array(v.string()), []),
});

export type SiteRules = v.InferOutput<typeof SiteRulesSchema>;

export type SiteRuleList = keyof SiteRules;

export const EMPTY_SITE_RULES: SiteRules = {
	alwaysTranslate: [],
	neverOffer: [],
	neverOfferLangs: [],
};

export function withRule(rules: SiteRules, list: SiteRuleList, value: string): SiteRules {
	if (rules[list].includes(value)) return rules;
	return { ...rules, [list]: [...rules[list], value] };
}

export function withoutRule(rules: SiteRules, list: SiteRuleList, value: string): SiteRules {
	return { ...rules, [list]: rules[list].filter((item) => item !== value) };
}

export function withAlwaysTranslate(rules: SiteRules, host: string, enabled: boolean): SiteRules {
	if (!enabled) return withoutRule(rules, "alwaysTranslate", host);
	return withRule(withoutRule(rules, "neverOffer", host), "alwaysTranslate", host);
}

/**
 * BCP 47 のタグを、翻訳先の言語と比べられる単位にそろえる。
 * 中国語だけは簡体字と繁体字で翻訳先が分かれるので、地域から書記体系を補う。
 */
export function pageLanguageKey(tag: string): string | null {
	let locale: Intl.Locale;
	try {
		locale = new Intl.Locale(tag.trim());
	} catch {
		return null;
	}
	if (locale.language === "und") return null;
	if (locale.language !== "zh") return locale.language;
	const script = locale.maximize().script;
	return script === "Hant" ? "zh-Hant" : "zh-Hans";
}

const languageNames = new Intl.DisplayNames(["ja"], { type: "language", fallback: "code" });

export function languageLabel(key: string): string {
	return languageNames.of(key) ?? key;
}

export type PageOffer = "translate" | "offer" | "none";

export function decidePageOffer(input: {
	rules: SiteRules;
	host: string;
	pageLang: string | null;
	targetLang: LanguageCode;
	offerEnabled: boolean;
	/** このタブで直前のページを翻訳していた */
	continuing: boolean;
}): PageOffer {
	const { rules, host, pageLang, targetLang } = input;
	if (pageLang === targetLang) return "none";
	if (input.continuing || rules.alwaysTranslate.includes(host)) return "translate";
	if (pageLang == null || !input.offerEnabled) return "none";
	if (rules.neverOffer.includes(host) || rules.neverOfferLangs.includes(pageLang)) return "none";
	return "offer";
}
