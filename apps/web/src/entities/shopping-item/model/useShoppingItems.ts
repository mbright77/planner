import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';

import {
  createShoppingItem,
  fetchShoppingItems,
  updateShoppingItem,
  type CreateShoppingItemRequest,
} from '../../../shared/api/shopping';
import { useAuthSession } from '../../../processes/auth-session/AuthSessionContext';

export function useShoppingItems() {
  const { session } = useAuthSession();

  return useQuery({
    queryKey: ['shopping-items', session?.accessToken],
    queryFn: () => fetchShoppingItems(session!.accessToken),
    enabled: Boolean(session?.accessToken),
  });
}

export function useCreateShoppingItem() {
  const { session } = useAuthSession();
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: (request: CreateShoppingItemRequest) => createShoppingItem(session!.accessToken, request),
    onSuccess: async () => {
      await queryClient.invalidateQueries({ queryKey: ['shopping-items'] });
    },
  });
}

export function useUpdateShoppingItem() {
  const { session } = useAuthSession();
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: ({ itemId, isCompleted }: { itemId: string; isCompleted: boolean }) =>
      updateShoppingItem(session!.accessToken, itemId, isCompleted),
    onSuccess: async () => {
      await queryClient.invalidateQueries({ queryKey: ['shopping-items'] });
    },
  });
}
