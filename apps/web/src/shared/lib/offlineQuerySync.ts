import type { QueryClient } from '@tanstack/react-query';

import { buildOfflineCacheKey, deleteOfflineCache, writeOfflineCache } from './offlineCache';

export async function syncOfflineQueryData<T>(queryClient: QueryClient, queryKey: readonly unknown[]) {
  const data = queryClient.getQueryData<T>(queryKey);

  if (data === undefined) {
    await deleteOfflineCache(buildOfflineCacheKey(queryKey));
    return;
  }

  await writeOfflineCache(buildOfflineCacheKey(queryKey), data);
}
