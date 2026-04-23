import {
  createCalendarEvent as createCalendarEventRequest,
  getCalendarWeek,
  updateCalendarEvent as updateCalendarEventRequest,
  type CalendarEventResponse,
  type CreateCalendarEventRequest,
  type UpdateCalendarEventRequest,
  type WeeklyCalendarResponse,
} from '@planner/api-client';

import { env } from '../config/env';

export type {
  CalendarEventResponse,
  CreateCalendarEventRequest,
  UpdateCalendarEventRequest,
  WeeklyCalendarResponse,
};

export async function fetchCalendarWeek(accessToken: string, weekStart: string) {
  return getCalendarWeek({ baseUrl: env.apiBaseUrl, accessToken }, weekStart);
}

export async function createCalendarEvent(accessToken: string, request: CreateCalendarEventRequest) {
  return createCalendarEventRequest({ baseUrl: env.apiBaseUrl, accessToken }, request);
}

export async function updateCalendarEvent(
  accessToken: string,
  eventId: string,
  request: UpdateCalendarEventRequest,
) {
  return updateCalendarEventRequest({ baseUrl: env.apiBaseUrl, accessToken }, eventId, request);
}
