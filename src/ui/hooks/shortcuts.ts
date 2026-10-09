import { createSignal, type Accessor } from "solid-js";

import { browser } from "#imports";
import type { CommandName } from "@/infra/messaging/protocol";

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
