import type { BackgroundApi, TranslateErrorKind, TranslateFailure } from "@/utils/messages";
import { callBackground } from "@/utils/runtime";

import type { Overlay } from "./overlay";

interface FailurePolicy {
  /** ページ翻訳を続けても同じ失敗を繰り返すだけなので、セッションを止める */
  fatal: boolean;
  /** ユーザーが解消できる失敗に添える操作 */
  action: { label: string; request: keyof BackgroundApi } | null;
}

export const FAILURE_POLICY: Record<TranslateErrorKind, FailurePolicy> = {
  signed_out: {
    fatal: true,
    action: { label: "ChatGPT でサインイン", request: "auth:signIn" },
  },
  no_model: { fatal: true, action: { label: "設定を開く", request: "open:options" } },
  usage_limit: { fatal: true, action: { label: "使用状況を管理", request: "open:usage" } },
  not_eligible: { fatal: true, action: null },
  extension_reloaded: { fatal: true, action: null },
  unavailable: { fatal: false, action: null },
  other: { fatal: false, action: null },
};

export function notifyFailure(overlay: Overlay, failure: TranslateFailure) {
  const { action } = FAILURE_POLICY[failure.kind];
  overlay.toast(action ? failure.message : `翻訳に失敗しました: ${failure.message}`, {
    error: true,
    ...(action && {
      action: { label: action.label, onClick: () => void callBackground(action.request) },
    }),
  });
}
