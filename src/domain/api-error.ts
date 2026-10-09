import { TranslateFailure } from "./failure";

/** API の失敗。HTTP 応答前やストリーム途中の失敗は status を持たない */
export class ApiError extends Error {
  constructor(
    readonly status: number | null,
    readonly code: string | null,
    message: string,
  ) {
    super(message);
  }

  /** access token が期限前に失効していた可能性があり、refresh すれば成功しうる */
  get isAuthExpired(): boolean {
    return this.status === 401 && this.code !== "subscription_sharing_invalid_user";
  }
}

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
