import { describe, expect, it } from "vitest";

import { packBatch, priorityScore } from "./batch-scheduler";
import type { Placement } from "./batch-scheduler";

const VIEWPORT = 1000;
const at = (top: number, bottom: number, inMainContent = false): Placement => ({
	top,
	bottom,
	inMainContent,
});

describe("priorityScore", () => {
	it("ビューポート内では読書ライン（上から 3 割）に近いものほど先", () => {
		const nearLine = priorityScore(at(280, 320), VIEWPORT);
		const top = priorityScore(at(0, 40), VIEWPORT);
		const bottom = priorityScore(at(900, 940), VIEWPORT);
		expect(nearLine).toBeLessThan(top);
		expect(top).toBeLessThan(bottom);
	});

	it("読書ラインにかかる要素は高さに関わらず同じ優先度", () => {
		expect(priorityScore(at(100, 900), VIEWPORT)).toBe(priorityScore(at(290, 310), VIEWPORT));
	});

	it("ビューポート外はビューポート内のどれよりも後で、近いものほど先", () => {
		const farthestInView = priorityScore(at(990, 1000), VIEWPORT);
		const justBelow = priorityScore(at(1010, 1050), VIEWPORT);
		const farBelow = priorityScore(at(5000, 5050), VIEWPORT);
		const justAbove = priorityScore(at(-50, -10), VIEWPORT);
		expect(farthestInView).toBeLessThan(justBelow);
		expect(farthestInView).toBeLessThan(justAbove);
		expect(justBelow).toBeLessThan(farBelow);
	});

	it("本文領域の要素は、少し遠くても本文外の要素より先", () => {
		expect(priorityScore(at(500, 520, true), VIEWPORT)).toBeLessThan(
			priorityScore(at(400, 420), VIEWPORT),
		);
	});

	it("本文領域でもビューポート外ならビューポート内より後", () => {
		expect(priorityScore(at(990, 1000), VIEWPORT)).toBeLessThan(
			priorityScore(at(1010, 1050, true), VIEWPORT),
		);
	});
});

describe("packBatch", () => {
	const size = (n: number) => n;

	it("先頭の候補は文字数上限を超えていても必ず入れる", () => {
		expect(packBatch([100_000, 1], size)).toEqual([100_000]);
	});

	it("上限を超える候補は飛ばして、収まる後続を詰める", () => {
		expect(packBatch([1500, 1000, 400, 200], size)).toEqual([1500, 400]);
	});

	it("優先度順を保つ", () => {
		expect(packBatch([3, 1, 2], size)).toEqual([3, 1, 2]);
	});

	it("件数は 25 件までに抑える", () => {
		expect(
			packBatch(
				Array.from({ length: 30 }, () => 1),
				size,
			),
		).toHaveLength(25);
	});

	it("候補がなければ空", () => {
		expect(packBatch([], size)).toEqual([]);
	});
});
