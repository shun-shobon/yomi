import { describe, expect, it } from "vitest";

import { continuesTranslation } from "./navigation";

describe("continuesTranslation", () => {
	it.each(["link", "form_submit"])("ページ内の操作による遷移（%s）は翻訳を続ける", (type) => {
		expect(continuesTranslation({ transitionType: type, transitionQualifiers: [] })).toBe(true);
	});

	it.each(["typed", "generated", "keyword", "auto_bookmark", "reload"])(
		"アドレスバーやブックマーク、リロードによる遷移（%s）は翻訳を続けない",
		(type) => {
			expect(continuesTranslation({ transitionType: type, transitionQualifiers: [] })).toBe(false);
		},
	);

	it("アドレスバーから開いたページは、リンクとして報告されても翻訳を続けない", () => {
		expect(
			continuesTranslation({ transitionType: "link", transitionQualifiers: ["from_address_bar"] }),
		).toBe(false);
	});

	it("戻る・進むは元の遷移の種類によらず翻訳を続ける", () => {
		expect(
			continuesTranslation({ transitionType: "typed", transitionQualifiers: ["forward_back"] }),
		).toBe(true);
	});
});
