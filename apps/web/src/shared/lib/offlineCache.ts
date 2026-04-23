type CachedEntry<T> = {
  key: string;
  value: T;
  updatedAt: string;
};

const databaseName = 'planner-offline-cache';
const queryCacheStoreName = 'query-cache';
const mutationQueueStoreName = 'mutation-queue';
const databaseVersion = 2;

function openDatabase(): Promise<IDBDatabase> {
  return new Promise((resolve, reject) => {
    const request = window.indexedDB.open(databaseName, databaseVersion);

    request.onerror = () => reject(request.error ?? new Error('Unable to open offline cache.'));
    request.onsuccess = () => resolve(request.result);
    request.onupgradeneeded = () => {
      const database = request.result;

      if (!database.objectStoreNames.contains(queryCacheStoreName)) {
        database.createObjectStore(queryCacheStoreName, { keyPath: 'key' });
      }

      if (!database.objectStoreNames.contains(mutationQueueStoreName)) {
        database.createObjectStore(mutationQueueStoreName, { keyPath: 'key' });
      }
    };
  });
}

async function withStore<T>(
  storeName: string,
  mode: IDBTransactionMode,
  run: (store: IDBObjectStore) => IDBRequest<T>,
) {
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
  const result = await withStore(queryCacheStoreName, 'readonly', (store) => store.get(key));

  return (result as CachedEntry<T> | undefined) ?? null;
}

export async function writeOfflineCache<T>(key: string, value: T) {
  await withStore(queryCacheStoreName, 'readwrite', (store) =>
    store.put({ key, value, updatedAt: new Date().toISOString() } satisfies CachedEntry<T>),
  );
}

export async function deleteOfflineCache(key: string) {
  await withStore(queryCacheStoreName, 'readwrite', (store) => store.delete(key));
}

export async function readOfflineQueueStore<T>(key: string): Promise<CachedEntry<T> | null> {
  const result = await withStore(mutationQueueStoreName, 'readonly', (store) => store.get(key));

  return (result as CachedEntry<T> | undefined) ?? null;
}

export async function writeOfflineQueueStore<T>(key: string, value: T) {
  await withStore(mutationQueueStoreName, 'readwrite', (store) =>
    store.put({ key, value, updatedAt: new Date().toISOString() } satisfies CachedEntry<T>),
  );
}

export async function deleteOfflineQueueStore(key: string) {
  await withStore(mutationQueueStoreName, 'readwrite', (store) => store.delete(key));
}

export async function listOfflineQueueStore<T>() {
  const result = await withStore(mutationQueueStoreName, 'readonly', (store) => store.getAll());

  return (result as CachedEntry<T>[] | undefined) ?? [];
}

export function buildOfflineCacheKey(parts: readonly unknown[]) {
  return JSON.stringify(parts);
}
