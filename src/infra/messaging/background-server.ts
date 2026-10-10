import { browser } from "#imports";
import type { SerializedFailure } from "@/domain/failure";

import {
  TRANSLATE_PORT,
  type BackgroundApi,
  type BackgroundRequest,
  type BackgroundResponse,
  type ParamsOf,
  type TranslateEvent,
  type TranslateRequest,
} from "./protocol";

/** fetch のストリーム受信だけでは service worker の idle タイマーが延長されないため、拡張 API を定期的に呼ぶ */
const KEEP_ALIVE_INTERVAL_MS = 20_000;

export type BackgroundHandlers = {
  [K in keyof BackgroundApi]: (params: ParamsOf<K>) => Promise<BackgroundApi[K]>;
};

type ToFailure = (e: unknown) => SerializedFailure;

export function serveBackgroundApi(handlers: BackgroundHandlers, toFailure: ToFailure) {
  browser.runtime.onMessage.addListener((request: BackgroundRequest, _sender, sendResponse) => {
    // TS は union になった関数を引数の対応付きで呼べない
    const handler = handlers[request.type] as (params: unknown) => Promise<unknown>;
    handler(request.params).then(
      (value) => sendResponse({ ok: true, value }),
      (e: unknown) =>
        sendResponse({
          ok: false,
          failure: toFailure(e),
        } satisfies BackgroundResponse<keyof BackgroundApi>),
    );
    return true;
  });
}

export type TranslateHandler = (
  req: TranslateRequest,
  signal: AbortSignal,
  onDelta: (text: string) => void,
) => Promise<void>;

export function serveTranslatePort(translate: TranslateHandler, toFailure: ToFailure) {
  browser.runtime.onConnect.addListener((port) => {
    if (port.name !== TRANSLATE_PORT) return;
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
          (e: unknown) => post({ type: "error", failure: toFailure(e) }),
        )
        .finally(() => clearInterval(keepAlive));
    });
  });
}
