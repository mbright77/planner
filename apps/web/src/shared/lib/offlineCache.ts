type CachedEntry<T> = {
  key: string;
  value: T;
  updatedAt: string;
};

const databaseName = 'planner-offline-cache';
const storeName = 'query-cache';
const databaseVersion = 1;

function openDatabase(): Promise<IDBDatabase> {
  return new Promise((resolve, reject) => {
    const request = window.indexedDB.open(databaseName, databaseVersion);

    request.onerror = () => reject(request.error ?? new Error('Unable to open offline cache.'));
    request.onsuccess = () => resolve(request.result);
    request.onupgradeneeded = () => {
      const database = request.result;

      if (!database.objectStoreNames.contains(storeName)) {
        database.createObjectStore(storeName, { keyPath: 'key' });
      }
    };
  });
}

async function withStore<T>(mode: IDBTransactionMode, run: (store: IDBObjectStore) => IDBRequest<T>) {
  const database = await openDatabase();

  return new Promise<T>((resolve, reject) => {
    const transaction = database.transaction(storeName, mode);
    const store = transaction.objectStore(storeName);
    const request = run(store);

    request.onerror = () => reject(request.error ?? new Error('Offline cache request failed.'));
    request.onsuccess = () => resolve(request.result);
    transaction.oncomplete = () => database.close();
    transaction.onerror = () => reject(transaction.error ?? new Error('Offline cache transaction failed.'));
  });
}

export async function readOfflineCache<T>(key: string): Promise<CachedEntry<T> | null> {
  const result = await withStore('readonly', (store) => store.get(key));

  return (result as CachedEntry<T> | undefined) ?? null;
}

export async function writeOfflineCache<T>(key: string, value: T) {
  await withStore('readwrite', (store) =>
    store.put({ key, value, updatedAt: new Date().toISOString() } satisfies CachedEntry<T>),
  );
}

export function buildOfflineCacheKey(parts: readonly unknown[]) {
  return JSON.stringify(parts);
}
