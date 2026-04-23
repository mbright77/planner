import {
  createProfile as createProfileRequest,
  getProfiles,
  updateProfile as updateProfileRequest,
  type CreateProfileRequest,
  type ProfileResponse,
  type UpdateProfileRequest,
} from '@planner/api-client';

import { env } from '../config/env';

export type { CreateProfileRequest, ProfileResponse, UpdateProfileRequest };

export async function fetchProfiles(accessToken: string) {
  return getProfiles({ baseUrl: env.apiBaseUrl, accessToken });
}

export async function createProfile(accessToken: string, request: CreateProfileRequest) {
  return createProfileRequest({ baseUrl: env.apiBaseUrl, accessToken }, request);
}

export async function updateProfile(
  accessToken: string,
  profileId: string,
  request: UpdateProfileRequest,
) {
  return updateProfileRequest({ baseUrl: env.apiBaseUrl, accessToken }, profileId, request);
}
