import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';

import {
  createProfile,
  fetchProfiles,
  updateProfile,
  type CreateProfileRequest,
  type UpdateProfileRequest,
} from '../../../shared/api/profiles';
import { useAuthSession } from '../../../processes/auth-session/AuthSessionContext';

export function useProfiles() {
  const { session } = useAuthSession();

  return useQuery({
    queryKey: ['profiles', session?.accessToken],
    queryFn: () => fetchProfiles(session!.accessToken),
    enabled: Boolean(session?.accessToken),
  });
}

export function useCreateProfile() {
  const queryClient = useQueryClient();
  const { session } = useAuthSession();

  return useMutation({
    mutationFn: (request: CreateProfileRequest) => createProfile(session!.accessToken, request),
    onSuccess: async () => {
      await queryClient.invalidateQueries({ queryKey: ['profiles'] });
      await queryClient.invalidateQueries({ queryKey: ['bootstrap'] });
    },
  });
}

export function useUpdateProfile() {
  const queryClient = useQueryClient();
  const { session } = useAuthSession();

  return useMutation({
    mutationFn: ({ profileId, request }: { profileId: string; request: UpdateProfileRequest }) =>
      updateProfile(session!.accessToken, profileId, request),
    onSuccess: async () => {
      await queryClient.invalidateQueries({ queryKey: ['profiles'] });
      await queryClient.invalidateQueries({ queryKey: ['bootstrap'] });
    },
  });
}
