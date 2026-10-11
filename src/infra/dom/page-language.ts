import { browser } from "#imports";

const SAMPLE_LENGTH = 4000;

export async function detectPageLanguage(): Promise<string | null> {
	const declared = document.documentElement.lang;
	if (declared !== "") return declared;
	const sample = document.body.innerText.slice(0, SAMPLE_LENGTH);
	if (sample.trim() === "") return null;
	const { isReliable, languages } = await browser.i18n.detectLanguage(sample);
	const [top] = languages;
	return isReliable && top != null ? top.language : null;
}
