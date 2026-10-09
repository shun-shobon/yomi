import { createSignal, onCleanup, type Accessor } from "solid-js";

import { browser, type WxtStorageItem } from "#imports";
import { credentialsItem } from "@/utils/auth-storage";
import type { AuthState, CommandName } from "@/utils/messages";
import { callBackground } from "@/utils/runtime";
import { getSettings, updateSettings, watchSettings, type Settings } from "@/utils/settings";

export function createSettings(): [Accessor<Settings | null>, (patch: Partial<Settings>) => void] {
  const [settings, setSettings] = createSignal<Settings | null>(null);
  void getSettings().then(setSettings);
  onCleanup(watchSettings(setSettings));
  const update = (patch: Partial<Settings>) => {
    setSettings((s) => s && { ...s, ...patch });
    void updateSettings(patch);
  };
  return [settings, update];
}

export function createAuth(): Accessor<AuthState | null> {
  const [auth, setAuth] = createSignal<AuthState | null>(null);
  const load = () => void callBackground("auth:getState").then(setAuth);
  load();
  // 資格情報の中身は読まず、変化の通知だけを background への再問い合わせに使う
  onCleanup(credentialsItem.watch(load));
  return auth;
}

/** 割り当てのないコマンドは含まない */
export function createShortcuts(): Accessor<Partial<Record<CommandName, string>>> {
  const [shortcuts, setShortcuts] = createSignal<Partial<Record<CommandName, string>>>({});
  void browser.commands.getAll().then((commands) => {
    setShortcuts(
      Object.fromEntries(commands.filter((c) => c.shortcut).map((c) => [c.name, c.shortcut])),
    );
  });
  return shortcuts;
}

export function createStorageItem<T>(
  item: WxtStorageItem<T, Record<string, unknown>>,
): Accessor<T> {
  // T が関数型でも setter の updater 形式と解釈されないよう、常に関数で包んで渡す
  const [value, setValue] = createSignal<T>(item.fallback);
  const set = (v: T) => setValue(() => v);
  void item.getValue().then(set);
  onCleanup(item.watch(set));
  return value;
}
