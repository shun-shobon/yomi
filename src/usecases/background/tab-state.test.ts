import { beforeEach, describe, expect, it } from "vitest";
import { fakeBrowser } from "wxt/testing/fake-browser";

import {
	commitNavigation,
	dismissOffer,
	forgetTab,
	getTabPageState,
	setTranslating,
} from "./tab-state";

const navigation = (transitionType: string) => ({ transitionType, transitionQualifiers: [] });

beforeEach(() => {
	fakeBrowser.reset();
});

describe("tab-state", () => {
	it("提案を閉じたタブと翻訳中のタブを、タブごとに記録する", async () => {
		await dismissOffer(1);
		await setTranslating(2, true);

		expect(await getTabPageState(1)).toEqual({ offerDismissed: true, translating: false });
		expect(await getTabPageState(2)).toEqual({ offerDismissed: false, translating: true });
	});

	it("リンクで移ったら、提案を閉じた記録も翻訳中の記録も残す", async () => {
		await dismissOffer(1);
		await setTranslating(1, true);

		await commitNavigation(1, navigation("link"));

		expect(await getTabPageState(1)).toEqual({ offerDismissed: true, translating: true });
	});

	it("アドレスバーから移ったら、翻訳中の記録だけを消す", async () => {
		await dismissOffer(1);
		await setTranslating(1, true);

		await commitNavigation(1, navigation("typed"));

		expect(await getTabPageState(1)).toEqual({ offerDismissed: true, translating: false });
	});

	it("リロードしたら、提案を閉じた記録も翻訳中の記録も消す", async () => {
		await dismissOffer(1);
		await setTranslating(1, true);

		await commitNavigation(1, navigation("reload"));

		expect(await getTabPageState(1)).toEqual({ offerDismissed: false, translating: false });
	});

	it("翻訳をやめたら翻訳中の記録を消す", async () => {
		await setTranslating(1, true);
		await setTranslating(1, false);

		expect(await getTabPageState(1)).toMatchObject({ translating: false });
	});

	it("続けて届いた更新を取りこぼさない", async () => {
		await Promise.all([setTranslating(1, true), setTranslating(2, true), dismissOffer(3)]);

		expect(await getTabPageState(1)).toMatchObject({ translating: true });
		expect(await getTabPageState(2)).toMatchObject({ translating: true });
		expect(await getTabPageState(3)).toMatchObject({ offerDismissed: true });
	});

	it("タブが閉じられたら記録を消す", async () => {
		await dismissOffer(1);
		await setTranslating(1, true);
		await dismissOffer(2);

		await forgetTab(1);

		expect(await getTabPageState(1)).toEqual({ offerDismissed: false, translating: false });
		expect(await getTabPageState(2)).toMatchObject({ offerDismissed: true });
	});
});
