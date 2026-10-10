import { callBackground } from "@/infra/messaging/background-client";

export function PlanStatus() {
  return (
    <span class="plan-status-row">
      <span class="plan-status">ChatGPT サブスクリプションを利用中</span>
      <span class="muted">·</span>
      <button class="btn link" onClick={() => void callBackground("open:usage")}>
        使用状況を管理
      </button>
    </span>
  );
}
