import { beforeEach, describe, expect, it } from "vitest";
import { fakeBrowser } from "wxt/testing/fake-browser";

import { dismissOffer, forgetOfferDismissal, isOfferDismissed } from "./offer-dismissal";

beforeEach(() => {
	fakeBrowser.reset();
});

describe("offer-dismissal", () => {
	it("提案を閉じたタブだけを記録する", async () => {
		await dismissOffer(1);

		expect(await isOfferDismissed(1)).toBe(true);
		expect(await isOfferDismissed(2)).toBe(false);
	});

	it("タブが閉じられたら記録を消す", async () => {
		await dismissOffer(1);
		await dismissOffer(2);

		await forgetOfferDismissal(1);

		expect(await isOfferDismissed(1)).toBe(false);
		expect(await isOfferDismissed(2)).toBe(true);
	});
});
