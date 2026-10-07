import { render } from "preact";
import { useEffect, useState } from "preact/hooks";

import "@/components/base.css";
import { useAuth, useSettings, useShortcuts, useStorageItem } from "@/components/hooks";
import { PlanStatus, SignInCard } from "@/components/SignInCard";
import { TranslationSettingsFields } from "@/components/TranslationSettingsFields";
import { signInItem } from "@/utils/auth-storage";
import type { ModelInfo } from "@/utils/messages";
import { callBackground } from "@/utils/runtime";
import { isReasoningEffort, type Settings } from "@/utils/settings";

import "./style.css";

function App() {
  const auth = useAuth();
  const [settings, update] = useSettings();

  if (!auth || !settings) return null;

  return (
    <main class="page">
      <h1>Yomi</h1>
      <p class="muted lead">
        ChatGPT プランを使って、Web ページ全体や選択したテキストを翻訳します。
      </p>

      <section class="section">
        <h2>アカウント</h2>
        {auth.signedIn ? (
          <div class="row">
            <div class="grow">
              <PlanStatus />
              <div class="muted small">{auth.email ?? "ChatGPT アカウント"}</div>
            </div>
            <button class="btn" onClick={() => void callBackground("auth:signOut")}>
              サインアウト
            </button>
          </div>
        ) : (
          <SignInSection />
        )}
      </section>

      <section class="section">
        <h2>モデル</h2>
        {auth.signedIn ? (
          <ModelSection settings={settings} update={update} />
        ) : (
          <p class="muted small">サインインすると、アカウントで利用できるモデルが表示されます。</p>
        )}
      </section>

      <section class="section">
        <h2>翻訳</h2>
        <div class="stack">
          <TranslationSettingsFields
            settings={settings}
            update={update}
            switches={["showSelectionButton", "hoverOriginal", "highlightPending"]}
          />
        </div>
      </section>

      <UsageSection />
    </main>
  );
}

function SignInSection() {
  const signIn = useStorageItem(signInItem);
  return (
    <div class="stack">
      <SignInCard />
      {signIn?.status === "pending" && (
        <p class="muted small">開いたタブで ChatGPT にサインインし、アクセスを許可してください。</p>
      )}
      {signIn?.status === "failed" && <p class="error-text">{signIn.message}</p>}
      <p class="muted small">ChatGPT Plus / Pro プランが必要です。</p>
    </div>
  );
}

type ModelsView =
  | { status: "loading" }
  | { status: "failed"; message: string }
  | { status: "ready"; models: ModelInfo[] };

function ModelSection({
  settings,
  update,
}: {
  settings: Settings;
  update: (patch: Partial<Settings>) => void;
}) {
  const [view, setView] = useState<ModelsView>({ status: "loading" });
  const load = () => {
    setView({ status: "loading" });
    callBackground("models:list").then(
      (models) => setView({ status: "ready", models }),
      (e: unknown) =>
        setView({ status: "failed", message: e instanceof Error ? e.message : String(e) }),
    );
  };
  useEffect(load, []);

  if (view.status === "loading") {
    return <p class="muted small">モデル一覧を取得しています…</p>;
  }
  if (view.status === "failed") {
    return (
      <div class="stack">
        <p class="error-text">モデル一覧を取得できませんでした: {view.message}</p>
        <div>
          <button class="btn" onClick={load}>
            再試行
          </button>
        </div>
      </div>
    );
  }

  const selected = view.models.find((m) => m.slug === settings.model);
  const selectModel = (model: ModelInfo) => {
    const effortSupported = model.reasoningEfforts.includes(settings.reasoningEffort);
    update({
      model: model.slug,
      reasoningEffort: effortSupported ? settings.reasoningEffort : model.defaultReasoningEffort,
      fastMode: settings.fastMode && model.supportsFast,
    });
  };

  return (
    <div class="stack">
      <label class="field">
        <span>翻訳に使うモデル</span>
        <select
          value={settings.model ?? ""}
          onChange={(e) => {
            const { value } = e.currentTarget;
            const model = view.models.find((m) => m.slug === value);
            if (model) selectModel(model);
          }}
        >
          <option value="" disabled>
            選択してください
          </option>
          {view.models.map((m) => (
            <option value={m.slug}>{m.displayName}</option>
          ))}
        </select>
      </label>
      {!settings.model && <p class="notice">翻訳を始める前にモデルを選択してください。</p>}
      {settings.model && !selected && (
        <p class="notice">選択中のモデル（{settings.model}）はこのアカウントでは利用できません。</p>
      )}
      {selected && <ModelOptions model={selected} settings={settings} update={update} />}
    </div>
  );
}

function ModelOptions({
  model,
  settings,
  update,
}: {
  model: ModelInfo;
  settings: Settings;
  update: (patch: Partial<Settings>) => void;
}) {
  const effortSupported = model.reasoningEfforts.includes(settings.reasoningEffort);
  return (
    <>
      <label class="field">
        <span>推論の強さ</span>
        <select
          value={settings.reasoningEffort}
          onChange={(e) => {
            const { value } = e.currentTarget;
            if (isReasoningEffort(value)) update({ reasoningEffort: value });
          }}
        >
          {model.reasoningEfforts.map((effort) => (
            <option value={effort}>{effort}</option>
          ))}
        </select>
        <span class="muted small">
          低いほど速く、使用量の消費も少なくなります。翻訳には low 程度で十分です。
        </span>
      </label>
      {!effortSupported && (
        <p class="notice">
          推論の強さ「{settings.reasoningEffort}」はこのモデルでは使えません。選び直してください。
        </p>
      )}
      {model.supportsFast && (
        <label class="switch">
          <span>
            高速モード
            <span class="muted small block">
              応答が速くなる代わりに、ChatGPT プランの使用量を多く消費します。
            </span>
          </span>
          <input
            type="checkbox"
            checked={settings.fastMode}
            onChange={(e) => update({ fastMode: e.currentTarget.checked })}
          />
        </label>
      )}
    </>
  );
}

function UsageSection() {
  const shortcuts = useShortcuts();
  const translateKey = <kbd>{shortcuts["translate-page"] ?? "未設定"}</kbd>;
  return (
    <section class="section">
      <h2>使い方とショートカット</h2>
      <table class="usage">
        <tbody>
          <tr>
            <th>ページ全体を翻訳</th>
            <td>ツールバーのポップアップ、右クリック「このページを翻訳」、または {translateKey}</td>
          </tr>
          <tr>
            <th>選択テキストを翻訳</th>
            <td>
              選択すると出るボタン、右クリック「選択テキストを翻訳」、または選択中に {translateKey}
            </td>
          </tr>
          <tr>
            <th>原文 / 訳文の切り替え</th>
            <td>
              ポップアップのボタン、または <kbd>{shortcuts["toggle-original"] ?? "未設定"}</kbd>
            </td>
          </tr>
        </tbody>
      </table>
      <button class="btn" onClick={() => void callBackground("open:shortcuts")}>
        ショートカットを変更
      </button>
    </section>
  );
}

render(<App />, document.getElementById("app")!);
