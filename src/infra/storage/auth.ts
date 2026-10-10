import * as v from "valibot";

import { defineValidatedItem } from "./item";

const CredentialsSchema = v.object({
  clientId: v.string(),
  email: v.nullable(v.string()),
  idToken: v.string(),
  accessToken: v.string(),
  refreshToken: v.string(),
  expiresAt: v.number(),
});

export type Credentials = v.InferOutput<typeof CredentialsSchema>;

export const credentialsItem = defineValidatedItem(
  "local:credentials",
  v.nullable(CredentialsSchema),
  null,
);

const PendingSignInSchema = v.object({
  status: v.literal("pending"),
  tabId: v.number(),
  verifier: v.string(),
  state: v.string(),
  nonce: v.string(),
  clientId: v.nullable(v.string()),
});

export type PendingSignIn = v.InferOutput<typeof PendingSignInSchema>;

/** 認可画面での操作中に service worker が停止しても完了できるよう session storage に置く */
export const signInItem = defineValidatedItem(
  "session:signIn",
  v.nullable(
    v.variant("status", [
      PendingSignInSchema,
      v.object({ status: v.literal("failed"), message: v.string() }),
    ]),
  ),
  null,
);

/** 発行済み client_id はサインアウト後の再サインインでも使い回す */
export const clientIdItem = defineValidatedItem("local:clientId", v.nullable(v.string()), null);

export const hostIdItem = defineValidatedItem("local:extAgentHostId", v.nullable(v.string()), null);
