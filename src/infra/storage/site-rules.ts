import { EMPTY_SITE_RULES, SiteRulesSchema } from "@/domain/site-rules";
import type { SiteRules } from "@/domain/site-rules";

import { defineValidatedItem } from "./item";

/** 1 項目あたりの sync storage の上限（8KB）を設定と分け合わないよう、別の項目に置く */
const siteRulesItem = defineValidatedItem("sync:siteRules", SiteRulesSchema, EMPTY_SITE_RULES);

export function getSiteRules(): Promise<SiteRules> {
	return siteRulesItem.getValue();
}

export async function updateSiteRules(update: (rules: SiteRules) => SiteRules): Promise<void> {
	await siteRulesItem.setValue(update(await siteRulesItem.getValue()));
}

export function watchSiteRules(cb: (rules: SiteRules) => void): () => void {
	return siteRulesItem.watch(cb);
}
