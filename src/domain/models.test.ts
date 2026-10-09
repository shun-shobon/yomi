import { describe, expect, it } from "vitest";

import { settingsForModel, supportsEffort, type ModelInfo } from "./models";

const model: ModelInfo = {
  slug: "gpt-x",
  displayName: "GPT X",
  reasoningEfforts: ["low", "medium", "high"],
  defaultReasoningEffort: "medium",
  supportsFast: false,
};

describe("supportsEffort", () => {
  it("モデルが挙げた effort だけを対応とみなす", () => {
    expect(supportsEffort(model, "high")).toBe(true);
    expect(supportsEffort(model, "minimal")).toBe(false);
  });
});

describe("settingsForModel", () => {
  it("対応している effort はそのまま引き継ぐ", () => {
    expect(settingsForModel({ reasoningEffort: "high", fastMode: false }, model)).toEqual({
      model: "gpt-x",
      reasoningEffort: "high",
      fastMode: false,
    });
  });

  it("対応していない effort はモデルの既定値に戻す", () => {
    expect(settingsForModel({ reasoningEffort: "xhigh", fastMode: false }, model)).toMatchObject({
      reasoningEffort: "medium",
    });
  });

  it("高速モードは新しいモデルが対応している場合だけ維持する", () => {
    const current = { reasoningEffort: "low", fastMode: true } as const;
    expect(settingsForModel(current, model).fastMode).toBe(false);
    expect(settingsForModel(current, { ...model, supportsFast: true }).fastMode).toBe(true);
  });

  it("高速モードが無効なら対応モデルでも有効にしない", () => {
    const fast = { ...model, supportsFast: true };
    expect(settingsForModel({ reasoningEffort: "low", fastMode: false }, fast).fastMode).toBe(
      false,
    );
  });
});
