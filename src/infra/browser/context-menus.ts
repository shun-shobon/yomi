import { browser } from "#imports";

export type ContextMenuId = "translate-page" | "translate-selection";

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
