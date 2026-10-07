import type { ReasoningEffort } from "./settings";

export const MANAGE_USAGE_URL = "https://chatgpt.com/settings/usage";

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

/** content → background（runtime.connect の name="translate"） */
export interface TranslateRequest {
  instructions: string;
  input: string;
}

/** background → content */
export type TranslateEvent =
  | { type: "delta"; text: string }
  | { type: "done" }
  | { type: "error"; failure: SerializedFailure };

export interface ModelInfo {
  slug: string;
  displayName: string;
  reasoningEfforts: ReasoningEffort[];
  defaultReasoningEffort: ReasoningEffort;
  /** 優先処理（Codex の Fast モード）に対応しているか */
  supportsFast: boolean;
}

export interface AuthState {
  signedIn: boolean;
  email: string | null;
}

/** popup / options / content → background のメッセージと応答 */
export interface BackgroundApi {
  "auth:getState": AuthState;
  "auth:signIn": void;
  "auth:signOut": void;
  "models:list": ModelInfo[];
  "open:options": void;
  "open:usage": void;
  "open:shortcuts": void;
}

export type BackgroundRequest = { type: keyof BackgroundApi };

export type BackgroundResponse<K extends keyof BackgroundApi> =
  | { ok: true; value: BackgroundApi[K] }
  | { ok: false; failure: SerializedFailure };

export interface PageState {
  /** 翻訳セッションが有効で、スクロールや DOM 変化に追従して翻訳し続けている */
  active: boolean;
  showing: "translation" | "original";
  /** 翻訳待ち + 翻訳中のセグメント数 */
  busy: number;
  done: number;
  failed: number;
}

/** popup / background → content。応答は常に PageState */
export type ContentMessage =
  | { type: "page:getState" }
  | { type: "page:translate" }
  | { type: "page:stop" }
  | { type: "page:showOriginal" }
  | { type: "page:showTranslation" }
  | { type: "command:translate" }
  | { type: "command:toggleOriginal" }
  | { type: "selection:translate"; text: string };

export type CommandName = "translate-page" | "toggle-original";
