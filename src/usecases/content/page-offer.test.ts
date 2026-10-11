import { beforeEach, describe, expect, it, vi } from "vitest";
import { fakeBrowser } from "wxt/testing/fake-browser";

import { withDefaults } from "@/domain/settings";
import { getSiteRules, updateSiteRules } from "@/infra/storage/site-rules";
import type { OfferOptions, Overlay } from "@/usecases/content/overlay";

import { offerPageTranslation } from "./page-offer";
import type { PageTranslator } from "./page-translator";

const deps = vi.hoisted(() => ({
	detectPageLanguage: vi.fn<() => Promise<string | null>>(),
	callBackground: vi.fn(),
	isReload: vi.fn<() => boolean>(),
}));
vi.mock("@/infra/dom/page-language", () => ({ detectPageLanguage: deps.detectPageLanguage }));
vi.mock("@/infra/dom/navigation", () => ({ isReload: deps.isReload }));
vi.mock("@/infra/messaging/background-client", () => ({ callBackground: deps.callBackground }));

function setup({
	signedIn = true,
	active = false,
	dismissed = false,
	translating = false,
}: { signedIn?: boolean; active?: boolean; dismissed?: boolean; translating?: boolean } = {}) {
	deps.callBackground.mockImplementation((method: string) => {
		switch (method) {
			case "auth:getState":
				return Promise.resolve({ signedIn, email: null });
			case "tab:enterPage":
				return Promise.resolve({ offerDismissed: dismissed, translating });
			default:
				return Promise.resolve();
		}
	});
	const page = { isActive: active, start: vi.fn() };
	const overlay = { showOffer: vi.fn<(offer: OfferOptions) => void>() };
	const settings = withDefaults({ targetLang: "ja" });
	const run = () =>
		offerPageTranslation({
			page: page as unknown as PageTranslator,
			overlay: overlay as unknown as Overlay,
			getSettings: () => settings,
		});
	const offer = () => {
		const [call] = overlay.showOffer.mock.calls;
		if (call == null) throw new Error("提案が表示されていない");
		return call[0];
	};
	const click = (items: OfferOptions["actions"], label: string) => {
		const item = items.find((a) => a.label === label);
		if (item == null) throw new Error(`${label} がない`);
		item.onClick();
	};
	return { run, page, overlay, offer, click };
}

beforeEach(() => {
	fakeBrowser.reset();
	vi.stubGlobal("location", { hostname: "example.com" });
	deps.detectPageLanguage.mockResolvedValue("en-US");
	deps.isReload.mockReturnValue(false);
});

describe("offerPageTranslation", () => {
	it("翻訳先と違う言語のページでは言語名を添えて提案する", async () => {
		const ctx = setup();

		await ctx.run();

		expect(ctx.offer().message).toBe("このページは英語です。翻訳しますか？");
		expect(ctx.page.start).not.toHaveBeenCalled();
	});

	it("このタブで提案を閉じたことがあれば提案しない", async () => {
		const ctx = setup({ dismissed: true });

		await ctx.run();

		expect(ctx.overlay.showOffer).not.toHaveBeenCalled();
	});

	it("このタブで提案を閉じたことがあっても、常に翻訳するサイトは翻訳する", async () => {
		await updateSiteRules((r) => ({ ...r, alwaysTranslate: ["example.com"] }));
		const ctx = setup({ dismissed: true });

		await ctx.run();

		expect(ctx.page.start).toHaveBeenCalled();
	});

	it("リロードしたかどうかをタブの記録に伝える", async () => {
		deps.isReload.mockReturnValue(true);
		const ctx = setup();

		await ctx.run();

		expect(deps.callBackground).toHaveBeenCalledWith("tab:enterPage", { reloaded: true });
	});

	it("このタブで翻訳を続けているなら、提案せずに翻訳を始める", async () => {
		const ctx = setup({ translating: true, dismissed: true });

		await ctx.run();

		expect(ctx.page.start).toHaveBeenCalled();
		expect(ctx.overlay.showOffer).not.toHaveBeenCalled();
	});

	it("このタブで翻訳を続けていても、翻訳先と同じ言語のページは翻訳しない", async () => {
		deps.detectPageLanguage.mockResolvedValue("ja");
		const ctx = setup({ translating: true });

		await ctx.run();

		expect(ctx.page.start).not.toHaveBeenCalled();
	});

	it("提案を閉じるとタブに記録する", async () => {
		const ctx = setup();
		await ctx.run();

		ctx.offer().onDismiss();

		expect(deps.callBackground).toHaveBeenCalledWith("offer:dismiss");
	});

	it("翻訳先と同じ言語のページでは何もしない", async () => {
		deps.detectPageLanguage.mockResolvedValue("ja");
		const ctx = setup();

		await ctx.run();

		expect(ctx.overlay.showOffer).not.toHaveBeenCalled();
	});

	it("常に翻訳するサイトでは提案せずに翻訳を始める", async () => {
		await updateSiteRules((r) => ({ ...r, alwaysTranslate: ["example.com"] }));
		const ctx = setup();

		await ctx.run();

		expect(ctx.page.start).toHaveBeenCalled();
		expect(ctx.overlay.showOffer).not.toHaveBeenCalled();
	});

	it.each([
		["サインインしていない", { signedIn: false }],
		["すでに翻訳を始めている", { active: true }],
	])("%s なら何もしない", async (_, options) => {
		await updateSiteRules((r) => ({ ...r, alwaysTranslate: ["example.com"] }));
		const ctx = setup(options);

		await ctx.run();

		expect(ctx.page.start).not.toHaveBeenCalled();
		expect(ctx.overlay.showOffer).not.toHaveBeenCalled();
	});

	it("「このサイトは常に翻訳」で翻訳を始め、提案の除外を外してサイトを登録する", async () => {
		const ctx = setup();
		await ctx.run();
		// 別タブで除外した後に、このタブの提案から常に翻訳を選んだ場合
		await updateSiteRules((r) => ({ ...r, neverOffer: ["example.com"] }));

		ctx.click(ctx.offer().actions, "このサイトは常に翻訳");

		expect(ctx.page.start).toHaveBeenCalled();
		await expect.poll(getSiteRules).toMatchObject({
			alwaysTranslate: ["example.com"],
			neverOffer: [],
		});
	});

	it("メニューからサイトや言語を提案の対象外にできる", async () => {
		const ctx = setup();
		await ctx.run();

		ctx.click(ctx.offer().menu, "このサイトでは表示しない");
		await expect.poll(getSiteRules).toMatchObject({ neverOffer: ["example.com"] });

		ctx.click(ctx.offer().menu, "英語のページでは表示しない");
		await expect.poll(getSiteRules).toMatchObject({ neverOfferLangs: ["en"] });
	});
});
