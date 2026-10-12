import type { Overlay } from "./overlay";
import type { PageTranslator } from "./page-translator";

export function startPageTranslation(overlay: Overlay, page: PageTranslator): void {
	overlay.hideOffer();
	const wasActive = page.isActive;
	page.start();
	if (!wasActive) overlay.toast("ページの翻訳を開始しました");
}
