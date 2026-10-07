import { browser, defineContentScript } from "#imports";
import type { ContentMessage, PageState } from "@/utils/messages";
import { getSettings, watchSettings } from "@/utils/settings";

import { FAILURE_POLICY, notifyFailure } from "./failure-policy";
import { watchHoverOriginal } from "./hover";
import { Overlay } from "./overlay";
import { PageTranslator } from "./page-translator";
import { SelectionTranslator } from "./selection";

export default defineContentScript({
  matches: ["<all_urls>"],
  runAt: "document_idle",
  async main(ctx) {
    let settings = await getSettings();
    watchSettings((next) => {
      settings = next;
    });
    const overlay = new Overlay();

    const page = new PageTranslator({
      getSettings: () => settings,
      onFatalFailure: (failure) => notifyFailure(overlay, failure),
      onPartialFailure: () =>
        overlay.toast("一部のテキストを翻訳できませんでした。もう一度翻訳すると再試行します。", {
          error: true,
        }),
    });
    const selection = new SelectionTranslator(overlay, {
      getSettings: () => settings,
      onFailure: (failure) => {
        // 解消方法のない失敗はパネル内の表示だけで十分
        if (FAILURE_POLICY[failure.kind].action) notifyFailure(overlay, failure);
      },
    });
    watchHoverOriginal(overlay, page, () => settings.hoverOriginal);
    // 拡張の更新・再読み込み後は古い content script が残るので、DOM の監視を止める
    ctx.onInvalidated(() => page.stop());

    const startPage = () => {
      const wasActive = page.isActive;
      page.start();
      if (!wasActive) overlay.toast("ページの翻訳を開始しました");
    };

    const handle = (message: ContentMessage) => {
      switch (message.type) {
        case "page:getState":
          return;
        case "page:translate":
          return startPage();
        case "page:stop":
          return page.stop();
        case "page:showOriginal":
          return page.showOriginal();
        case "page:showTranslation":
          return page.start();
        case "command:translate":
          if (selection.translateCurrent()) return;
          if (!page.isActive) return startPage();
          page.stop();
          return overlay.toast("翻訳を停止しました");
        case "command:toggleOriginal":
          if (page.hasTranslations()) page.toggleOriginal();
          return;
        case "selection:translate":
          return selection.translateText(message.text);
      }
    };

    browser.runtime.onMessage.addListener(
      (message: ContentMessage, _sender, sendResponse: (state: PageState) => void) => {
        handle(message);
        sendResponse(page.getState());
      },
    );
  },
});
