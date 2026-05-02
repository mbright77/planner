import {
  acceptMealRequest as acceptMealRequestRequest,
  assignMealRequest as assignMealRequestRequest,
  createMealPlan as createMealPlanRequest,
  createMealRequest as createMealRequestRequest,
  getMealRequests,
  getMealsWeek,
  updateMealPlan as updateMealPlanRequest,
  type CreateMealPlanRequest,
  type CreateMealRequestRequest,
  type MealPlanResponse,
  type MealRequestResponse,
  type UpdateMealPlanRequest,
  type WeeklyMealsResponse,
} from '@planner/api-client';

import { env } from '../config/env';
import { http } from './http';

export type {
  CreateMealPlanRequest,
  CreateMealRequestRequest,
  MealPlanResponse,
  MealRequestResponse,
  UpdateMealPlanRequest,
  WeeklyMealsResponse,
};

export async function fetchMealsWeek(accessToken: string, weekStart: string) {
  return getMealsWeek({ baseUrl: env.apiBaseUrl, accessToken }, weekStart);
}

export async function createMealPlan(accessToken: string, request: CreateMealPlanRequest) {
  return createMealPlanRequest({ baseUrl: env.apiBaseUrl, accessToken }, request);
}

export async function updateMealPlan(accessToken: string, mealId: string, request: UpdateMealPlanRequest) {
  return updateMealPlanRequest({ baseUrl: env.apiBaseUrl, accessToken }, mealId, request);
}

export async function deleteMealPlan(accessToken: string, mealId: string) {
  return http<void>(`/api/v1/meals/${mealId}`, {
    accessToken,
    method: 'DELETE',
  });
}

export async function fetchMealRequests(accessToken: string, weekStart: string) {
  return getMealRequests({ baseUrl: env.apiBaseUrl, accessToken }, weekStart);
}

export async function createMealRequest(accessToken: string, request: CreateMealRequestRequest) {
  return createMealRequestRequest({ baseUrl: env.apiBaseUrl, accessToken }, request);
}

export async function assignMealRequest(accessToken: string, requestId: string, assigneeProfileId: string | null) {
  return assignMealRequestRequest({ baseUrl: env.apiBaseUrl, accessToken }, requestId, assigneeProfileId);
}

export async function acceptMealRequest(accessToken: string, requestId: string) {
  return acceptMealRequestRequest({ baseUrl: env.apiBaseUrl, accessToken }, requestId);
}
