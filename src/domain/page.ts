import * as v from "valibot";

const ShowingSchema = v.picklist(["translation", "original"]);

export type Showing = v.InferOutput<typeof ShowingSchema>;

export type SegmentState = "idle" | "queued" | "pending" | "done" | "failed";

export const PageStateSchema = v.object({
  active: v.boolean(),
  showing: ShowingSchema,
  busy: v.number(),
  done: v.number(),
  failed: v.number(),
});

export type PageState = v.InferOutput<typeof PageStateSchema>;

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
