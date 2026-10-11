import { beforeEach, describe, expect, it } from "vitest";
import { fakeBrowser } from "wxt/testing/fake-browser";

import { dismissOffer, enterPage, forgetTab, setTranslating } from "./tab-state";

beforeEach(() => {
	fakeBrowser.reset();
});

describe("tab-state", () => {
	it("提案を閉じたタブと翻訳中のタブを、タブごとに記録する", async () => {
		await dismissOffer(1);
		await setTranslating(2, true);

		expect(await enterPage(1, { reloaded: false })).toEqual({
			offerDismissed: true,
			translating: false,
		});
		expect(await enterPage(2, { reloaded: false })).toEqual({
			offerDismissed: false,
			translating: true,
		});
	});

	it("リロードしたら提案を閉じた記録も翻訳中の記録も消す", async () => {
		await dismissOffer(1);
		await setTranslating(1, true);

		const expected = { offerDismissed: false, translating: false };
		expect(await enterPage(1, { reloaded: true })).toEqual(expected);
		expect(await enterPage(1, { reloaded: false })).toEqual(expected);
	});

	it("翻訳をやめたら翻訳中の記録を消す", async () => {
		await setTranslating(1, true);
		await setTranslating(1, false);

		expect(await enterPage(1, { reloaded: false })).toMatchObject({ translating: false });
	});

	it("続けて届いた更新を取りこぼさない", async () => {
		await Promise.all([setTranslating(1, true), setTranslating(2, true), dismissOffer(3)]);

		expect(await enterPage(1, { reloaded: false })).toMatchObject({ translating: true });
		expect(await enterPage(2, { reloaded: false })).toMatchObject({ translating: true });
		expect(await enterPage(3, { reloaded: false })).toMatchObject({ offerDismissed: true });
	});

	it("タブが閉じられたら記録を消す", async () => {
		await dismissOffer(1);
		await setTranslating(1, true);
		await dismissOffer(2);

		await forgetTab(1);

		expect(await enterPage(1, { reloaded: false })).toEqual({
			offerDismissed: false,
			translating: false,
		});
		expect(await enterPage(2, { reloaded: false })).toMatchObject({ offerDismissed: true });
	});
});
