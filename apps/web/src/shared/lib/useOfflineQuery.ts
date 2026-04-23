import { useQuery, type UseQueryOptions } from '@tanstack/react-query';

import { buildOfflineCacheKey, readOfflineCache, writeOfflineCache } from './offlineCache';

export function useOfflineQuery<TQueryFnData, TError = Error>(
  options: UseQueryOptions<TQueryFnData, TError, TQueryFnData, readonly unknown[]>,
) {
  const cacheKey = buildOfflineCacheKey(options.queryKey);
  const queryFn = options.queryFn;

  if (!queryFn || typeof queryFn !== 'function') {
    throw new Error('useOfflineQuery requires a concrete query function.');
  }

  return useQuery({
    ...options,
    meta: {
      ...(options.meta ?? {}),
      offlineCacheKey: cacheKey,
    },
    queryFn: async (context) => {
      try {
        const data = await queryFn(context);
        await writeOfflineCache(cacheKey, data);
        return data;
      } catch (error) {
        const cached = await readOfflineCache<TQueryFnData>(cacheKey);
        if (cached) {
          return cached.value;
        }

        throw error;
      }
    },
  });
}
