import * as v from "valibot";
import { describe, expect, it } from "vitest";

import {
	decidePageOffer,
	EMPTY_SITE_RULES,
	languageLabel,
	pageLanguageKey,
	SiteRulesSchema,
	withAlwaysTranslate,
	withoutRule,
	withRule,
} from "./site-rules";

describe("pageLanguageKey", () => {
	it("地域を落として言語だけにする", () => {
		expect(pageLanguageKey("en-US")).toBe("en");
		expect(pageLanguageKey("JA")).toBe("ja");
	});

	it("中国語は地域や書記体系から簡体字・繁体字を判別する", () => {
		expect(pageLanguageKey("zh")).toBe("zh-Hans");
		expect(pageLanguageKey("zh-CN")).toBe("zh-Hans");
		expect(pageLanguageKey("zh-TW")).toBe("zh-Hant");
		expect(pageLanguageKey("zh-Hant-HK")).toBe("zh-Hant");
	});

	it("不正なタグや und は null", () => {
		expect(pageLanguageKey("")).toBeNull();
		expect(pageLanguageKey("not a tag")).toBeNull();
		expect(pageLanguageKey("und")).toBeNull();
	});
});

describe("languageLabel", () => {
	it("日本語の言語名を返す", () => {
		expect(languageLabel("en")).toBe("英語");
	});
});

describe("decidePageOffer", () => {
	const base = {
		rules: EMPTY_SITE_RULES,
		host: "example.com",
		pageLang: "en",
		targetLang: "ja",
		offerEnabled: true,
	} as const;

	it("翻訳先と違う言語なら提案する", () => {
		expect(decidePageOffer(base)).toBe("offer");
	});

	it("翻訳先と同じ言語なら、常に翻訳するサイトでも何もしない", () => {
		const rules = withRule(EMPTY_SITE_RULES, "alwaysTranslate", "example.com");
		expect(decidePageOffer({ ...base, rules, pageLang: "ja" })).toBe("none");
	});

	it("常に翻訳するサイトは、提案を切っていても言語が不明でも翻訳する", () => {
		const rules = withRule(EMPTY_SITE_RULES, "alwaysTranslate", "example.com");
		expect(decidePageOffer({ ...base, rules, offerEnabled: false })).toBe("translate");
		expect(decidePageOffer({ ...base, rules, pageLang: null })).toBe("translate");
	});

	it("言語が不明なら提案しない", () => {
		expect(decidePageOffer({ ...base, pageLang: null })).toBe("none");
	});

	it("提案を切っている・除外したサイトや言語では提案しない", () => {
		expect(decidePageOffer({ ...base, offerEnabled: false })).toBe("none");
		expect(
			decidePageOffer({ ...base, rules: withRule(EMPTY_SITE_RULES, "neverOffer", "example.com") }),
		).toBe("none");
		expect(
			decidePageOffer({ ...base, rules: withRule(EMPTY_SITE_RULES, "neverOfferLangs", "en") }),
		).toBe("none");
	});
});

describe("withRule / withoutRule", () => {
	it("重複して追加しない", () => {
		const once = withRule(EMPTY_SITE_RULES, "neverOffer", "a.com");
		expect(withRule(once, "neverOffer", "a.com").neverOffer).toEqual(["a.com"]);
	});

	it("指定した値だけを取り除く", () => {
		const rules = withRule(
			withRule(EMPTY_SITE_RULES, "neverOffer", "a.com"),
			"neverOffer",
			"b.com",
		);
		expect(withoutRule(rules, "neverOffer", "a.com").neverOffer).toEqual(["b.com"]);
	});
});

describe("withAlwaysTranslate", () => {
	it("常に翻訳に登録すると、そのサイトを提案の除外から外す", () => {
		const rules = withRule(EMPTY_SITE_RULES, "neverOffer", "a.com");
		expect(withAlwaysTranslate(rules, "a.com", true)).toMatchObject({
			alwaysTranslate: ["a.com"],
			neverOffer: [],
		});
	});

	it("解除すると常に翻訳からだけ外す", () => {
		const rules = withAlwaysTranslate(EMPTY_SITE_RULES, "a.com", true);
		expect(withAlwaysTranslate(rules, "a.com", false).alwaysTranslate).toEqual([]);
	});
});

describe("SiteRulesSchema", () => {
	it("壊れた項目だけを空に戻す", () => {
		expect(
			v.parse(SiteRulesSchema, {
				alwaysTranslate: ["a.com"],
				neverOffer: "x",
				neverOfferLangs: [1],
			}),
		).toEqual({ alwaysTranslate: ["a.com"], neverOffer: [], neverOfferLangs: [] });
	});
});
