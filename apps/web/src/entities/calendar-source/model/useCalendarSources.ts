import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';

import { useAuthSession } from '../../../processes/auth-session/AuthSessionContext';
import {
  disconnectGoogleCalendar,
  fetchCalendarSources,
  fetchGoogleCalendars,
  startGoogleAuthorization,
  updateCalendarSources,
  updateGoogleCalendarSelection,
  type CalendarSourceSettingsResponse,
  type GoogleAuthorizationUrlResponse,
  type GoogleCalendarListResponse,
  type UpdateCalendarSourcesRequest,
  type UpdateGoogleCalendarSelectionRequest,
} from '../../../shared/api/calendarSources';

const calendarSourcesKey = (accessToken: string | undefined) =>
  ['calendar-sources', accessToken] as const;

const googleCalendarsKey = (accessToken: string | undefined) =>
  ['google-calendars', accessToken] as const;

export function useCalendarSources() {
  const { session } = useAuthSession();

  return useQuery({
    queryKey: calendarSourcesKey(session?.accessToken),
    queryFn: () => fetchCalendarSources(session!.accessToken),
    enabled: Boolean(session?.accessToken),
  });
}

export function useUpdateCalendarSources() {
  const { session } = useAuthSession();
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: (request: UpdateCalendarSourcesRequest) =>
      updateCalendarSources(session!.accessToken, request),
    onSuccess: async () => {
      await queryClient.invalidateQueries({
        queryKey: calendarSourcesKey(session?.accessToken),
      });
      await queryClient.invalidateQueries({
        queryKey: googleCalendarsKey(session?.accessToken),
      });
      await queryClient.invalidateQueries({
        queryKey: ['dashboard-overview', session?.accessToken],
      });
    },
  });
}

export function useStartGoogleAuthorization() {
  const { session } = useAuthSession();

  return useMutation({
    mutationFn: () => startGoogleAuthorization(session!.accessToken),
  });
}

export function useGoogleCalendars(refresh?: boolean) {
  const { session } = useAuthSession();

  return useQuery({
    queryKey: googleCalendarsKey(session?.accessToken),
    queryFn: () => fetchGoogleCalendars(session!.accessToken, refresh),
    enabled: Boolean(session?.accessToken),
  });
}

export function useUpdateGoogleCalendarSelection() {
  const { session } = useAuthSession();
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: (request: UpdateGoogleCalendarSelectionRequest) =>
      updateGoogleCalendarSelection(session!.accessToken, request),
    onSuccess: async () => {
      await queryClient.invalidateQueries({
        queryKey: googleCalendarsKey(session?.accessToken),
      });
      await queryClient.invalidateQueries({
        queryKey: calendarSourcesKey(session?.accessToken),
      });
      await queryClient.invalidateQueries({
        queryKey: ['dashboard-overview', session?.accessToken],
      });
    },
  });
}

export function useDisconnectGoogleCalendar() {
  const { session } = useAuthSession();
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: () => disconnectGoogleCalendar(session!.accessToken),
    onSuccess: async () => {
      await queryClient.invalidateQueries({
        queryKey: calendarSourcesKey(session?.accessToken),
      });
      await queryClient.invalidateQueries({
        queryKey: googleCalendarsKey(session?.accessToken),
      });
      await queryClient.invalidateQueries({
        queryKey: ['dashboard-overview', session?.accessToken],
      });
    },
  });
}

export type { CalendarSourceSettingsResponse, GoogleAuthorizationUrlResponse, GoogleCalendarListResponse };
