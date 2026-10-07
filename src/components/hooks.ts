import { useEffect, useState } from "preact/hooks";

import { browser, type WxtStorageItem } from "#imports";
import { credentialsItem } from "@/utils/auth-storage";
import type { AuthState, CommandName } from "@/utils/messages";
import { callBackground } from "@/utils/runtime";
import { getSettings, updateSettings, watchSettings, type Settings } from "@/utils/settings";

export function useSettings(): [Settings | null, (patch: Partial<Settings>) => void] {
  const [settings, setSettings] = useState<Settings | null>(null);
  useEffect(() => {
    void getSettings().then(setSettings);
    return watchSettings(setSettings);
  }, []);
  const update = (patch: Partial<Settings>) => {
    setSettings((s) => s && { ...s, ...patch });
    void updateSettings(patch);
  };
  return [settings, update];
}

export function useAuth(): AuthState | null {
  const [auth, setAuth] = useState<AuthState | null>(null);
  useEffect(() => {
    const load = () => void callBackground("auth:getState").then(setAuth);
    load();
    // 資格情報の中身は読まず、変化の通知だけを background への再問い合わせに使う
    return credentialsItem.watch(load);
  }, []);
  return auth;
}

/** 割り当てのないコマンドは含まない */
export function useShortcuts(): Partial<Record<CommandName, string>> {
  const [shortcuts, setShortcuts] = useState<Partial<Record<CommandName, string>>>({});
  useEffect(() => {
    void browser.commands.getAll().then((commands) => {
      setShortcuts(
        Object.fromEntries(commands.filter((c) => c.shortcut).map((c) => [c.name, c.shortcut])),
      );
    });
  }, []);
  return shortcuts;
}

export function useStorageItem<T>(item: WxtStorageItem<T, Record<string, unknown>>): T {
  const [value, setValue] = useState<T>(item.fallback);
  useEffect(() => {
    void item.getValue().then(setValue);
    return item.watch(setValue);
  }, [item]);
  return value;
}
