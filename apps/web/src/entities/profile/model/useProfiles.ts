import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';

import type { BootstrapResponse } from '../../../shared/api/bootstrap';
import {
  createProfile,
  fetchProfiles,
  updateProfile,
  type CreateProfileRequest,
  type ProfileResponse,
  type UpdateProfileRequest,
} from '../../../shared/api/profiles';
import { useAuthSession } from '../../../processes/auth-session/AuthSessionContext';

function profilesKey(accessToken: string | undefined) {
  return ['profiles', accessToken] as const;
}

function bootstrapKey(accessToken: string | undefined) {
  return ['bootstrap', accessToken] as const;
}

function updateBootstrapProfiles(
  bootstrap: BootstrapResponse | undefined,
  updateProfiles: (profiles: BootstrapResponse['profiles']) => BootstrapResponse['profiles'],
) {
  if (!bootstrap) {
    return bootstrap;
  }

  return {
    ...bootstrap,
    profiles: updateProfiles(bootstrap.profiles),
  };
}

export function useProfiles() {
  const { session } = useAuthSession();

  return useQuery({
    queryKey: profilesKey(session?.accessToken),
    queryFn: () => fetchProfiles(session!.accessToken),
    enabled: Boolean(session?.accessToken),
  });
}

export function useCreateProfile() {
  const queryClient = useQueryClient();
  const { session } = useAuthSession();
  const profilesQueryKey = profilesKey(session?.accessToken);
  const bootstrapQueryKey = bootstrapKey(session?.accessToken);

  return useMutation({
    mutationFn: (request: CreateProfileRequest) => createProfile(session!.accessToken, request),
    onMutate: async (request) => {
      await Promise.all([
        queryClient.cancelQueries({ queryKey: profilesQueryKey }),
        queryClient.cancelQueries({ queryKey: bootstrapQueryKey }),
      ]);

      const previousProfiles = queryClient.getQueryData<ProfileResponse[]>(profilesQueryKey);
      const previousBootstrap = queryClient.getQueryData<BootstrapResponse>(bootstrapQueryKey);
      const optimisticId = `profile-${crypto.randomUUID()}`;
      const optimisticProfile: ProfileResponse = {
        id: optimisticId,
        displayName: request.displayName,
        colorKey: request.colorKey,
        isActive: true,
        hasLogin: false,
      };

      queryClient.setQueryData<ProfileResponse[]>(profilesQueryKey, (profiles = []) => [...profiles, optimisticProfile]);
      queryClient.setQueryData<BootstrapResponse | undefined>(bootstrapQueryKey, (bootstrap) =>
        updateBootstrapProfiles(bootstrap, (profiles) => [...profiles, optimisticProfile]),
      );

      return { previousProfiles, previousBootstrap, optimisticId };
    },
    onError: (_error, _request, context) => {
      queryClient.setQueryData(profilesQueryKey, context?.previousProfiles);
      queryClient.setQueryData(bootstrapQueryKey, context?.previousBootstrap);
    },
    onSuccess: (profile, _request, context) => {
      queryClient.setQueryData<ProfileResponse[]>(profilesQueryKey, (profiles = []) =>
        profiles.map((currentProfile) => (currentProfile.id === context?.optimisticId ? profile : currentProfile)),
      );
      queryClient.setQueryData<BootstrapResponse | undefined>(bootstrapQueryKey, (bootstrap) =>
        updateBootstrapProfiles(bootstrap, (profiles) =>
          profiles.map((currentProfile) => (currentProfile.id === context?.optimisticId ? profile : currentProfile)),
        ),
      );
    },
    onSettled: async () => {
      await Promise.all([
        queryClient.invalidateQueries({ queryKey: profilesQueryKey }),
        queryClient.invalidateQueries({ queryKey: bootstrapQueryKey }),
      ]);
    },
  });
}

export function useUpdateProfile() {
  const queryClient = useQueryClient();
  const { session } = useAuthSession();
  const profilesQueryKey = profilesKey(session?.accessToken);
  const bootstrapQueryKey = bootstrapKey(session?.accessToken);

  return useMutation({
    mutationFn: ({ profileId, request }: { profileId: string; request: UpdateProfileRequest }) =>
      updateProfile(session!.accessToken, profileId, request),
    onMutate: async ({ profileId, request }) => {
      await Promise.all([
        queryClient.cancelQueries({ queryKey: profilesQueryKey }),
        queryClient.cancelQueries({ queryKey: bootstrapQueryKey }),
      ]);

      const previousProfiles = queryClient.getQueryData<ProfileResponse[]>(profilesQueryKey);
      const previousBootstrap = queryClient.getQueryData<BootstrapResponse>(bootstrapQueryKey);

      queryClient.setQueryData<ProfileResponse[]>(profilesQueryKey, (profiles = []) =>
        profiles.map((profile) => (profile.id === profileId ? { ...profile, ...request } : profile)),
      );
      queryClient.setQueryData<BootstrapResponse | undefined>(bootstrapQueryKey, (bootstrap) =>
        updateBootstrapProfiles(bootstrap, (profiles) =>
          profiles.map((profile) => (profile.id === profileId ? { ...profile, ...request } : profile)),
        ),
      );

      return { previousProfiles, previousBootstrap };
    },
    onError: (_error, _variables, context) => {
      queryClient.setQueryData(profilesQueryKey, context?.previousProfiles);
      queryClient.setQueryData(bootstrapQueryKey, context?.previousBootstrap);
    },
    onSuccess: (profile) => {
      queryClient.setQueryData<ProfileResponse[]>(profilesQueryKey, (profiles = []) =>
        profiles.map((currentProfile) => (currentProfile.id === profile.id ? profile : currentProfile)),
      );
      queryClient.setQueryData<BootstrapResponse | undefined>(bootstrapQueryKey, (bootstrap) =>
        updateBootstrapProfiles(bootstrap, (profiles) =>
          profiles.map((currentProfile) => (currentProfile.id === profile.id ? profile : currentProfile)),
        ),
      );
    },
    onSettled: async () => {
      await Promise.all([
        queryClient.invalidateQueries({ queryKey: profilesQueryKey }),
        queryClient.invalidateQueries({ queryKey: bootstrapQueryKey }),
      ]);
    },
  });
}
