import { createSignal, onCleanup, type Accessor } from "solid-js";

import { callBackground } from "@/infra/messaging/background-client";
import type { AuthState } from "@/infra/messaging/protocol";
import { credentialsItem } from "@/infra/storage/auth";

export function createAuth(): Accessor<AuthState | null> {
  const [auth, setAuth] = createSignal<AuthState | null>(null);
  const load = () => void callBackground("auth:getState").then(setAuth);
  load();
  // 資格情報の中身は読まず、変化の通知だけを background への再問い合わせに使う
  onCleanup(credentialsItem.watch(load));
  return auth;
}
