import { describe, expect, it } from "vitest";

import { createBatchDecoder, encodeBatch } from "./batch-protocol";

function decode(chunks: string[]): [number, string][] {
  const out: [number, string][] = [];
  const feed = createBatchDecoder((index, markup) => out.push([index, markup]));
  for (const chunk of chunks) feed(chunk);
  return out;
}

describe("encodeBatch", () => {
  it("1 始まりの id を振った seg で囲む", () => {
    expect(encodeBatch(["a", "<g0>b</g0>"])).toBe(
      '<seg id="1">a</seg>\n<seg id="2"><g0>b</g0></seg>',
    );
  });

  it("decoder で 0 始まりの位置と元のマークアップに戻る", () => {
    const markups = ["one", "two\nlines", "<x0/>"];
    expect(decode([encodeBatch(markups)])).toEqual(markups.map((m, i) => [i, m]));
  });
});

describe("createBatchDecoder", () => {
  it("チャンク境界をまたぐ seg を閉じた時点で 1 度だけ取り出す", () => {
    const out: [number, string][] = [];
    const feed = createBatchDecoder((index, markup) => out.push([index, markup]));
    feed('<seg id="1">he');
    feed("llo</se");
    expect(out).toEqual([]);
    feed('g>\n<seg id="2">wor');
    expect(out).toEqual([[0, "hello"]]);
    feed("ld</seg>");
    expect(out).toEqual([
      [0, "hello"],
      [1, "world"],
    ]);
  });

  it("1 文字ずつ届いても取り出せる", () => {
    expect(decode('<seg id="1">a</seg><seg id="2">b</seg>'.split(""))).toEqual([
      [0, "a"],
      [1, "b"],
    ]);
  });

  it("id の引用符がなくても読む", () => {
    expect(decode(["<seg id=3>x</seg>"])).toEqual([[2, "x"]]);
  });

  it("閉じタグが欠けた seg は捨て、次の seg を飲み込まない", () => {
    expect(decode(['<seg id="1">broken\n<seg id="2">ok</seg>'])).toEqual([[1, "ok"]]);
  });

  it("順不同で届いた seg を届いた順に返す", () => {
    expect(decode(['<seg id="2">b</seg><seg id="1">a</seg>'])).toEqual([
      [1, "b"],
      [0, "a"],
    ]);
  });

  it("seg の外の文字列は無視する", () => {
    expect(decode(['了解です。\n<seg id="1">a</seg>\n以上'])).toEqual([[0, "a"]]);
  });
});
