import { callBackground } from "@/utils/runtime";

/** SIWC ガイドラインの文言をそのまま使うサインイン導線 */
export function SignInCard() {
  return (
    <div class="sign-in-card">
      <strong>Use your ChatGPT plan</strong>
      <p class="muted small">
        Complete eligible AI requests in this app with usage included in your ChatGPT plan or
        credits balance.
      </p>
      <button class="btn chatgpt-btn" onClick={() => void callBackground("auth:signIn")}>
        Continue with ChatGPT
      </button>
    </div>
  );
}

export function PlanStatus() {
  return (
    <span class="plan-status-row">
      <span class="plan-status">Using ChatGPT plan</span>
      <span class="muted">·</span>
      <button class="btn link" onClick={() => void callBackground("open:usage")}>
        Manage usage
      </button>
    </span>
  );
}
