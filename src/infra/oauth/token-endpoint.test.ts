import { afterEach, describe, expect, it, vi } from "vitest";

import { revokeRefreshToken } from "./token-endpoint";

afterEach(() => {
	vi.unstubAllGlobals();
});

describe("revokeRefreshToken", () => {
	it("失効エンドポイントが成功を返せば完了する", async () => {
		vi.stubGlobal("fetch", vi.fn().mockResolvedValue(new Response(null, { status: 200 })));

		await expect(revokeRefreshToken("refresh-1", "client-1")).resolves.toBeUndefined();
	});

	it("失効エンドポイントがエラーを返したら失敗にする", async () => {
		vi.stubGlobal("fetch", vi.fn().mockResolvedValue(new Response(null, { status: 500 })));

		await expect(revokeRefreshToken("refresh-1", "client-1")).rejects.toThrow("revoke failed");
	});

	it("応答がなければタイムアウトで失敗にする", async () => {
		const timeout = new AbortController();
		vi.spyOn(AbortSignal, "timeout").mockReturnValue(timeout.signal);
		vi.stubGlobal(
			"fetch",
			vi.fn(
				(_url: string, init: RequestInit) =>
					new Promise((_, reject) => {
						init.signal?.addEventListener("abort", () => reject(new Error("aborted")));
					}),
			),
		);

		const result = revokeRefreshToken("refresh-1", "client-1");
		timeout.abort();

		await expect(result).rejects.toThrow("aborted");
	});
});
