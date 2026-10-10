import { Show } from "solid-js";

import { callBackground } from "@/infra/messaging/background-client";
import "@/ui/base.css";
import { PlanStatus } from "@/ui/components/PlanStatus";
import { SignInCard } from "@/ui/components/SignInCard";
import { TranslationSettingsFields } from "@/ui/components/TranslationSettingsFields";
import { createActivePage } from "@/ui/hooks/active-page";
import { createAuth } from "@/ui/hooks/auth";
import { createSettings } from "@/ui/hooks/settings";

import { PageControls } from "./PageControls";
import { ShortcutHints } from "./ShortcutHints";
import "./style.css";

export function App() {
  const auth = createAuth();
  const [settings, update] = createSettings();
  const [page, sendToPage] = createActivePage();

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

        <Show when={auth()!.signedIn && settings()!.model == null}>
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
          disabled={!auth()!.signedIn || settings()!.model == null}
        />

        <section class="settings">
          <TranslationSettingsFields
            settings={settings()!}
            update={update}
            switches={["showSelectionButton", "hoverOriginal"]}
          />
        </section>

        <ShortcutHints />
      </div>
    </Show>
  );
}
