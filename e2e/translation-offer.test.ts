import type { Page } from "playwright-core";
import { beforeAll, expect, test } from "vitest";

import { launchExtension, screenshot } from "./fixtures";
import type { Extension } from "./fixtures";

let ext: Extension;

beforeAll(async () => {
	ext = await launchExtension();
	return () => ext.context.close();
});

// カードを出すまでオーバーレイの host 要素は作られない
const hasOverlay = (page: Page) => page.evaluate(() => document.querySelector("yomi-ui") != null);

// 提案カードは closed shadow DOM なので、操作は座標で行い表示はスクリーンショットで確認する
test("翻訳先と違う言語のページで提案し、「翻訳する」で翻訳を始める", async () => {
	const page = await ext.openTestPage();
	await screenshot(page, "translation-offer");

	const width = await page.evaluate(() => document.documentElement.clientWidth);
	// カードは右上 16px に幅 360px で出て、主操作のボタンは本文 1 行の下の左端にある
	await page.mouse.click(width - 16 - 360 + 40, 16 + 12 + 30 + 12);

	await expect.poll(() => page.textContent("#h1"), { timeout: 10_000 }).toMatch(/^JA:/u);
	await page.close();
});

test("カードの外をクリックすると提案を閉じる", async () => {
	const page = await ext.openTestPage();
	const width = await page.evaluate(() => document.documentElement.clientWidth);

	await page.mouse.click(100, 400);
	// 閉じていれば「翻訳する」があった位置をクリックしても翻訳は始まらない
	await page.mouse.click(width - 16 - 360 + 40, 16 + 12 + 30 + 12);

	expect(await ext.sendToTab({ type: "page:getState" })).toMatchObject({ active: false });
	await page.close();
});

test("提案を閉じたタブでは、ページを移っても提案しない", async () => {
	const page = await ext.openTestPage("https://test.example/first");
	await page.mouse.click(100, 400);
	await page.goto("https://test.example/second");

	const other = await ext.openTestPage("https://test.example/other-tab");
	await expect.poll(() => hasOverlay(other)).toBe(true);
	expect(await hasOverlay(page)).toBe(false);
	await page.close();
	await other.close();
});

test("提案を閉じたタブでも、リロードすれば再び提案する", async () => {
	const page = await ext.openTestPage();
	await page.mouse.click(100, 400);
	await page.reload();

	await expect.poll(() => hasOverlay(page)).toBe(true);
	await page.close();
});

test("翻訳したタブでページを移ると次のページも翻訳し、新しいタブでは翻訳しない", async () => {
	const page = await ext.openTestPage("https://test.example/first");
	await ext.sendToTab({ type: "page:translate" });
	await expect.poll(() => page.textContent("#h1"), { timeout: 10_000 }).toMatch(/^JA:/u);

	await page.goto("https://test.example/second");
	await expect.poll(() => page.textContent("#h1"), { timeout: 10_000 }).toMatch(/^JA:/u);

	const other = await ext.openTestPage("https://test.example/other-tab");
	await expect.poll(() => hasOverlay(other)).toBe(true);
	expect(await ext.sendToTab({ type: "page:getState" })).toMatchObject({ active: false });
	await page.close();
	await other.close();
});

test("翻訳したタブでもリロードすれば翻訳せずに提案する", async () => {
	const page = await ext.openTestPage();
	await ext.sendToTab({ type: "page:translate" });
	await expect.poll(() => page.textContent("#h1"), { timeout: 10_000 }).toMatch(/^JA:/u);

	await page.reload();
	await expect.poll(() => hasOverlay(page)).toBe(true);
	expect(await ext.sendToTab({ type: "page:getState" })).toMatchObject({ active: false });
	await page.close();
});

test("翻訳を止めたタブでは、ページを移っても翻訳しない", async () => {
	const page = await ext.openTestPage("https://test.example/first");
	await ext.sendToTab({ type: "page:translate" });
	await expect.poll(() => page.textContent("#h1"), { timeout: 10_000 }).toMatch(/^JA:/u);
	await ext.sendToTab({ type: "page:stop" });

	await page.goto("https://test.example/second");
	await expect.poll(() => hasOverlay(page)).toBe(true);
	expect(await ext.sendToTab({ type: "page:getState" })).toMatchObject({ active: false });
	await page.close();
});

test("常に翻訳するサイトは開いただけで翻訳する", async () => {
	await ext.setSiteRules({ alwaysTranslate: ["test.example"] });
	const page = await ext.openTestPage();

	await expect.poll(() => page.textContent("#h1"), { timeout: 10_000 }).toMatch(/^JA:/u);
	await page.close();
});

test.each([
	[
		"本文を書き換える",
		() => {
			history.pushState(null, "", "/spa-next");
			document.querySelector("#h1")!.textContent = "Next page heading";
		},
	],
	[
		"body を差し替える",
		() => {
			history.pushState(null, "", "/spa-next");
			const body = document.createElement("body");
			body.innerHTML = '<h1 id="h1">Next page heading</h1>';
			document.documentElement.replaceChild(body, document.body);
		},
	],
])("翻訳中のタブで SPA が%s遷移をしても、移った先を翻訳する", async (_, navigate) => {
	const page = await ext.openTestPage();
	await ext.sendToTab({ type: "page:translate" });
	await expect.poll(() => page.textContent("#h1"), { timeout: 10_000 }).toMatch(/^JA:/u);

	await page.evaluate(navigate);
	await expect
		.poll(() => page.textContent("#h1"), { timeout: 10_000 })
		.toBe("JA:NEXT PAGE HEADING");
	await page.close();
});
