import { beforeEach, describe, expect, it, vi } from "vitest";
import { fakeBrowser } from "wxt/testing/fake-browser";

import { ApiError } from "@/domain/api-error";
import { TranslateFailure } from "@/domain/failure";
import { streamResponse, type StreamOptions } from "@/infra/openai/client";
import { updateSettings } from "@/infra/storage/settings";

import { getAccessToken } from "./auth";
import { translate } from "./translate";

vi.mock("@/infra/openai/client", () => ({ listModels: vi.fn(), streamResponse: vi.fn() }));
vi.mock("./auth", () => ({ getAccessToken: vi.fn() }));

const req = { instructions: "日本語に訳す", input: "Hello" };

function run(onDelta: (text: string) => void = () => {}) {
  return translate(req, new AbortController().signal, onDelta);
}

describe("translate", () => {
  beforeEach(async () => {
    fakeBrowser.reset();
    vi.mocked(getAccessToken).mockReset();
    vi.mocked(streamResponse).mockReset();
    vi.mocked(getAccessToken).mockImplementation((force) =>
      Promise.resolve(force != null && force ? "refreshed-token" : "token"),
    );
    await updateSettings({ model: "gpt-test" });
  });

  it("モデル未選択なら no_model で失敗し、API を呼ばない", async () => {
    await updateSettings({ model: null });

    const error = await run().catch((e: unknown) => e);

    expect(error).toBeInstanceOf(TranslateFailure);
    expect((error as TranslateFailure).kind).toBe("no_model");
    expect(streamResponse).not.toHaveBeenCalled();
  });

  it("設定のモデル・reasoningEffort・fastMode と訳文の入力を streamResponse に渡す", async () => {
    await updateSettings({ reasoningEffort: "high", fastMode: true });
    vi.mocked(streamResponse).mockResolvedValue();

    await run();

    expect(streamResponse).toHaveBeenCalledWith(
      expect.objectContaining({
        token: "token",
        model: "gpt-test",
        reasoningEffort: "high",
        fast: true,
        instructions: req.instructions,
        input: req.input,
      }),
    );
  });

  it("受け取った訳文の断片を順に onDelta へ渡す", async () => {
    vi.mocked(streamResponse).mockImplementation((opts: StreamOptions) => {
      opts.onDelta("こん");
      opts.onDelta("にちは");
      return Promise.resolve();
    });
    const deltas: string[] = [];

    await run((text) => deltas.push(text));

    expect(deltas).toEqual(["こん", "にちは"]);
  });

  it("401 なら access token を強制 refresh して 1 回だけ再試行する", async () => {
    vi.mocked(streamResponse)
      .mockRejectedValueOnce(new ApiError(401, null, "expired"))
      .mockResolvedValueOnce();

    await run();

    expect(getAccessToken).toHaveBeenLastCalledWith(true);
    expect(vi.mocked(streamResponse).mock.calls.map(([opts]) => opts.token)).toEqual([
      "token",
      "refreshed-token",
    ]);
  });

  it("再試行でも 401 なら、それ以上再試行せずに失敗する", async () => {
    vi.mocked(streamResponse).mockRejectedValue(new ApiError(401, null, "expired"));

    await expect(run()).rejects.toBeInstanceOf(ApiError);
    expect(streamResponse).toHaveBeenCalledTimes(2);
  });

  it.each([
    [
      "サブスクリプションの利用者が不正な 401",
      new ApiError(401, "subscription_sharing_invalid_user", "x"),
    ],
    ["403", new ApiError(403, null, "forbidden")],
    ["status のない失敗", new ApiError(null, null, "network")],
  ])("%s では refresh も再試行もしない", async (_, error) => {
    vi.mocked(streamResponse).mockRejectedValue(error);

    await expect(run()).rejects.toBe(error);
    expect(streamResponse).toHaveBeenCalledTimes(1);
    expect(getAccessToken).not.toHaveBeenCalledWith(true);
  });

  it("訳文の一部を受け取った後の 401 は再試行しない", async () => {
    const error = new ApiError(401, null, "expired");
    vi.mocked(streamResponse).mockImplementation((opts: StreamOptions) => {
      opts.onDelta("こん");
      return Promise.reject(error);
    });
    const deltas: string[] = [];

    await expect(run((text) => deltas.push(text))).rejects.toBe(error);
    expect(streamResponse).toHaveBeenCalledTimes(1);
    expect(deltas).toEqual(["こん"]);
  });
});
