import { describe, expect, it } from "vitest";

import { escapeText, parse } from "./markup";

describe("parse", () => {
  it("タグ列とタグ間のテキストに分ける", () => {
    expect(parse("前<g0>強調</g0>中<x1/>後")).toEqual({
      structure: "g0 /g0 x1",
      texts: ["前", "強調", "中", "後"],
    });
  });

  it("タグが連続しても、テキスト列は常にタグ数 + 1", () => {
    expect(parse("<g0><x1/></g0>")).toEqual({ structure: "g0 x1 /g0", texts: ["", "", "", ""] });
  });

  it("タグのないテキストは 1 要素になる", () => {
    expect(parse("plain")).toEqual({ structure: "", texts: ["plain"] });
  });

  it("空白入りの自己終了タグも atomic として読む", () => {
    expect(parse("a<x1 />b").structure).toBe("x1");
  });

  it("g・x 以外のタグはテキストとして残す", () => {
    expect(parse("<b>x</b>")).toEqual({ structure: "", texts: ["<b>x</b>"] });
  });

  it("名前付きエンティティを大文字小文字を問わずデコードする", () => {
    expect(parse("&lt;&GT;&amp;&quot;&apos;").texts).toEqual(["<>&\"'"]);
  });

  it("10 進・16 進の文字参照をデコードする", () => {
    expect(parse("&#65;&#x3042;&#X1F600;").texts).toEqual(["Aあ😀"]);
  });

  it("未知の名前や Unicode の範囲外はそのまま残す", () => {
    expect(parse("&copy;&#x110000;&#99999999;").texts).toEqual(["&copy;&#x110000;&#99999999;"]);
  });

  it("エスケープされたタグはタグとして扱わない", () => {
    expect(parse("&lt;g0&gt;")).toEqual({ structure: "", texts: ["<g0>"] });
  });
});

describe("escapeText", () => {
  it("& < > をエスケープし、parse で元に戻る", () => {
    const text = "a < b && c > <g0>";
    expect(escapeText(text)).toBe("a &lt; b &amp;&amp; c &gt; &lt;g0&gt;");
    expect(parse(escapeText(text)).texts).toEqual([text]);
  });

  it("既にエンティティの形をした文字列も二重にデコードされない", () => {
    expect(parse(escapeText("&lt;")).texts).toEqual(["&lt;"]);
  });
});
