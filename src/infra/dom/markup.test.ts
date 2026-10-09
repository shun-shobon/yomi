// @vitest-environment happy-dom
import { describe, expect, it } from "vitest";

import { parse } from "@/domain/markup";

import { build, serialize } from "./markup";

function paragraph(html: string): HTMLParagraphElement {
  const p = document.createElement("p");
  p.innerHTML = html;
  return p;
}

function serializeChildren(html: string) {
  const p = paragraph(html);
  const [first, ...rest] = Array.from(p.childNodes);
  return serialize({ parent: p, nodes: [first!, ...rest] });
}

function html(fragment: DocumentFragment): string {
  const div = document.createElement("div");
  div.append(fragment);
  return div.innerHTML;
}

describe("serialize", () => {
  it("インライン要素を g、訳さない要素を x にし、要素を出現順に番号付ける", () => {
    const { markup, placeholders, structure } = serializeChildren(
      'Click <a href="/x">the <b>link</b></a> or <code>run()</code>.',
    );
    expect(markup).toBe("Click <g0>the <g1>link</g1></g0> or <x2/>.");
    expect(placeholders.map((el) => el.tagName)).toEqual(["A", "B", "CODE"]);
    expect(structure).toBe("g0 g1 /g1 /g0 x2");
  });

  it("structure は同じマークアップを parse した structure と一致する", () => {
    const { markup, structure } = serializeChildren("a<em>b<br>c</em><img>d");
    expect(parse(markup).structure).toBe(structure);
  });

  it("空白をまとめて両端を落とし、テキスト中の < & をエスケープする", () => {
    expect(serializeChildren("\n  a  <  b\n &amp; c  ").markup).toBe("a &lt; b &amp; c");
  });

  it("notranslate などの除外指定は、インライン要素でも中身ごと x にする", () => {
    const { markup } = serializeChildren('Use <span class="notranslate">Yomi <b>app</b></span>');
    expect(markup).toBe("Use <x0/>");
  });

  it("テキストスロットはタグ数 + 1 個で、各位置のテキストノードを持つ", () => {
    const { slots } = serializeChildren("a<b>b</b>c");
    expect(slots.map((slot) => slot.texts.map((t) => t.data))).toEqual([["a"], ["b"], ["c"]]);
  });
});

describe("build", () => {
  it("訳文の語順に合わせて要素の複製を並べ替える", () => {
    const { placeholders } = serializeChildren('Read <a href="/x">the docs</a> <b>now</b>');
    const fragment = build("<g1>今すぐ</g1><g0>ドキュメント</g0>を読む", placeholders);
    expect(html(fragment)).toBe('<b>今すぐ</b><a href="/x">ドキュメント</a>を読む');
  });

  it("元の要素は動かさず複製する", () => {
    const p = paragraph("a <b>b</b>");
    const { placeholders } = serialize({ parent: p, nodes: [p.firstChild!, p.lastChild!] });
    build("<g0>B</g0> A", placeholders);
    expect(p.innerHTML).toBe("a <b>b</b>");
  });

  it("存在しない id のタグは捨てて中身のテキストを残す", () => {
    const { placeholders } = serializeChildren("<b>x</b>");
    expect(html(build("<g0>太字</g0><g7>余分</g7>", placeholders))).toBe("<b>太字</b>余分");
  });

  it("重複した id は最初の 1 つだけ要素にし、2 つ目は中身のテキストだけ残す", () => {
    const { placeholders } = serializeChildren("<b>x</b> <img>");
    expect(html(build("<g0>一</g0><g0>二</g0><x1/><x1/>", placeholders))).toBe("<b>一</b>二<img>");
  });

  it("閉じ忘れた入れ子のタグは外側の閉じタグでまとめて閉じる", () => {
    const { placeholders } = serializeChildren("<a><b>x</b></a>");
    expect(html(build("<g0><g1>中</g0>外", placeholders))).toBe("<a><b>中</b></a>外");
  });

  it("訳文から落ちた atomic 要素を末尾に補う", () => {
    const { placeholders } = serializeChildren("see <img> and <code>x</code>");
    expect(html(build("<x1/> を参照", placeholders))).toBe("<code>x</code> を参照<img>");
  });

  it("落ちたのがインライン要素なら補わない", () => {
    const { placeholders } = serializeChildren("<b>x</b>");
    expect(html(build("太字なし", placeholders))).toBe("太字なし");
  });

  it("エンティティはテキストとしてデコードし、HTML として解釈しない", () => {
    const { placeholders } = serializeChildren("x");
    const fragment = build("&lt;img src=x onerror=alert(1)&gt;", placeholders);
    expect(fragment.querySelector("img")).toBeNull();
    expect(fragment.textContent).toBe("<img src=x onerror=alert(1)>");
  });
});
