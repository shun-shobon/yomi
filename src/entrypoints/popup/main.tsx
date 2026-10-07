import { render } from "preact";
import { useEffect, useState } from "preact/hooks";

import { browser } from "#imports";
import "@/components/base.css";
import { useAuth, useSettings, useShortcuts } from "@/components/hooks";
import { PlanStatus, SignInCard } from "@/components/SignInCard";
import { TranslationSettingsFields } from "@/components/TranslationSettingsFields";
import type { ContentMessage, PageState } from "@/utils/messages";
import { callBackground } from "@/utils/runtime";

import "./style.css";

const POLL_MS = 500;

type PageView =
  | { status: "loading" }
  /** content script を注入できないページ（chrome:// など） */
  | { status: "unavailable" }
  | { status: "ready"; state: PageState };

function usePage(): [PageView, (message: ContentMessage) => void] {
  const [view, setView] = useState<PageView>({ status: "loading" });
  const [tabId, setTabId] = useState<number | null>(null);

  useEffect(() => {
    void browser.tabs.query({ active: true, currentWindow: true }).then(([tab]) => {
      if (tab?.id === undefined) setView({ status: "unavailable" });
      else setTabId(tab.id);
    });
  }, []);

  const send = (message: ContentMessage) => {
    if (tabId === null) return;
    browser.tabs.sendMessage(tabId, message).then(
      (state: PageState) => setView({ status: "ready", state }),
      () => setView({ status: "unavailable" }),
    );
  };

  useEffect(() => {
    if (tabId === null) return;
    send({ type: "page:getState" });
    const timer = setInterval(() => send({ type: "page:getState" }), POLL_MS);
    return () => clearInterval(timer);
  }, [tabId]);

  return [view, send];
}

function App() {
  const auth = useAuth();
  const [settings, update] = useSettings();
  const [page, sendToPage] = usePage();
  const shortcuts = useShortcuts();

  if (!auth || !settings) return <div class="popup" />;

  return (
    <div class="popup">
      <header class="top">
        <span class="brand">Yomi</span>
        <button class="btn link small" onClick={() => void callBackground("open:options")}>
          設定
        </button>
      </header>

      {auth.signedIn ? (
        <section class="account">
          <PlanStatus />
        </section>
      ) : (
        <SignInCard />
      )}

      {auth.signedIn && !settings.model && (
        <div class="notice">
          翻訳に使うモデルが未選択です。
          <button class="btn link" onClick={() => void callBackground("open:options")}>
            設定で選択
          </button>
        </div>
      )}

      <PageControls page={page} send={sendToPage} disabled={!auth.signedIn || !settings.model} />

      <section class="settings">
        <TranslationSettingsFields
          settings={settings}
          update={update}
          switches={["showSelectionButton", "hoverOriginal"]}
        />
      </section>

      <footer class="shortcuts small muted">
        <span>
          <kbd>{shortcuts["translate-page"] ?? "未設定"}</kbd> 翻訳 / 停止
        </span>
        <span>
          <kbd>{shortcuts["toggle-original"] ?? "未設定"}</kbd> 原文切替
        </span>
        <button class="btn link small" onClick={() => void callBackground("open:shortcuts")}>
          変更
        </button>
      </footer>
    </div>
  );
}

function PageControls({
  page,
  send,
  disabled,
}: {
  page: PageView;
  send: (message: ContentMessage) => void;
  disabled: boolean;
}) {
  if (page.status === "loading") return <section class="page" />;
  if (page.status === "unavailable") {
    return (
      <section class="page">
        <p class="muted small center">このページは翻訳できません</p>
      </section>
    );
  }

  const { state } = page;
  const hasTranslations = state.done > 0;
  return (
    <section class="page">
      {state.active ? (
        <button class="btn block" onClick={() => send({ type: "page:stop" })}>
          翻訳を停止
        </button>
      ) : (
        <button
          class="btn block primary"
          disabled={disabled}
          onClick={() => {
            send({ type: "page:translate" });
            window.close();
          }}
        >
          このページを翻訳
        </button>
      )}
      {hasTranslations && (
        <button
          class="btn block"
          onClick={() =>
            send({
              type: state.showing === "translation" ? "page:showOriginal" : "page:showTranslation",
            })
          }
        >
          {state.showing === "translation" ? "原文を表示" : "訳文を表示"}
        </button>
      )}
      {(state.active || hasTranslations) && (
        <p class="progress small muted">
          {state.busy > 0 && <span class="spinner" />}
          翻訳済み {state.done}
          {state.busy > 0 && ` · 処理中 ${state.busy}`}
          {state.failed > 0 && <span class="error-text"> · 失敗 {state.failed}</span>}
        </p>
      )}
    </section>
  );
}

render(<App />, document.getElementById("app")!);
