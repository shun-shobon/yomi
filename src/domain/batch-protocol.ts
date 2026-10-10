/** 閉じタグが欠けた seg が次の seg を飲み込まないよう、内容に <seg を含ませない */
const SEG_PATTERN = /<seg id="?(\d+)"?>((?:(?!<seg[\s>])[\s\S])*?)<\/seg>/g;

export function encodeBatch(markups: readonly string[]): string {
  return markups.map((markup, i) => `<seg id="${i + 1}">${markup}</seg>`).join("\n");
}

/** 範囲外や重複の検証は呼び出し側で行う */
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
