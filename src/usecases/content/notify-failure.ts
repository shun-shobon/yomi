import { FAILURE_POLICY } from "@/domain/failure";
import type { FailureRemedy, TranslateFailure } from "@/domain/failure";
import { callBackground } from "@/infra/messaging/background-client";
import type { ParamlessMethod } from "@/infra/messaging/protocol";

import type { Overlay } from "./overlay";

const REMEDY_ACTIONS: Record<FailureRemedy, { label: string; request: ParamlessMethod }> = {
	sign_in: { label: "ChatGPT でサインイン", request: "auth:signIn" },
	open_usage: { label: "使用状況を管理", request: "open:usage" },
};

export function notifyFailure(overlay: Overlay, failure: TranslateFailure) {
	const { remedy } = FAILURE_POLICY[failure.kind];
	const action = remedy && REMEDY_ACTIONS[remedy];
	overlay.toast(action ? failure.message : `翻訳に失敗しました: ${failure.message}`, {
		error: true,
		...(action && {
			action: { label: action.label, onClick: () => void callBackground(action.request) },
		}),
	});
}
