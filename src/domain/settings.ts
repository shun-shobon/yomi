import * as v from "valibot";

import { LanguageCodeSchema } from "./languages";

export const ReasoningEffortSchema = v.picklist([
	"none",
	"minimal",
	"low",
	"medium",
	"high",
	"xhigh",
	"max",
]);

export type ReasoningEffort = v.InferOutput<typeof ReasoningEffortSchema>;

export function isReasoningEffort(value: string): value is ReasoningEffort {
	return v.is(ReasoningEffortSchema, value);
}

/** 保存値の一部が古い・壊れていても、その項目だけ既定値に戻して他の設定は残す */
const SettingsSchema = v.object({
	targetLang: v.fallback(LanguageCodeSchema, "ja"),
	/** アカウントごとに利用可能なモデルが異なるため既定値を持たない */
	model: v.fallback(v.nullable(v.string()), null),
	reasoningEffort: v.fallback(ReasoningEffortSchema, "low"),
	fastMode: v.fallback(v.boolean(), false),
	showSelectionButton: v.fallback(v.boolean(), true),
	offerTranslation: v.fallback(v.boolean(), true),
	hoverOriginal: v.fallback(v.boolean(), true),
	highlightPending: v.fallback(v.boolean(), true),
});

export type Settings = v.InferOutput<typeof SettingsSchema>;

export function withDefaults(overrides: Record<string, unknown>): Settings {
	return v.parse(SettingsSchema, overrides);
}
