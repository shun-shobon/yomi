import { callBackground } from "@/infra/messaging/background-client";

export function AccountStatus(props: { email: string | null }) {
	return (
		<span class="account-status">
			<span class="account-name" title={props.email ?? undefined}>
				{props.email ?? "ChatGPT アカウント"}
			</span>
			<button class="btn link" onClick={() => void callBackground("open:usage")}>
				使用状況を管理
			</button>
		</span>
	);
}
