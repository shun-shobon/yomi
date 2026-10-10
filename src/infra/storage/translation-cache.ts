import { openDB, type DBSchema, type IDBPDatabase, type IDBPTransaction } from "idb";
import * as v from "valibot";

import {
  CACHE_MAX_ENTRIES,
  CachedTranslationSchema,
  type CachedTranslation,
} from "@/domain/translation-cache";

const DB_NAME = "translation-cache";
const STORE = "entries";
const USED_AT = "usedAt";
/** 当たるたびに更新すると、表示するだけで書き込みが続く */
const TOUCH_INTERVAL_MS = 24 * 60 * 60 * 1000;

const RowSchema = v.object({ ...CachedTranslationSchema.entries, usedAt: v.number() });

type Row = v.InferOutput<typeof RowSchema>;

interface CacheDb extends DBSchema {
  // 古い版が保存した行は今の型と食い違いうるので、読み出し時に RowSchema で検証する
  [STORE]: { key: string; value: unknown; indexes: { [USED_AT]: number } };
}

type WriteTransaction = IDBPTransaction<CacheDb, [typeof STORE], "readwrite">;

let dbPromise: Promise<IDBPDatabase<CacheDb>> | null = null;

function openDb(): Promise<IDBPDatabase<CacheDb>> {
  dbPromise ??= openDB<CacheDb>(DB_NAME, 1, {
    upgrade(db) {
      db.createObjectStore(STORE, { keyPath: "key" }).createIndex(USED_AT, USED_AT);
    },
  }).catch((e: unknown) => {
    dbPromise = null;
    throw e;
  });
  return dbPromise;
}

/** トランザクション内で IndexedDB 以外を await すると自動コミットされるため、ハッシュは開始前に求めておく */
async function hashKey(key: string): Promise<string> {
  const digest = await crypto.subtle.digest("SHA-256", new TextEncoder().encode(key));
  return new Uint8Array(digest).toHex();
}

/** 途中の要求が失敗しても tx.done の reject を未処理にしない */
async function write<T>(run: (tx: WriteTransaction) => Promise<T>): Promise<T> {
  const tx = (await openDb()).transaction(STORE, "readwrite");
  const [result] = await Promise.all([run(tx), tx.done]);
  return result;
}

export async function lookupTranslations(keys: string[]): Promise<(string | null)[]> {
  const hashed = await Promise.all(keys.map(hashKey));
  return write(async ({ store }) => {
    const now = Date.now();
    return Promise.all(
      hashed.map(async (key) => {
        const parsed = v.safeParse(RowSchema, await store.get(key));
        if (!parsed.success) return null;
        const row = parsed.output;
        if (now - row.usedAt > TOUCH_INTERVAL_MS) await store.put({ ...row, usedAt: now });
        return row.translation;
      }),
    );
  });
}

export async function storeTranslations(entries: CachedTranslation[]): Promise<void> {
  const rows = await Promise.all(
    entries.map(async ({ key, translation }) => ({ key: await hashKey(key), translation })),
  );
  return write(async ({ store }) => {
    const now = Date.now();
    await Promise.all(rows.map((row) => store.put({ ...row, usedAt: now } satisfies Row)));
    let excess = (await store.count()) - CACHE_MAX_ENTRIES;
    for (let cursor = excess > 0 ? await store.index(USED_AT).openCursor() : null; cursor;) {
      await cursor.delete();
      cursor = --excess > 0 ? await cursor.continue() : null;
    }
  });
}

export async function countTranslations(): Promise<number> {
  return (await openDb()).count(STORE);
}

export async function clearTranslations(): Promise<void> {
  return (await openDb()).clear(STORE);
}
