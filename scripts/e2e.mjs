import { mkdtempSync } from "node:fs";
import { tmpdir } from "node:os";
import { join, resolve } from "node:path";

import { chromium } from "playwright-core";

const extensionPath = resolve(".output/chrome-mv3");
const shotDir = process.argv[2] ?? null;
const executablePath = process.env.CHROMIUM_PATH;
if (!executablePath) throw new Error("CHROMIUM_PATH を指定してください");

const TEST_PAGE = `<!doctype html><html lang="en"><head><title>Test page</title></head><body style="font:16px/1.5 sans-serif;max-width:720px;margin:24px auto">
<h1 id="h1">Getting started with the extension</h1>
<p id="p1">Read the <a id="link" href="https://example.com/docs">official documentation</a> and run <code id="code">npm run build</code> to build the <b>whole</b> project.</p>
<ul><li id="li1">First item</li><li id="li2">Second item with <em>emphasis</em></li></ul>
<p id="p2">Click <a id="link2" href="/x">here</a> now</p>
<details id="det"><summary id="sum">More details</summary><p id="hidden-p">Hidden until opened</p></details>
<pre id="pre">const keepMe = "untranslated";</pre>
<main style="display:contents"><p id="contents-p">Inside a display contents wrapper</p></main>
<p id="nt"><span class="notranslate">BrandName</span> stays as is.</p>
<div style="height:3000px"></div>
<p id="far">This paragraph is far below the fold.</p>
<div id="dynamic-root"></div>
</body></html>`;

const userDataDir = mkdtempSync(join(tmpdir(), "gt-e2e-"));
const context = await chromium.launchPersistentContext(userDataDir, {
  executablePath,
  headless: true,
  args: [`--disable-extensions-except=${extensionPath}`, `--load-extension=${extensionPath}`],
  viewport: { width: 1000, height: 800 },
});

let failures = 0;
const check = (name, ok, detail = "") => {
  console.log(`${ok ? "✔" : "✘"} ${name}${detail ? `  (${detail})` : ""}`);
  if (!ok) failures++;
};

try {
  const sw = context.serviceWorkers()[0] ?? (await context.waitForEvent("serviceworker"));
  const extensionId = new URL(sw.url()).host;

  await sw.evaluate(async () => {
    await chrome.storage.local.set({
      credentials: {
        clientId: "oaiapp_test",
        email: "tester@example.com",
        idToken: "fake-id-token",
        accessToken: "fake-access",
        refreshToken: "fake-refresh",
        expiresAt: Date.now() + 3600_000,
      },
    });
    await chrome.storage.sync.set({ settings: { model: "gpt-6-luna", targetLang: "ja" } });

    const fakeTranslate = (markup) =>
      markup.startsWith("Click ")
        ? // 語順が変わりタグ構造が原文と一致しないケース
          markup.replace(/^Click (<g(\d+)>)here(<\/g\2>) now$/, "$1HERE$3 CLICK NOW")
        : "JA:" + markup.replace(/(^|>)([^<]*)/g, (_, gt, text) => gt + text.toUpperCase());
    const sse = (events) => {
      const encoder = new TextEncoder();
      return new ReadableStream({
        async start(controller) {
          for (const e of events) {
            controller.enqueue(encoder.encode(`event: ${e.type}\ndata: ${JSON.stringify(e)}\n\n`));
            await new Promise((r) => setTimeout(r, 5));
          }
          controller.close();
        },
      });
    };
    globalThis.__requests = [];
    const realFetch = globalThis.fetch;
    globalThis.fetch = async (url, init) => {
      const u = url instanceof Request ? url.url : String(url);
      if (u.endsWith("/v1/models")) {
        return new Response(
          JSON.stringify({
            models: [
              {
                slug: "gpt-6-luna",
                display_name: "GPT-6 Luna",
                visibility: "list",
                default_reasoning_level: "medium",
                supported_reasoning_levels: [
                  { effort: "low", description: "Fast responses" },
                  { effort: "medium", description: "Balanced" },
                  { effort: "future-level", description: "Unknown to the SDK" },
                ],
                service_tiers: [{ id: "priority", name: "Fast", description: "1.5x speed" }],
              },
              {
                slug: "gpt-6.1-sol",
                display_name: "GPT-6.1 Sol",
                visibility: "list",
                default_reasoning_level: "high",
                supported_reasoning_levels: [{ effort: "high", description: "Deep" }],
                service_tiers: [],
              },
              {
                slug: "hidden",
                display_name: "Hidden",
                visibility: "hide",
                default_reasoning_level: "low",
                supported_reasoning_levels: [],
                service_tiers: [],
              },
            ],
          }),
          { headers: { "content-type": "application/json" } },
        );
      }
      if (u.endsWith("/v1/responses")) {
        const body = JSON.parse(init.body);
        globalThis.__requests.push(body);
        const input = body.input[0].content;
        const output = input.includes("<seg ")
          ? input.replace(
              /<seg id="(\d+)">([\s\S]*?)<\/seg>/g,
              (_, id, m) => `<seg id="${id}">${fakeTranslate(m)}</seg>`,
            )
          : `訳: ${input}`;
        const chunks = output.match(/[\s\S]{1,7}/g) ?? [];
        return new Response(
          sse([
            ...chunks.map((delta) => ({ type: "response.output_text.delta", delta })),
            { type: "response.completed", response: {} },
          ]),
          { headers: { "content-type": "text/event-stream" } },
        );
      }
      return realFetch(url, init);
    };
  });

  const page = await context.newPage();
  await page.route("https://test.example/**", (route) =>
    route.fulfill({ contentType: "text/html", body: TEST_PAGE }),
  );
  await page.goto("https://test.example/page");
  await page.waitForTimeout(500);
  const originalP1 = await page.innerHTML("#p1");
  await page.evaluate(() => {
    window.__link = document.querySelector("#link");
  });

  const sendToTab = (message) =>
    sw.evaluate(async (message) => {
      const [tab] = await chrome.tabs.query({ active: true, lastFocusedWindow: true });
      return chrome.tabs.sendMessage(tab.id, message);
    }, message);

  await sendToTab({ type: "page:translate" });
  await page.waitForFunction(
    () => document.querySelector("#li2")?.textContent?.includes("JA:"),
    null,
    {
      timeout: 5000,
    },
  );
  await page.waitForTimeout(300);
  if (shotDir) await page.screenshot({ path: join(shotDir, "page-translated.png") });

  const text = (sel) => page.textContent(sel);
  check("見出しが翻訳される", (await text("#h1")).startsWith("JA:GETTING"), await text("#h1"));
  check(
    "リンクの href が保たれる",
    (await page.getAttribute("#p1 a", "href")) === "https://example.com/docs",
  );
  check(
    "リンク内テキストも翻訳される",
    (await text("#p1 a")) === "OFFICIAL DOCUMENTATION",
    await text("#p1 a"),
  );
  check(
    "インライン code は訳さない",
    (await text("#p1 code")) === "npm run build",
    await text("#p1 code"),
  );
  check("太字要素が保たれる", (await text("#p1 b")) === "WHOLE", await text("#p1 b"));
  check(
    "構造が同じ場合は元の要素をそのまま使う",
    await page.evaluate(() => document.querySelector("#p1 a") === window.__link),
  );
  check(
    "語順が変わってもリンクを保つ",
    (await page.innerHTML("#p2")).replace(/ id="link2"/, "") === '<a href="/x">HERE</a> CLICK NOW',
    await page.innerHTML("#p2"),
  );
  check("リスト項目が翻訳される", (await text("#li1")) === "JA:FIRST ITEM", await text("#li1"));
  check(
    "display: contents の中も翻訳する",
    (await text("#contents-p")).includes("JA:"),
    await text("#contents-p"),
  );
  check("pre は訳さない", (await text("#pre")) === 'const keepMe = "untranslated";');
  check("notranslate は訳さない", (await text("#nt .notranslate")) === "BrandName");
  check("ビューポート外は未翻訳", !(await text("#far")).includes("JA:"), await text("#far"));

  await page.evaluate(() => window.scrollTo(0, document.body.scrollHeight));
  await page
    .waitForFunction(() => document.querySelector("#far")?.textContent?.includes("JA:"), null, {
      timeout: 5000,
    })
    .catch(() => {});
  check("スクロールで追加翻訳される", (await text("#far")).includes("JA:"), await text("#far"));

  await page.evaluate(() => {
    const p = document.createElement("p");
    p.id = "dyn";
    p.textContent = "Dynamically inserted content";
    document.querySelector("#dynamic-root").append(p);
  });
  await page
    .waitForFunction(() => document.querySelector("#dyn")?.textContent?.includes("JA:"), null, {
      timeout: 5000,
    })
    .catch(() => {});
  check(
    "動的に追加された要素も翻訳される",
    (await text("#dyn")).includes("JA:"),
    await text("#dyn"),
  );

  await page.evaluate(() => {
    window.scrollTo(0, 0);
    document.querySelector("#li1").firstChild.data = "Rerendered by framework";
  });
  await page
    .waitForFunction(
      () => document.querySelector("#li1")?.textContent === "JA:RERENDERED BY FRAMEWORK",
      null,
      { timeout: 5000 },
    )
    .catch(() => {});
  check(
    "ページが書き換えたテキストを訳し直す",
    (await text("#li1")) === "JA:RERENDERED BY FRAMEWORK",
    await text("#li1"),
  );

  check("閉じた details の中身は未翻訳", (await text("#hidden-p")) === "Hidden until opened");
  await page.evaluate(() => {
    document.querySelector("#det").open = true;
  });
  await page
    .waitForFunction(
      () => document.querySelector("#hidden-p")?.textContent?.includes("JA:"),
      null,
      { timeout: 5000 },
    )
    .catch(() => {});
  check(
    "表示された要素を翻訳する",
    (await text("#hidden-p")).includes("JA:"),
    await text("#hidden-p"),
  );

  check(
    "翻訳完了後にハイライトが残らない",
    (await page.locator("[data-gt-pending]").count()) === 0,
  );
  const state = await sendToTab({ type: "page:getState" });
  check("状態が取得できる", state.active && state.done >= 6, JSON.stringify(state));

  await sendToTab({ type: "page:showOriginal" });
  check("原文に戻すと元の DOM に戻る", (await page.innerHTML("#p1")) === originalP1);
  check(
    "原文に戻すとテキストノードも戻る",
    (await text("#li1")) === "Rerendered by framework",
    await text("#li1"),
  );
  check(
    "語順が変わった段落も原文に戻る",
    (await text("#p2")) === "Click here now",
    await text("#p2"),
  );
  await sendToTab({ type: "page:showTranslation" });
  check(
    "訳文表示に戻せる",
    (await text("#li1")) === "JA:RERENDERED BY FRAMEWORK",
    await text("#li1"),
  );

  const requests = await sw.evaluate(() => globalThis.__requests);
  check(
    "store:false / stream:true で送る",
    requests.every((r) => r.store === false && r.stream === true),
  );
  check(
    "reasoning effort を送る",
    requests.every((r) => r.reasoning?.effort === "low"),
  );
  check(
    "高速モードが OFF なら service_tier を送らない",
    requests.every((r) => !("service_tier" in r)),
  );
  check(
    "system ロールを使わない",
    requests.every((r) => r.input.every((m) => m.role !== "system")),
  );

  await page.evaluate(() => window.scrollTo(0, 0));
  await page.hover("#li1");
  await page.waitForTimeout(500);
  if (shotDir) await page.screenshot({ path: join(shotDir, "hover-original.png") });

  // 選択テキスト翻訳（UI は closed shadow DOM なのでスクリーンショットで確認する）
  await sendToTab({ type: "page:showOriginal" });
  const box = await page.locator("#li2").boundingBox();
  await page.mouse.move(box.x + 2, box.y + box.height / 2);
  await page.mouse.down();
  await page.mouse.move(box.x + 120, box.y + box.height / 2);
  await page.mouse.up();
  await page.waitForTimeout(300);
  if (shotDir) await page.screenshot({ path: join(shotDir, "selection-button.png") });
  const selRect = await page.evaluate(() => {
    const r = getSelection().getRangeAt(0).getClientRects();
    const last = r[r.length - 1];
    return { right: last.right, bottom: last.bottom };
  });
  await sw.evaluate(() =>
    chrome.storage.sync.set({
      settings: { model: "gpt-6-luna", targetLang: "ja", fastMode: true },
    }),
  );
  await page.mouse.click(selRect.right, selRect.bottom + 8 + 15);
  await page.waitForTimeout(800);
  if (shotDir) await page.screenshot({ path: join(shotDir, "selection-panel.png") });
  const selectionRequest = (await sw.evaluate(() => globalThis.__requests)).at(-1);
  check(
    "選択テキストを翻訳リクエストする",
    !selectionRequest.input[0].content.includes("<seg"),
    selectionRequest.input[0].content,
  );
  check(
    "高速モードが ON なら priority で送る",
    selectionRequest.service_tier === "priority",
    String(selectionRequest.service_tier),
  );

  for (const name of ["popup", "options"]) {
    const p = await context.newPage();
    await p.setViewportSize(
      name === "popup" ? { width: 340, height: 520 } : { width: 900, height: 1100 },
    );
    await p.goto(`chrome-extension://${extensionId}/${name}.html`);
    await p.waitForTimeout(600);
    if (shotDir) await p.screenshot({ path: join(shotDir, `${name}.png`), fullPage: true });
    if (name === "options") {
      const options = await p.locator("select").first().locator("option").allTextContents();
      check(
        "設定ページに表示対象のモデルだけが並ぶ",
        JSON.stringify(options) ===
          JSON.stringify(["選択してください", "GPT-6 Luna", "GPT-6.1 Sol"]),
        JSON.stringify(options),
      );
      const efforts = await p.locator("select").nth(1).locator("option").allTextContents();
      check(
        "推論の強さはモデルが対応するものだけ並ぶ",
        JSON.stringify(efforts) === JSON.stringify(["low", "medium"]),
        JSON.stringify(efforts),
      );
      check("高速モードのスイッチを表示する", (await p.getByText("高速モード").count()) === 1);
    }
    await p.close();
  }
} finally {
  await context.close();
}

console.log(failures ? `\n${failures} 件失敗` : "\nすべて成功");
process.exit(failures ? 1 : 0);
