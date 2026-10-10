import type { SerializedFailure } from "@/domain/failure";
import type { ModelInfo } from "@/domain/models";

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
}

export type BackgroundRequest = { type: keyof BackgroundApi };

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
