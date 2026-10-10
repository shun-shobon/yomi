import * as v from "valibot";

import { browser } from "#imports";
import { TranslateFailure } from "@/domain/failure";

import {
  BACKGROUND_API,
  BackgroundResponseSchema,
  type BackgroundMethod,
  type ParamsOf,
  type ResultOf,
} from "./protocol";

export async function callBackground<K extends BackgroundMethod>(
  type: K,
  ...[params]: [ParamsOf<K>] extends [void] ? [] : [Exclude<ParamsOf<K>, void>]
): Promise<ResultOf<K>> {
  const raw: unknown = await browser.runtime.sendMessage({ type, params });
  const response = v.parse(BackgroundResponseSchema, raw);
  if (!response.ok) throw TranslateFailure.from(response.failure);
  return v.parse(BACKGROUND_API[type].result, response.value);
}
