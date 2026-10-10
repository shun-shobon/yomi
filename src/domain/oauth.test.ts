import { describe, expect, it } from "vitest";

import {
  REDIRECT_URI,
  TokenEndpointError,
  buildAuthorizeUrl,
  createPkce,
  decodeIdToken,
  hasRequiredScope,
  parseAuthorizationCallback,
  parseTokenResponse,
  type AuthorizeRequest,
} from "./oauth";

const request: AuthorizeRequest = {
  clientId: null,
  hostId: "host-1",
  state: "state-1",
  nonce: "nonce-1",
  codeChallenge: "challenge-1",
  idTokenHint: null,
};

describe("buildAuthorizeUrl", () => {
  it("初回は dynamic client として登録を求め、アプリ名を伝える", () => {
    const params = new URL(buildAuthorizeUrl(request)).searchParams;
    expect(params.get("client_id")).toBe("dynamic_agent_client");
    expect(params.get("agent_name_hint")).toBe("Yomi");
    expect(params.has("id_token_hint")).toBe(false);
  });

  it("再サインインでは発行済みの client_id と前回の ID トークンを使う", () => {
    const params = new URL(
      buildAuthorizeUrl({ ...request, clientId: "client-1", idTokenHint: "id-token" }),
    ).searchParams;
    expect(params.get("client_id")).toBe("client-1");
    expect(params.get("id_token_hint")).toBe("id-token");
    expect(params.has("agent_name_hint")).toBe(false);
  });

  it("PKCE と state・nonce・redirect_uri を載せる", () => {
    const params = new URL(buildAuthorizeUrl(request)).searchParams;
    expect(params.get("response_type")).toBe("code");
    expect(params.get("redirect_uri")).toBe(REDIRECT_URI);
    expect(params.get("state")).toBe("state-1");
    expect(params.get("nonce")).toBe("nonce-1");
    expect(params.get("code_challenge")).toBe("challenge-1");
    expect(params.get("code_challenge_method")).toBe("S256");
    expect(hasRequiredScope(params.get("scope")!)).toBe(true);
  });
});

describe("parseAuthorizationCallback", () => {
  const callback = (query: string) => new URL(`${REDIRECT_URI}?${query}`);

  it("code と発行された client_id を取り出す", () => {
    expect(
      parseAuthorizationCallback(callback("state=s&code=c&client_id=new"), {
        state: "s",
        clientId: null,
      }),
    ).toEqual({ code: "c", clientId: "new" });
  });

  it("client_id が付かなければ発行済みのものを使う", () => {
    expect(
      parseAuthorizationCallback(callback("state=s&code=c"), { state: "s", clientId: "old" }),
    ).toEqual({ code: "c", clientId: "old" });
  });

  it("client_id がどこにもなければ失敗する", () => {
    expect(() =>
      parseAuthorizationCallback(callback("state=s&code=c"), { state: "s", clientId: null }),
    ).toThrow("client_id");
  });

  it("state が一致しなければ、エラー応答よりも先に拒否する", () => {
    expect(() =>
      parseAuthorizationCallback(callback("state=other&error=access_denied"), {
        state: "s",
        clientId: null,
      }),
    ).toThrow("state");
  });

  it("エラー応答は説明があればそれを、なければエラーコードを伝える", () => {
    const expected = { state: "s", clientId: null };
    expect(() =>
      parseAuthorizationCallback(
        callback("state=s&error=access_denied&error_description=denied%20by%20user"),
        expected,
      ),
    ).toThrow("denied by user");
    expect(() =>
      parseAuthorizationCallback(callback("state=s&error=access_denied"), expected),
    ).toThrow("access_denied");
  });

  it("code がなければ失敗する", () => {
    expect(() =>
      parseAuthorizationCallback(callback("state=s&client_id=c"), { state: "s", clientId: null }),
    ).toThrow("認可コード");
  });
});

describe("parseTokenResponse", () => {
  const body = {
    access_token: "at",
    refresh_token: "rt",
    id_token: "it",
    expires_in: 3600,
    scope: "openid",
  };

  it("成功応答を取り出す", () => {
    expect(parseTokenResponse(200, true, body)).toEqual({
      accessToken: "at",
      refreshToken: "rt",
      idToken: "it",
      expiresIn: 3600,
      scope: "openid",
    });
  });

  it("id_token は省略されうる", () => {
    const { id_token: _, ...rest } = body;
    expect(parseTokenResponse(200, true, rest).idToken).toBeNull();
  });

  it.each([null, "text", 1])("JSON オブジェクトでない応答 %o は拒否する", (json) => {
    expect(() => parseTokenResponse(502, false, json)).toThrow("HTTP 502");
  });

  it("エラー応答は error を code に持つ TokenEndpointError にする", () => {
    const parseError = () =>
      parseTokenResponse(400, false, { error: "invalid_grant", error_description: "expired" });
    expect(parseError).toThrow(TokenEndpointError);
    expect(parseError).toThrow(
      expect.objectContaining({
        code: "invalid_grant",
        message: expect.stringContaining("expired"),
      }),
    );
  });

  it("error がないエラー応答は HTTP ステータスを code にする", () => {
    expect(() => parseTokenResponse(500, false, {})).toThrow(
      expect.objectContaining({ code: "http_500" }),
    );
  });

  it.each(["access_token", "refresh_token", "expires_in", "scope"])(
    "%s が欠けていれば拒否する",
    (key) => {
      expect(() => parseTokenResponse(200, true, { ...body, [key]: undefined })).toThrow(
        "必要な項目",
      );
    },
  );

  it("id_token が文字列でなければ拒否する", () => {
    expect(() => parseTokenResponse(200, true, { ...body, id_token: 1 })).toThrow("必要な項目");
  });
});

describe("TokenEndpointError.requiresReauth", () => {
  it("refresh token の失効を示すエラーだけ再サインインを求める", () => {
    expect(new TokenEndpointError("invalid_grant", "x").requiresReauth).toBe(true);
    expect(new TokenEndpointError("refresh_token_reused", "x").requiresReauth).toBe(true);
    expect(new TokenEndpointError("http_500", "x").requiresReauth).toBe(false);
  });
});

describe("hasRequiredScope", () => {
  it("スコープ列に直接利用の権限が含まれるかを語単位で判定する", () => {
    expect(hasRequiredScope("openid chatgpt.tokens.use.direct email")).toBe(true);
    expect(hasRequiredScope("openid email")).toBe(false);
    expect(hasRequiredScope("chatgpt.tokens.use.direct.extra")).toBe(false);
  });
});

describe("decodeIdToken", () => {
  const jwt = (claims: unknown) =>
    `header.${new TextEncoder().encode(JSON.stringify(claims)).toBase64({ alphabet: "base64url", omitPadding: true })}.signature`;

  it("nonce と email を取り出す", () => {
    expect(decodeIdToken(jwt({ nonce: "n", email: "a@example.com" }))).toEqual({
      nonce: "n",
      email: "a@example.com",
    });
  });

  it("base64url の - と _ を含むペイロードを UTF-8 として読む", () => {
    // "?>" と "?" の並びは base64 で "+" や "/" になり、base64url では "-" と "_" に置き換わる
    const token = jwt({ nonce: "??>>", email: "山田@例え.jp" });
    expect(token.split(".")[1]).toMatch(/[-_]/);
    expect(decodeIdToken(token)).toEqual({ nonce: "??>>", email: "山田@例え.jp" });
  });

  it("email がなければ null にする", () => {
    expect(decodeIdToken(jwt({ nonce: "n" })).email).toBeNull();
  });

  it("nonce がなければ失敗する", () => {
    expect(() => decodeIdToken(jwt({ email: "a@example.com" }))).toThrow("nonce");
  });

  it("ペイロード部がなければ失敗する", () => {
    expect(() => decodeIdToken("only-header")).toThrow("形式");
  });
});

describe("createPkce", () => {
  it("challenge は verifier の SHA-256 を base64url にしたもの", async () => {
    const { verifier, challenge } = await createPkce();
    const digest = await crypto.subtle.digest("SHA-256", new TextEncoder().encode(verifier));
    const expected = Buffer.from(digest).toString("base64url");
    expect(challenge).toBe(expected);
    expect(verifier).toMatch(/^[A-Za-z0-9_-]{43,128}$/);
  });
});
