/**
 * 複数セグメントを 1 リクエストにまとめるための入出力形式。
 * 各セグメントを <seg id="N">…</seg> で囲み、N は 1 始まりのバッチ内の位置。
 */

/** 閉じタグが欠けた seg が次の seg を飲み込まないよう、内容に <seg を含ませない */
const SEG_PATTERN = /<seg id="?(\d+)"?>((?:(?!<seg[\s>])[\s\S])*?)<\/seg>/g;

export function encodeBatch(markups: readonly string[]): string {
  return markups.map((markup, i) => `<seg id="${i + 1}">${markup}</seg>`).join("\n");
}

/**
 * ストリーミングで届く出力から、閉じた seg を順に取り出す。
 * index はバッチ内の 0 始まりの位置。範囲外や重複の検証は呼び出し側で行う。
 */
export function createBatchDecoder(
  onSegment: (index: number, markup: string) => void,
): (delta: string) => void {
  let buffer = "";
  let cursor = 0;
  const pattern = new RegExp(SEG_PATTERN);
  return (delta) => {
    buffer += delta;
    pattern.lastIndex = cursor;
    for (let m = pattern.exec(buffer); m; m = pattern.exec(buffer)) {
      cursor = pattern.lastIndex;
      onSegment(Number(m[1]) - 1, m[2]!);
    }
  };
}
