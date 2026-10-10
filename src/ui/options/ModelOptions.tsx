import { For, Show } from "solid-js";

import { supportsEffort, type ModelInfo } from "@/domain/models";
import { isReasoningEffort, type Settings } from "@/domain/settings";

export function ModelOptions(props: {
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
              応答が速くなる代わりに、ChatGPT サブスクリプションの使用量を多く消費します。
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
