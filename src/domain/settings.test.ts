import { describe, expect, it } from "vitest";

import { withDefaults } from "./settings";

describe("withDefaults", () => {
  it("保存されていない項目を既定値で補う", () => {
    expect(withDefaults({ targetLang: "en" })).toMatchObject({
      targetLang: "en",
      reasoningEffort: "low",
      showSelectionButton: true,
    });
  });

  it("不正な値の項目だけを既定値に戻し、他の項目は残す", () => {
    expect(
      withDefaults({ targetLang: "xx", reasoningEffort: "high", fastMode: "yes" }),
    ).toMatchObject({ targetLang: "ja", reasoningEffort: "high", fastMode: false });
  });

  it("未知の項目を取り除く", () => {
    expect(withDefaults({ removed: 1 })).not.toHaveProperty("removed");
  });
});
