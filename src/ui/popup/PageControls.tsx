import { Match, Show, Switch } from "solid-js";

import type { ContentMessage } from "@/infra/messaging/protocol";
import type { PageView } from "@/ui/hooks/active-page";

export function PageControls(props: {
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
