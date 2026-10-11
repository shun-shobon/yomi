import { describe, expect, it } from "vitest";

import { toModelInfos } from "./models";
import type { SiwcModel } from "./models";

const siwc = (overrides: Partial<SiwcModel> = {}): SiwcModel => ({
	slug: "gpt-x",
	display_name: "GPT X",
	visibility: "list",
	default_reasoning_level: "medium",
	supported_reasoning_levels: [{ effort: "low" }, { effort: "medium" }],
	service_tiers: [],
	...overrides,
});

describe("toModelInfos", () => {
	it("SIWC のモデルを ModelInfo に変換する", () => {
		expect(toModelInfos([siwc()])).toEqual([
			{
				slug: "gpt-x",
				displayName: "GPT X",
				reasoningEfforts: ["low", "medium"],
				defaultReasoningEffort: "medium",
				supportsFast: false,
			},
		]);
	});

	it("一覧表示用でないモデルは除外する", () => {
		const models = toModelInfos([
			siwc({ slug: "a", visibility: "hide" }),
			siwc({ slug: "b" }),
			siwc({ slug: "c", visibility: "none" }),
		]);
		expect(models.map((m) => m.slug)).toEqual(["b"]);
	});

	it("未知の effort は選択肢から除く", () => {
		const [model] = toModelInfos([
			siwc({ supported_reasoning_levels: [{ effort: "low" }, { effort: "ultra" }] }),
		]);
		expect(model!.reasoningEfforts).toEqual(["low"]);
	});

	it("既定の effort が未知なら失敗する", () => {
		expect(() => toModelInfos([siwc({ default_reasoning_level: "ultra" })])).toThrow("ultra");
	});

	it("除外されるモデルの既定 effort が未知でも失敗しない", () => {
		expect(toModelInfos([siwc({ visibility: "hide", default_reasoning_level: "ultra" })])).toEqual(
			[],
		);
	});

	it("priority の service tier があれば高速モードに対応する", () => {
		const [fast] = toModelInfos([siwc({ service_tiers: [{ id: "flex" }, { id: "priority" }] })]);
		const [slow] = toModelInfos([siwc({ service_tiers: [{ id: "flex" }] })]);
		expect(fast!.supportsFast).toBe(true);
		expect(slow!.supportsFast).toBe(false);
	});
});
