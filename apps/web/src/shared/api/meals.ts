import { http } from './http';

export type MealPlanResponse = {
  id: string;
  mealDate: string;
  title: string;
  notes: string | null;
  ownerProfileId: string | null;
};

export type WeeklyMealsResponse = {
  weekStart: string;
  weekEnd: string;
  meals: MealPlanResponse[];
};

export type CreateMealPlanRequest = {
  mealDate: string;
  title: string;
  notes: string | null;
  ownerProfileId: string | null;
};

export type UpdateMealPlanRequest = CreateMealPlanRequest;

export type MealRequestResponse = {
  id: string;
  requesterProfileId: string | null;
  requestedForDate: string | null;
  title: string;
  notes: string | null;
  status: string;
  assigneeProfileId: string | null;
  createdAtUtc: string;
};

export type CreateMealRequestRequest = {
  requesterProfileId: string | null;
  requestedForDate: string | null;
  title: string;
  notes: string | null;
};

export async function fetchMealsWeek(accessToken: string, weekStart: string) {
  return http<WeeklyMealsResponse>(`/api/v1/meals/week?start=${weekStart}`, {
    method: 'GET',
    accessToken,
  });
}

export async function createMealPlan(accessToken: string, request: CreateMealPlanRequest) {
  return http<MealPlanResponse>('/api/v1/meals', {
    method: 'POST',
    accessToken,
    body: JSON.stringify(request),
  });
}

export async function updateMealPlan(accessToken: string, mealId: string, request: UpdateMealPlanRequest) {
  return http<MealPlanResponse>(`/api/v1/meals/${mealId}`, {
    method: 'PUT',
    accessToken,
    body: JSON.stringify(request),
  });
}

export async function fetchMealRequests(accessToken: string, weekStart: string) {
  return http<MealRequestResponse[]>(`/api/v1/meals/requests?start=${weekStart}`, {
    method: 'GET',
    accessToken,
  });
}

export async function createMealRequest(accessToken: string, request: CreateMealRequestRequest) {
  return http<MealRequestResponse>('/api/v1/meals/requests', {
    method: 'POST',
    accessToken,
    body: JSON.stringify(request),
  });
}

export async function assignMealRequest(accessToken: string, requestId: string, assigneeProfileId: string | null) {
  return http<MealRequestResponse>(`/api/v1/meals/requests/${requestId}/assign`, {
    method: 'PUT',
    accessToken,
    body: JSON.stringify({ assigneeProfileId }),
  });
}

export async function acceptMealRequest(accessToken: string, requestId: string) {
  return http<MealRequestResponse>(`/api/v1/meals/requests/${requestId}/accept`, {
    method: 'POST',
    accessToken,
  });
}
