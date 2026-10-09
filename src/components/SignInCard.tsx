import { callBackground } from "@/utils/runtime";

export function SignInCard() {
  return (
    <div class="sign-in-card">
      <strong>ChatGPT プランで翻訳</strong>
      <p class="muted small">翻訳には ChatGPT プランの使用量またはクレジットが使われます。</p>
      <button class="btn chatgpt-btn" onClick={() => void callBackground("auth:signIn")}>
        ChatGPT でサインイン
      </button>
    </div>
  );
}

export function PlanStatus() {
  return (
    <span class="plan-status-row">
      <span class="plan-status">ChatGPT プランを利用中</span>
      <span class="muted">·</span>
      <button class="btn link" onClick={() => void callBackground("open:usage")}>
        使用状況を管理
      </button>
    </span>
  );
}
