import { beforeAll, expect, test } from "vitest";

import { launchExtension, screenshot } from "./fixtures";
import type { Extension } from "./fixtures";

let ext: Extension;

beforeAll(async () => {
	ext = await launchExtension();
	return () => ext.context.close();
});

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

	// カードを出すまでオーバーレイの host 要素は作られない
	const hasOverlay = (p: typeof page) =>
		p.evaluate(() => document.querySelector("yomi-ui") != null);
	const other = await ext.openTestPage("https://test.example/other-tab");
	await expect.poll(() => hasOverlay(other)).toBe(true);
	expect(await hasOverlay(page)).toBe(false);
	await page.close();
	await other.close();
});

test("常に翻訳するサイトは開いただけで翻訳する", async () => {
	await ext.setSiteRules({ alwaysTranslate: ["test.example"] });
	const page = await ext.openTestPage();

	await expect.poll(() => page.textContent("#h1"), { timeout: 10_000 }).toMatch(/^JA:/u);
	await page.close();
});
