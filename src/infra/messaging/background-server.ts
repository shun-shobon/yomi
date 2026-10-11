import * as v from "valibot";

import { browser } from "#imports";
import type { SerializedFailure } from "@/domain/failure";

import {
	BACKGROUND_API,
	BackgroundRequestSchema,
	TRANSLATE_PORT,
	TranslateRequestSchema,
} from "./protocol";
import type {
	BackgroundMethod,
	BackgroundResponse,
	ParamsOf,
	ResultOf,
	TranslateEvent,
	TranslateRequest,
} from "./protocol";

/** fetch のストリーム受信だけでは service worker の idle タイマーが延長されないため、拡張 API を定期的に呼ぶ */
const KEEP_ALIVE_INTERVAL_MS = 20_000;

/** 送信元が拡張のページ（ポップアップなど）のときは tabId がない */
export interface BackgroundSender {
	tabId: number | undefined;
	origin: string | undefined;
}

export type BackgroundHandlers = {
	[K in BackgroundMethod]: (params: ParamsOf<K>, sender: BackgroundSender) => Promise<ResultOf<K>>;
};

type ToFailure = (e: unknown) => SerializedFailure;

export function serveBackgroundApi(handlers: BackgroundHandlers, toFailure: ToFailure) {
	browser.runtime.onMessage.addListener((raw: unknown, sender, sendResponse) => {
		const respond = (response: BackgroundResponse) => sendResponse(response);
		dispatch(handlers, raw, { tabId: sender.tab?.id, origin: sender.origin }).then(
			(value) => respond({ ok: true, value }),
			(e: unknown) => respond({ ok: false, failure: toFailure(e) }),
		);
		return true;
	});
}

async function dispatch(
	handlers: BackgroundHandlers,
	raw: unknown,
	sender: BackgroundSender,
): Promise<unknown> {
	const { type, params } = v.parse(BackgroundRequestSchema, raw);
	return await call(handlers, type, params, sender);
}

function call<K extends BackgroundMethod>(
	handlers: BackgroundHandlers,
	type: K,
	params: unknown,
	sender: BackgroundSender,
) {
	return handlers[type](v.parse(BACKGROUND_API[type].params, params), sender);
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
		port.onMessage.addListener((raw: unknown) => {
			const post = (event: TranslateEvent) => {
				if (!controller.signal.aborted) port.postMessage(event);
			};
			const keepAlive = setInterval(
				() => void browser.runtime.getPlatformInfo(),
				KEEP_ALIVE_INTERVAL_MS,
			);
			const run = async () =>
				await translate(v.parse(TranslateRequestSchema, raw), controller.signal, (text) =>
					post({ type: "delta", text }),
				);
			void run()
				.then(
					() => post({ type: "done" }),
					(e: unknown) => post({ type: "error", failure: toFailure(e) }),
				)
				.finally(() => clearInterval(keepAlive));
		});
	});
}
