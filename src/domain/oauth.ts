const AUTHORIZE_URL = "https://auth.openai.com/api/accounts/authorize";
export const RESOURCE = "https://api.openai.com/v1";
const SCOPE = "openid profile email offline_access resource.invoke chatgpt.tokens.use.direct";
const REQUIRED_SCOPE = "chatgpt.tokens.use.direct";
// SIWC は loopback 以外の redirect_uri を受け付けない。拡張は待ち受けできないので遷移 URL を横取りする
export const REDIRECT_URI = "http://127.0.0.1:1455/callback";
const DYNAMIC_CLIENT_ID = "dynamic_agent_client";
const APP_NAME = "Yomi";

const REAUTH_ERRORS = new Set([
	"invalid_grant",
	"invalid_refresh_token",
	"token_expired",
	"refresh_token_expired",
	"refresh_token_invalidated",
	"refresh_token_reused",
]);

export interface AuthorizeRequest {
	clientId: string | null;
	hostId: string;
	state: string;
	nonce: string;
	codeChallenge: string;
	idTokenHint: string | null;
}

export function buildAuthorizeUrl(req: AuthorizeRequest): string {
	const params = new URLSearchParams({
		client_id: req.clientId ?? DYNAMIC_CLIENT_ID,
		ext_agent_host_id: req.hostId,
		response_type: "code",
		redirect_uri: REDIRECT_URI,
		scope: SCOPE,
		resource: RESOURCE,
		state: req.state,
		nonce: req.nonce,
		code_challenge_method: "S256",
		code_challenge: req.codeChallenge,
	});
	if (req.clientId == null) params.set("agent_name_hint", APP_NAME);
	if (req.idTokenHint != null) params.set("id_token_hint", req.idTokenHint);
	return `${AUTHORIZE_URL}?${params}`;
}

export function isRedirectUrl(url: string): boolean {
	if (!URL.canParse(url)) return false;
	const actual = new URL(url);
	const expected = new URL(REDIRECT_URI);
	return actual.origin === expected.origin && actual.pathname === expected.pathname;
}

export function parseAuthorizationCallback(
	callback: URL,
	expected: { state: string; clientId: string | null },
): { code: string; clientId: string } {
	const params = callback.searchParams;
	if (params.get("state") !== expected.state) {
		throw new Error("認可レスポンスの state が一致しません");
	}
	const error = params.get("error");
	if (error != null) throw new Error(params.get("error_description") ?? error);
	const code = params.get("code");
	if (code == null || code === "") throw new Error("認可コードを取得できませんでした");
	// 発行済みの client_id で再認可した場合、コールバックには client_id が付かない
	const clientId = params.get("client_id") ?? expected.clientId;
	if (clientId == null || clientId === "") throw new Error("client_id が発行されませんでした");
	return { code, clientId };
}

export class TokenEndpointError extends Error {
	constructor(
		readonly code: string,
		message: string,
	) {
		super(message);
	}

	get requiresReauth(): boolean {
		return REAUTH_ERRORS.has(this.code);
	}
}

export interface TokenResponse {
	accessToken: string;
	refreshToken: string;
	idToken: string | null;
	expiresIn: number;
	scope: string;
}

export function parseTokenResponse(status: number, ok: boolean, json: unknown): TokenResponse {
	if (!isRecord(json)) {
		throw new Error(`トークンエンドポイントの応答が不正です（HTTP ${status}）`);
	}
	if (!ok) {
		const code = typeof json["error"] === "string" ? json["error"] : `http_${status}`;
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
		(idToken != null && typeof idToken !== "string")
	) {
		throw new Error("トークンエンドポイントの応答に必要な項目がありません");
	}
	return { accessToken, refreshToken, idToken: idToken ?? null, expiresIn, scope };
}

export function hasRequiredScope(scope: string): boolean {
	return scope.split(" ").includes(REQUIRED_SCOPE);
}

export interface IdTokenClaims {
	nonce: string;
	email: string | null;
}

/** 署名は検証しない。トークンは TLS で発行元から直接受け取っており、表示用の email と nonce の照合にだけ使う */
export function decodeIdToken(jwt: string): IdTokenClaims {
	const payload = jwt.split(".")[1];
	if (payload == null || payload === "") throw new Error("ID トークンの形式が不正です");
	const bytes = Uint8Array.fromBase64(payload, { alphabet: "base64url" });
	const claims: unknown = JSON.parse(new TextDecoder().decode(bytes));
	if (!isRecord(claims) || typeof claims["nonce"] !== "string") {
		throw new Error("ID トークンに nonce がありません");
	}
	return {
		nonce: claims["nonce"],
		email: typeof claims["email"] === "string" ? claims["email"] : null,
	};
}

export async function createPkce(): Promise<{ verifier: string; challenge: string }> {
	const verifier = randomToken(32);
	const digest = await crypto.subtle.digest("SHA-256", new TextEncoder().encode(verifier));
	return {
		verifier,
		challenge: new Uint8Array(digest).toBase64({ alphabet: "base64url", omitPadding: true }),
	};
}

export function randomToken(bytes: number): string {
	return crypto
		.getRandomValues(new Uint8Array(bytes))
		.toBase64({ alphabet: "base64url", omitPadding: true });
}

function isRecord(value: unknown): value is Record<string, unknown> {
	return typeof value === "object" && value != null;
}
