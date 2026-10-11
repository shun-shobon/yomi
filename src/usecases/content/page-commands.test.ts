import { describe, expect, it, vi } from "vitest";

import type { PageState } from "@/domain/page";

import type { Overlay } from "./overlay";
import { createPageCommands } from "./page-commands";
import type { PageTranslator } from "./page-translator";
import type { SelectionTranslator } from "./selection-translator";

function setup({ active = false, selected = false, translated = false } = {}) {
	const page = {
		isActive: active,
		start: vi.fn(() => {
			page.isActive = true;
		}),
		stop: vi.fn(() => {
			page.isActive = false;
		}),
		showOriginal: vi.fn(),
		toggleOriginal: vi.fn(),
		hasTranslations: vi.fn(() => translated),
		getState: vi.fn(() => ({ active: page.isActive }) as unknown as PageState),
	};
	const selection = {
		translateCurrent: vi.fn(() => selected),
		translateText: vi.fn(),
	};
	const overlay = { toast: vi.fn(), hideOffer: vi.fn() };
	const run = createPageCommands({
		page: page as unknown as PageTranslator,
		selection: selection as unknown as SelectionTranslator,
		overlay: overlay as unknown as Overlay,
	});
	return { run, page, selection, overlay };
}

describe("createPageCommands", () => {
	let ctx: ReturnType<typeof setup>;

	describe("command:translate", () => {
		it("選択範囲があれば選択翻訳だけを行い、ページ翻訳には触れない", () => {
			ctx = setup({ selected: true });

			ctx.run({ type: "command:translate" });

			expect(ctx.selection.translateCurrent).toHaveBeenCalled();
			expect(ctx.page.start).not.toHaveBeenCalled();
			expect(ctx.page.stop).not.toHaveBeenCalled();
			expect(ctx.overlay.toast).not.toHaveBeenCalled();
		});

		it("選択範囲がなく未翻訳ならページ翻訳を開始してトーストを出す", () => {
			ctx = setup();

			ctx.run({ type: "command:translate" });

			expect(ctx.page.start).toHaveBeenCalledTimes(1);
			expect(ctx.overlay.toast).toHaveBeenCalledWith("ページの翻訳を開始しました");
		});

		it("選択範囲がなく翻訳中ならページ翻訳を停止してトーストを出す", () => {
			ctx = setup({ active: true });

			ctx.run({ type: "command:translate" });

			expect(ctx.page.stop).toHaveBeenCalledTimes(1);
			expect(ctx.page.start).not.toHaveBeenCalled();
			expect(ctx.overlay.toast).toHaveBeenCalledWith("翻訳を停止しました");
		});

		it("繰り返すと開始と停止を交互に切り替える", () => {
			ctx = setup();

			ctx.run({ type: "command:translate" });
			ctx.run({ type: "command:translate" });
			ctx.run({ type: "command:translate" });

			expect(ctx.page.start).toHaveBeenCalledTimes(2);
			expect(ctx.page.stop).toHaveBeenCalledTimes(1);
		});
	});

	describe("page:translate", () => {
		it("未翻訳なら開始してトーストを出す", () => {
			ctx = setup();

			ctx.run({ type: "page:translate" });

			expect(ctx.page.start).toHaveBeenCalledTimes(1);
			expect(ctx.overlay.toast).toHaveBeenCalledWith("ページの翻訳を開始しました");
		});

		it("翻訳の提案を閉じる", () => {
			ctx = setup();

			ctx.run({ type: "page:translate" });

			expect(ctx.overlay.hideOffer).toHaveBeenCalled();
		});

		it("開始済みならトーストを出さない", () => {
			ctx = setup({ active: true });

			ctx.run({ type: "page:translate" });

			expect(ctx.page.start).toHaveBeenCalledTimes(1);
			expect(ctx.overlay.toast).not.toHaveBeenCalled();
		});
	});

	describe("command:toggleOriginal", () => {
		it("訳文があれば原文と訳文を切り替える", () => {
			ctx = setup({ active: true, translated: true });

			ctx.run({ type: "command:toggleOriginal" });

			expect(ctx.page.toggleOriginal).toHaveBeenCalledTimes(1);
		});

		it("訳文がなければ何もしない", () => {
			ctx = setup({ active: true });

			ctx.run({ type: "command:toggleOriginal" });

			expect(ctx.page.toggleOriginal).not.toHaveBeenCalled();
		});
	});

	it("selection:translate は渡されたテキストを翻訳する", () => {
		ctx = setup();

		ctx.run({ type: "selection:translate", text: "Hello" });

		expect(ctx.selection.translateText).toHaveBeenCalledWith("Hello");
	});

	it.each([
		[{ type: "page:getState" }, false],
		[{ type: "page:translate" }, true],
		[{ type: "page:stop" }, false],
		[{ type: "page:showOriginal" }, false],
		[{ type: "page:showTranslation" }, true],
		[{ type: "command:translate" }, true],
		[{ type: "command:toggleOriginal" }, false],
		[{ type: "selection:translate", text: "Hello" }, false],
	] as const)("%o の実行後のページ状態を返す", (message, active) => {
		ctx = setup();

		expect(ctx.run(message)).toEqual({ active });
	});

	it("page:stop は翻訳中のページを停止した後の状態を返す", () => {
		ctx = setup({ active: true });

		expect(ctx.run({ type: "page:stop" })).toEqual({ active: false });
	});
});
