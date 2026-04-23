import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';

import {
  createShoppingItem,
  fetchShoppingItems,
  updateShoppingItem,
  type CreateShoppingItemRequest,
  type ShoppingItemResponse,
} from '../../../shared/api/shopping';
import { useAuthSession } from '../../../processes/auth-session/AuthSessionContext';

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

  return useQuery({
    queryKey: shoppingItemsKey(session?.accessToken),
    queryFn: () => fetchShoppingItems(session!.accessToken),
    enabled: Boolean(session?.accessToken),
  });
}

export function useCreateShoppingItem() {
  const { session } = useAuthSession();
  const queryClient = useQueryClient();
  const queryKey = shoppingItemsKey(session?.accessToken);

  return useMutation({
    mutationFn: (request: CreateShoppingItemRequest) => createShoppingItem(session!.accessToken, request),
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

      return { previousItems, optimisticId };
    },
    onError: (_error, _request, context) => {
      queryClient.setQueryData(queryKey, context?.previousItems);
    },
    onSuccess: (item, _request, context) => {
      queryClient.setQueryData<ShoppingItemResponse[]>(queryKey, (items = []) =>
        items.map((currentItem) => (currentItem.id === context?.optimisticId ? item : currentItem)),
      );
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
      updateShoppingItem(session!.accessToken, itemId, isCompleted),
    onMutate: async ({ itemId, isCompleted }) => {
      await queryClient.cancelQueries({ queryKey });

      const previousItems = queryClient.getQueryData<ShoppingItemResponse[]>(queryKey);

      queryClient.setQueryData<ShoppingItemResponse[]>(queryKey, (items) =>
        applyShoppingItemUpdate(items, itemId, isCompleted),
      );

      return { previousItems };
    },
    onError: (_error, _variables, context) => {
      queryClient.setQueryData(queryKey, context?.previousItems);
    },
    onSuccess: (item) => {
      queryClient.setQueryData<ShoppingItemResponse[]>(queryKey, (items = []) =>
        items.map((currentItem) => (currentItem.id === item.id ? item : currentItem)),
      );
    },
    onSettled: async () => {
      await Promise.all([
        queryClient.invalidateQueries({ queryKey }),
        queryClient.invalidateQueries({ queryKey: ['dashboard-overview'] }),
      ]);
    },
  });
}
