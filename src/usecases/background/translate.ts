import { ApiError } from "@/domain/api-error";
import { TranslateFailure } from "@/domain/failure";
import type { ModelInfo } from "@/domain/models";
import type { TranslateRequest } from "@/infra/messaging/protocol";
import { listModels as fetchModels, streamResponse } from "@/infra/openai/client";
import { getSettings } from "@/infra/storage/settings";

import { getAccessToken } from "./auth";

export function listModels(): Promise<ModelInfo[]> {
	return withAuthRetry(fetchModels);
}

export async function translate(
	req: TranslateRequest,
	signal: AbortSignal,
	onDelta: (text: string) => void,
): Promise<void> {
	const { model, reasoningEffort, fastMode } = await getSettings();
	if (model == null) throw new TranslateFailure("no_model", "翻訳に使うモデルを選択してください。");
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
		// 訳文の一部を返した後に再試行すると、呼び出し側に同じ訳文が重複して届く
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
		if (!(e instanceof ApiError && e.isAuthExpired && canRetry())) throw e;
		return await fn(await getAccessToken(true));
	}
}
