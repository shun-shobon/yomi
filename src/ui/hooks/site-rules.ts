import { createSignal, onCleanup } from "solid-js";
import type { Accessor } from "solid-js";

import type { SiteRules } from "@/domain/site-rules";
import { getSiteRules, updateSiteRules, watchSiteRules } from "@/infra/storage/site-rules";

export function createSiteRules(): [
	Accessor<SiteRules | null>,
	(update: (rules: SiteRules) => SiteRules) => void,
] {
	const [rules, setRules] = createSignal<SiteRules | null>(null);
	void getSiteRules().then(setRules);
	onCleanup(watchSiteRules(setRules));
	const update = (fn: (rules: SiteRules) => SiteRules) => {
		setRules((r) => r && fn(r));
		void updateSiteRules(fn);
	};
	return [rules, update];
}
