/** 呼び出し側が取るべき行動で分類した失敗の種別 */
export type TranslateErrorKind =
  | "signed_out" // サインインが必要
  | "no_model" // モデル未選択
  | "usage_limit" // ChatGPT プランの使用量上限
  | "not_eligible" // プラン対象外・地域制限など
  | "extension_reloaded" // 拡張の更新で content script と background の接続が切れた
  | "unavailable" // 一時的な障害
  | "other";

/** プロセス間で受け渡す失敗の表現。runtime messaging を通すため plain object */
export interface SerializedFailure {
  kind: TranslateErrorKind;
  message: string;
}

export class TranslateFailure extends Error {
  constructor(
    readonly kind: TranslateErrorKind,
    message: string,
  ) {
    super(message);
  }

  serialize(): SerializedFailure {
    return { kind: this.kind, message: this.message };
  }

  static from(failure: SerializedFailure): TranslateFailure {
    return new TranslateFailure(failure.kind, failure.message);
  }
}

/** ユーザーが失敗を解消するための操作 */
export type FailureRemedy = "sign_in" | "open_options" | "open_usage";

interface FailurePolicy {
  /** ページ翻訳を続けても同じ失敗を繰り返すだけなので、セッションを止める */
  fatal: boolean;
  remedy: FailureRemedy | null;
}

export const FAILURE_POLICY: Record<TranslateErrorKind, FailurePolicy> = {
  signed_out: { fatal: true, remedy: "sign_in" },
  no_model: { fatal: true, remedy: "open_options" },
  usage_limit: { fatal: true, remedy: "open_usage" },
  not_eligible: { fatal: true, remedy: null },
  extension_reloaded: { fatal: true, remedy: null },
  unavailable: { fatal: false, remedy: null },
  other: { fatal: false, remedy: null },
};
