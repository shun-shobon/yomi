import type { Page } from "playwright-core";
import { afterAll, beforeAll, describe, expect, test } from "vitest";

import { type Extension, launchExtension, screenshot, takesScreenshots } from "./fixtures";

type LinkHolder = Window & { __link?: Element | null };

let ext: Extension;
let page: Page;
let originalP1: string;

const text = (sel: string) => page.textContent(sel);

beforeAll(async () => {
  ext = await launchExtension();
  page = await ext.openTestPage();
  originalP1 = await page.innerHTML("#p1");
  await page.evaluate(() => {
    (window as LinkHolder).__link = document.querySelector("#link");
  });

  await ext.sendToTab({ type: "page:translate" });
  await page.waitForFunction(() => document.querySelector("#li2")?.textContent?.includes("JA:"));
  await page.waitForTimeout(300);
  await screenshot(page, "page-translated");
});

afterAll(() => ext?.context.close());

describe("ページ翻訳", () => {
  test("見出しが翻訳される", async () => {
    expect(await text("#h1")).toMatch(/^JA:GETTING/);
  });

  test("リンクの href が保たれる", async () => {
    expect(await page.getAttribute("#p1 a", "href")).toBe("https://example.com/docs");
  });

  test("リンク内テキストも翻訳される", async () => {
    expect(await text("#p1 a")).toBe("OFFICIAL DOCUMENTATION");
  });

  test("インライン code は訳さない", async () => {
    expect(await text("#p1 code")).toBe("npm run build");
  });

  test("太字要素が保たれる", async () => {
    expect(await text("#p1 b")).toBe("WHOLE");
  });

  test("構造が同じ場合は元の要素をそのまま使う", async () => {
    expect(
      await page.evaluate(() => document.querySelector("#p1 a") === (window as LinkHolder).__link),
    ).toBe(true);
  });

  test("語順が変わってもリンクを保つ", async () => {
    expect((await page.innerHTML("#p2")).replace(/ id="link2"/, "")).toBe(
      '<a href="/x">HERE</a> CLICK NOW',
    );
  });

  test("リスト項目が翻訳される", async () => {
    expect(await text("#li1")).toBe("JA:FIRST ITEM");
  });

  test("display: contents の中も翻訳する", async () => {
    expect(await text("#contents-p")).toContain("JA:");
  });

  test("pre は訳さない", async () => {
    expect(await text("#pre")).toBe('const keepMe = "untranslated";');
  });

  test("notranslate は訳さない", async () => {
    expect(await text("#nt .notranslate")).toBe("BrandName");
  });

  test("スクロールしなくてもビューポート外まで翻訳される", async () => {
    await expect.poll(() => text("#far")).toContain("JA:");
  });
});

describe("ページの変化への追従", () => {
  test("動的に追加された要素も翻訳される", async () => {
    await page.evaluate(() => {
      const p = document.createElement("p");
      p.id = "dyn";
      p.textContent = "Dynamically inserted content";
      document.querySelector("#dynamic-root")!.append(p);
    });
    await expect.poll(() => text("#dyn")).toContain("JA:");
  });

  test("ページが書き換えたテキストを訳し直す", async () => {
    await page.evaluate(() => {
      window.scrollTo(0, 0);
      (document.querySelector("#li1")!.firstChild as Text).data = "Rerendered by framework";
    });
    await expect.poll(() => text("#li1")).toBe("JA:RERENDERED BY FRAMEWORK");
  });

  test("閉じた details の中身は未翻訳", async () => {
    expect(await text("#hidden-p")).toBe("Hidden until opened");
  });

  test("表示された要素を翻訳する", async () => {
    await page.evaluate(() => {
      document.querySelector<HTMLDetailsElement>("#det")!.open = true;
    });
    await expect.poll(() => text("#hidden-p")).toContain("JA:");
  });

  test("翻訳完了後にハイライトが残らない", async () => {
    expect(await page.locator("[data-gt-pending]").count()).toBe(0);
  });

  test("状態が取得できる", async () => {
    const state = await ext.sendToTab<{ active: boolean; done: number }>({
      type: "page:getState",
    });
    expect(state.active).toBe(true);
    expect(state.done).toBeGreaterThanOrEqual(6);
  });
});

describe("原文と訳文の切り替え", () => {
  test("原文に戻すと元の DOM とテキストに戻る", async () => {
    await ext.sendToTab({ type: "page:showOriginal" });
    expect(await page.innerHTML("#p1")).toBe(originalP1);
    expect(await text("#li1")).toBe("Rerendered by framework");
    expect(await text("#p2")).toBe("Click here now");
  });

  test("訳文表示に戻せる", async () => {
    await ext.sendToTab({ type: "page:showTranslation" });
    expect(await text("#li1")).toBe("JA:RERENDERED BY FRAMEWORK");
  });
});

describe("API リクエスト", () => {
  test("store:false / stream:true で送る", async () => {
    for (const r of await ext.requests()) {
      expect(r).toMatchObject({ store: false, stream: true });
    }
  });

  test("reasoning effort を送る", async () => {
    for (const r of await ext.requests()) expect(r.reasoning?.effort).toBe("low");
  });

  test("高速モードが OFF なら service_tier を送らない", async () => {
    for (const r of await ext.requests()) expect(r).not.toHaveProperty("service_tier");
  });

  test("system ロールを使わない", async () => {
    for (const r of await ext.requests()) {
      expect(r.input.map((m) => m.role)).not.toContain("system");
    }
  });
});

describe("キャッシュ", () => {
  test("同じ内容のページはキャッシュから表示し、API に送らない", async () => {
    const before = (await ext.requests()).length;
    const cachedPage = await ext.openTestPage();
    await cachedPage.bringToFront();
    await ext.sendToTab({ type: "page:translate" });
    await expect.poll(() => cachedPage.textContent("#far")).toContain("JA:");
    expect(await cachedPage.textContent("#h1")).toMatch(/^JA:GETTING/);
    expect((await ext.requests()).length).toBe(before);
    await cachedPage.close();
  });

  test("URL が違うページではキャッシュを使わない", async () => {
    const before = (await ext.requests()).length;
    const otherPage = await ext.openTestPage("https://test.example/other-page");
    await otherPage.bringToFront();
    await ext.sendToTab({ type: "page:translate" });
    await expect.poll(() => otherPage.textContent("#far")).toContain("JA:");
    expect((await ext.requests()).length).toBeGreaterThan(before);
    await otherPage.close();
  });

  test("設定画面で保存済みの訳文の件数を表示し、消去できる", async () => {
    const options = await ext.context.newPage();
    await options.goto(`chrome-extension://${ext.extensionId}/options.html`);
    const label = options.getByText(/保存済みの訳文/);
    await expect.poll(() => label.textContent()).toMatch(/保存済みの訳文 [1-9]\d* 件/);
    await options.getByRole("button", { name: "キャッシュを消去" }).click();
    await expect.poll(() => label.textContent()).toContain(" 0 件");
    await options.close();
  });
});

test.runIf(takesScreenshots)("ホバーで原文を表示する", async () => {
  await page.bringToFront();
  await page.evaluate(() => window.scrollTo(0, 0));
  await page.hover("#li1");
  await page.waitForTimeout(500);
  await screenshot(page, "hover-original");
});
