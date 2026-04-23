import { http } from './http';

export type ProfileResponse = {
  id: string;
  displayName: string;
  colorKey: string;
  isActive: boolean;
};

export type CreateProfileRequest = {
  displayName: string;
  colorKey: string;
};

export type UpdateProfileRequest = {
  displayName: string;
  colorKey: string;
  isActive: boolean;
};

export async function fetchProfiles(accessToken: string) {
  return http<ProfileResponse[]>('/api/v1/profiles', {
    method: 'GET',
    accessToken,
  });
}

export async function createProfile(accessToken: string, request: CreateProfileRequest) {
  return http<ProfileResponse>('/api/v1/profiles', {
    method: 'POST',
    accessToken,
    body: JSON.stringify(request),
  });
}

export async function updateProfile(
  accessToken: string,
  profileId: string,
  request: UpdateProfileRequest,
) {
  return http<ProfileResponse>(`/api/v1/profiles/${profileId}`, {
    method: 'PUT',
    accessToken,
    body: JSON.stringify(request),
  });
}
