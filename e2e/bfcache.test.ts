import { createServer } from "node:http";

import type { Page } from "playwright-core";
import { afterEach, beforeAll, expect, test } from "vitest";
import type { Browser } from "wxt/browser";

import { launchExtension } from "./fixtures";
import type { Extension } from "./fixtures";

declare const chrome: typeof Browser;

const ORIGINAL =
	"This page explains how the extension translates every paragraph while keeping the original layout of the page intact.";
const JAPANESE =
	"このページでは、ページの元のレイアウトを保ったまま、拡張機能がすべての段落を翻訳する仕組みを説明します。";
const translated = (text: string) => `JA:${text.toUpperCase()}`;

let ext: Extension;
let origin: string;

// page.route で返したページは BFCache に載らないことがあるので、実際の HTTP サーバーから配信する
beforeAll(async () => {
	const server = createServer((req, res) => {
		const declaresLang = !(req.url?.startsWith("/nolang/") ?? false);
		res.setHeader("Content-Type", "text/html; charset=utf-8");
		res.end(`<!doctype html><html${declaresLang ? ' lang="en"' : ""}><head><title>BFCache</title></head><body>
<p id="text">${ORIGINAL}</p>
<script>addEventListener("pageshow", (e) => { document.documentElement.dataset.persisted = String(e.persisted); });</script>
</body></html>`);
	});
	await new Promise<void>((resolve) => {
		server.listen(0, "127.0.0.1", resolve);
	});
	const address = server.address();
	if (address == null || typeof address === "string") throw new Error("サーバーを起動できない");
	origin = `http://127.0.0.1:${address.port}`;
	ext = await launchExtension({ bfcache: true });
	return async () => {
		await ext.context.close();
		await new Promise((resolve) => {
			server.close(resolve);
		});
	};
});

afterEach(() => ext.fixTranslation(null));

const pageState = () => ext.sendToTab<{ active: boolean }>({ type: "page:getState" });

async function open(path: string): Promise<Page> {
	const page = await ext.context.newPage();
	await page.goto(origin + path);
	await expect.poll(pageState).toMatchObject({ active: false });
	return page;
}

async function translate(page: Page) {
	await ext.sendToTab({ type: "page:translate" });
	await expect.poll(() => page.textContent("#text")).not.toBe(ORIGINAL);
}

// page.goto はアドレスバーからの遷移になり翻訳を続けないので、ページ内からリンクを押して移る
async function followLink(page: Page) {
	const url = new URL("next", page.url()).href;
	await page.evaluate((href) => {
		const a = document.createElement("a");
		a.href = href;
		document.body.append(a);
		a.click();
	}, url);
	await page.waitForURL(url);
}

async function goBackFromCache(page: Page) {
	// BFCache から戻ると load は発火しないので、既定の waitUntil では待ち終わらない
	await page.goBack({ waitUntil: "commit" });
	await expect
		.poll(() => page.evaluate(() => document.documentElement.dataset["persisted"]))
		.toBe("true");
}

async function appendParagraph(page: Page, text: string) {
	await page.evaluate((t) => {
		const p = document.createElement("p");
		p.id = "added";
		p.textContent = t;
		document.body.append(p);
	}, text);
}

test("未翻訳のページへ戻ったとき、移った先で翻訳していれば翻訳を始める", async () => {
	const page = await open("/a");
	await followLink(page);
	await expect.poll(pageState).toMatchObject({ active: false });
	await translate(page);

	await goBackFromCache(page);

	await expect.poll(() => page.textContent("#text")).toBe(translated(ORIGINAL));
	await expect.poll(pageState).toMatchObject({ active: true });
	await page.close();
});

test("翻訳したページへ戻ったとき、翻訳を続けていれば後から増えた本文も翻訳する", async () => {
	const page = await open("/a");
	await translate(page);
	await followLink(page);
	await expect.poll(pageState).toMatchObject({ active: true });

	await goBackFromCache(page);

	await expect.poll(pageState).toMatchObject({ active: true });
	await appendParagraph(page, "Added after coming back.");
	await expect.poll(() => page.textContent("#added")).toBe(translated("Added after coming back."));
	await page.close();
});

test("翻訳したページへ戻ったとき、移った先で翻訳を止めていれば原文に戻す", async () => {
	const page = await open("/a");
	await translate(page);
	await followLink(page);
	await expect.poll(pageState).toMatchObject({ active: true });
	await ext.sendToTab({ type: "page:stop" });

	await goBackFromCache(page);

	await expect.poll(() => page.textContent("#text")).toBe(ORIGINAL);
	expect(await pageState()).toMatchObject({ active: false });
	await page.close();
});

test("言語の宣言がないページへ戻ったとき、訳文ではなく原文の言語で判断する", async () => {
	await ext.fixTranslation(JAPANESE);
	const page = await open("/nolang/a");
	const detect = (text: string) =>
		ext.context
			.serviceWorkers()[0]!
			.evaluate(async (t) => (await chrome.i18n.detectLanguage(t)).languages[0]?.language, text);
	// 訳文が日本語と判定されないと、戻ったときに検出し直す誤りを捕まえられない
	expect(await detect(ORIGINAL)).toBe("en");
	expect(await detect(JAPANESE)).toBe("ja");
	await translate(page);
	await followLink(page);
	await expect.poll(pageState).toMatchObject({ active: true });

	await goBackFromCache(page);

	await expect.poll(pageState).toMatchObject({ active: true });
	await expect.poll(() => page.textContent("#text")).toBe(JAPANESE);
	await page.close();
});
