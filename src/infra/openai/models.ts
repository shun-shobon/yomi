import type { ModelInfo } from "@/domain/models";
import { isReasoningEffort } from "@/domain/settings";

/** Codex の Fast モードと同じく、この service tier をモデルが提供していれば優先処理を使える */
export const FAST_SERVICE_TIER = "priority";

export interface SiwcModel {
	slug: string;
	display_name: string;
	visibility: string;
	default_reasoning_level: string;
	supported_reasoning_levels: { effort: string }[];
	service_tiers: { id: string }[];
}

export function toModelInfos(models: SiwcModel[]): ModelInfo[] {
	return models.filter((m) => m.visibility === "list").map(toModelInfo);
}

function toModelInfo(m: SiwcModel): ModelInfo {
	if (!isReasoningEffort(m.default_reasoning_level)) {
		throw new Error(
			`${m.slug} の既定の reasoning effort が未知の値です: ${m.default_reasoning_level}`,
		);
	}
	return {
		slug: m.slug,
		displayName: m.display_name,
		// SDK が知らない新しい effort は送れないので選択肢に出さない
		reasoningEfforts: m.supported_reasoning_levels
			.map(({ effort }) => effort)
			.filter(isReasoningEffort),
		defaultReasoningEffort: m.default_reasoning_level,
		supportsFast: m.service_tiers.some((tier) => tier.id === FAST_SERVICE_TIER),
	};
}
