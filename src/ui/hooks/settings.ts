import { createSignal, onCleanup } from "solid-js";
import type { Accessor } from "solid-js";

import type { Settings } from "@/domain/settings";
import { getSettings, updateSettings, watchSettings } from "@/infra/storage/settings";

export function createSettings(): [Accessor<Settings | null>, (patch: Partial<Settings>) => void] {
	const [settings, setSettings] = createSignal<Settings | null>(null);
	void getSettings().then(setSettings);
	onCleanup(watchSettings(setSettings));
	const update = (patch: Partial<Settings>) => {
		setSettings((s) => s && { ...s, ...patch });
		void updateSettings(patch);
	};
	return [settings, update];
}
