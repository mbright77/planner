import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';

import {
  acceptMealRequest,
  assignMealRequest,
  createMealPlan,
  createMealRequest,
  fetchMealRequests,
  fetchMealsWeek,
  updateMealPlan,
  type CreateMealPlanRequest,
  type CreateMealRequestRequest,
  type UpdateMealPlanRequest,
} from '../../../shared/api/meals';
import { useAuthSession } from '../../../processes/auth-session/AuthSessionContext';

export function useMealsWeek(weekStart: string) {
  const { session } = useAuthSession();

  return useQuery({
    queryKey: ['meals-week', session?.accessToken, weekStart],
    queryFn: () => fetchMealsWeek(session!.accessToken, weekStart),
    enabled: Boolean(session?.accessToken),
  });
}

export function useCreateMealPlan(weekStart: string) {
  const { session } = useAuthSession();
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: (request: CreateMealPlanRequest) => createMealPlan(session!.accessToken, request),
    onSuccess: async () => {
      await queryClient.invalidateQueries({ queryKey: ['meals-week', session?.accessToken, weekStart] });
    },
  });
}

export function useMealRequests(weekStart: string) {
  const { session } = useAuthSession();

  return useQuery({
    queryKey: ['meal-requests', session?.accessToken, weekStart],
    queryFn: () => fetchMealRequests(session!.accessToken, weekStart),
    enabled: Boolean(session?.accessToken),
  });
}

async function invalidateMealQueries(
  queryClient: ReturnType<typeof useQueryClient>,
  accessToken: string | undefined,
  weekStart: string,
) {
  await Promise.all([
    queryClient.invalidateQueries({ queryKey: ['meals-week', accessToken, weekStart] }),
    queryClient.invalidateQueries({ queryKey: ['meal-requests', accessToken, weekStart] }),
  ]);
}

export function useCreateMealRequest(weekStart: string) {
  const { session } = useAuthSession();
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: (request: CreateMealRequestRequest) => createMealRequest(session!.accessToken, request),
    onSuccess: async () => {
      await invalidateMealQueries(queryClient, session?.accessToken, weekStart);
    },
  });
}

export function useAssignMealRequest(weekStart: string) {
  const { session } = useAuthSession();
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: ({ requestId, assigneeProfileId }: { requestId: string; assigneeProfileId: string | null }) =>
      assignMealRequest(session!.accessToken, requestId, assigneeProfileId),
    onSuccess: async () => {
      await invalidateMealQueries(queryClient, session?.accessToken, weekStart);
    },
  });
}

export function useAcceptMealRequest(weekStart: string) {
  const { session } = useAuthSession();
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: (requestId: string) => acceptMealRequest(session!.accessToken, requestId),
    onSuccess: async () => {
      await invalidateMealQueries(queryClient, session?.accessToken, weekStart);
    },
  });
}

export function useUpdateMealPlan(weekStart: string) {
  const { session } = useAuthSession();
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: ({ mealId, request }: { mealId: string; request: UpdateMealPlanRequest }) =>
      updateMealPlan(session!.accessToken, mealId, request),
    onSuccess: async () => {
      await invalidateMealQueries(queryClient, session?.accessToken, weekStart);
    },
  });
}
