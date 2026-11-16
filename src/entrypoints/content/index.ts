import * as v from "valibot";

import { browser, defineContentScript } from "#imports";
import { FAILURE_POLICY } from "@/domain/failure";
import type { PageState } from "@/domain/page";
import { ContentMessageSchema } from "@/infra/messaging/protocol";
import { getSettings, watchSettings } from "@/infra/storage/settings";
import { createOverlay } from "@/ui/content/Overlay";
import { watchHoverOriginal } from "@/usecases/content/hover-original";
import { notifyFailure } from "@/usecases/content/notify-failure";
import { createPageCommands } from "@/usecases/content/page-commands";
import { createPageOffer, rememberPageTranslating } from "@/usecases/content/page-offer";
import { PageTranslator } from "@/usecases/content/page-translator";
import { SelectionTranslator } from "@/usecases/content/selection-translator";

export default defineContentScript({
	matches: ["<all_urls>"],
	runAt: "document_idle",
	async main(ctx) {
		let settings = await getSettings();
		watchSettings((next) => {
			settings = next;
		});
		const overlay = createOverlay();

		const page = new PageTranslator({
			getSettings: () => settings,
			onFatalFailure: (failure) => notifyFailure(overlay, failure),
			onPartialFailure: () =>
				overlay.toast("一部のテキストを翻訳できませんでした。もう一度翻訳すると再試行します。", {
					error: true,
				}),
			onActiveChange: rememberPageTranslating,
		});
		const selection = new SelectionTranslator(overlay, {
			getSettings: () => settings,
			onFailure: (failure) => {
				// 解消方法のない失敗はパネル内の表示だけで十分
				if (FAILURE_POLICY[failure.kind].remedy) notifyFailure(overlay, failure);
			},
		});
		watchHoverOriginal(overlay, page, () => settings.hoverOriginal);
		// 拡張の更新・再読み込み後は古い content script が残るので、DOM の監視を止める
		ctx.onInvalidated(() => page.stop());

		const runCommand = createPageCommands({ overlay, page, selection });
		browser.runtime.onMessage.addListener(
			(message: unknown, _sender, sendResponse: (state: PageState) => void) => {
				if (!v.is(ContentMessageSchema, message)) return;
				sendResponse(runCommand(message));
			},
		);
		const offer = createPageOffer({ overlay, page, getSettings: () => settings });
		// BFCache から戻っても main() は実行し直されないので、離れる・戻るの度に状態を合わせる
		ctx.addEventListener(window, "pagehide", () => {
			page.suspend();
			overlay.hideOffer();
		});
		ctx.addEventListener(window, "pageshow", (e) => {
			if (e.persisted) void offer();
		});
		void offer();
	},
});
