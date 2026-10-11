import { Show } from "solid-js";

import { withAlwaysTranslate } from "@/domain/site-rules";
import { callBackground } from "@/infra/messaging/background-client";

import "@/ui/base.css";
import { AccountStatus } from "@/ui/components/AccountStatus";
import { SignInCard } from "@/ui/components/SignInCard";
import { TranslationSettingsFields } from "@/ui/components/TranslationSettingsFields";
import { createActivePage } from "@/ui/hooks/active-page";
import { createAuth } from "@/ui/hooks/auth";
import { createSettings } from "@/ui/hooks/settings";
import { createSiteRules } from "@/ui/hooks/site-rules";

import { PageControls } from "./PageControls";
import { ShortcutHints } from "./ShortcutHints";

import "./style.css";

export function App() {
	const auth = createAuth();
	const [settings, update] = createSettings();
	const [page, sendToPage] = createActivePage();
	const [siteRules, updateSiteRules] = createSiteRules();

	return (
		<Show when={auth() && settings() && siteRules()} fallback={<div class="popup" />}>
			<div class="popup">
				<header class="top">
					<span class="brand">Yomi</span>
					<button class="btn link small" onClick={() => void callBackground("open:options")}>
						設定
					</button>
				</header>

				<Show when={auth()!.signedIn} fallback={<SignInCard />}>
					<section class="account">
						<AccountStatus email={auth()!.email} />
					</section>
				</Show>

				<PageControls
					page={page()}
					send={sendToPage}
					disabled={!auth()!.signedIn}
					alwaysTranslate={(host) => siteRules()!.alwaysTranslate.includes(host)}
					setAlwaysTranslate={(host, enabled) =>
						updateSiteRules((rules) => withAlwaysTranslate(rules, host, enabled))
					}
				/>

				<section class="settings">
					<TranslationSettingsFields
						settings={settings()!}
						update={update}
						switches={["showSelectionButton", "hoverOriginal"]}
					/>
				</section>

				<ShortcutHints />
			</div>
		</Show>
	);
}
