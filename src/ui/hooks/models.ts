import { createSignal, type Accessor } from "solid-js";

import type { ModelInfo } from "@/domain/models";
import { callBackground } from "@/infra/messaging/background-client";

export type ModelsView =
  | { status: "loading" }
  | { status: "failed"; message: string }
  | { status: "ready"; models: ModelInfo[] };

/** アカウントで利用できるモデル一覧。reload で取得し直す */
export function createModels(): [Accessor<ModelsView>, () => void] {
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
  return [view, load];
}
