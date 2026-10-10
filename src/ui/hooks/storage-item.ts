import { createSignal, onCleanup, type Accessor } from "solid-js";

import type { StorageItem } from "@/infra/storage/item";

export function createStorageItem<T>(item: StorageItem<T>): Accessor<T> {
  // T が関数型でも setter の updater 形式と解釈されないよう、常に関数で包んで渡す
  const [value, setValue] = createSignal<T>(item.fallback);
  const set = (v: T) => setValue(() => v);
  void item.getValue().then(set);
  onCleanup(item.watch(set));
  return value;
}
