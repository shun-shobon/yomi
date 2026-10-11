const BATCH_MAX_CHARS = 2000;
const BATCH_MAX_SEGMENTS = 25;
const READING_LINE = 0.3;
const MAIN_CONTENT_BONUS = 300;
const OFFSCREEN_PENALTY = 100_000;

export interface Placement {
	top: number;
	bottom: number;
	inMainContent: boolean;
}

export function priorityScore(p: Placement, viewportHeight: number): number {
	const line = viewportHeight * READING_LINE;
	const inView = p.bottom > 0 && p.top < viewportHeight;
	const score = inView
		? Math.abs(Math.min(Math.max(line, p.top), p.bottom) - line)
		: OFFSCREEN_PENALTY + Math.min(Math.abs(p.top - viewportHeight), Math.abs(p.bottom));
	return p.inMainContent ? score - MAIN_CONTENT_BONUS : score;
}

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
