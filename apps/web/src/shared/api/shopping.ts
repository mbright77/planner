import {
  createShoppingItem as createShoppingItemRequest,
  getShoppingItems,
  updateShoppingItem as updateShoppingItemRequest,
  type CreateShoppingItemRequest,
  type ShoppingItemResponse,
} from '@planner/api-client';

import { env } from '../config/env';

export type { CreateShoppingItemRequest, ShoppingItemResponse };

export async function fetchShoppingItems(accessToken: string) {
  return getShoppingItems({ baseUrl: env.apiBaseUrl, accessToken });
}

export async function createShoppingItem(accessToken: string, request: CreateShoppingItemRequest) {
  return createShoppingItemRequest({ baseUrl: env.apiBaseUrl, accessToken }, request);
}

export async function updateShoppingItem(accessToken: string, itemId: string, isCompleted: boolean) {
  return updateShoppingItemRequest({ baseUrl: env.apiBaseUrl, accessToken }, itemId, { isCompleted });
}
