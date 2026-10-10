import { createSignal, onCleanup, type Accessor } from "solid-js";

import type { PageState } from "@/domain/page";
import { activeTabId } from "@/infra/browser/tabs";
import { sendToContent } from "@/infra/messaging/content-client";
import type { ContentMessage } from "@/infra/messaging/protocol";

const POLL_MS = 500;

export type PageView =
  | { status: "loading" }
  | { status: "unavailable" }
  | { status: "ready"; state: PageState };

export function createActivePage(): [Accessor<PageView>, (message: ContentMessage) => void] {
  const [view, setView] = createSignal<PageView>({ status: "loading" });
  let tabId: number | undefined;

  const send = (message: ContentMessage) => {
    if (tabId === undefined) return;
    sendToContent(tabId, message).then(
      (state) => setView({ status: "ready", state }),
      () => setView({ status: "unavailable" }),
    );
  };

  let timer: ReturnType<typeof setInterval> | undefined;
  onCleanup(() => clearInterval(timer));
  void activeTabId().then((id) => {
    if (id === undefined) {
      setView({ status: "unavailable" });
      return;
    }
    tabId = id;
    send({ type: "page:getState" });
    timer = setInterval(() => send({ type: "page:getState" }), POLL_MS);
  });

  return [view, send];
}
