import * as v from "valibot";

import { ReasoningEffortSchema } from "./settings";
import type { ReasoningEffort, Settings } from "./settings";

export const ModelInfoSchema = v.object({
	slug: v.string(),
	displayName: v.string(),
	reasoningEfforts: v.array(ReasoningEffortSchema),
	defaultReasoningEffort: ReasoningEffortSchema,
	supportsFast: v.boolean(),
});

export type ModelInfo = v.InferOutput<typeof ModelInfoSchema>;

export function supportsEffort(model: ModelInfo, effort: ReasoningEffort): boolean {
	return model.reasoningEfforts.includes(effort);
}

export function settingsForModel(
	current: Pick<Settings, "reasoningEffort" | "fastMode">,
	model: ModelInfo,
): Pick<Settings, "model" | "reasoningEffort" | "fastMode"> {
	return {
		model: model.slug,
		reasoningEffort: supportsEffort(model, current.reasoningEffort)
			? current.reasoningEffort
			: model.defaultReasoningEffort,
		fastMode: current.fastMode && model.supportsFast,
	};
}
