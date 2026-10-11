import { Show } from "solid-js";

import "@/ui/base.css";
import { TranslationSettingsFields } from "@/ui/components/TranslationSettingsFields";
import { createAuth } from "@/ui/hooks/auth";
import { createSettings } from "@/ui/hooks/settings";

import { AccountSection } from "./AccountSection";
import { CacheSection } from "./CacheSection";
import { ModelSection } from "./ModelSection";

import "./style.css";
import { UsageSection } from "./UsageSection";

export function App() {
	const auth = createAuth();
	const [settings, update] = createSettings();

	return (
		<Show when={auth() && settings()}>
			<main class="page">
				<h1>Yomi</h1>

				<AccountSection auth={auth()!} />

				<section class="section">
					<h2>モデル</h2>
					<Show
						when={auth()!.signedIn}
						fallback={
							<p class="muted small">
								サインインすると、アカウントで利用できるモデルが表示されます。
							</p>
						}
					>
						<ModelSection settings={settings()!} update={update} />
					</Show>
				</section>

				<section class="section">
					<h2>翻訳</h2>
					<div class="stack">
						<TranslationSettingsFields
							settings={settings()!}
							update={update}
							switches={["showSelectionButton", "hoverOriginal", "highlightPending"]}
						/>
					</div>
				</section>

				<CacheSection />

				<UsageSection />
			</main>
		</Show>
	);
}
