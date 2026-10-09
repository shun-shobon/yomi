import type { ReasoningEffort, Settings } from "./settings";

export interface ModelInfo {
  slug: string;
  displayName: string;
  reasoningEfforts: ReasoningEffort[];
  defaultReasoningEffort: ReasoningEffort;
  /** 優先処理（Codex の Fast モード）に対応しているか */
  supportsFast: boolean;
}

export function supportsEffort(model: ModelInfo, effort: ReasoningEffort): boolean {
  return model.reasoningEfforts.includes(effort);
}

/** モデルを切り替えたとき、新しいモデルが対応しない推論の強さ・高速モードを使える値に直す */
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
