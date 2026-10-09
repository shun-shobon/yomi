import { callBackground } from "@/infra/messaging/background-client";

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
