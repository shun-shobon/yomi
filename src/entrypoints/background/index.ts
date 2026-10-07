import { browser, defineBackground, type Browser } from "#imports";
import {
  MANAGE_USAGE_URL,
  TranslateFailure,
  type BackgroundApi,
  type BackgroundRequest,
  type BackgroundResponse,
  type CommandName,
  type ContentMessage,
  type TranslateEvent,
  type TranslateRequest,
} from "@/utils/messages";
import { getSettings } from "@/utils/settings";

import {
  getAccessToken,
  getAuthState,
  handleTabRemoved,
  handleTabUpdated,
  signOut,
  startSignIn,
} from "./auth";
import { toTranslateFailure } from "./errors";
import { ApiError, listModels, streamResponse } from "./openai";

/** fetch のストリーム受信だけでは service worker の idle タイマーが延長されないため、拡張 API を定期的に呼ぶ */
const KEEP_ALIVE_INTERVAL_MS = 20_000;

const COMMAND_MESSAGES: Record<CommandName, ContentMessage> = {
  "translate-page": { type: "command:translate" },
  "toggle-original": { type: "command:toggleOriginal" },
};

export default defineBackground(() => {
  // service worker 再起動後もサインインを完了できるよう、リスナーはトップレベルで同期的に登録する
  browser.tabs.onUpdated.addListener((tabId, info) => {
    void handleTabUpdated(tabId, info.url).then(async (signedIn) => {
      if (signedIn) await browser.runtime.openOptionsPage();
    });
  });
  browser.tabs.onRemoved.addListener((tabId) => void handleTabRemoved(tabId));

  browser.runtime.onInstalled.addListener(({ reason }) => {
    void setUpContextMenus();
    if (reason === "install") void browser.runtime.openOptionsPage();
  });

  browser.contextMenus.onClicked.addListener((info, tab) => {
    if (tab?.id === undefined) return;
    if (info.menuItemId === "translate-page") {
      sendToTab(tab.id, { type: "page:translate" });
    } else if (info.menuItemId === "translate-selection" && info.selectionText) {
      sendToTab(tab.id, { type: "selection:translate", text: info.selectionText });
    }
  });

  browser.commands.onCommand.addListener((command) => {
    void browser.tabs.query({ active: true, currentWindow: true }).then(([tab]) => {
      if (tab?.id !== undefined) sendToTab(tab.id, COMMAND_MESSAGES[command as CommandName]);
    });
  });

  browser.runtime.onMessage.addListener((request: BackgroundRequest, _sender, sendResponse) => {
    handlers[request.type]().then(
      (value) => sendResponse({ ok: true, value }),
      (e: unknown) =>
        sendResponse({
          ok: false,
          failure: toTranslateFailure(e).serialize(),
        } satisfies BackgroundResponse<keyof BackgroundApi>),
    );
    return true;
  });

  browser.runtime.onConnect.addListener((port) => {
    if (port.name === "translate") servePort(port);
  });
});

async function setUpContextMenus() {
  await browser.contextMenus.removeAll();
  browser.contextMenus.create({
    id: "translate-page",
    title: "このページを翻訳",
    contexts: ["page"],
  });
  browser.contextMenus.create({
    id: "translate-selection",
    title: "選択テキストを翻訳",
    contexts: ["selection"],
  });
}

const handlers: { [K in keyof BackgroundApi]: () => Promise<BackgroundApi[K]> } = {
  "auth:getState": getAuthState,
  "auth:signIn": startSignIn,
  "auth:signOut": signOut,
  "models:list": () => withAuthRetry(listModels),
  "open:options": () => browser.runtime.openOptionsPage(),
  "open:usage": async () => {
    await browser.tabs.create({ url: MANAGE_USAGE_URL });
  },
  "open:shortcuts": async () => {
    await browser.tabs.create({ url: "chrome://extensions/shortcuts" });
  },
};

function servePort(port: Browser.runtime.Port) {
  const controller = new AbortController();
  port.onDisconnect.addListener(() => controller.abort());
  port.onMessage.addListener((req: TranslateRequest) => {
    const post = (event: TranslateEvent) => {
      if (!controller.signal.aborted) port.postMessage(event);
    };
    const keepAlive = setInterval(
      () => void browser.runtime.getPlatformInfo(),
      KEEP_ALIVE_INTERVAL_MS,
    );
    void translate(req, controller.signal, (text) => post({ type: "delta", text }))
      .then(
        () => post({ type: "done" }),
        (e: unknown) => post({ type: "error", failure: toTranslateFailure(e).serialize() }),
      )
      .finally(() => clearInterval(keepAlive));
  });
}

async function translate(
  req: TranslateRequest,
  signal: AbortSignal,
  onDelta: (text: string) => void,
): Promise<void> {
  const { model, reasoningEffort, fastMode } = await getSettings();
  if (!model) throw new TranslateFailure("no_model", "翻訳に使うモデルを選択してください。");
  let received = false;
  await withAuthRetry(
    (token) =>
      streamResponse({
        token,
        model,
        reasoningEffort,
        fast: fastMode,
        instructions: req.instructions,
        input: req.input,
        signal,
        onDelta: (text) => {
          received = true;
          onDelta(text);
        },
      }),
    () => !received,
  );
}

/** access token が期限前に失効していた場合に備え、401 は一度だけ refresh して再試行する */
async function withAuthRetry<T>(
  fn: (token: string) => Promise<T>,
  canRetry: () => boolean = () => true,
): Promise<T> {
  try {
    return await fn(await getAccessToken());
  } catch (e) {
    const retryable =
      e instanceof ApiError &&
      e.status === 401 &&
      e.code !== "subscription_sharing_invalid_user" &&
      canRetry();
    if (!retryable) throw e;
    return fn(await getAccessToken(true));
  }
}

function sendToTab(tabId: number, message: ContentMessage) {
  browser.tabs.sendMessage(tabId, message).catch(() => {
    // content script を注入できないページ（chrome:// など）では何もしない
  });
}
