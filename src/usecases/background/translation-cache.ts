import { TranslateFailure } from "@/domain/failure";
import { cacheKey } from "@/domain/translation-cache";
import type { BackgroundSender } from "@/infra/messaging/background-server";
import type { ParamsOf } from "@/infra/messaging/protocol";
import { lookupTranslations, storeTranslations } from "@/infra/storage/translation-cache";

/** キーのサイト部分を content script の申告どおりに使うと、別サイトの訳文を読み書きできてしまう */
function assertSentFrom(pageUrl: string, sender: BackgroundSender) {
	const { origin } = new URL(pageUrl);
	if (sender.tabId == null || origin === "null" || sender.origin !== origin) {
		throw new TranslateFailure("other", "このページの訳文キャッシュは使えません。");
	}
}

export async function lookupPageTranslations(
	{ pageUrl, lang, markups }: ParamsOf<"cache:lookup">,
	sender: BackgroundSender,
): Promise<(string | null)[]> {
	assertSentFrom(pageUrl, sender);
	return await lookupTranslations(markups.map((markup) => cacheKey(lang, pageUrl, markup)));
}

export async function storePageTranslations(
	{ pageUrl, lang, entries }: ParamsOf<"cache:store">,
	sender: BackgroundSender,
): Promise<void> {
	assertSentFrom(pageUrl, sender);
	await storeTranslations(
		entries.map(({ markup, translation }) => ({
			key: cacheKey(lang, pageUrl, markup),
			translation,
		})),
	);
}
