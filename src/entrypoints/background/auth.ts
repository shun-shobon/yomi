import { browser, storage } from "#imports";
import {
  credentialsItem,
  signInItem,
  welcomeItem,
  type Credentials,
  type PendingSignIn,
} from "@/utils/auth-storage";
import { TranslateFailure, type AuthState } from "@/utils/messages";

const AUTHORIZE_URL = "https://auth.openai.com/api/accounts/authorize";
const TOKEN_URL = "https://auth.openai.com/api/accounts/oauth/token";
const REVOKE_URL = "https://auth.openai.com/api/accounts/oauth/revoke";
const RESOURCE = "https://api.openai.com/v1";
const SCOPE = "openid profile email offline_access resource.invoke chatgpt.tokens.use.direct";
const REQUIRED_SCOPE = "chatgpt.tokens.use.direct";
// SIWC は loopback 以外の redirect_uri を受け付けない。拡張は待ち受けできないので遷移 URL を横取りする
const REDIRECT_URI = "http://127.0.0.1:1455/callback";
const DYNAMIC_CLIENT_ID = "dynamic_agent_client";
const APP_NAME = "Yomi";
const REFRESH_MARGIN_MS = 60 * 1000;

const REAUTH_ERRORS = new Set([
  "invalid_grant",
  "invalid_refresh_token",
  "token_expired",
  "refresh_token_expired",
  "refresh_token_invalidated",
  "refresh_token_reused",
]);

/** 発行済み client_id はサインアウト後の再サインインでも使い回す */
const clientIdItem = storage.defineItem<string | null>("local:clientId", { fallback: null });
const hostIdItem = storage.defineItem<string | null>("local:extAgentHostId", { fallback: null });

export async function getAuthState(): Promise<AuthState> {
  const creds = await credentialsItem.getValue();
  return { signedIn: creds !== null, email: creds?.email ?? null };
}

export async function startSignIn(): Promise<void> {
  const current = await signInItem.getValue();
  if (current?.status === "pending") {
    const exists = await browser.tabs.get(current.tabId).then(
      () => true,
      () => false,
    );
    if (exists) {
      await browser.tabs.update(current.tabId, { active: true });
      return;
    }
  }

  const verifier = randomToken(32);
  const challenge = base64url(
    new Uint8Array(await crypto.subtle.digest("SHA-256", new TextEncoder().encode(verifier))),
  );
  const state = randomToken(16);
  const nonce = randomToken(16);
  const [clientId, hostId, previous] = await Promise.all([
    clientIdItem.getValue(),
    getHostId(),
    credentialsItem.getValue(),
  ]);

  const params = new URLSearchParams({
    client_id: clientId ?? DYNAMIC_CLIENT_ID,
    ext_agent_host_id: hostId,
    response_type: "code",
    redirect_uri: REDIRECT_URI,
    scope: SCOPE,
    resource: RESOURCE,
    state,
    nonce,
    code_challenge_method: "S256",
    code_challenge: challenge,
  });
  if (!clientId) params.set("agent_name_hint", APP_NAME);
  if (previous) params.set("id_token_hint", previous.idToken);

  const tab = await browser.tabs.create({ url: `${AUTHORIZE_URL}?${params}` });
  if (tab.id === undefined) throw new Error("認可タブを開けませんでした");
  await signInItem.setValue({
    status: "pending",
    tabId: tab.id,
    verifier,
    state,
    nonce,
    clientId,
  });
}

/** defineBackground 直下で同期登録した tabs.onUpdated から呼ぶ。loopback への遷移を捕まえて認可を完了する */
export async function handleTabUpdated(tabId: number, url: string | undefined): Promise<boolean> {
  if (!url?.startsWith(REDIRECT_URI)) return false;
  const pending = await signInItem.getValue();
  if (pending?.status !== "pending" || pending.tabId !== tabId) return false;
  await browser.tabs.remove(tabId);
  try {
    await completeSignIn(pending, new URL(url));
    await signInItem.setValue(null);
    return true;
  } catch (e) {
    await signInItem.setValue({
      status: "failed",
      message: e instanceof Error ? e.message : String(e),
    });
    return false;
  }
}

export async function handleTabRemoved(tabId: number): Promise<void> {
  const pending = await signInItem.getValue();
  if (pending?.status === "pending" && pending.tabId === tabId) await signInItem.setValue(null);
}

async function completeSignIn(pending: PendingSignIn, callback: URL): Promise<void> {
  const params = callback.searchParams;
  if (params.get("state") !== pending.state) {
    throw new Error("認可レスポンスの state が一致しません");
  }
  const error = params.get("error");
  if (error) throw new Error(params.get("error_description") ?? error);
  const code = params.get("code");
  if (!code) throw new Error("認可コードを取得できませんでした");
  // 発行済みの client_id で再認可した場合、コールバックには client_id が付かない
  const clientId = params.get("client_id") ?? pending.clientId;
  if (!clientId) throw new Error("client_id が発行されませんでした");
  await clientIdItem.setValue(clientId);

  const tokens = await postToken({
    grant_type: "authorization_code",
    client_id: clientId,
    code,
    code_verifier: pending.verifier,
    redirect_uri: REDIRECT_URI,
    resource: RESOURCE,
  });
  if (!tokens.scope.split(" ").includes(REQUIRED_SCOPE)) {
    throw new Error("このアカウントでは ChatGPT プランを利用できません（Plus / Pro が必要です）");
  }
  if (!tokens.idToken) throw new Error("ID トークンが発行されませんでした");
  // 署名検証はしていない。トークンは TLS で発行元から直接受け取っており、ここでは表示用の email と nonce の照合にだけ使う
  const claims = decodeIdToken(tokens.idToken);
  if (claims.nonce !== pending.nonce) throw new Error("ID トークンの nonce が一致しません");

  credentialsGeneration++;
  await credentialsItem.setValue({
    clientId,
    email: claims.email,
    idToken: tokens.idToken,
    accessToken: tokens.accessToken,
    refreshToken: tokens.refreshToken,
    expiresAt: Date.now() + tokens.expiresIn * 1000,
  });
  if ((await welcomeItem.getValue()) === "never") await welcomeItem.setValue("pending");
}

/** サインイン・サインアウトのたびに進める。進んでいたら refresh の結果を書き戻さない */
let credentialsGeneration = 0;
let refreshPromise: Promise<Credentials> | null = null;

export async function getAccessToken(forceRefresh = false): Promise<string> {
  const creds = await credentialsItem.getValue();
  if (!creds)
    throw new TranslateFailure("signed_out", "翻訳するには ChatGPT でサインインしてください。");
  if (!forceRefresh && creds.expiresAt - REFRESH_MARGIN_MS > Date.now()) {
    return creds.accessToken;
  }
  // refresh token はローテーションされ、使用済みを再送すると refresh_token_reused で失効するため直列化する
  refreshPromise ??= refresh(creds).finally(() => {
    refreshPromise = null;
  });
  return (await refreshPromise).accessToken;
}

async function refresh(creds: Credentials): Promise<Credentials> {
  const generation = credentialsGeneration;
  let tokens: TokenResponse;
  try {
    tokens = await postToken({
      grant_type: "refresh_token",
      client_id: creds.clientId,
      refresh_token: creds.refreshToken,
      resource: RESOURCE,
    });
  } catch (e) {
    if (e instanceof TokenEndpointError && REAUTH_ERRORS.has(e.code)) {
      if (generation === credentialsGeneration) await credentialsItem.setValue(null);
      throw new TranslateFailure(
        "signed_out",
        "セッションの有効期限が切れました。再度サインインしてください",
      );
    }
    throw e;
  }
  if (generation !== credentialsGeneration) {
    throw new TranslateFailure("signed_out", "サインイン状態が変わったため処理を中断しました");
  }
  const next: Credentials = {
    ...creds,
    accessToken: tokens.accessToken,
    refreshToken: tokens.refreshToken,
    // refresh 応答の id_token は省略されうる
    idToken: tokens.idToken ?? creds.idToken,
    expiresAt: Date.now() + tokens.expiresIn * 1000,
  };
  await credentialsItem.setValue(next);
  return next;
}

export async function signOut(): Promise<void> {
  credentialsGeneration++;
  // 進行中の refresh が新しい refresh token を受け取っていれば、そちらを revoke する
  await refreshPromise?.catch(() => {});
  const creds = await credentialsItem.getValue();
  await credentialsItem.setValue(null);
  if (!creds) return;
  try {
    await fetch(REVOKE_URL, {
      method: "POST",
      headers: { "Content-Type": "application/x-www-form-urlencoded" },
      body: new URLSearchParams({
        token: creds.refreshToken,
        token_type_hint: "refresh_token",
        client_id: creds.clientId,
      }),
    });
  } catch {
    // ローカルの資格情報は既に消しているので、revocation の失敗でサインアウトを妨げない
  }
}

class TokenEndpointError extends Error {
  constructor(
    readonly code: string,
    message: string,
  ) {
    super(message);
  }
}

interface TokenResponse {
  accessToken: string;
  refreshToken: string;
  idToken: string | null;
  expiresIn: number;
  scope: string;
}

async function postToken(body: Record<string, string>): Promise<TokenResponse> {
  const res = await fetch(TOKEN_URL, {
    method: "POST",
    headers: { "Content-Type": "application/x-www-form-urlencoded" },
    body: new URLSearchParams(body),
  });
  const json: unknown = await res.json();
  if (!isRecord(json)) {
    throw new Error(`トークンエンドポイントの応答が不正です（HTTP ${res.status}）`);
  }
  if (!res.ok) {
    const code = typeof json["error"] === "string" ? json["error"] : `http_${res.status}`;
    const description =
      typeof json["error_description"] === "string" ? json["error_description"] : code;
    throw new TokenEndpointError(code, `トークンの取得に失敗しました: ${description}`);
  }
  const {
    access_token: accessToken,
    refresh_token: refreshToken,
    id_token: idToken,
    expires_in: expiresIn,
    scope,
  } = json;
  if (
    typeof accessToken !== "string" ||
    typeof refreshToken !== "string" ||
    typeof expiresIn !== "number" ||
    typeof scope !== "string" ||
    (idToken !== undefined && typeof idToken !== "string")
  ) {
    throw new Error("トークンエンドポイントの応答に必要な項目がありません");
  }
  return { accessToken, refreshToken, idToken: idToken ?? null, expiresIn, scope };
}

interface IdTokenClaims {
  nonce: string;
  email: string | null;
}

function decodeIdToken(jwt: string): IdTokenClaims {
  const payload = jwt.split(".")[1];
  if (!payload) throw new Error("ID トークンの形式が不正です");
  const bytes = Uint8Array.from(atob(payload.replace(/-/g, "+").replace(/_/g, "/")), (c) =>
    c.charCodeAt(0),
  );
  const claims: unknown = JSON.parse(new TextDecoder().decode(bytes));
  if (!isRecord(claims) || typeof claims["nonce"] !== "string") {
    throw new Error("ID トークンに nonce がありません");
  }
  return {
    nonce: claims["nonce"],
    email: typeof claims["email"] === "string" ? claims["email"] : null,
  };
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null;
}

async function getHostId(): Promise<string> {
  const existing = await hostIdItem.getValue();
  if (existing) return existing;
  const id = `urn:uuid:${crypto.randomUUID()}`;
  await hostIdItem.setValue(id);
  return id;
}

function randomToken(bytes: number): string {
  return base64url(crypto.getRandomValues(new Uint8Array(bytes)));
}

function base64url(bytes: Uint8Array): string {
  return btoa(String.fromCharCode(...bytes))
    .replace(/\+/g, "-")
    .replace(/\//g, "_")
    .replace(/=+$/, "");
}
