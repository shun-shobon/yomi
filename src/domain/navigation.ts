/** webNavigation が報告するトップフレームの遷移 */
export interface Navigation {
	transitionType: string;
	transitionQualifiers: string[];
}

/** 翻訳中のタブで、遷移した先のページも続けて翻訳するか */
export function continuesTranslation(nav: Navigation): boolean {
	// アドレスバーから開いたページは、リンクとして報告されても新しく開き直したものとして扱う
	if (nav.transitionQualifiers.includes("from_address_bar")) return false;
	if (nav.transitionQualifiers.includes("forward_back")) return true;
	return nav.transitionType === "link" || nav.transitionType === "form_submit";
}
