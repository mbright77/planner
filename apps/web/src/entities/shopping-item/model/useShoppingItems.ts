import { useMutation, useQueryClient } from '@tanstack/react-query';

import {
  createShoppingItem,
  deleteShoppingItem,
  fetchShoppingItems,
  updateShoppingItem,
  type CreateShoppingItemRequest,
  type ShoppingItemResponse,
} from '../../../shared/api/shopping';
import { useAuthSession } from '../../../processes/auth-session/AuthSessionContext';
import { runOrQueueOfflineMutation } from '../../../shared/lib/offlineMutationQueue';
import { syncOfflineQueryData } from '../../../shared/lib/offlineQuerySync';
import { useOfflineQuery } from '../../../shared/lib/useOfflineQuery';
import { useNetworkStatus } from '../../../shared/lib/useNetworkStatus';

function shoppingItemsKey(accessToken: string | undefined) {
  return ['shopping-items', accessToken] as const;
}

function applyShoppingItemUpdate(
  items: ShoppingItemResponse[] | undefined,
  itemId: string,
  isCompleted: boolean,
) {
  if (!items) {
    return items;
  }

  return items.map((item) =>
    item.id === itemId
      ? {
          ...item,
          isCompleted,
          completedAtUtc: isCompleted ? new Date().toISOString() : null,
        }
      : item,
  );
}

export function useShoppingItems() {
  const { session } = useAuthSession();
  const { isOnline } = useNetworkStatus();

  return useOfflineQuery({
    queryKey: shoppingItemsKey(session?.accessToken),
    queryFn: () => fetchShoppingItems(session!.accessToken),
    enabled: Boolean(session?.accessToken),
    refetchInterval: isOnline ? 30_000 : false,
  });
}

export function useCreateShoppingItem() {
  const { session } = useAuthSession();
  const queryClient = useQueryClient();
  const queryKey = shoppingItemsKey(session?.accessToken);

  return useMutation({
    mutationFn: (request: CreateShoppingItemRequest) =>
      runOrQueueOfflineMutation(
        {
          kind: 'shopping.create',
          accessToken: session!.accessToken,
          payload: request,
          invalidateKeys: [queryKey, ['dashboard-overview']],
        },
        () => createShoppingItem(session!.accessToken, request),
      ),
    onMutate: async (request) => {
      await queryClient.cancelQueries({ queryKey });

      const previousItems = queryClient.getQueryData<ShoppingItemResponse[]>(queryKey);
      const optimisticId = `shopping-${crypto.randomUUID()}`;
      const optimisticItem: ShoppingItemResponse = {
        id: optimisticId,
        label: request.label,
        category: request.category,
        isCompleted: false,
        createdAtUtc: new Date().toISOString(),
        completedAtUtc: null,
        addedByProfileId: request.addedByProfileId,
      };

      queryClient.setQueryData<ShoppingItemResponse[]>(queryKey, (items = []) => [...items, optimisticItem]);
      await syncOfflineQueryData<ShoppingItemResponse[]>(queryClient, queryKey);

      return { previousItems, optimisticId };
    },
    onError: async (_error, _request, context) => {
      queryClient.setQueryData(queryKey, context?.previousItems);
      await syncOfflineQueryData<ShoppingItemResponse[]>(queryClient, queryKey);
    },
    onSuccess: async (result, _request, context) => {
      if (result.status === 'queued') {
        return;
      }

      queryClient.setQueryData<ShoppingItemResponse[]>(queryKey, (items = []) =>
        items.map((currentItem) => (currentItem.id === context?.optimisticId ? result.data : currentItem)),
      );
      await syncOfflineQueryData<ShoppingItemResponse[]>(queryClient, queryKey);
    },
    onSettled: async () => {
      await Promise.all([
        queryClient.invalidateQueries({ queryKey }),
        queryClient.invalidateQueries({ queryKey: ['dashboard-overview'] }),
      ]);
    },
  });
}

export function useUpdateShoppingItem() {
  const { session } = useAuthSession();
  const queryClient = useQueryClient();
  const queryKey = shoppingItemsKey(session?.accessToken);

  return useMutation({
    mutationFn: ({ itemId, isCompleted }: { itemId: string; isCompleted: boolean }) =>
      runOrQueueOfflineMutation(
        {
          kind: 'shopping.update',
          accessToken: session!.accessToken,
          payload: { itemId, isCompleted },
          invalidateKeys: [queryKey, ['dashboard-overview']],
        },
        () => updateShoppingItem(session!.accessToken, itemId, isCompleted),
      ),
    onMutate: async ({ itemId, isCompleted }) => {
      await queryClient.cancelQueries({ queryKey });

      const previousItems = queryClient.getQueryData<ShoppingItemResponse[]>(queryKey);

      queryClient.setQueryData<ShoppingItemResponse[]>(queryKey, (items) =>
        applyShoppingItemUpdate(items, itemId, isCompleted),
      );
      await syncOfflineQueryData<ShoppingItemResponse[]>(queryClient, queryKey);

      return { previousItems };
    },
    onError: async (_error, _variables, context) => {
      queryClient.setQueryData(queryKey, context?.previousItems);
      await syncOfflineQueryData<ShoppingItemResponse[]>(queryClient, queryKey);
    },
    onSuccess: async (result) => {
      if (result.status === 'queued') {
        return;
      }

      queryClient.setQueryData<ShoppingItemResponse[]>(queryKey, (items = []) =>
        items.map((currentItem) => (currentItem.id === result.data.id ? result.data : currentItem)),
      );
      await syncOfflineQueryData<ShoppingItemResponse[]>(queryClient, queryKey);
    },
    onSettled: async () => {
      await Promise.all([
        queryClient.invalidateQueries({ queryKey }),
        queryClient.invalidateQueries({ queryKey: ['dashboard-overview'] }),
      ]);
    },
  });
}

export function useDeleteShoppingItem() {
  const { session } = useAuthSession();
  const queryClient = useQueryClient();
  const queryKey = shoppingItemsKey(session?.accessToken);

  return useMutation({
    mutationFn: (itemId: string) =>
      runOrQueueOfflineMutation(
        {
          kind: 'shopping.delete',
          accessToken: session!.accessToken,
          payload: { itemId },
          invalidateKeys: [queryKey, ['dashboard-overview']],
        },
        () => deleteShoppingItem(session!.accessToken, itemId),
      ),
    onMutate: async (itemId) => {
      await queryClient.cancelQueries({ queryKey });
      const previousItems = queryClient.getQueryData<ShoppingItemResponse[]>(queryKey);

      queryClient.setQueryData<ShoppingItemResponse[]>(queryKey, (items = []) =>
        items.filter((item) => item.id !== itemId),
      );
      await syncOfflineQueryData<ShoppingItemResponse[]>(queryClient, queryKey);

      return { previousItems };
    },
    onError: async (_error, _itemId, context) => {
      queryClient.setQueryData(queryKey, context?.previousItems);
      await syncOfflineQueryData<ShoppingItemResponse[]>(queryClient, queryKey);
    },
    onSettled: async () => {
      await Promise.all([
        queryClient.invalidateQueries({ queryKey }),
        queryClient.invalidateQueries({ queryKey: ['dashboard-overview'] }),
      ]);
    },
  });
}
