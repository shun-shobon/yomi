const BATCH_MAX_CHARS = 2000;
const BATCH_MAX_SEGMENTS = 25;
/** ビューポート内では、この高さ（ビューポートに対する比率）に近いものから訳す */
const READING_LINE = 0.3;
/** 本文らしい領域を優先するため、スコアから差し引く量 */
const MAIN_CONTENT_BONUS = 300;
/** ビューポート外のものは、ビューポート内のどれよりも後にする */
const OFFSCREEN_PENALTY = 100_000;

export interface Placement {
  top: number;
  bottom: number;
  /** main / article など本文と思われる領域の中にある */
  inMainContent: boolean;
}

/** 小さいほど先に訳す */
export function priorityScore(p: Placement, viewportHeight: number): number {
  const line = viewportHeight * READING_LINE;
  const inView = p.bottom > 0 && p.top < viewportHeight;
  const score = inView
    ? Math.abs(Math.min(Math.max(line, p.top), p.bottom) - line)
    : OFFSCREEN_PENALTY + Math.min(Math.abs(p.top - viewportHeight), Math.abs(p.bottom));
  return p.inMainContent ? score - MAIN_CONTENT_BONUS : score;
}

/**
 * 優先度順に並んだ候補から、件数と文字数の上限まで詰める。
 * 上限を超える候補は飛ばして後続を試し、先頭の 1 件は大きくても必ず含める。
 */
export function packBatch<T>(sorted: readonly T[], sizeOf: (item: T) => number): T[] {
  const batch: T[] = [];
  let chars = 0;
  for (const item of sorted) {
    if (batch.length >= BATCH_MAX_SEGMENTS) break;
    const size = sizeOf(item);
    if (batch.length > 0 && chars + size > BATCH_MAX_CHARS) continue;
    batch.push(item);
    chars += size;
  }
  return batch;
}
