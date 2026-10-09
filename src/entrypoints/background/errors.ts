import { TranslateFailure } from "@/domain/failure";

import { ApiError } from "./openai";

/** background で起きたあらゆる失敗を、呼び出し側が行動を決められる TranslateFailure に変換する */
export function toTranslateFailure(e: unknown): TranslateFailure {
  if (e instanceof TranslateFailure) return e;
  if (e instanceof ApiError) return fromApiError(e);
  return new TranslateFailure("other", e instanceof Error ? e.message : String(e));
}

function fromApiError(e: ApiError): TranslateFailure {
  switch (e.code) {
    case "subscription_sharing_usage_limit_exceeded":
      return new TranslateFailure(
        "usage_limit",
        "使用量の上限に達しました。ChatGPT の設定でプランまたはこのアプリの上限を確認してください。",
      );
    case "subscription_sharing_invalid_user":
      return new TranslateFailure("signed_out", e.message);
  }
  switch (e.status) {
    case 403:
      return new TranslateFailure("not_eligible", e.message);
    case 503:
      return new TranslateFailure("unavailable", e.message);
    default:
      return new TranslateFailure("other", e.message);
  }
}
