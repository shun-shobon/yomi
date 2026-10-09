import { describe, expect, it } from "vitest";

import { summarizePage } from "./page";

describe("summarizePage", () => {
  it("待ちと翻訳中をまとめて busy に数える", () => {
    expect(
      summarizePage(true, "translation", [
        "idle",
        "queued",
        "pending",
        "pending",
        "done",
        "failed",
      ]),
    ).toEqual({ active: true, showing: "translation", busy: 3, done: 1, failed: 1 });
  });
});
