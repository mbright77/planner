import { useMutation, useQueryClient } from '@tanstack/react-query';

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
  type MealPlanResponse,
  type MealRequestResponse,
  type UpdateMealPlanRequest,
  type WeeklyMealsResponse,
} from '../../../shared/api/meals';
import { useAuthSession } from '../../../processes/auth-session/AuthSessionContext';
import { runOrQueueOfflineMutation } from '../../../shared/lib/offlineMutationQueue';
import { syncOfflineQueryData } from '../../../shared/lib/offlineQuerySync';
import { useOfflineQuery } from '../../../shared/lib/useOfflineQuery';
import { useNetworkStatus } from '../../../shared/lib/useNetworkStatus';

function mealsWeekKey(accessToken: string | undefined, weekStart: string) {
  return ['meals-week', accessToken, weekStart] as const;
}

function mealRequestsKey(accessToken: string | undefined, weekStart: string) {
  return ['meal-requests', accessToken, weekStart] as const;
}

function isDateInWeek(date: string, weekStart: string) {
  const weekStartDate = new Date(`${weekStart}T00:00:00.000Z`);
  const weekEndDate = new Date(weekStartDate);
  weekEndDate.setUTCDate(weekStartDate.getUTCDate() + 6);
  const weekEnd = weekEndDate.toISOString().slice(0, 10);

  return date >= weekStart && date <= weekEnd;
}

function sortMeals(meals: MealPlanResponse[]) {
  return [...meals].sort((left, right) => left.mealDate.localeCompare(right.mealDate));
}

function computeWeekStartFromDate(date: string) {
  const d = new Date(`${date}T00:00:00.000Z`);
  const day = d.getUTCDay();
  const diff = day === 0 ? -6 : 1 - day;
  d.setUTCDate(d.getUTCDate() + diff);
  return d.toISOString().slice(0, 10);
}

export function useMealsWeek(weekStart: string) {
  const { session } = useAuthSession();

  return useOfflineQuery({
    queryKey: mealsWeekKey(session?.accessToken, weekStart),
    queryFn: () => fetchMealsWeek(session!.accessToken, weekStart),
    enabled: Boolean(session?.accessToken),
  });
}

export function useCreateMealPlan(weekStart: string) {
  const { session } = useAuthSession();
  const queryClient = useQueryClient();
  const mealsQueryKey = mealsWeekKey(session?.accessToken, weekStart);

  return useMutation({
    mutationFn: (request: CreateMealPlanRequest) =>
      runOrQueueOfflineMutation(
        {
          kind: 'meal.create',
          accessToken: session!.accessToken,
          payload: request,
          invalidateKeys: [mealsQueryKey, ['dashboard-overview']],
        },
        () => createMealPlan(session!.accessToken, request),
      ),
    onMutate: async (request) => {
      await queryClient.cancelQueries({ queryKey: mealsQueryKey });

      const previousMeals = queryClient.getQueryData<WeeklyMealsResponse>(mealsQueryKey);
      const optimisticId = `meal-${crypto.randomUUID()}`;

      if (isDateInWeek(request.mealDate, weekStart)) {
        const optimisticMeal: MealPlanResponse = {
          id: optimisticId,
          mealDate: request.mealDate,
          title: request.title,
          notes: request.notes,
          ownerProfileId: request.ownerProfileId,
        };

        queryClient.setQueryData<WeeklyMealsResponse | undefined>(mealsQueryKey, (week) =>
          week
            ? {
                ...week,
                meals: sortMeals([
                  ...week.meals.filter((meal) => meal.mealDate !== request.mealDate),
                  optimisticMeal,
                ]),
              }
            : week,
        );
        await syncOfflineQueryData<WeeklyMealsResponse>(queryClient, mealsQueryKey);
      }

      return { previousMeals, optimisticId };
    },
    onError: async (_error, _request, context) => {
      queryClient.setQueryData(mealsQueryKey, context?.previousMeals);
      await syncOfflineQueryData<WeeklyMealsResponse>(queryClient, mealsQueryKey);
    },
    onSuccess: async (result, _request, context) => {
      if (result.status === 'queued') {
        return;
      }

      queryClient.setQueryData<WeeklyMealsResponse | undefined>(mealsQueryKey, (week) =>
        week
          ? {
            ...week,
            meals: sortMeals(
                week.meals.map((currentMeal) =>
                  currentMeal.id === context?.optimisticId ? result.data : currentMeal,
                ),
              ),
            }
          : week,
      );
      await syncOfflineQueryData<WeeklyMealsResponse>(queryClient, mealsQueryKey);
      // Ensure any canonical server week caches are refreshed too (server returns DateOnly mealDate)
      try {
        const canonicalWeekStart = computeWeekStartFromDate(result.data.mealDate);
        await invalidateMealQueries(queryClient, session?.accessToken, weekStart, canonicalWeekStart);
      } catch {
        // best-effort: swallow errors to avoid breaking UI flow
      }
    },
    onSettled: async () => {
      await Promise.all([
        queryClient.invalidateQueries({ queryKey: mealsQueryKey }),
        queryClient.invalidateQueries({ queryKey: ['dashboard-overview'] }),
      ]);
    },
  });
}

export function useMealRequests(weekStart: string) {
  const { session } = useAuthSession();
  const { isOnline } = useNetworkStatus();

  return useOfflineQuery({
    queryKey: mealRequestsKey(session?.accessToken, weekStart),
    queryFn: () => fetchMealRequests(session!.accessToken, weekStart),
    enabled: Boolean(session?.accessToken),
    refetchInterval: isOnline ? 30_000 : false,
  });
}

async function invalidateMealQueries(
  queryClient: ReturnType<typeof useQueryClient>,
  accessToken: string | undefined,
  weekStart: string,
  alsoInvalidateWeekStart?: string,
) {
  const promises: Promise<unknown>[] = [
    queryClient.invalidateQueries({ queryKey: mealsWeekKey(accessToken, weekStart) }),
    queryClient.invalidateQueries({ queryKey: mealRequestsKey(accessToken, weekStart) }),
    queryClient.invalidateQueries({ queryKey: ['dashboard-overview'] }),
  ];

  if (alsoInvalidateWeekStart && alsoInvalidateWeekStart !== weekStart) {
    promises.push(queryClient.invalidateQueries({ queryKey: mealsWeekKey(accessToken, alsoInvalidateWeekStart) }));
    promises.push(queryClient.invalidateQueries({ queryKey: mealRequestsKey(accessToken, alsoInvalidateWeekStart) }));
  }

  await Promise.all(promises);
}

export function useCreateMealRequest(weekStart: string) {
  const { session } = useAuthSession();
  const queryClient = useQueryClient();
  const requestsQueryKey = mealRequestsKey(session?.accessToken, weekStart);

  return useMutation({
    mutationFn: (request: CreateMealRequestRequest) =>
      runOrQueueOfflineMutation(
        {
          kind: 'meal-request.create',
          accessToken: session!.accessToken,
          payload: request,
          invalidateKeys: [requestsQueryKey, mealsWeekKey(session?.accessToken, weekStart), ['dashboard-overview']],
        },
        () => createMealRequest(session!.accessToken, request),
      ),
    onMutate: async (request) => {
      await queryClient.cancelQueries({ queryKey: requestsQueryKey });

      const previousRequests = queryClient.getQueryData<MealRequestResponse[]>(requestsQueryKey);
      const optimisticId = `meal-request-${crypto.randomUUID()}`;
      const optimisticRequest: MealRequestResponse = {
        id: optimisticId,
        requesterProfileId: null,
        requestedForDate: request.requestedForDate,
        title: request.title,
        notes: request.notes,
        status: 'Pending',
        assigneeProfileId: null,
        createdAtUtc: new Date().toISOString(),
      };

      queryClient.setQueryData<MealRequestResponse[]>(requestsQueryKey, (requests = []) => [optimisticRequest, ...requests]);
      await syncOfflineQueryData<MealRequestResponse[]>(queryClient, requestsQueryKey);

      return { previousRequests, optimisticId };
    },
    onError: async (_error, _request, context) => {
      queryClient.setQueryData(requestsQueryKey, context?.previousRequests);
      await syncOfflineQueryData<MealRequestResponse[]>(queryClient, requestsQueryKey);
    },
    onSuccess: async (result, _request, context) => {
      if (result.status === 'queued') {
        return;
      }

      queryClient.setQueryData<MealRequestResponse[]>(requestsQueryKey, (requests = []) =>
        requests.map((currentRequest) =>
          currentRequest.id === context?.optimisticId ? result.data : currentRequest,
        ),
      );
      await syncOfflineQueryData<MealRequestResponse[]>(queryClient, requestsQueryKey);
    },
    onSettled: async () => {
      await invalidateMealQueries(queryClient, session?.accessToken, weekStart);
    },
  });
}

export function useAssignMealRequest(weekStart: string) {
  const { session } = useAuthSession();
  const queryClient = useQueryClient();
  const requestsQueryKey = mealRequestsKey(session?.accessToken, weekStart);

  return useMutation({
    mutationFn: ({ requestId, assigneeProfileId }: { requestId: string; assigneeProfileId: string | null }) =>
      runOrQueueOfflineMutation(
        {
          kind: 'meal-request.assign',
          accessToken: session!.accessToken,
          payload: { requestId, assigneeProfileId },
          invalidateKeys: [requestsQueryKey, mealsWeekKey(session?.accessToken, weekStart), ['dashboard-overview']],
        },
        () => assignMealRequest(session!.accessToken, requestId, assigneeProfileId),
      ),
    onMutate: async ({ requestId, assigneeProfileId }) => {
      await queryClient.cancelQueries({ queryKey: requestsQueryKey });

      const previousRequests = queryClient.getQueryData<MealRequestResponse[]>(requestsQueryKey);

      queryClient.setQueryData<MealRequestResponse[]>(requestsQueryKey, (requests = []) =>
        requests.map((request) =>
          request.id === requestId ? { ...request, assigneeProfileId } : request,
        ),
      );
      await syncOfflineQueryData<MealRequestResponse[]>(queryClient, requestsQueryKey);

      return { previousRequests };
    },
    onError: async (_error, _variables, context) => {
      queryClient.setQueryData(requestsQueryKey, context?.previousRequests);
      await syncOfflineQueryData<MealRequestResponse[]>(queryClient, requestsQueryKey);
    },
    onSuccess: async (result) => {
      if (result.status === 'queued') {
        return;
      }

      queryClient.setQueryData<MealRequestResponse[]>(requestsQueryKey, (requests = []) =>
        requests.map((currentRequest) =>
          currentRequest.id === result.data.id ? result.data : currentRequest,
        ),
      );
      await syncOfflineQueryData<MealRequestResponse[]>(queryClient, requestsQueryKey);
    },
    onSettled: async () => {
      await invalidateMealQueries(queryClient, session?.accessToken, weekStart);
    },
  });
}

export function useAcceptMealRequest(weekStart: string) {
  const { session } = useAuthSession();
  const queryClient = useQueryClient();
  const requestsQueryKey = mealRequestsKey(session?.accessToken, weekStart);
  const mealsQueryKey = mealsWeekKey(session?.accessToken, weekStart);

  return useMutation({
    mutationFn: (requestId: string) =>
      runOrQueueOfflineMutation(
        {
          kind: 'meal-request.accept',
          accessToken: session!.accessToken,
          payload: { requestId },
          invalidateKeys: [requestsQueryKey, mealsQueryKey, ['dashboard-overview']],
        },
        () => acceptMealRequest(session!.accessToken, requestId),
      ),
    onMutate: async (requestId) => {
      await Promise.all([
        queryClient.cancelQueries({ queryKey: requestsQueryKey }),
        queryClient.cancelQueries({ queryKey: mealsQueryKey }),
      ]);

      const previousRequests = queryClient.getQueryData<MealRequestResponse[]>(requestsQueryKey);
      const previousMeals = queryClient.getQueryData<WeeklyMealsResponse>(mealsQueryKey);
      const acceptedRequest = previousRequests?.find((request) => request.id === requestId);

      queryClient.setQueryData<MealRequestResponse[]>(requestsQueryKey, (requests = []) =>
        requests.filter((request) => request.id !== requestId),
      );

      if (acceptedRequest?.requestedForDate && isDateInWeek(acceptedRequest.requestedForDate, weekStart)) {
        const optimisticMeal: MealPlanResponse = {
          id: `accepted-meal-${requestId}`,
          mealDate: acceptedRequest.requestedForDate,
          title: acceptedRequest.title,
          notes: acceptedRequest.notes,
          ownerProfileId: acceptedRequest.assigneeProfileId,
        };

        queryClient.setQueryData<WeeklyMealsResponse | undefined>(mealsQueryKey, (week) =>
          week
            ? {
                ...week,
                meals: sortMeals([
                  ...week.meals.filter((meal) => meal.mealDate !== acceptedRequest.requestedForDate),
                  optimisticMeal,
                ]),
              }
            : week,
        );
      }

      await Promise.all([
        syncOfflineQueryData<MealRequestResponse[]>(queryClient, requestsQueryKey),
        syncOfflineQueryData<WeeklyMealsResponse>(queryClient, mealsQueryKey),
      ]);

      return { previousRequests, previousMeals };
    },
    onError: async (_error, _requestId, context) => {
      queryClient.setQueryData(requestsQueryKey, context?.previousRequests);
      queryClient.setQueryData(mealsQueryKey, context?.previousMeals);
      await Promise.all([
        syncOfflineQueryData<MealRequestResponse[]>(queryClient, requestsQueryKey),
        syncOfflineQueryData<WeeklyMealsResponse>(queryClient, mealsQueryKey),
      ]);
    },
    onSuccess: async (result) => {
      if (result.status === 'queued') {
        return;
      }

      // If accepting created a meal for a requested date, ensure the canonical week is refreshed
      try {
        const requestedFor = result.data.requestedForDate;
        if (requestedFor) {
          const canonicalWeekStart = computeWeekStartFromDate(requestedFor);
          await invalidateMealQueries(queryClient, session?.accessToken, weekStart, canonicalWeekStart);
        }
      } catch {
        // ignore
      }
    },
    onSettled: async () => {
      await invalidateMealQueries(queryClient, session?.accessToken, weekStart);
    },
  });
}

export function useUpdateMealPlan(weekStart: string) {
  const { session } = useAuthSession();
  const queryClient = useQueryClient();
  const mealsQueryKey = mealsWeekKey(session?.accessToken, weekStart);

  return useMutation({
    mutationFn: ({ mealId, request }: { mealId: string; request: UpdateMealPlanRequest }) =>
      runOrQueueOfflineMutation(
        {
          kind: 'meal.update',
          accessToken: session!.accessToken,
          payload: { mealId, request },
          invalidateKeys: [mealsQueryKey, mealRequestsKey(session?.accessToken, weekStart), ['dashboard-overview']],
        },
        () => updateMealPlan(session!.accessToken, mealId, request),
      ),
    onMutate: async ({ mealId, request }) => {
      await queryClient.cancelQueries({ queryKey: mealsQueryKey });

      const previousMeals = queryClient.getQueryData<WeeklyMealsResponse>(mealsQueryKey);

      queryClient.setQueryData<WeeklyMealsResponse | undefined>(mealsQueryKey, (week) => {
        if (!week) {
          return week;
        }

        const remainingMeals = week.meals.filter((meal) => meal.id !== mealId);
        const nextMeals = isDateInWeek(request.mealDate, weekStart)
          ? sortMeals([
              ...remainingMeals.filter((meal) => meal.mealDate !== request.mealDate),
              {
                id: mealId,
                mealDate: request.mealDate,
                title: request.title,
                notes: request.notes,
                ownerProfileId: request.ownerProfileId,
              },
            ])
          : remainingMeals;

        return {
          ...week,
          meals: nextMeals,
        };
      });
      await syncOfflineQueryData<WeeklyMealsResponse>(queryClient, mealsQueryKey);

      return { previousMeals };
    },
    onError: async (_error, _variables, context) => {
      queryClient.setQueryData(mealsQueryKey, context?.previousMeals);
      await syncOfflineQueryData<WeeklyMealsResponse>(queryClient, mealsQueryKey);
    },
    onSuccess: async (result) => {
      if (result.status === 'queued') {
        return;
      }

      queryClient.setQueryData<WeeklyMealsResponse | undefined>(mealsQueryKey, (week) => {
        if (!week) {
          return week;
        }

        const remainingMeals = week.meals.filter((currentMeal) => currentMeal.id !== result.data.id);

        return {
          ...week,
          meals: isDateInWeek(result.data.mealDate, weekStart)
            ? sortMeals([
                ...remainingMeals.filter((currentMeal) => currentMeal.mealDate !== result.data.mealDate),
                result.data,
              ])
            : remainingMeals,
        };
      });
      await syncOfflineQueryData<WeeklyMealsResponse>(queryClient, mealsQueryKey);
      try {
        const canonicalWeekStart = computeWeekStartFromDate(result.data.mealDate);
        await invalidateMealQueries(queryClient, session?.accessToken, weekStart, canonicalWeekStart);
      } catch {
        // ignore
      }
    },
    onSettled: async () => {
      await invalidateMealQueries(queryClient, session?.accessToken, weekStart);
    },
  });
}
