import { storage } from "#imports";
import { withDefaults, type Settings } from "@/domain/settings";

/** ユーザーが変更した項目だけを保存し、既定値の変更が既存ユーザーにも反映されるようにする */
const overridesItem = storage.defineItem<Partial<Settings>>("sync:settings", { fallback: {} });

export async function getSettings(): Promise<Settings> {
  return withDefaults(await overridesItem.getValue());
}

export async function updateSettings(patch: Partial<Settings>): Promise<void> {
  await overridesItem.setValue({ ...(await overridesItem.getValue()), ...patch });
}

export function watchSettings(cb: (settings: Settings) => void): () => void {
  return overridesItem.watch((overrides) => cb(withDefaults(overrides)));
}
