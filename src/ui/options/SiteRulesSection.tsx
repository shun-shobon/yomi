import { For, Show } from "solid-js";

import { languageLabel, withoutRule } from "@/domain/site-rules";
import type { SiteRuleList } from "@/domain/site-rules";
import { createSiteRules } from "@/ui/hooks/site-rules";

const GROUPS: { list: SiteRuleList; title: string; label: (value: string) => string }[] = [
	{ list: "alwaysTranslate", title: "常に翻訳するサイト", label: (host) => host },
	{ list: "neverOffer", title: "翻訳を提案しないサイト", label: (host) => host },
	{ list: "neverOfferLangs", title: "翻訳を提案しない言語", label: languageLabel },
];

export function SiteRulesSection() {
	const [rules, update] = createSiteRules();
	return (
		<section class="section">
			<h2>サイト</h2>
			<Show when={rules()}>
				{(current) => (
					<div class="stack">
						<For each={GROUPS}>
							{(group) => (
								<div class="rule-group">
									<h3>{group.title}</h3>
									<Show
										when={current()[group.list].length > 0}
										fallback={<p class="muted small">なし</p>}
									>
										<ul class="rule-list">
											<For each={current()[group.list]}>
												{(value) => (
													<li class="row">
														<span class="grow">{group.label(value)}</span>
														<button
															class="btn link small"
															onClick={() => update((r) => withoutRule(r, group.list, value))}
														>
															削除
														</button>
													</li>
												)}
											</For>
										</ul>
									</Show>
								</div>
							)}
						</For>
					</div>
				)}
			</Show>
		</section>
	);
}
