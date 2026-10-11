import { describe, expect, it } from "vitest";

import { placeAbove, placeBelow } from "./position";
import type { Viewport } from "./position";

const viewport: Viewport = { width: 1000, height: 800, scrollX: 0, scrollY: 0 };
const size = { width: 200, height: 100 };

function rect(left: number, top: number, width: number, height: number): DOMRect {
	return {
		left,
		top,
		width,
		height,
		right: left + width,
		bottom: top + height,
		x: left,
		y: top,
		toJSON: () => ({}),
	};
}

describe("placeBelow", () => {
	it("収まれば anchor の下に置く", () => {
		const pos = placeBelow(rect(400, 100, 100, 20), size, viewport);
		expect(pos.top).toBeGreaterThan(120);
		expect(pos.top + size.height).toBeLessThanOrEqual(viewport.height);
	});

	it("下に収まらなければ anchor の上に反転する", () => {
		const anchor = rect(400, 700, 100, 20);
		const pos = placeBelow(anchor, size, viewport);
		expect(pos.top + size.height).toBeLessThanOrEqual(anchor.top);
	});

	it("上にも収まらなければ上端に寄せる", () => {
		const pos = placeBelow(rect(400, 50, 100, 720), size, viewport);
		expect(pos.top).toBeGreaterThanOrEqual(0);
		expect(pos.top).toBeLessThan(50);
	});

	it("左右はビューポートの内側にクランプする", () => {
		const left = placeBelow(rect(0, 100, 10, 20), size, viewport);
		const right = placeBelow(rect(990, 100, 10, 20), size, viewport);
		expect(left.left).toBeGreaterThanOrEqual(0);
		expect(right.left + size.width).toBeLessThanOrEqual(viewport.width);
	});

	it("スクロール量を足してページ座標にする", () => {
		const anchor = rect(400, 100, 100, 20);
		const base = placeBelow(anchor, size, viewport);
		const scrolled = placeBelow(anchor, size, { ...viewport, scrollX: 30, scrollY: 500 });
		expect(scrolled).toEqual({ left: base.left + 30, top: base.top + 500 });
	});
});

describe("placeAbove", () => {
	it("収まれば anchor の上に置き、左端を anchor に揃える", () => {
		const anchor = rect(400, 300, 100, 20);
		const pos = placeAbove(anchor, size, viewport);
		expect(pos.top + size.height).toBeLessThanOrEqual(anchor.top);
		expect(pos.left).toBe(400);
	});

	it("上に収まらなければ anchor の下に反転する", () => {
		const anchor = rect(400, 50, 100, 20);
		expect(placeAbove(anchor, size, viewport).top).toBeGreaterThanOrEqual(anchor.bottom);
	});

	it("左右はビューポートの内側にクランプする", () => {
		const left = placeAbove(rect(-50, 300, 100, 20), size, viewport);
		const right = placeAbove(rect(950, 300, 40, 20), size, viewport);
		expect(left.left).toBeGreaterThanOrEqual(0);
		expect(right.left + size.width).toBeLessThanOrEqual(viewport.width);
	});

	it("スクロール量を足してページ座標にする", () => {
		const anchor = rect(400, 300, 100, 20);
		const base = placeAbove(anchor, size, viewport);
		const scrolled = placeAbove(anchor, size, { ...viewport, scrollX: 30, scrollY: 500 });
		expect(scrolled).toEqual({ left: base.left + 30, top: base.top + 500 });
	});
});
