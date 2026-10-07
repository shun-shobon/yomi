import { browser } from "#imports";

import {
  TranslateFailure,
  type BackgroundApi,
  type BackgroundRequest,
  type BackgroundResponse,
} from "./messages";

export async function callBackground<K extends keyof BackgroundApi>(
  type: K,
): Promise<BackgroundApi[K]> {
  const request: BackgroundRequest = { type };
  const response: BackgroundResponse<K> = await browser.runtime.sendMessage(request);
  if (!response.ok) throw TranslateFailure.from(response.failure);
  return response.value;
}
