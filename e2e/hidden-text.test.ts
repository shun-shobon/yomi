import type { Page } from "playwright-core";
import { beforeAll, describe, expect, test } from "vitest";

import { launchExtension } from "./fixtures";
import type { Extension } from "./fixtures";

type Held = Window & { __held?: Element[] };

let ext: Extension;
let page: Page;
let originalInline: string;

const BODY = `<style id="fx">
@keyframes show { to { opacity: 1 } }
#fade-anim, #fade-trans { opacity: 0 }
#fade-trans { transition: opacity 150ms }
</style>
<h1 id="control">Visible heading text</h1>
<p style="visibility:hidden">SECRET_VISIBILITY_BLOCK</p>
<p style="opacity:0">SECRET_OPACITY_BLOCK</p>
<div style="opacity:0"><p>SECRET_OPACITY_PARENT</p></div>
<div style="visibility:hidden">SECRET_VISIBILITY_PARENT <b>SECRET_VISIBILITY_INLINE</b><p id="override" style="visibility:visible">Visible child paragraph</p></div>
<div style="display:contents"><p id="contents">Inside a display contents wrapper</p></div>
<details><summary id="summary">Summary label</summary>SECRET_DETAILS_TEXT</details>
<p id="inline">Visible words <span id="inline-secret" style="visibility:hidden">SECRET_INLINE_VISIBILITY</span> and <a id="inline-link" href="/x">a link</a> with <b id="inline-opacity" style="opacity:0">SECRET_INLINE_OPACITY</b> here</p>
<p id="reveal">Before <span id="reveal-span" style="visibility:hidden">revealed later</span> after</p>
<p id="fade-anim">Animated fade in</p>
<p id="fade-trans">Transitioned fade in</p>
<div id="dynamic-root"></div>`;

const text = (sel: string) => page.textContent(sel);

async function sentText() {
	return (await ext.requests()).flatMap((req) => req.input.map((m) => m.content)).join("\n");
}

async function waitUntilIdle() {
	await expect
		.poll(async () => (await ext.sendToTab<{ busy: number }>({ type: "page:getState" })).busy)
		.toBe(0);
}

beforeAll(async () => {
	ext = await launchExtension();
	return () => ext.context.close();
});

beforeAll(async () => {
	page = await ext.openTestPage();
	await page.bringToFront();
	await page.evaluate((body) => {
		document.body.innerHTML = body;
		(window as Held).__held = ["#inline-secret", "#inline-link", "#inline-opacity"].map((sel) =>
			document.querySelector(sel)!,
		);
	}, BODY);
	originalInline = await page.innerHTML("#inline");

	await ext.sendToTab({ type: "page:translate" });
	await page.waitForFunction(() => document.querySelector("#control")?.textContent.includes("JA:"));
});

describe("見えない文章を送らない", () => {
	test("visibility:hidden・opacity:0 のブロック、非表示のインライン、閉じた details の本文を送らない", async () => {
		await waitUntilIdle();
		expect((await sentText()).match(/SECRET_\w+/gu) ?? []).toEqual([]);
	});

	test("翻訳開始後に追加された非表示の要素を送らない", async () => {
		await page.evaluate(() => {
			const root = document.querySelector("#dynamic-root")!;
			root.insertAdjacentHTML(
				"beforeend",
				`<p style="visibility:hidden">SECRET_DYNAMIC_VISIBILITY</p>
				<div style="opacity:0"><p>SECRET_DYNAMIC_OPACITY</p></div>
				<p id="dyn-mixed">Dynamic visible words <span style="visibility:hidden">SECRET_DYNAMIC_INLINE</span> end</p>
				<p id="dyn-sentinel">Dynamic sentinel paragraph</p>`,
			);
			document
				.querySelector("#control")!
				.insertAdjacentHTML(
					"beforeend",
					'<span style="opacity:0">SECRET_DYNAMIC_INLINE_IN_TRANSLATED</span>',
				);
		});
		await expect.poll(() => text("#dyn-sentinel")).toContain("JA:");
		await expect.poll(() => text("#dyn-mixed")).toContain("JA:DYNAMIC VISIBLE WORDS");
		await waitUntilIdle();

		expect((await sentText()).match(/SECRET_\w+/gu) ?? []).toEqual([]);
	});

	test("表示されるまでフェードインする要素を送らない", async () => {
		const sent = await sentText();
		expect(sent).not.toContain("Animated fade in");
		expect(sent).not.toContain("Transitioned fade in");
	});
});

describe("見えている文章は訳す", () => {
	test("visibility:hidden の親の中で visible に戻した子は訳す", async () => {
		expect(await text("#override")).toBe("JA:VISIBLE CHILD PARAGRAPH");
	});

	test("display: contents の中は訳す", async () => {
		expect(await text("#contents")).toBe("JA:INSIDE A DISPLAY CONTENTS WRAPPER");
	});

	test("閉じた details の summary は訳す", async () => {
		expect(await text("#summary")).toBe("JA:SUMMARY LABEL");
	});

	test("非表示のインラインを含む段落も、見えている部分は訳して非表示の要素はそのまま残す", async () => {
		expect(await text("#inline")).toMatch(/^JA:VISIBLE WORDS /u);
		expect(await text("#inline-link")).toBe("A LINK");
		expect(await text("#inline-secret")).toBe("SECRET_INLINE_VISIBILITY");
		expect(await text("#inline-opacity")).toBe("SECRET_INLINE_OPACITY");
		expect(
			await page.evaluate(() =>
				["#inline-secret", "#inline-link", "#inline-opacity"].every(
					(sel, i) => document.querySelector(sel) === (window as Held).__held![i],
				),
			),
		).toBe(true);
	});

	test("表示されたインラインは段落ごと訳し直す", async () => {
		expect(await sentText()).not.toContain("revealed later");
		await page.evaluate(() => {
			document.querySelector<HTMLElement>("#reveal-span")!.style.visibility = "visible";
		});
		await expect.poll(() => text("#reveal")).toBe("JA:BEFORE REVEALED LATER AFTER");
	});

	test("CSS アニメーションで表示された要素を訳す", async () => {
		await page.evaluate(() => {
			const sheet = document.querySelector<HTMLStyleElement>("#fx")!.sheet!;
			sheet.insertRule("#fade-anim { animation: show 150ms forwards }", sheet.cssRules.length);
		});
		await expect.poll(() => text("#fade-anim")).toBe("JA:ANIMATED FADE IN");
	});

	test("CSS トランジションで表示された要素を訳す", async () => {
		await page.evaluate(() => {
			const sheet = document.querySelector<HTMLStyleElement>("#fx")!.sheet!;
			sheet.insertRule("#fade-trans { opacity: 1 }", sheet.cssRules.length);
		});
		await expect.poll(() => text("#fade-trans")).toBe("JA:TRANSITIONED FADE IN");
	});
});

describe("原文への復元", () => {
	test("非表示のインラインを含む段落が元の DOM に戻る", async () => {
		await ext.sendToTab({ type: "page:showOriginal" });
		expect(await page.innerHTML("#inline")).toBe(originalInline);
		expect(
			await page.evaluate(() =>
				["#inline-secret", "#inline-link", "#inline-opacity"].every(
					(sel, i) => document.querySelector(sel) === (window as Held).__held![i],
				),
			),
		).toBe(true);
	});
});
