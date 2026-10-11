import { beforeAll, expect, test } from "vitest";

import { launchExtension } from "./fixtures";
import type { Extension } from "./fixtures";

let ext: Extension;

beforeAll(async () => {
	ext = await launchExtension();
	return () => ext.context.close();
});

test("中身の差し替え", async () => {
	const page = await ext.openTestPage();
	await ext.sendToTab({ type: "page:translate" });
	await expect.poll(() => page.textContent("#h1"), { timeout: 10_000 }).toMatch(/^JA:/u);
	await page.evaluate(() => {
		history.pushState(null, "", "/next");
		document.querySelector("#dynamic-root")!.innerHTML = "<p id='spa'>Brand new content here</p>";
	});
	await expect.poll(() => page.textContent("#spa"), { timeout: 10_000 }).toMatch(/^JA:/u);
});

test("body の差し替え", async () => {
	const page = await ext.openTestPage();
	await ext.sendToTab({ type: "page:translate" });
	await expect.poll(() => page.textContent("#h1"), { timeout: 10_000 }).toMatch(/^JA:/u);
	await page.evaluate(() => {
		history.pushState(null, "", "/next");
		const body = document.createElement("body");
		body.innerHTML = "<p id='spa'>Brand new content here</p>";
		document.body.replaceWith(body);
	});
	await expect.poll(() => page.textContent("#spa"), { timeout: 5_000 }).toMatch(/^JA:/u);
});
