// Save storage (docs/12): IndexedDB in the browser, localStorage when IndexedDB is missing, and nothing at all in
// some private windows (the menu then offers export only). Saves never leave the browser.

import type { SaveFile, SlotId } from './save';

const DB = 'doublelife';
const STORE = 'saves';
const LS_PREFIX = 'doublelife.save.';

export interface SaveStore {
  kind: 'indexeddb' | 'localstorage' | 'none';
  get(slot: SlotId): Promise<SaveFile | null>;
  put(file: SaveFile): Promise<void>;
  all(): Promise<SaveFile[]>;
}

function idbOpen(): Promise<IDBDatabase> {
  return new Promise((resolve, reject) => {
    const req = indexedDB.open(DB, 1);
    req.onupgradeneeded = () => req.result.createObjectStore(STORE);
    req.onsuccess = () => resolve(req.result);
    req.onerror = () => reject(req.error);
  });
}

function idbStore(db: IDBDatabase): SaveStore {
  const run = <T>(mode: IDBTransactionMode, fn: (s: IDBObjectStore) => IDBRequest<T>): Promise<T> =>
    new Promise((resolve, reject) => {
      const req = fn(db.transaction(STORE, mode).objectStore(STORE));
      req.onsuccess = () => resolve(req.result);
      req.onerror = () => reject(req.error);
    });
  return {
    kind: 'indexeddb',
    get: async (slot) => ((await run('readonly', (s) => s.get(slot))) as SaveFile | undefined) ?? null,
    put: async (file) => {
      await run('readwrite', (s) => s.put(file, file.meta.slot));
    },
    all: async () => (await run('readonly', (s) => s.getAll())) as SaveFile[],
  };
}

function lsStore(ls: Storage): SaveStore {
  return {
    kind: 'localstorage',
    get: async (slot) => {
      const raw = ls.getItem(LS_PREFIX + slot);
      return raw ? (JSON.parse(raw) as SaveFile) : null;
    },
    put: async (file) => ls.setItem(LS_PREFIX + file.meta.slot, JSON.stringify(file)),
    all: async () => {
      const out: SaveFile[] = [];
      for (let i = 0; i < ls.length; i++) {
        const k = ls.key(i);
        if (k?.startsWith(LS_PREFIX)) out.push(JSON.parse(ls.getItem(k) as string) as SaveFile);
      }
      return out;
    },
  };
}

const NONE: SaveStore = {
  kind: 'none',
  get: async () => null,
  put: async () => {
    throw new Error('storage unavailable');
  },
  all: async () => [],
};

let opened: Promise<SaveStore> | null = null;

/** The save store for this browser, opened once. */
export function saveStore(): Promise<SaveStore> {
  opened ??= (async () => {
    try {
      if (typeof indexedDB !== 'undefined') return idbStore(await idbOpen());
    } catch {
      // fall through to localStorage
    }
    try {
      const ls = globalThis.localStorage;
      ls.setItem(LS_PREFIX + 'probe', '1');
      ls.removeItem(LS_PREFIX + 'probe');
      return lsStore(ls);
    } catch {
      return NONE;
    }
  })();
  return opened;
}

/** Ask the browser not to evict saves (docs/12), once. */
export function askPersist(): void {
  void navigator.storage?.persist?.().catch(() => undefined);
}
