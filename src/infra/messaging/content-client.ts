import * as v from "valibot";

import { browser } from "#imports";
import { PageStateSchema } from "@/domain/page";
import type { PageState } from "@/domain/page";

import type { ContentMessage } from "./protocol";

export async function sendToContent(tabId: number, message: ContentMessage): Promise<PageState> {
	const raw: unknown = await browser.tabs.sendMessage(tabId, message);
	return v.parse(PageStateSchema, raw);
}
