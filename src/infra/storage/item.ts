import * as v from "valibot";

import { storage, type StorageItemKey } from "#imports";

export interface StorageItem<T> {
  readonly fallback: T;
  getValue(): Promise<T>;
  setValue(value: T): Promise<void>;
  watch(cb: (value: T) => void): () => void;
}

/** 古い版の拡張が保存した値は今の型と食い違いうるため、読み出すたびに検証して不正なら fallback を返す */
export function defineValidatedItem<TSchema extends v.GenericSchema>(
  key: StorageItemKey,
  schema: TSchema,
  fallback: v.InferOutput<TSchema>,
): StorageItem<v.InferOutput<TSchema>> {
  const item = storage.defineItem<unknown>(key);
  const parse = (raw: unknown): v.InferOutput<TSchema> => {
    const result = v.safeParse(schema, raw);
    return result.success ? result.output : fallback;
  };
  return {
    fallback,
    getValue: async () => parse(await item.getValue()),
    setValue: (value) => item.setValue(value),
    watch: (cb) => item.watch((raw) => cb(parse(raw))),
  };
}
