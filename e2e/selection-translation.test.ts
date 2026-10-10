import type { Page } from "playwright-core";
import { beforeAll, expect, test } from "vitest";

import { type Extension, launchExtension, screenshot } from "./fixtures";

let ext: Extension;
let page: Page;

beforeAll(async () => {
  ext = await launchExtension();
  return () => ext.context.close();
});

beforeAll(async () => {
  await ext.setSettings({ model: "gpt-6-luna", targetLang: "ja", fastMode: true });
  page = await ext.openTestPage();
});

// 選択テキスト翻訳の UI は closed shadow DOM なので、操作は座標で行い表示はスクリーンショットで確認する
test("選択したテキストを翻訳ボタンから翻訳する", async () => {
  const box = (await page.locator("#li2").boundingBox())!;
  await page.mouse.move(box.x + 2, box.y + box.height / 2);
  await page.mouse.down();
  await page.mouse.move(box.x + 120, box.y + box.height / 2);
  await page.mouse.up();
  await page.waitForTimeout(300);
  await screenshot(page, "selection-button");

  const selRect = await page.evaluate(() => {
    const rects = getSelection()!.getRangeAt(0).getClientRects();
    const last = rects.item(rects.length - 1)!;
    return { right: last.right, bottom: last.bottom };
  });
  await page.mouse.click(selRect.right, selRect.bottom + 8 + 15);
  await expect.poll(async () => (await ext.requests()).length).toBe(1);
  await page.waitForTimeout(500);
  await screenshot(page, "selection-panel");

  const [request] = await ext.requests();
  expect(request!.input[0]!.content).not.toContain("<seg");
  expect(request!.service_tier).toBe("priority");
});
