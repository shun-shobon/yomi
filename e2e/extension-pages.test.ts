import { beforeAll, describe, expect, test } from "vitest";

import { launchExtension, screenshot, takesScreenshots } from "./fixtures";
import type { Extension } from "./fixtures";

let ext: Extension;

beforeAll(async () => {
	ext = await launchExtension();
	return () => ext.context.close();
});

test.runIf(takesScreenshots)("ポップアップを表示する", async () => {
	const popup = await ext.context.newPage();
	await popup.setViewportSize({ width: 340, height: 520 });
	await popup.goto(`chrome-extension://${ext.extensionId}/popup.html`);
	await popup.waitForTimeout(600);
	await screenshot(popup, "popup", { fullPage: true });
	await popup.close();
});

describe("設定ページ", () => {
	test("モデルごとの選択肢を表示する", async () => {
		const options = await ext.context.newPage();
		await options.setViewportSize({ width: 900, height: 1100 });
		await options.goto(`chrome-extension://${ext.extensionId}/options.html`);
		const selects = options.locator("select");

		// 表示対象のモデルだけが並ぶ
		await expect
			.poll(() => selects.first().locator("option").allTextContents())
			.toEqual(["GPT-6 Luna", "GPT-6.1 Sol"]);
		// 推論の強さはモデルが対応するものだけ並ぶ
		expect(await selects.nth(1).locator("option").allTextContents()).toEqual(["low", "medium"]);
		expect(await options.getByText("高速モード").count()).toBe(1);

		await screenshot(options, "options", { fullPage: true });
		await options.close();
	});
});
