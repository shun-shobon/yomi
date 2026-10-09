import { createSignal, For, Match, Show, Switch } from "solid-js";
import { render } from "solid-js/web";

import { settingsForModel, supportsEffort, type ModelInfo } from "@/domain/models";
import { isReasoningEffort, type Settings } from "@/domain/settings";
import { callBackground } from "@/infra/messaging/background-client";
import { signInItem } from "@/infra/storage/auth";
import "@/ui/base.css";
import { PlanStatus } from "@/ui/components/PlanStatus";
import { SignInCard } from "@/ui/components/SignInCard";
import { TranslationSettingsFields } from "@/ui/components/TranslationSettingsFields";
import { createAuth } from "@/ui/hooks/auth";
import { createSettings } from "@/ui/hooks/settings";
import { createShortcuts } from "@/ui/hooks/shortcuts";
import { createStorageItem } from "@/ui/hooks/storage-item";

import "./style.css";

function App() {
  const auth = createAuth();
  const [settings, update] = createSettings();

  return (
    <Show when={auth() && settings()}>
      <main class="page">
        <h1>Yomi</h1>

        <section class="section">
          <h2>アカウント</h2>
          <Show when={auth()!.signedIn} fallback={<SignInSection />}>
            <div class="row">
              <div class="grow">
                <PlanStatus />
                <div class="muted small">{auth()!.email ?? "ChatGPT アカウント"}</div>
              </div>
              <button class="btn" onClick={() => void callBackground("auth:signOut")}>
                サインアウト
              </button>
            </div>
          </Show>
        </section>

        <section class="section">
          <h2>モデル</h2>
          <Show
            when={auth()!.signedIn}
            fallback={
              <p class="muted small">
                サインインすると、アカウントで利用できるモデルが表示されます。
              </p>
            }
          >
            <ModelSection settings={settings()!} update={update} />
          </Show>
        </section>

        <section class="section">
          <h2>翻訳</h2>
          <div class="stack">
            <TranslationSettingsFields
              settings={settings()!}
              update={update}
              switches={["showSelectionButton", "hoverOriginal", "highlightPending"]}
            />
          </div>
        </section>

        <UsageSection />
      </main>
    </Show>
  );
}

function SignInSection() {
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

type ModelsView =
  | { status: "loading" }
  | { status: "failed"; message: string }
  | { status: "ready"; models: ModelInfo[] };

function ModelSection(props: { settings: Settings; update: (patch: Partial<Settings>) => void }) {
  const [view, setView] = createSignal<ModelsView>({ status: "loading" });
  const load = () => {
    setView({ status: "loading" });
    callBackground("models:list").then(
      (models) => setView({ status: "ready", models }),
      (e: unknown) =>
        setView({ status: "failed", message: e instanceof Error ? e.message : String(e) }),
    );
  };
  load();

  const models = () => {
    const v = view();
    return v.status === "ready" ? v.models : undefined;
  };
  const failure = () => {
    const v = view();
    return v.status === "failed" ? v.message : undefined;
  };
  const selected = () => models()?.find((m) => m.slug === props.settings.model);
  const selectModel = (model: ModelInfo) => props.update(settingsForModel(props.settings, model));

  return (
    <Switch>
      <Match when={view().status === "loading"}>
        <p class="muted small">モデル一覧を取得しています…</p>
      </Match>
      <Match when={failure()}>
        {(message) => (
          <div class="stack">
            <p class="error-text">モデル一覧を取得できませんでした: {message()}</p>
            <div>
              <button class="btn" onClick={load}>
                再試行
              </button>
            </div>
          </div>
        )}
      </Match>
      <Match when={models()}>
        {(models) => (
          <div class="stack">
            <label class="field">
              <span>翻訳に使うモデル</span>
              <select
                value={props.settings.model ?? ""}
                onChange={(e) => {
                  const { value } = e.currentTarget;
                  const model = models().find((m) => m.slug === value);
                  if (model) selectModel(model);
                }}
              >
                <option value="" disabled>
                  選択してください
                </option>
                <For each={models()}>{(m) => <option value={m.slug}>{m.displayName}</option>}</For>
              </select>
            </label>
            <Show when={!props.settings.model}>
              <p class="notice">翻訳を始める前にモデルを選択してください。</p>
            </Show>
            <Show when={props.settings.model && !selected()}>
              <p class="notice">
                選択中のモデル（{props.settings.model}）はこのアカウントでは利用できません。
              </p>
            </Show>
            <Show when={selected()}>
              {(model) => (
                <ModelOptions model={model()} settings={props.settings} update={props.update} />
              )}
            </Show>
          </div>
        )}
      </Match>
    </Switch>
  );
}

function ModelOptions(props: {
  model: ModelInfo;
  settings: Settings;
  update: (patch: Partial<Settings>) => void;
}) {
  const effortSupported = () => supportsEffort(props.model, props.settings.reasoningEffort);
  return (
    <>
      <label class="field">
        <span>推論の強さ</span>
        <select
          value={props.settings.reasoningEffort}
          onChange={(e) => {
            const { value } = e.currentTarget;
            if (isReasoningEffort(value)) props.update({ reasoningEffort: value });
          }}
        >
          <For each={props.model.reasoningEfforts}>
            {(effort) => <option value={effort}>{effort}</option>}
          </For>
        </select>
        <span class="muted small">
          低いほど速く、使用量の消費も少なくなります。翻訳には low 程度で十分です。
        </span>
      </label>
      <Show when={!effortSupported()}>
        <p class="notice">
          推論の強さ「{props.settings.reasoningEffort}
          」はこのモデルでは使えません。選び直してください。
        </p>
      </Show>
      <Show when={props.model.supportsFast}>
        <label class="switch">
          <span>
            高速モード
            <span class="muted small block">
              応答が速くなる代わりに、ChatGPT プランの使用量を多く消費します。
            </span>
          </span>
          <input
            type="checkbox"
            checked={props.settings.fastMode}
            onChange={(e) => props.update({ fastMode: e.currentTarget.checked })}
          />
        </label>
      </Show>
    </>
  );
}

function UsageSection() {
  const shortcuts = createShortcuts();
  // Solid の JSX は実 DOM ノードなので、同じ要素を 2 か所に置くと後から置いた方へ移動してしまう
  const translateKey = () => <kbd>{shortcuts()["translate-page"] ?? "未設定"}</kbd>;
  return (
    <section class="section">
      <h2>使い方とショートカット</h2>
      <table class="usage">
        <tbody>
          <tr>
            <th>ページ全体を翻訳</th>
            <td>
              ツールバーのポップアップ、右クリック「このページを翻訳」、または {translateKey()}
            </td>
          </tr>
          <tr>
            <th>選択テキストを翻訳</th>
            <td>
              選択すると出るボタン、右クリック「選択テキストを翻訳」、または選択中に{" "}
              {translateKey()}
            </td>
          </tr>
          <tr>
            <th>原文 / 訳文の切り替え</th>
            <td>
              ポップアップのボタン、または <kbd>{shortcuts()["toggle-original"] ?? "未設定"}</kbd>
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

render(() => <App />, document.getElementById("app")!);
