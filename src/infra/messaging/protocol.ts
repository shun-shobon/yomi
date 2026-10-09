import type { SerializedFailure } from "@/domain/failure";
import type { ModelInfo } from "@/domain/models";

/** content → background の翻訳ストリームに使う runtime.connect の name */
export const TRANSLATE_PORT = "translate";

/** content → background（TRANSLATE_PORT） */
export interface TranslateRequest {
  instructions: string;
  input: string;
}

/** background → content */
export type TranslateEvent =
  | { type: "delta"; text: string }
  | { type: "done" }
  | { type: "error"; failure: SerializedFailure };

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
