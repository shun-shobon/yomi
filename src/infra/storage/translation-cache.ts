import { CACHE_MAX_ENTRIES, type CachedTranslation } from "@/domain/translation-cache";

const DB_NAME = "translation-cache";
const STORE = "entries";
const USED_AT = "usedAt";
/** 当たるたびに更新すると、表示するだけで書き込みが続く */
const TOUCH_INTERVAL_MS = 24 * 60 * 60 * 1000;

interface Row extends CachedTranslation {
  usedAt: number;
}

let dbPromise: Promise<IDBDatabase> | null = null;

function openDb(): Promise<IDBDatabase> {
  dbPromise ??= new Promise<IDBDatabase>((resolve, reject) => {
    const req = indexedDB.open(DB_NAME, 1);
    req.onupgradeneeded = () => {
      req.result.createObjectStore(STORE, { keyPath: "key" }).createIndex(USED_AT, USED_AT);
    };
    req.onsuccess = () => resolve(req.result);
    req.onerror = () => reject(req.error);
  }).catch((e: unknown) => {
    dbPromise = null;
    throw e;
  });
  return dbPromise;
}

async function hashKey(key: string): Promise<string> {
  const digest = await crypto.subtle.digest("SHA-256", new TextEncoder().encode(key));
  return Array.from(new Uint8Array(digest), (b) => b.toString(16).padStart(2, "0")).join("");
}

/** トランザクション内で await すると自動コミットされてしまう */
async function transact<T>(
  mode: IDBTransactionMode,
  run: (store: IDBObjectStore) => () => T,
): Promise<T> {
  const tx = (await openDb()).transaction(STORE, mode);
  const collect = run(tx.objectStore(STORE));
  await new Promise<void>((resolve, reject) => {
    tx.oncomplete = () => resolve();
    tx.onerror = tx.onabort = () => reject(tx.error);
  });
  return collect();
}

export async function lookupTranslations(keys: string[]): Promise<(string | null)[]> {
  const hashed = await Promise.all(keys.map(hashKey));
  return transact("readwrite", (store) => {
    const now = Date.now();
    const found: (string | null)[] = keys.map(() => null);
    hashed.forEach((key, i) => {
      const req = store.get(key) as IDBRequest<Row | undefined>;
      req.onsuccess = () => {
        const row = req.result;
        if (!row) return;
        found[i] = row.translation;
        if (now - row.usedAt > TOUCH_INTERVAL_MS) store.put({ ...row, usedAt: now });
      };
    });
    return () => found;
  });
}

export async function storeTranslations(entries: CachedTranslation[]): Promise<void> {
  const rows = await Promise.all(
    entries.map(async ({ key, translation }) => ({ key: await hashKey(key), translation })),
  );
  return transact("readwrite", (store) => {
    const now = Date.now();
    for (const row of rows) store.put({ ...row, usedAt: now } satisfies Row);
    const countReq = store.count();
    countReq.onsuccess = () => {
      let excess = countReq.result - CACHE_MAX_ENTRIES;
      if (excess <= 0) return;
      const cursorReq = store.index(USED_AT).openCursor();
      cursorReq.onsuccess = () => {
        const cursor = cursorReq.result;
        if (!cursor || excess-- <= 0) return;
        cursor.delete();
        cursor.continue();
      };
    };
    return () => undefined;
  });
}

export function countTranslations(): Promise<number> {
  return transact("readonly", (store) => {
    const req = store.count();
    return () => req.result;
  });
}

export function clearTranslations(): Promise<void> {
  return transact("readwrite", (store) => {
    store.clear();
    return () => undefined;
  });
}
