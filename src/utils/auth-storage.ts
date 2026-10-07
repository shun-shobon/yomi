import { storage } from "#imports";

export interface Credentials {
  /** dynamic registration で発行された oaiapp_... の client_id */
  clientId: string;
  email: string | null;
  idToken: string;
  accessToken: string;
  refreshToken: string;
  expiresAt: number;
}

export const credentialsItem = storage.defineItem<Credentials | null>("local:credentials", {
  fallback: null,
});

export interface PendingSignIn {
  status: "pending";
  tabId: number;
  verifier: string;
  state: string;
  nonce: string;
  /** 再サインイン時に使った client_id。初回は dynamic registration なので null */
  clientId: string | null;
}

/**
 * サインインの進行状況。認可画面での操作中に service worker が停止しても完了できるよう session storage に置く
 */
export type SignInState = PendingSignIn | { status: "failed"; message: string } | null;

export const signInItem = storage.defineItem<SignInState>("session:signIn", { fallback: null });

/** SIWC ガイドラインにより「You're using your ChatGPT plan」モーダルは初回サインイン時だけ表示する */
export const welcomeItem = storage.defineItem<"never" | "pending" | "shown">("local:welcome", {
  fallback: "never",
});
