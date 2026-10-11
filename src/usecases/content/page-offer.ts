import type { Settings } from "@/domain/settings";
import {
	decidePageOffer,
	languageLabel,
	pageLanguageKey,
	withAlwaysTranslate,
	withRule,
} from "@/domain/site-rules";
import { detectPageLanguage } from "@/infra/dom/page-language";
import { callBackground } from "@/infra/messaging/background-client";
import { getSiteRules, updateSiteRules } from "@/infra/storage/site-rules";

import type { Overlay } from "./overlay";
import type { PageTranslator } from "./page-translator";

/** サインイン前に翻訳を始めると、ページを開くたびにエラーを出してしまうので何もしない */
async function canTranslate(): Promise<boolean> {
	try {
		return (await callBackground("auth:getState")).signedIn;
	} catch {
		return false;
	}
}

export async function offerPageTranslation(deps: {
	overlay: Overlay;
	page: PageTranslator;
	getSettings: () => Settings;
}): Promise<void> {
	const { overlay, page } = deps;
	const host = location.hostname;
	// file:// などホストのないページにはサイト単位のルールを当てられない
	if (host === "") return;

	const settings = deps.getSettings();
	const [allowed, rules, detected, dismissed] = await Promise.all([
		canTranslate(),
		getSiteRules(),
		detectPageLanguage(),
		callBackground("offer:isDismissed").catch(() => false),
	]);
	if (!allowed || page.isActive) return;

	const pageLang = detected == null ? null : pageLanguageKey(detected);
	const decision = decidePageOffer({
		rules,
		host,
		pageLang,
		targetLang: settings.targetLang,
		offerEnabled: settings.offerTranslation,
	});
	if (decision === "translate") {
		page.start();
		return;
	}
	if (decision === "none" || pageLang == null || dismissed) return;

	const label = languageLabel(pageLang);
	overlay.showOffer({
		message: `このページは${label}です。翻訳しますか？`,
		actions: [
			{ label: "翻訳する", onClick: () => page.start() },
			{
				label: "このサイトは常に翻訳",
				onClick: () => {
					void updateSiteRules((r) => withAlwaysTranslate(r, host, true));
					page.start();
				},
			},
		],
		menu: [
			{
				label: "このサイトでは表示しない",
				onClick: () => void updateSiteRules((r) => withRule(r, "neverOffer", host)),
			},
			{
				label: `${label}のページでは表示しない`,
				onClick: () => void updateSiteRules((r) => withRule(r, "neverOfferLangs", pageLang)),
			},
		],
		onDismiss: () => void callBackground("offer:dismiss").catch(() => {}),
	});
}
