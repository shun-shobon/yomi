import * as v from "valibot";

import { browser, defineBackground } from "#imports";
import { toTranslateFailure } from "@/domain/api-error";
import { ContextMenuIdSchema, setUpContextMenus } from "@/infra/browser/context-menus";
import {
	activeTabId,
	openOptionsPage,
	openShortcutsPage,
	openUsagePage,
} from "@/infra/browser/tabs";
import { serveBackgroundApi, serveTranslatePort } from "@/infra/messaging/background-server";
import { sendToContent } from "@/infra/messaging/content-client";
import { CommandNameSchema } from "@/infra/messaging/protocol";
import type { CommandName, ContentMessage } from "@/infra/messaging/protocol";
import { hideAuthStorageFromContentScripts } from "@/infra/storage/auth";
import {
	getAuthState,
	handleTabRemoved,
	handleTabUpdated,
	signOut,
	startSignIn,
} from "@/usecases/background/auth";
import {
	commitNavigation,
	dismissOffer,
	forgetTab,
	getTabPageState,
	setTranslating,
} from "@/usecases/background/tab-state";
import { listModels, translate } from "@/usecases/background/translate";
import {
	lookupPageTranslations,
	storePageTranslations,
} from "@/usecases/background/translation-cache";

const COMMAND_MESSAGES: Record<CommandName, ContentMessage> = {
	"translate-page": { type: "command:translate" },
	"toggle-original": { type: "command:toggleOriginal" },
};

const serializeFailure = (e: unknown) => toTranslateFailure(e).serialize();

export default defineBackground(() => {
	void hideAuthStorageFromContentScripts();
	// service worker 再起動後もサインインを完了できるよう、リスナーはトップレベルで同期的に登録する
	browser.tabs.onUpdated.addListener((tabId, info) => {
		void handleTabUpdated(tabId, info.url).then(async (signedIn) => {
			if (signedIn) await openOptionsPage();
		});
	});
	browser.tabs.onRemoved.addListener((tabId) => {
		void handleTabRemoved(tabId);
		void forgetTab(tabId);
	});

	browser.webNavigation.onCommitted.addListener((details) => {
		if (details.frameId === 0) void commitNavigation(details.tabId, details);
	});

	browser.runtime.onInstalled.addListener(({ reason }) => {
		void setUpContextMenus();
		if (reason === "install") void openOptionsPage();
	});

	browser.contextMenus.onClicked.addListener((info, tab) => {
		if (tab?.id == null || !v.is(ContextMenuIdSchema, info.menuItemId)) return;
		if (info.menuItemId === "translate-page") {
			notifyTab(tab.id, { type: "page:translate" });
		} else if (info.selectionText != null) {
			notifyTab(tab.id, { type: "selection:translate", text: info.selectionText });
		}
	});

	browser.commands.onCommand.addListener((command) => {
		if (!v.is(CommandNameSchema, command)) return;
		void activeTabId().then((tabId) => {
			if (tabId != null) notifyTab(tabId, COMMAND_MESSAGES[command]);
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
			"cache:lookup": lookupPageTranslations,
			"cache:store": storePageTranslations,
			"tab:getState": async (_, { tabId }) =>
				tabId == null
					? { offerDismissed: false, translating: false }
					: await getTabPageState(tabId),
			"tab:setTranslating": async ({ translating }, { tabId }) => {
				if (tabId != null) await setTranslating(tabId, translating);
			},
			"offer:dismiss": async (_, { tabId }) => {
				if (tabId != null) await dismissOffer(tabId);
			},
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
