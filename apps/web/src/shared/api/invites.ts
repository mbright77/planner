import {
  acceptFamilyInvite as acceptFamilyInviteRequest,
  createFamilyInvite as createFamilyInviteRequest,
  getFamilyInvite,
  getFamilyInvites,
  type AcceptFamilyInviteRequest,
  type AuthResponse,
  type CreateFamilyInviteRequest,
  type FamilyInviteDetailsResponse,
  type FamilyInviteResponse,
} from '@planner/api-client';

import { env } from '../config/env';

export type {
  AcceptFamilyInviteRequest,
  AuthResponse,
  CreateFamilyInviteRequest,
  FamilyInviteDetailsResponse,
  FamilyInviteResponse,
};

export async function fetchFamilyInvites(accessToken: string) {
  return getFamilyInvites({ baseUrl: env.apiBaseUrl, accessToken });
}

export async function createFamilyInvite(accessToken: string, request: CreateFamilyInviteRequest) {
  return createFamilyInviteRequest({ baseUrl: env.apiBaseUrl, accessToken }, request);
}

export async function fetchFamilyInvite(token: string) {
  return getFamilyInvite({ baseUrl: env.apiBaseUrl }, token);
}

export async function acceptFamilyInvite(token: string, request: AcceptFamilyInviteRequest) {
  return acceptFamilyInviteRequest({ baseUrl: env.apiBaseUrl }, token, request);
}
