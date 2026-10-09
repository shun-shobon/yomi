import type { PageState } from "@/domain/page";
import type { ContentMessage } from "@/infra/messaging/protocol";

import type { Overlay } from "./overlay";
import type { PageTranslator } from "./page-translator";
import type { SelectionTranslator } from "./selection-translator";

/** popup・ショートカット・右クリックメニューからの指示を実行し、実行後のページ状態を返す */
export function createPageCommands(deps: {
  overlay: Overlay;
  page: PageTranslator;
  selection: SelectionTranslator;
}): (message: ContentMessage) => PageState {
  const { overlay, page, selection } = deps;

  const startPage = () => {
    const wasActive = page.isActive;
    page.start();
    if (!wasActive) overlay.toast("ページの翻訳を開始しました");
  };

  const run = (message: ContentMessage) => {
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

  return (message) => {
    run(message);
    return page.getState();
  };
}
