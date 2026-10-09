import { browser } from "#imports";
import type { PageState } from "@/domain/page";

import type { ContentMessage } from "./protocol";

/** content script を注入できないページ（chrome:// など）では reject する */
export function sendToContent(tabId: number, message: ContentMessage): Promise<PageState> {
  return browser.tabs.sendMessage(tabId, message);
}
