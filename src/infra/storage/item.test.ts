import * as v from "valibot";
import { beforeEach, describe, expect, it, vi } from "vitest";
import { fakeBrowser } from "wxt/testing/fake-browser";

import { storage } from "#imports";

import { defineValidatedItem } from "./item";

const item = defineValidatedItem("local:test", v.nullable(v.object({ n: v.number() })), null);

beforeEach(() => fakeBrowser.reset());

describe("defineValidatedItem", () => {
  it("スキーマに合う値を返す", async () => {
    await item.setValue({ n: 1 });
    expect(await item.getValue()).toEqual({ n: 1 });
  });

  it("スキーマに合わない保存値は fallback として読む", async () => {
    await storage.setItem("local:test", { n: "1" });
    expect(await item.getValue()).toBeNull();
  });

  it("watch にも検証後の値を渡す", async () => {
    const cb = vi.fn();
    item.watch(cb);
    await storage.setItem("local:test", "broken");
    await vi.waitFor(() => expect(cb).toHaveBeenCalledWith(null));
  });
});
