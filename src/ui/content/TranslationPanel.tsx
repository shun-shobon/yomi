import { createSignal, Match, onCleanup, Show, Switch } from "solid-js";

import type { PanelState } from "@/usecases/content/overlay";

import type { PagePosition } from "./position";

export const PANEL_MAX_WIDTH = 440;
export const PANEL_ESTIMATED_HEIGHT = 160;
const COPIED_FEEDBACK_MS = 1500;

export interface PanelItem {
  id: number;
  position: PagePosition;
  title: string;
  state: PanelState;
  onClose: () => void;
}

export function TranslationPanel(props: PanelItem) {
  const translating = () => (props.state.status === "translating" ? props.state : undefined);
  const done = () => (props.state.status === "done" ? props.state : undefined);
  const failed = () => (props.state.status === "failed" ? props.state : undefined);

  return (
    <div
      class="panel"
      role="dialog"
      style={{ left: `${props.position.left}px`, top: `${props.position.top}px` }}
    >
      <header>
        <span class="title">{props.title}</span>
        <button class="icon-btn close" aria-label="閉じる" onClick={() => props.onClose()}>
          ✕
        </button>
      </header>
      <div
        class="body"
        classList={{
          cursor: props.state.status === "translating" && props.state.text !== "",
          error: props.state.status === "failed",
        }}
        aria-live="polite"
      >
        <Switch>
          <Match when={translating()?.text === ""}>
            <span class="dots">
              <i />
              <i />
              <i />
            </span>
          </Match>
          <Match when={translating()}>{(s) => s().text}</Match>
          <Match when={done()}>{(s) => s().text}</Match>
          <Match when={failed()}>{(s) => s().message}</Match>
        </Switch>
      </div>
      <footer>
        <span class="status">{translating() ? "翻訳中…" : ""}</span>
        <span class="spacer" />
        <Show when={done()}>{(s) => <CopyButton text={s().text} />}</Show>
      </footer>
    </div>
  );
}

function CopyButton(props: { text: string }) {
  const [copied, setCopied] = createSignal(false);
  let timer: ReturnType<typeof setTimeout> | undefined;
  onCleanup(() => clearTimeout(timer));
  const copy = () =>
    void navigator.clipboard.writeText(props.text).then(() => {
      setCopied(true);
      clearTimeout(timer);
      timer = setTimeout(() => setCopied(false), COPIED_FEEDBACK_MS);
    });
  return (
    <button class="copy" classList={{ copied: copied() }} onClick={copy}>
      {copied() ? "コピーしました" : "コピー"}
    </button>
  );
}
