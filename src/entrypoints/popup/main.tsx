import { createSignal, Match, onCleanup, Show, Switch, type Accessor } from "solid-js";
import { render } from "solid-js/web";

import { browser } from "#imports";
import type { PageState } from "@/domain/page";
import { callBackground } from "@/infra/messaging/background-client";
import type { ContentMessage } from "@/infra/messaging/protocol";
import "@/ui/base.css";
import { PlanStatus } from "@/ui/components/PlanStatus";
import { SignInCard } from "@/ui/components/SignInCard";
import { TranslationSettingsFields } from "@/ui/components/TranslationSettingsFields";
import { createAuth } from "@/ui/hooks/auth";
import { createSettings } from "@/ui/hooks/settings";
import { createShortcuts } from "@/ui/hooks/shortcuts";

import "./style.css";

const POLL_MS = 500;

type PageView =
  | { status: "loading" }
  /** content script を注入できないページ（chrome:// など） */
  | { status: "unavailable" }
  | { status: "ready"; state: PageState };

function createPage(): [Accessor<PageView>, (message: ContentMessage) => void] {
  const [view, setView] = createSignal<PageView>({ status: "loading" });
  let tabId: number | undefined;

  const send = (message: ContentMessage) => {
    if (tabId === undefined) return;
    browser.tabs.sendMessage(tabId, message).then(
      (state: PageState) => setView({ status: "ready", state }),
      () => setView({ status: "unavailable" }),
    );
  };

  let timer: ReturnType<typeof setInterval> | undefined;
  onCleanup(() => clearInterval(timer));
  void browser.tabs.query({ active: true, currentWindow: true }).then(([tab]) => {
    if (tab?.id === undefined) {
      setView({ status: "unavailable" });
      return;
    }
    tabId = tab.id;
    send({ type: "page:getState" });
    timer = setInterval(() => send({ type: "page:getState" }), POLL_MS);
  });

  return [view, send];
}

function App() {
  const auth = createAuth();
  const [settings, update] = createSettings();
  const [page, sendToPage] = createPage();
  const shortcuts = createShortcuts();

  return (
    <Show when={auth() && settings()} fallback={<div class="popup" />}>
      <div class="popup">
        <header class="top">
          <span class="brand">Yomi</span>
          <button class="btn link small" onClick={() => void callBackground("open:options")}>
            設定
          </button>
        </header>

        <Show when={auth()!.signedIn} fallback={<SignInCard />}>
          <section class="account">
            <PlanStatus />
          </section>
        </Show>

        <Show when={auth()!.signedIn && !settings()!.model}>
          <div class="notice">
            翻訳に使うモデルが未選択です。
            <button class="btn link" onClick={() => void callBackground("open:options")}>
              設定で選択
            </button>
          </div>
        </Show>

        <PageControls
          page={page()}
          send={sendToPage}
          disabled={!auth()!.signedIn || !settings()!.model}
        />

        <section class="settings">
          <TranslationSettingsFields
            settings={settings()!}
            update={update}
            switches={["showSelectionButton", "hoverOriginal"]}
          />
        </section>

        <footer class="shortcuts small muted">
          <span>
            <kbd>{shortcuts()["translate-page"] ?? "未設定"}</kbd> 翻訳 / 停止
          </span>
          <span>
            <kbd>{shortcuts()["toggle-original"] ?? "未設定"}</kbd> 原文切替
          </span>
          <button class="btn link small" onClick={() => void callBackground("open:shortcuts")}>
            変更
          </button>
        </footer>
      </div>
    </Show>
  );
}

function PageControls(props: {
  page: PageView;
  send: (message: ContentMessage) => void;
  disabled: boolean;
}) {
  const state = () => (props.page.status === "ready" ? props.page.state : undefined);
  const hasTranslations = () => (state()?.done ?? 0) > 0;
  return (
    <section class="page">
      <Switch>
        <Match when={props.page.status === "unavailable"}>
          <p class="muted small center">このページは翻訳できません</p>
        </Match>
        <Match when={state()}>
          {(state) => (
            <>
              <Show
                when={state().active}
                fallback={
                  <button
                    class="btn block primary"
                    disabled={props.disabled}
                    onClick={() => {
                      props.send({ type: "page:translate" });
                      window.close();
                    }}
                  >
                    このページを翻訳
                  </button>
                }
              >
                <button class="btn block" onClick={() => props.send({ type: "page:stop" })}>
                  翻訳を停止
                </button>
              </Show>
              <Show when={hasTranslations()}>
                <button
                  class="btn block"
                  onClick={() =>
                    props.send({
                      type:
                        state().showing === "translation"
                          ? "page:showOriginal"
                          : "page:showTranslation",
                    })
                  }
                >
                  {state().showing === "translation" ? "原文を表示" : "訳文を表示"}
                </button>
              </Show>
              <Show when={state().active || hasTranslations()}>
                <p class="progress small muted">
                  <Show when={state().busy > 0}>
                    <span class="spinner" />
                  </Show>
                  翻訳済み {state().done}
                  {state().busy > 0 && ` · 処理中 ${state().busy}`}
                  <Show when={state().failed > 0}>
                    <span class="error-text"> · 失敗 {state().failed}</span>
                  </Show>
                </p>
              </Show>
            </>
          )}
        </Match>
      </Switch>
    </section>
  );
}

render(() => <App />, document.getElementById("app")!);
