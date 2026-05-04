import { useQuery, type UseQueryOptions } from '@tanstack/react-query';
import { ApiError } from '@planner/api-client';

import { HttpError } from '../api/http';
import { buildOfflineCacheKey, readOfflineCache, writeOfflineCache } from './offlineCache';

function isUnauthorizedError(error: unknown) {
  if (error instanceof ApiError || error instanceof HttpError) {
    return error.status === 401 || error.status === 403;
  }

  return false;
}

function isOfflineNetworkError(error: unknown) {
  return error instanceof TypeError && !window.navigator.onLine;
}

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
        if (isUnauthorizedError(error)) {
          throw error;
        }

        if (!isOfflineNetworkError(error)) {
          throw error;
        }

        const cached = await readOfflineCache<TQueryFnData>(cacheKey);
        if (cached) {
          return cached.value;
        }

        throw error;
      }
    },
  });
}
