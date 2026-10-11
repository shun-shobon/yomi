import { beforeEach, describe, expect, it, vi } from "vitest";

import { cacheKey } from "@/domain/translation-cache";

import { lookupPageTranslations, storePageTranslations } from "./translation-cache";

const storage = vi.hoisted(() => ({ lookupTranslations: vi.fn(), storeTranslations: vi.fn() }));
vi.mock("@/infra/storage/translation-cache", () => storage);

const page = "https://a.example/doc";
const fromPage = { tabId: 1, origin: "https://a.example" };

beforeEach(() => {
	storage.lookupTranslations.mockResolvedValue(["訳"]);
	storage.storeTranslations.mockResolvedValue(undefined);
});

describe("lookupPageTranslations", () => {
	it("送信元のページのキャッシュを引く", async () => {
		await expect(
			lookupPageTranslations({ pageUrl: page, lang: "ja", markups: ["x"] }, fromPage),
		).resolves.toEqual(["訳"]);
		expect(storage.lookupTranslations).toHaveBeenCalledWith([cacheKey("ja", page, "x")]);
	});

	it.each([
		["別オリジンのページ", { tabId: 1, origin: "https://b.example" }],
		["拡張のページ", { tabId: undefined, origin: "chrome-extension://abc" }],
		["オリジンのない送信元", { tabId: 1, origin: undefined }],
	])("%s からは引けない", async (_, sender) => {
		await expect(
			lookupPageTranslations({ pageUrl: page, lang: "ja", markups: ["x"] }, sender),
		).rejects.toThrow("このページの訳文キャッシュは使えません");
		expect(storage.lookupTranslations).not.toHaveBeenCalled();
	});

	it("不透明なオリジンのページでは引けない", async () => {
		await expect(
			lookupPageTranslations(
				{ pageUrl: "file:///tmp/a.html", lang: "ja", markups: ["x"] },
				{ tabId: 1, origin: "null" },
			),
		).rejects.toThrow("このページの訳文キャッシュは使えません");
	});
});

describe("storePageTranslations", () => {
	it("送信元のページのキーで保存する", async () => {
		await storePageTranslations(
			{ pageUrl: page, lang: "ja", entries: [{ markup: "x", translation: "訳" }] },
			fromPage,
		);
		expect(storage.storeTranslations).toHaveBeenCalledWith([
			{ key: cacheKey("ja", page, "x"), translation: "訳" },
		]);
	});

	it("別オリジンのページには保存できない", async () => {
		await expect(
			storePageTranslations(
				{ pageUrl: page, lang: "ja", entries: [{ markup: "x", translation: "訳" }] },
				{ tabId: 1, origin: "https://b.example" },
			),
		).rejects.toThrow("このページの訳文キャッシュは使えません");
		expect(storage.storeTranslations).not.toHaveBeenCalled();
	});
});
