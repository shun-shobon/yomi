import type { PageState } from "@/domain/page";
import type { ContentMessage } from "@/infra/messaging/protocol";

import type { Overlay } from "./overlay";
import type { PageTranslator } from "./page-translator";
import type { SelectionTranslator } from "./selection-translator";
import { startPageTranslation } from "./start-page";

export function createPageCommands(deps: {
	overlay: Overlay;
	page: PageTranslator;
	selection: SelectionTranslator;
}): (message: ContentMessage) => PageState {
	const { overlay, page, selection } = deps;

	const startPage = () => startPageTranslation(overlay, page);

	const run = (message: ContentMessage): void => {
		switch (message.type) {
			case "page:getState":
				break;
			case "page:translate":
				startPage();
				break;
			case "page:stop":
				page.stop();
				break;
			case "page:showOriginal":
				page.showOriginal();
				break;
			case "page:showTranslation":
				overlay.hideOffer();
				page.start();
				break;
			case "command:translate":
				if (selection.translateCurrent()) break;
				if (page.isActive) {
					page.stop();
					overlay.toast("翻訳を停止しました");
				} else {
					startPage();
				}
				break;
			case "command:toggleOriginal":
				if (page.hasTranslations()) page.toggleOriginal();
				break;
			case "selection:translate":
				selection.translateText(message.text);
				break;
		}
	};

	return (message) => {
		run(message);
		return page.getState();
	};
}
