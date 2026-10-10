// @vitest-environment happy-dom
import { afterEach, describe, expect, it } from "vitest";

import { Segment } from "./segment";

function segmentOf(html: string, setup?: (p: HTMLParagraphElement) => void) {
  const p = document.createElement("p");
  p.innerHTML = html;
  setup?.(p);
  document.body.append(p);
  const [first, ...rest] = Array.from(p.childNodes);
  return { p, seg: new Segment({ parent: p, nodes: [first!, ...rest] }) };
}

afterEach(() => {
  document.body.replaceChildren();
});

describe("Segment", () => {
  it("改行を保つ要素では訳文の改行を残して書き込む", () => {
    const { p, seg } = segmentOf("Hello\nworld", (el) => (el.style.whiteSpace = "pre-line"));
    seg.applyTranslation("こんにちは\n  世界", "ja");
    seg.render("translation");
    expect(p.textContent).toBe("こんにちは\n世界");
  });

  it("改行を保たない要素では訳文の改行を空白にまとめる", () => {
    const { p, seg } = segmentOf("Hello world");
    seg.applyTranslation("こんにちは\n世界", "ja");
    seg.render("translation");
    expect(p.textContent).toBe("こんにちは 世界");
  });

  it("訳文の表示中だけ lang と dir を訳文の言語に合わせ、原文に戻すと元の属性に戻す", () => {
    const { p, seg } = segmentOf("Hello", (el) => el.setAttribute("lang", "en"));
    seg.applyTranslation("こんにちは", "ja");

    seg.render("translation");
    expect([p.getAttribute("lang"), p.getAttribute("dir")]).toEqual(["ja", "auto"]);

    seg.render("original");
    expect([p.getAttribute("lang"), p.hasAttribute("dir")]).toEqual(["en", false]);
  });
});
