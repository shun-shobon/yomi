import { browser, defineBackground } from "#imports";
import { toTranslateFailure } from "@/domain/api-error";
import { setUpContextMenus, type ContextMenuId } from "@/infra/browser/context-menus";
import {
  activeTabId,
  openOptionsPage,
  openShortcutsPage,
  openUsagePage,
} from "@/infra/browser/tabs";
import { serveBackgroundApi, serveTranslatePort } from "@/infra/messaging/background-server";
import { sendToContent } from "@/infra/messaging/content-client";
import type { CommandName, ContentMessage } from "@/infra/messaging/protocol";
import {
  getAuthState,
  handleTabRemoved,
  handleTabUpdated,
  signOut,
  startSignIn,
} from "@/usecases/background/auth";
import { listModels, translate } from "@/usecases/background/translate";

const COMMAND_MESSAGES: Record<CommandName, ContentMessage> = {
  "translate-page": { type: "command:translate" },
  "toggle-original": { type: "command:toggleOriginal" },
};

const serializeFailure = (e: unknown) => toTranslateFailure(e).serialize();

export default defineBackground(() => {
  // service worker 再起動後もサインインを完了できるよう、リスナーはトップレベルで同期的に登録する
  browser.tabs.onUpdated.addListener((tabId, info) => {
    void handleTabUpdated(tabId, info.url).then(async (signedIn) => {
      if (signedIn) await openOptionsPage();
    });
  });
  browser.tabs.onRemoved.addListener((tabId) => void handleTabRemoved(tabId));

  browser.runtime.onInstalled.addListener(({ reason }) => {
    void setUpContextMenus();
    if (reason === "install") void openOptionsPage();
  });

  browser.contextMenus.onClicked.addListener((info, tab) => {
    if (tab?.id === undefined) return;
    const id = info.menuItemId as ContextMenuId;
    if (id === "translate-page") {
      notifyTab(tab.id, { type: "page:translate" });
    } else if (id === "translate-selection" && info.selectionText) {
      notifyTab(tab.id, { type: "selection:translate", text: info.selectionText });
    }
  });

  browser.commands.onCommand.addListener((command) => {
    void activeTabId().then((tabId) => {
      if (tabId !== undefined) notifyTab(tabId, COMMAND_MESSAGES[command as CommandName]);
    });
  });

  serveBackgroundApi(
    {
      "auth:getState": getAuthState,
      "auth:signIn": startSignIn,
      "auth:signOut": signOut,
      "models:list": listModels,
      "open:options": openOptionsPage,
      "open:usage": openUsagePage,
      "open:shortcuts": openShortcutsPage,
    },
    serializeFailure,
  );
  serveTranslatePort(translate, serializeFailure);
});

function notifyTab(tabId: number, message: ContentMessage) {
  sendToContent(tabId, message).catch(() => {
    // content script を注入できないページ（chrome:// など）では何もしない
  });
}
