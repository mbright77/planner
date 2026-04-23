import { http } from './http';

export type CalendarEventResponse = {
  id: string;
  title: string;
  notes: string | null;
  startAtUtc: string;
  endAtUtc: string;
  assignedProfileId: string | null;
};

export type WeeklyCalendarResponse = {
  weekStart: string;
  weekEnd: string;
  events: CalendarEventResponse[];
};

export type CreateCalendarEventRequest = {
  title: string;
  notes: string | null;
  startAtUtc: string;
  endAtUtc: string;
  assignedProfileId: string | null;
};

export type UpdateCalendarEventRequest = CreateCalendarEventRequest;

export async function fetchCalendarWeek(accessToken: string, weekStart: string) {
  return http<WeeklyCalendarResponse>(`/api/v1/calendar/week?start=${weekStart}`, {
    method: 'GET',
    accessToken,
  });
}

export async function createCalendarEvent(accessToken: string, request: CreateCalendarEventRequest) {
  return http<CalendarEventResponse>('/api/v1/calendar', {
    method: 'POST',
    accessToken,
    body: JSON.stringify(request),
  });
}

export async function updateCalendarEvent(
  accessToken: string,
  eventId: string,
  request: UpdateCalendarEventRequest,
) {
  return http<CalendarEventResponse>(`/api/v1/calendar/${eventId}`, {
    method: 'PUT',
    accessToken,
    body: JSON.stringify(request),
  });
}
