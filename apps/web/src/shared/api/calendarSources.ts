import {
  disconnectGoogleCalendar as disconnectGoogleCalendarRequest,
  getCalendarSources as getCalendarSourcesRequest,
  getGoogleCalendars as getGoogleCalendarsRequest,
  startGoogleAuthorization as startGoogleAuthorizationRequest,
  updateCalendarSources as updateCalendarSourcesRequest,
  updateGoogleCalendarSelection as updateGoogleCalendarSelectionRequest,
  type CalendarSourceSettingsResponse,
  type GoogleAuthorizationUrlResponse,
  type GoogleCalendarListResponse,
  type UpdateCalendarSourcesRequest,
  type UpdateGoogleCalendarSelectionRequest,
} from '@planner/api-client';

import { env } from '../config/env';

export type {
  CalendarSourceSettingsResponse,
  GoogleAuthorizationUrlResponse,
  GoogleCalendarListResponse,
  UpdateCalendarSourcesRequest,
  UpdateGoogleCalendarSelectionRequest,
};

export async function fetchCalendarSources(accessToken: string) {
  return getCalendarSourcesRequest({ baseUrl: env.apiBaseUrl, accessToken });
}

export async function updateCalendarSources(
  accessToken: string,
  request: UpdateCalendarSourcesRequest,
) {
  return updateCalendarSourcesRequest(
    { baseUrl: env.apiBaseUrl, accessToken },
    request,
  );
}

export async function startGoogleAuthorization(accessToken: string) {
  return startGoogleAuthorizationRequest({ baseUrl: env.apiBaseUrl, accessToken });
}

export async function fetchGoogleCalendars(
  accessToken: string,
  refresh?: boolean,
) {
  return getGoogleCalendarsRequest(
    { baseUrl: env.apiBaseUrl, accessToken },
    refresh,
  );
}

export async function updateGoogleCalendarSelection(
  accessToken: string,
  request: UpdateGoogleCalendarSelectionRequest,
) {
  return updateGoogleCalendarSelectionRequest(
    { baseUrl: env.apiBaseUrl, accessToken },
    request,
  );
}

export async function disconnectGoogleCalendar(accessToken: string) {
  return disconnectGoogleCalendarRequest({ baseUrl: env.apiBaseUrl, accessToken });
}
