// @vitest-environment happy-dom
import { afterEach, describe, expect, it } from "vitest";

import { collectRuns } from "./segmenter";

afterEach(() => {
	document.body.replaceChildren();
});

function runsIn(root: Element) {
	return collectRuns(
		root,
		() => false,
		() => {},
	);
}

describe("collectRuns", () => {
	it.each([
		['<div class="notranslate"><p id="root">Hello</p></div>'],
		['<div translate="no"><section><p id="root">Hello</p></section></div>'],
		['<pre><p id="root">Hello</p></pre>'],
	])("翻訳しない祖先の中から走査を始めても訳さない: %s", (html) => {
		document.body.innerHTML = html;

		expect(runsIn(document.querySelector("#root")!)).toEqual([]);
	});

	it("翻訳しない祖先がなければ訳す", () => {
		document.body.innerHTML = '<div><p id="root">Hello</p></div>';

		expect(runsIn(document.querySelector("#root")!)).toHaveLength(1);
	});
});
