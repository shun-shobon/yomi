import { describe, expect, it } from "vitest";

import { ApiError, toTranslateFailure } from "./api-error";
import { TranslateFailure } from "./failure";

describe("ApiError.isAuthExpired", () => {
  it("401 は refresh で回復しうるとみなす", () => {
    expect(new ApiError(401, null, "unauthorized").isAuthExpired).toBe(true);
  });

  it("サブスクリプション共有の無効ユーザーは 401 でも refresh で回復しない", () => {
    expect(new ApiError(401, "subscription_sharing_invalid_user", "x").isAuthExpired).toBe(false);
  });

  it("401 以外や status のない失敗は対象外", () => {
    expect(new ApiError(403, null, "x").isAuthExpired).toBe(false);
    expect(new ApiError(null, null, "x").isAuthExpired).toBe(false);
  });
});

describe("toTranslateFailure", () => {
  it("TranslateFailure はそのまま返す", () => {
    const failure = new TranslateFailure("no_model", "モデル未選択");
    expect(toTranslateFailure(failure)).toBe(failure);
  });

  it.each([
    [429, "subscription_sharing_usage_limit_exceeded", "usage_limit"],
    [401, "subscription_sharing_invalid_user", "signed_out"],
    [403, null, "not_eligible"],
    [503, null, "unavailable"],
    [500, null, "other"],
    [null, null, "other"],
  ] as const)("status %s・code %s を %s に分類する", (status, code, kind) => {
    expect(toTranslateFailure(new ApiError(status, code, "x")).kind).toBe(kind);
  });

  it("status より code による分類を優先する", () => {
    expect(
      toTranslateFailure(new ApiError(403, "subscription_sharing_usage_limit_exceeded", "x")).kind,
    ).toBe("usage_limit");
  });

  it("API のメッセージを引き継ぐ", () => {
    expect(toTranslateFailure(new ApiError(503, null, "overloaded")).message).toBe("overloaded");
  });

  it("その他の例外は other としてメッセージを残す", () => {
    expect(toTranslateFailure(new Error("boom"))).toMatchObject({ kind: "other", message: "boom" });
    expect(toTranslateFailure("raw")).toMatchObject({ kind: "other", message: "raw" });
  });
});
