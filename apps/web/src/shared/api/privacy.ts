import {
  deleteAccount as deleteAccountRequest,
  deleteFamily as deleteFamilyRequest,
  type DeleteAccountRequest,
  type DeleteFamilyRequest,
} from '@planner/api-client';

import { env } from '../config/env';

export type { DeleteAccountRequest, DeleteFamilyRequest };

export async function deleteAccount(accessToken: string, request: DeleteAccountRequest) {
  return deleteAccountRequest({ baseUrl: env.apiBaseUrl, accessToken }, request);
}

export async function deleteFamily(accessToken: string, request: DeleteFamilyRequest) {
  return deleteFamilyRequest({ baseUrl: env.apiBaseUrl, accessToken }, request);
}
