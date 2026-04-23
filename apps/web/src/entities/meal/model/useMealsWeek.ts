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
import { useOfflineQuery } from '../../../shared/lib/useOfflineQuery';

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
    mutationFn: (request: CreateMealPlanRequest) => createMealPlan(session!.accessToken, request),
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
      }

      return { previousMeals, optimisticId };
    },
    onError: (_error, _request, context) => {
      queryClient.setQueryData(mealsQueryKey, context?.previousMeals);
    },
    onSuccess: (meal, _request, context) => {
      queryClient.setQueryData<WeeklyMealsResponse | undefined>(mealsQueryKey, (week) =>
        week
          ? {
              ...week,
              meals: sortMeals(
                week.meals.map((currentMeal) => (currentMeal.id === context?.optimisticId ? meal : currentMeal)),
              ),
            }
          : week,
      );
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

  return useOfflineQuery({
    queryKey: mealRequestsKey(session?.accessToken, weekStart),
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
    queryClient.invalidateQueries({ queryKey: mealsWeekKey(accessToken, weekStart) }),
    queryClient.invalidateQueries({ queryKey: mealRequestsKey(accessToken, weekStart) }),
    queryClient.invalidateQueries({ queryKey: ['dashboard-overview'] }),
  ]);
}

export function useCreateMealRequest(weekStart: string) {
  const { session } = useAuthSession();
  const queryClient = useQueryClient();
  const requestsQueryKey = mealRequestsKey(session?.accessToken, weekStart);

  return useMutation({
    mutationFn: (request: CreateMealRequestRequest) => createMealRequest(session!.accessToken, request),
    onMutate: async (request) => {
      await queryClient.cancelQueries({ queryKey: requestsQueryKey });

      const previousRequests = queryClient.getQueryData<MealRequestResponse[]>(requestsQueryKey);
      const optimisticId = `meal-request-${crypto.randomUUID()}`;
      const optimisticRequest: MealRequestResponse = {
        id: optimisticId,
        requesterProfileId: request.requesterProfileId,
        requestedForDate: request.requestedForDate,
        title: request.title,
        notes: request.notes,
        status: 'Pending',
        assigneeProfileId: null,
        createdAtUtc: new Date().toISOString(),
      };

      queryClient.setQueryData<MealRequestResponse[]>(requestsQueryKey, (requests = []) => [optimisticRequest, ...requests]);

      return { previousRequests, optimisticId };
    },
    onError: (_error, _request, context) => {
      queryClient.setQueryData(requestsQueryKey, context?.previousRequests);
    },
    onSuccess: (mealRequest, _request, context) => {
      queryClient.setQueryData<MealRequestResponse[]>(requestsQueryKey, (requests = []) =>
        requests.map((currentRequest) => (currentRequest.id === context?.optimisticId ? mealRequest : currentRequest)),
      );
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
      assignMealRequest(session!.accessToken, requestId, assigneeProfileId),
    onMutate: async ({ requestId, assigneeProfileId }) => {
      await queryClient.cancelQueries({ queryKey: requestsQueryKey });

      const previousRequests = queryClient.getQueryData<MealRequestResponse[]>(requestsQueryKey);

      queryClient.setQueryData<MealRequestResponse[]>(requestsQueryKey, (requests = []) =>
        requests.map((request) =>
          request.id === requestId ? { ...request, assigneeProfileId } : request,
        ),
      );

      return { previousRequests };
    },
    onError: (_error, _variables, context) => {
      queryClient.setQueryData(requestsQueryKey, context?.previousRequests);
    },
    onSuccess: (mealRequest) => {
      queryClient.setQueryData<MealRequestResponse[]>(requestsQueryKey, (requests = []) =>
        requests.map((currentRequest) => (currentRequest.id === mealRequest.id ? mealRequest : currentRequest)),
      );
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
    mutationFn: (requestId: string) => acceptMealRequest(session!.accessToken, requestId),
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

      return { previousRequests, previousMeals };
    },
    onError: (_error, _requestId, context) => {
      queryClient.setQueryData(requestsQueryKey, context?.previousRequests);
      queryClient.setQueryData(mealsQueryKey, context?.previousMeals);
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
      updateMealPlan(session!.accessToken, mealId, request),
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

      return { previousMeals };
    },
    onError: (_error, _variables, context) => {
      queryClient.setQueryData(mealsQueryKey, context?.previousMeals);
    },
    onSuccess: (meal) => {
      queryClient.setQueryData<WeeklyMealsResponse | undefined>(mealsQueryKey, (week) => {
        if (!week) {
          return week;
        }

        const remainingMeals = week.meals.filter((currentMeal) => currentMeal.id !== meal.id);

        return {
          ...week,
          meals: isDateInWeek(meal.mealDate, weekStart)
            ? sortMeals([...remainingMeals.filter((currentMeal) => currentMeal.mealDate !== meal.mealDate), meal])
            : remainingMeals,
        };
      });
    },
    onSettled: async () => {
      await invalidateMealQueries(queryClient, session?.accessToken, weekStart);
    },
  });
}
