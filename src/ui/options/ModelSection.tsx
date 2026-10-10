import { For, Match, Show, Switch } from "solid-js";

import { settingsForModel } from "@/domain/models";
import type { Settings } from "@/domain/settings";
import { createModels } from "@/ui/hooks/models";

import { ModelOptions } from "./ModelOptions";

export function ModelSection(props: {
  settings: Settings;
  update: (patch: Partial<Settings>) => void;
}) {
  const [view, reload] = createModels();
  const models = () => {
    const v = view();
    return v.status === "ready" ? v.models : undefined;
  };
  const failure = () => {
    const v = view();
    return v.status === "failed" ? v.message : undefined;
  };
  const selected = () => models()?.find((m) => m.slug === props.settings.model);

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
              <button class="btn" onClick={reload}>
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
                  if (model) props.update(settingsForModel(props.settings, model));
                }}
              >
                <option value="" disabled>
                  選択してください
                </option>
                <For each={models()}>{(m) => <option value={m.slug}>{m.displayName}</option>}</For>
              </select>
            </label>
            <Show when={props.settings.model == null}>
              <p class="notice">翻訳を始める前にモデルを選択してください。</p>
            </Show>
            <Show when={props.settings.model != null && !selected()}>
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
