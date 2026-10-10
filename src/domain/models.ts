import type { ReasoningEffort, Settings } from "./settings";

export interface ModelInfo {
  slug: string;
  displayName: string;
  reasoningEfforts: ReasoningEffort[];
  defaultReasoningEffort: ReasoningEffort;
  supportsFast: boolean;
}

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
