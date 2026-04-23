import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';

import { useAuthSession } from '../../../processes/auth-session/AuthSessionContext';
import {
  createFamilyInvite,
  fetchFamilyInvites,
  type CreateFamilyInviteRequest,
  type FamilyInviteResponse,
} from '../../../shared/api/invites';

function familyInvitesKey(accessToken: string | undefined) {
  return ['family-invites', accessToken] as const;
}

export function useFamilyInvites() {
  const { session } = useAuthSession();

  return useQuery({
    queryKey: familyInvitesKey(session?.accessToken),
    queryFn: () => fetchFamilyInvites(session!.accessToken),
    enabled: Boolean(session?.accessToken),
  });
}

export function useCreateFamilyInvite() {
  const { session } = useAuthSession();
  const queryClient = useQueryClient();
  const queryKey = familyInvitesKey(session?.accessToken);

  return useMutation({
    mutationFn: (request: CreateFamilyInviteRequest) => createFamilyInvite(session!.accessToken, request),
    onMutate: async (request) => {
      await queryClient.cancelQueries({ queryKey });

      const previousInvites = queryClient.getQueryData<FamilyInviteResponse[]>(queryKey);
      const optimisticInvite: FamilyInviteResponse = {
        id: `invite-${crypto.randomUUID()}`,
        email: request.email,
        token: 'pending',
        createdAtUtc: new Date().toISOString(),
        expiresAtUtc: new Date(Date.now() + 7 * 24 * 60 * 60 * 1000).toISOString(),
        isAccepted: false,
      };

      queryClient.setQueryData<FamilyInviteResponse[]>(queryKey, (invites = []) => [optimisticInvite, ...invites]);

      return { previousInvites, optimisticId: optimisticInvite.id };
    },
    onError: (_error, _request, context) => {
      queryClient.setQueryData(queryKey, context?.previousInvites);
    },
    onSuccess: (invite, _request, context) => {
      queryClient.setQueryData<FamilyInviteResponse[]>(queryKey, (invites = []) =>
        invites.map((currentInvite) => (currentInvite.id === context?.optimisticId ? invite : currentInvite)),
      );
    },
    onSettled: async () => {
      await queryClient.invalidateQueries({ queryKey });
    },
  });
}
