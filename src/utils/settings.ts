import { storage } from "#imports";

import type { LanguageCode } from "./languages";

/** Responses API が受け付ける reasoning.effort。モデルごとに対応する値は /v1/models が返す */
const REASONING_EFFORTS = ["none", "minimal", "low", "medium", "high", "xhigh", "max"] as const;

export type ReasoningEffort = (typeof REASONING_EFFORTS)[number];

export function isReasoningEffort(value: string): value is ReasoningEffort {
  return (REASONING_EFFORTS as readonly string[]).includes(value);
}

export interface Settings {
  targetLang: LanguageCode;
  /** /v1/models の slug。アカウントごとに利用可能なモデルが異なるため既定値を持たない */
  model: string | null;
  reasoningEffort: ReasoningEffort;
  /** service_tier: "priority" で優先処理させる。速くなる代わりに使用量の消費が増える */
  fastMode: boolean;
  showSelectionButton: boolean;
  hoverOriginal: boolean;
  highlightPending: boolean;
}

const DEFAULT_SETTINGS: Settings = {
  targetLang: "ja",
  model: null,
  reasoningEffort: "low",
  fastMode: false,
  showSelectionButton: true,
  hoverOriginal: true,
  highlightPending: true,
};

/** ユーザーが変更した項目だけを保存し、既定値の変更が既存ユーザーにも反映されるようにする */
const overridesItem = storage.defineItem<Partial<Settings>>("sync:settings", { fallback: {} });

const withDefaults = (overrides: Partial<Settings>): Settings => ({
  ...DEFAULT_SETTINGS,
  ...overrides,
});

export async function getSettings(): Promise<Settings> {
  return withDefaults(await overridesItem.getValue());
}

export async function updateSettings(patch: Partial<Settings>): Promise<void> {
  await overridesItem.setValue({ ...(await overridesItem.getValue()), ...patch });
}

export function watchSettings(cb: (settings: Settings) => void): () => void {
  return overridesItem.watch((overrides) => cb(withDefaults(overrides)));
}
