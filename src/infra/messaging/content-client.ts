import { browser } from "#imports";
import type { PageState } from "@/domain/page";

import type { ContentMessage } from "./protocol";

export function sendToContent(tabId: number, message: ContentMessage): Promise<PageState> {
  return browser.tabs.sendMessage(tabId, message);
}
