import { mkdtempSync } from "node:fs";
import { tmpdir } from "node:os";
import { join, resolve } from "node:path";

import { chromium } from "playwright-core";
import type { Page } from "playwright-core";
import type { Browser } from "wxt/browser";

// sw.evaluate に渡す関数は service worker 内で実行されるので、そこにある chrome を参照する
declare const chrome: typeof Browser;

export type ResponsesRequest = {
	store: boolean;
	stream: boolean;
	reasoning?: { effort: string };
	service_tier?: string;
	input: { role: string; content: string }[];
};

type MockedGlobal = typeof globalThis & { __requests: ResponsesRequest[] };

export const TEST_PAGE = `<!doctype html><html lang="en"><head><title>Test page</title></head><body style="font:16px/1.5 sans-serif;max-width:720px;margin:24px auto">
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

const screenshotDir = process.env["E2E_SCREENSHOT_DIR"];

export const takesScreenshots = screenshotDir != null;

export async function screenshot(page: Page, name: string, options?: { fullPage?: boolean }) {
	if (screenshotDir != null)
		await page.screenshot({ path: join(screenshotDir, `${name}.png`), ...options });
}

export type Extension = Awaited<ReturnType<typeof launchExtension>>;

export async function launchExtension() {
	const executablePath = process.env["CHROMIUM_PATH"];
	if (executablePath == null || executablePath === "")
		throw new Error("CHROMIUM_PATH を指定してください");
	const extensionPath = resolve(".output/chrome-mv3");

	const context = await chromium.launchPersistentContext(mkdtempSync(join(tmpdir(), "yomi-e2e-")), {
		executablePath,
		headless: true,
		args: [`--disable-extensions-except=${extensionPath}`, `--load-extension=${extensionPath}`],
		viewport: { width: 1000, height: 800 },
	});
	const sw = context.serviceWorkers()[0] ?? (await context.waitForEvent("serviceworker"));
	await sw.evaluate(installMocks);

	return {
		context,
		extensionId: new URL(sw.url()).host,
		sendToTab: <T = unknown>(message: unknown) =>
			sw.evaluate(async (msg): Promise<T> => {
				const [tab] = await chrome.tabs.query({ active: true, lastFocusedWindow: true });
				return await chrome.tabs.sendMessage(tab!.id!, msg);
			}, message),
		requests: () => sw.evaluate(() => (globalThis as MockedGlobal).__requests),
		setSettings: (settings: Record<string, unknown>) =>
			sw.evaluate((s) => chrome.storage.sync.set({ settings: s }), settings),
		openTestPage: async (url = "https://test.example/page") => {
			const page = await context.newPage();
			await page.route("https://test.example/**", (route) =>
				route.fulfill({ contentType: "text/html", body: TEST_PAGE }),
			);
			await page.goto(url);
			await page.waitForTimeout(500);
			return page;
		},
	};
}

async function installMocks() {
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

	const fakeTranslate = (markup: string) =>
		markup.startsWith("Click ")
			? // 語順が変わりタグ構造が原文と一致しないケース
				markup.replace(/^Click (<g(\d+)>)here(<\/g\2>) now$/u, "$1HERE$3 CLICK NOW")
			: "JA:" +
				markup.replaceAll(
					/(^|>)([^<]*)/gu,
					(_, gt: string, text: string) => gt + text.toUpperCase(),
				);
	const sse = (events: ({ type: string } & Record<string, unknown>)[]) => {
		const encoder = new TextEncoder();
		return new ReadableStream({
			async start(controller) {
				for (const e of events) {
					controller.enqueue(encoder.encode(`event: ${e.type}\ndata: ${JSON.stringify(e)}\n\n`));
					await new Promise((r) => {
						setTimeout(r, 5);
					});
				}
				controller.close();
			},
		});
	};
	const mocked = globalThis as MockedGlobal;
	mocked.__requests = [];
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
			const body = JSON.parse(init?.body as string) as ResponsesRequest;
			mocked.__requests.push(body);
			const input = body.input[0]!.content;
			const output = input.includes("<seg ")
				? input.replaceAll(
						/<seg id="(\d+)">([\s\S]*?)<\/seg>/gu,
						(_, id: string, m: string) => `<seg id="${id}">${fakeTranslate(m)}</seg>`,
					)
				: `訳: ${input}`;
			const chunks = output.match(/[\s\S]{1,7}/gu) ?? [];
			return new Response(
				sse([
					...chunks.map((delta) => ({ type: "response.output_text.delta", delta })),
					{ type: "response.completed", response: {} },
				]),
				{ headers: { "content-type": "text/event-stream" } },
			);
		}
		return await realFetch(url, init);
	};
}
