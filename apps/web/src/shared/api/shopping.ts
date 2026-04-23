import { http } from './http';

export type ShoppingItemResponse = {
  id: string;
  label: string;
  category: string;
  isCompleted: boolean;
  createdAtUtc: string;
  completedAtUtc: string | null;
  addedByProfileId: string | null;
};

export type CreateShoppingItemRequest = {
  label: string;
  category: string;
  addedByProfileId: string | null;
};

export async function fetchShoppingItems(accessToken: string) {
  return http<ShoppingItemResponse[]>('/api/v1/shopping', {
    method: 'GET',
    accessToken,
  });
}

export async function createShoppingItem(accessToken: string, request: CreateShoppingItemRequest) {
  return http<ShoppingItemResponse>('/api/v1/shopping', {
    method: 'POST',
    accessToken,
    body: JSON.stringify(request),
  });
}

export async function updateShoppingItem(accessToken: string, itemId: string, isCompleted: boolean) {
  return http<ShoppingItemResponse>(`/api/v1/shopping/${itemId}`, {
    method: 'PUT',
    accessToken,
    body: JSON.stringify({ isCompleted }),
  });
}
