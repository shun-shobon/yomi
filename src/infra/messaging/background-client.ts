import { browser } from "#imports";
import { TranslateFailure } from "@/domain/failure";

import type { BackgroundApi, BackgroundRequest, BackgroundResponse, ParamsOf } from "./protocol";

export async function callBackground<K extends keyof BackgroundApi>(
  type: K,
  ...[params]: ParamsOf<K> extends void ? [] : [ParamsOf<K>]
): Promise<BackgroundApi[K]> {
  const request = { type, params } as BackgroundRequest;
  const response: BackgroundResponse<K> = await browser.runtime.sendMessage(request);
  if (!response.ok) throw TranslateFailure.from(response.failure);
  return response.value;
}
