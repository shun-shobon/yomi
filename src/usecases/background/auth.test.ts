import { beforeEach, describe, expect, it, vi } from "vitest";
import { fakeBrowser } from "wxt/testing/fake-browser";

import type { TranslateFailure } from "@/domain/failure";
import { REDIRECT_URI, type TokenResponse } from "@/domain/oauth";
import type { Credentials } from "@/infra/storage/auth";

const endpoint = vi.hoisted(() => ({ postToken: vi.fn(), revokeRefreshToken: vi.fn() }));
vi.mock("@/infra/oauth/token-endpoint", () => endpoint);

const MINUTE = 60 * 1000;

// auth モジュールは進行中の refresh と世代カウンタをモジュール変数に持つので、テストごとに読み込み直す
async function load() {
  vi.resetModules();
  const auth = await import("./auth");
  const storage = await import("@/infra/storage/auth");
  // resetModules 後は domain のクラスも別物になるため、instanceof の判定には読み込み直したものを使う
  const { TranslateFailure } = await import("@/domain/failure");
  const { TokenEndpointError } = await import("@/domain/oauth");
  return { ...auth, ...storage, TranslateFailure, TokenEndpointError };
}

function credentials(overrides: Partial<Credentials> = {}): Credentials {
  return {
    clientId: "oaiapp_1",
    email: "user@example.com",
    idToken: "id-token",
    accessToken: "access-1",
    refreshToken: "refresh-1",
    expiresAt: Date.now() + 10 * MINUTE,
    ...overrides,
  };
}

function tokens(overrides: Partial<TokenResponse> = {}): TokenResponse {
  return {
    accessToken: "access-2",
    refreshToken: "refresh-2",
    idToken: null,
    expiresIn: 3600,
    scope: "openid email offline_access chatgpt.tokens.use.direct",
    ...overrides,
  };
}

function idToken(claims: Record<string, unknown>): string {
  const payload = new TextEncoder()
    .encode(JSON.stringify(claims))
    .toBase64({ alphabet: "base64url", omitPadding: true });
  return `header.${payload}.signature`;
}

function deferred<T>() {
  let resolve!: (value: T) => void;
  const promise = new Promise<T>((r) => {
    resolve = r;
  });
  return { promise, resolve };
}

beforeEach(() => {
  fakeBrowser.reset();
  endpoint.postToken.mockReset();
  endpoint.revokeRefreshToken.mockReset();
});

describe("getAccessToken", () => {
  it("期限まで余裕があれば refresh せずに保存済みの access token を返す", async () => {
    const auth = await load();
    await auth.credentialsItem.setValue(credentials());

    await expect(auth.getAccessToken()).resolves.toBe("access-1");
    expect(endpoint.postToken).not.toHaveBeenCalled();
  });

  it("期限間近なら refresh し、新しいトークンを保存する", async () => {
    const auth = await load();
    await auth.credentialsItem.setValue(credentials({ expiresAt: Date.now() + 30 * 1000 }));
    endpoint.postToken.mockResolvedValue(tokens());

    await expect(auth.getAccessToken()).resolves.toBe("access-2");

    expect(endpoint.postToken).toHaveBeenCalledWith(
      expect.objectContaining({
        grant_type: "refresh_token",
        client_id: "oaiapp_1",
        refresh_token: "refresh-1",
      }),
    );
    expect(await auth.credentialsItem.getValue()).toMatchObject({
      accessToken: "access-2",
      refreshToken: "refresh-2",
      // refresh 応答が id_token を省略したら以前のものを保つ
      idToken: "id-token",
      email: "user@example.com",
      expiresAt: expect.any(Number),
    });
    expect((await auth.credentialsItem.getValue())!.expiresAt).toBeGreaterThan(
      Date.now() + 59 * MINUTE,
    );
  });

  it("forceRefresh なら期限内でも refresh する", async () => {
    const auth = await load();
    await auth.credentialsItem.setValue(credentials());
    endpoint.postToken.mockResolvedValue(tokens());

    await expect(auth.getAccessToken(true)).resolves.toBe("access-2");
    expect(endpoint.postToken).toHaveBeenCalledTimes(1);
  });

  it("同時に呼ばれても refresh token を 1 回しか使わない", async () => {
    const auth = await load();
    await auth.credentialsItem.setValue(credentials({ expiresAt: 0 }));
    const response = deferred<TokenResponse>();
    endpoint.postToken.mockReturnValue(response.promise);

    const results = Promise.all([
      auth.getAccessToken(),
      auth.getAccessToken(),
      auth.getAccessToken(true),
    ]);
    await vi.waitFor(() => expect(endpoint.postToken).toHaveBeenCalled());
    response.resolve(tokens());

    await expect(results).resolves.toEqual(["access-2", "access-2", "access-2"]);
    expect(endpoint.postToken).toHaveBeenCalledTimes(1);
  });

  it("refresh が終わった後の呼び出しでは、ローテーション後の refresh token を使う", async () => {
    const auth = await load();
    await auth.credentialsItem.setValue(credentials());
    endpoint.postToken
      .mockResolvedValueOnce(tokens())
      .mockResolvedValueOnce(tokens({ accessToken: "access-3", refreshToken: "refresh-3" }));

    await auth.getAccessToken(true);
    await expect(auth.getAccessToken(true)).resolves.toBe("access-3");

    expect(endpoint.postToken).toHaveBeenLastCalledWith(
      expect.objectContaining({ refresh_token: "refresh-2" }),
    );
  });

  it("再サインインが必要なエラーなら資格情報を消して signed_out で失敗する", async () => {
    const auth = await load();
    await auth.credentialsItem.setValue(credentials({ expiresAt: 0 }));
    endpoint.postToken.mockRejectedValue(
      new auth.TokenEndpointError("refresh_token_reused", "reused"),
    );

    const error = await auth.getAccessToken().catch((e: unknown) => e);

    expect(error).toBeInstanceOf(auth.TranslateFailure);
    expect((error as TranslateFailure).kind).toBe("signed_out");
    expect(await auth.credentialsItem.getValue()).toBeNull();
  });

  it("再サインインで解決しない refresh の失敗では資格情報を残す", async () => {
    const auth = await load();
    const saved = credentials({ expiresAt: 0 });
    await auth.credentialsItem.setValue(saved);
    const error = new auth.TokenEndpointError("http_500", "server error");
    endpoint.postToken.mockRejectedValue(error);

    await expect(auth.getAccessToken()).rejects.toBe(error);
    expect(await auth.credentialsItem.getValue()).toEqual(saved);
  });

  it("失敗した refresh の後の呼び出しでは refresh をやり直す", async () => {
    const auth = await load();
    await auth.credentialsItem.setValue(credentials({ expiresAt: 0 }));
    endpoint.postToken.mockRejectedValueOnce(new Error("network")).mockResolvedValueOnce(tokens());

    await expect(auth.getAccessToken()).rejects.toThrow("network");
    await expect(auth.getAccessToken()).resolves.toBe("access-2");
  });

  it("未サインインなら signed_out で失敗する", async () => {
    const auth = await load();

    const error = await auth.getAccessToken().catch((e: unknown) => e);

    expect(error).toBeInstanceOf(auth.TranslateFailure);
    expect((error as TranslateFailure).kind).toBe("signed_out");
    expect(endpoint.postToken).not.toHaveBeenCalled();
  });
});

describe("signOut", () => {
  it("資格情報を消し、refresh token を revoke する", async () => {
    const auth = await load();
    await auth.credentialsItem.setValue(credentials());
    endpoint.revokeRefreshToken.mockResolvedValue(undefined);

    await auth.signOut();

    expect(await auth.credentialsItem.getValue()).toBeNull();
    expect(endpoint.revokeRefreshToken).toHaveBeenCalledWith("refresh-1", "oaiapp_1");
    await expect(auth.getAuthState()).resolves.toEqual({ signedIn: false, email: null });
  });

  it("revoke に失敗しても例外にならず、資格情報は消える", async () => {
    const auth = await load();
    await auth.credentialsItem.setValue(credentials());
    endpoint.revokeRefreshToken.mockRejectedValue(new Error("network"));

    await expect(auth.signOut()).resolves.toBeUndefined();
    expect(await auth.credentialsItem.getValue()).toBeNull();
  });

  it("サインアウト中に終わった refresh の結果で資格情報を復活させない", async () => {
    const auth = await load();
    await auth.credentialsItem.setValue(credentials({ expiresAt: 0 }));
    const response = deferred<TokenResponse>();
    endpoint.postToken.mockReturnValue(response.promise);
    endpoint.revokeRefreshToken.mockResolvedValue(undefined);

    const pending = auth.getAccessToken().catch((e: unknown) => e);
    await vi.waitFor(() => expect(endpoint.postToken).toHaveBeenCalled());
    const signingOut = auth.signOut();
    response.resolve(tokens());
    await signingOut;

    expect(await pending).toBeInstanceOf(auth.TranslateFailure);
    expect(await auth.credentialsItem.getValue()).toBeNull();
  });
});

describe("handleTabUpdated", () => {
  const TAB_ID = 7;
  const pending = {
    status: "pending" as const,
    tabId: TAB_ID,
    verifier: "verifier",
    state: "state-1",
    nonce: "nonce-1",
    clientId: null,
  };

  function callback(params: Record<string, string>): string {
    return `${REDIRECT_URI}?${new URLSearchParams(params)}`;
  }

  it("正常なコールバックならトークンを交換して資格情報を保存し、true を返す", async () => {
    const auth = await load();
    await auth.signInItem.setValue(pending);
    endpoint.postToken.mockResolvedValue(
      tokens({ idToken: idToken({ nonce: "nonce-1", email: "user@example.com" }) }),
    );

    const handled = await auth.handleTabUpdated(
      TAB_ID,
      callback({ code: "code-1", state: "state-1", client_id: "oaiapp_new" }),
    );

    expect(handled).toBe(true);
    expect(endpoint.postToken).toHaveBeenCalledWith(
      expect.objectContaining({
        grant_type: "authorization_code",
        client_id: "oaiapp_new",
        code: "code-1",
        code_verifier: "verifier",
        redirect_uri: REDIRECT_URI,
      }),
    );
    expect(await auth.credentialsItem.getValue()).toMatchObject({
      clientId: "oaiapp_new",
      email: "user@example.com",
      accessToken: "access-2",
      refreshToken: "refresh-2",
    });
    expect(await auth.signInItem.getValue()).toBeNull();
    expect(await auth.clientIdItem.getValue()).toBe("oaiapp_new");
  });

  it("redirect URI 以外への遷移は無視する", async () => {
    const auth = await load();
    await auth.signInItem.setValue(pending);

    await expect(auth.handleTabUpdated(TAB_ID, "https://example.com/")).resolves.toBe(false);
    await expect(auth.handleTabUpdated(TAB_ID, undefined)).resolves.toBe(false);

    expect(await auth.signInItem.getValue()).toEqual(pending);
    expect(endpoint.postToken).not.toHaveBeenCalled();
  });

  it("サインインを始めたタブ以外の遷移は無視する", async () => {
    const auth = await load();
    await auth.signInItem.setValue(pending);

    const handled = await auth.handleTabUpdated(
      TAB_ID + 1,
      callback({ code: "code-1", state: "state-1", client_id: "oaiapp_new" }),
    );

    expect(handled).toBe(false);
    expect(await auth.signInItem.getValue()).toEqual(pending);
    expect(endpoint.postToken).not.toHaveBeenCalled();
  });

  it("サインイン中でなければ無視する", async () => {
    const auth = await load();

    const handled = await auth.handleTabUpdated(
      TAB_ID,
      callback({ code: "code-1", state: "state-1", client_id: "oaiapp_new" }),
    );

    expect(handled).toBe(false);
    expect(endpoint.postToken).not.toHaveBeenCalled();
  });

  it("state が一致しなければトークンを交換せず、サインインを失敗にして false を返す", async () => {
    const auth = await load();
    await auth.signInItem.setValue(pending);

    const handled = await auth.handleTabUpdated(
      TAB_ID,
      callback({ code: "code-1", state: "forged", client_id: "oaiapp_new" }),
    );

    expect(handled).toBe(false);
    expect(endpoint.postToken).not.toHaveBeenCalled();
    expect(await auth.signInItem.getValue()).toEqual({
      status: "failed",
      message: expect.stringContaining("state"),
    });
    expect(await auth.credentialsItem.getValue()).toBeNull();
  });

  it.each([
    [
      "ChatGPT プランのスコープがない",
      tokens({ scope: "openid email", idToken: idToken({ nonce: "nonce-1" }) }),
    ],
    ["ID トークンの nonce が一致しない", tokens({ idToken: idToken({ nonce: "other" }) })],
    ["ID トークンがない", tokens({ idToken: null })],
  ])("%s応答なら資格情報を保存せず、サインインを失敗にする", async (_, response) => {
    const auth = await load();
    await auth.signInItem.setValue(pending);
    endpoint.postToken.mockResolvedValue(response);

    const handled = await auth.handleTabUpdated(
      TAB_ID,
      callback({ code: "code-1", state: "state-1", client_id: "oaiapp_new" }),
    );

    expect(handled).toBe(false);
    expect(await auth.signInItem.getValue()).toMatchObject({ status: "failed" });
    expect(await auth.credentialsItem.getValue()).toBeNull();
  });
});
