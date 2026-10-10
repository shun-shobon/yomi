import type { LanguageCode } from "./languages";

const REASONING_EFFORTS = ["none", "minimal", "low", "medium", "high", "xhigh", "max"] as const;

export type ReasoningEffort = (typeof REASONING_EFFORTS)[number];

export function isReasoningEffort(value: string): value is ReasoningEffort {
  return (REASONING_EFFORTS as readonly string[]).includes(value);
}

export interface Settings {
  targetLang: LanguageCode;
  /** アカウントごとに利用可能なモデルが異なるため既定値を持たない */
  model: string | null;
  reasoningEffort: ReasoningEffort;
  fastMode: boolean;
  showSelectionButton: boolean;
  hoverOriginal: boolean;
  highlightPending: boolean;
}

export const DEFAULT_SETTINGS: Settings = {
  targetLang: "ja",
  model: null,
  reasoningEffort: "low",
  fastMode: false,
  showSelectionButton: true,
  hoverOriginal: true,
  highlightPending: true,
};

export function withDefaults(overrides: Partial<Settings>): Settings {
  return { ...DEFAULT_SETTINGS, ...overrides };
}
