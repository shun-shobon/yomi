import { Show } from "solid-js";

import { callBackground } from "@/infra/messaging/background-client";
import type { AuthState } from "@/infra/messaging/protocol";
import { signInItem } from "@/infra/storage/auth";
import { PlanStatus } from "@/ui/components/PlanStatus";
import { SignInCard } from "@/ui/components/SignInCard";
import { createStorageItem } from "@/ui/hooks/storage-item";

export function AccountSection(props: { auth: AuthState }) {
	return (
		<section class="section">
			<h2>アカウント</h2>
			<Show when={props.auth.signedIn} fallback={<SignInPanel />}>
				<div class="row">
					<div class="grow">
						<PlanStatus />
						<div class="muted small">{props.auth.email ?? "ChatGPT アカウント"}</div>
					</div>
					<button class="btn" onClick={() => void callBackground("auth:signOut")}>
						サインアウト
					</button>
				</div>
			</Show>
		</section>
	);
}

function SignInPanel() {
	const signIn = createStorageItem(signInItem);
	const failure = () => {
		const s = signIn();
		return s?.status === "failed" ? s.message : undefined;
	};
	return (
		<div class="stack">
			<SignInCard />
			<Show when={signIn()?.status === "pending"}>
				<p class="muted small">開いたタブで ChatGPT にサインインし、アクセスを許可してください。</p>
			</Show>
			<Show when={failure()}>{(message) => <p class="error-text">{message()}</p>}</Show>
			<p class="muted small">ChatGPT Plus / Pro プランが必要です。</p>
		</div>
	);
}
