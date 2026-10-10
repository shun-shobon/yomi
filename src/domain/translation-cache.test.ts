import { describe, expect, it } from "vitest";

import { cacheKey } from "./translation-cache";

describe("cacheKey", () => {
  it("URL のクエリとハッシュは区別しない", () => {
    expect(cacheKey("ja", "https://a.example/doc?utm_source=x#intro", "x")).toBe(
      cacheKey("ja", "https://a.example/doc", "x"),
    );
  });

  it("オリジン・パス・翻訳先の言語・マークアップが違えば別のキーになる", () => {
    const base = cacheKey("ja", "https://a.example/doc", "x");
    expect(cacheKey("ja", "https://b.example/doc", "x")).not.toBe(base);
    expect(cacheKey("ja", "https://a.example/other", "x")).not.toBe(base);
    expect(cacheKey("en", "https://a.example/doc", "x")).not.toBe(base);
    expect(cacheKey("ja", "https://a.example/doc", "y")).not.toBe(base);
  });
});
