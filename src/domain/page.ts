export type Showing = "translation" | "original";

export type SegmentState = "idle" | "queued" | "pending" | "done" | "failed";

export interface PageState {
  /** 翻訳セッションが有効で、スクロールや DOM 変化に追従して翻訳し続けている */
  active: boolean;
  showing: Showing;
  /** 翻訳待ち + 翻訳中のセグメント数 */
  busy: number;
  done: number;
  failed: number;
}

export function summarizePage(
  active: boolean,
  showing: Showing,
  states: Iterable<SegmentState>,
): PageState {
  const counts: Record<SegmentState, number> = {
    idle: 0,
    queued: 0,
    pending: 0,
    done: 0,
    failed: 0,
  };
  for (const state of states) counts[state]++;
  return {
    active,
    showing,
    busy: counts.queued + counts.pending,
    done: counts.done,
    failed: counts.failed,
  };
}
