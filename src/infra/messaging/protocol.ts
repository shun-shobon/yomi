import type { SerializedFailure } from "@/domain/failure";
import type { ModelInfo } from "@/domain/models";
import type { CachedTranslation } from "@/domain/translation-cache";

export const TRANSLATE_PORT = "translate";

export interface TranslateRequest {
  instructions: string;
  input: string;
}

export type TranslateEvent =
  | { type: "delta"; text: string }
  | { type: "done" }
  | { type: "error"; failure: SerializedFailure };

export interface AuthState {
  signedIn: boolean;
  email: string | null;
}

export interface BackgroundApi {
  "auth:getState": AuthState;
  "auth:signIn": void;
  "auth:signOut": void;
  "models:list": ModelInfo[];
  "open:options": void;
  "open:usage": void;
  "open:shortcuts": void;
  "cache:lookup": (string | null)[];
  "cache:store": void;
}

export interface BackgroundParams {
  "cache:lookup": { keys: string[] };
  "cache:store": { entries: CachedTranslation[] };
}

export type ParamsOf<K extends keyof BackgroundApi> = K extends keyof BackgroundParams
  ? BackgroundParams[K]
  : void;

export type BackgroundRequest = {
  [K in keyof BackgroundApi]: { type: K; params: ParamsOf<K> };
}[keyof BackgroundApi];

export type BackgroundResponse<K extends keyof BackgroundApi> =
  | { ok: true; value: BackgroundApi[K] }
  | { ok: false; failure: SerializedFailure };

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
