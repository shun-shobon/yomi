import * as v from "valibot";

import { browser } from "#imports";

export const ContextMenuIdSchema = v.picklist(["translate-page", "translate-selection"]);

type ContextMenuId = v.InferOutput<typeof ContextMenuIdSchema>;

export async function setUpContextMenus(): Promise<void> {
	await browser.contextMenus.removeAll();
	browser.contextMenus.create({
		id: "translate-page" satisfies ContextMenuId,
		title: "このページを翻訳",
		contexts: ["page"],
	});
	browser.contextMenus.create({
		id: "translate-selection" satisfies ContextMenuId,
		title: "選択テキストを翻訳",
		contexts: ["selection"],
	});
}
