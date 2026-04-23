import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';

import {
  type CalendarEventResponse,
  createCalendarEvent,
  fetchCalendarWeek,
  updateCalendarEvent,
  type CreateCalendarEventRequest,
  type UpdateCalendarEventRequest,
  type WeeklyCalendarResponse,
} from '../../../shared/api/calendar';
import { useAuthSession } from '../../../processes/auth-session/AuthSessionContext';

function calendarWeekKey(accessToken: string | undefined, weekStart: string) {
  return ['calendar-week', accessToken, weekStart] as const;
}

function isEventInWeek(startAtUtc: string, weekStart: string) {
  const eventDate = startAtUtc.slice(0, 10);
  const weekStartDate = new Date(`${weekStart}T00:00:00.000Z`);
  const weekEndDate = new Date(weekStartDate);
  weekEndDate.setUTCDate(weekStartDate.getUTCDate() + 6);
  const weekEnd = weekEndDate.toISOString().slice(0, 10);

  return eventDate >= weekStart && eventDate <= weekEnd;
}

function sortEvents(events: CalendarEventResponse[]) {
  return [...events].sort((left, right) => left.startAtUtc.localeCompare(right.startAtUtc));
}

export function useCalendarWeek(weekStart: string) {
  const { session } = useAuthSession();

  return useQuery({
    queryKey: calendarWeekKey(session?.accessToken, weekStart),
    queryFn: () => fetchCalendarWeek(session!.accessToken, weekStart),
    enabled: Boolean(session?.accessToken),
  });
}

export function useCreateCalendarEvent(weekStart: string) {
  const { session } = useAuthSession();
  const queryClient = useQueryClient();
  const queryKey = calendarWeekKey(session?.accessToken, weekStart);

  return useMutation({
    mutationFn: (request: CreateCalendarEventRequest) => createCalendarEvent(session!.accessToken, request),
    onMutate: async (request) => {
      await queryClient.cancelQueries({ queryKey });

      const previousWeek = queryClient.getQueryData<WeeklyCalendarResponse>(queryKey);
      const optimisticId = `event-${crypto.randomUUID()}`;

      if (isEventInWeek(request.startAtUtc, weekStart)) {
        const optimisticEvent: CalendarEventResponse = {
          id: optimisticId,
          title: request.title,
          notes: request.notes,
          startAtUtc: request.startAtUtc,
          endAtUtc: request.endAtUtc,
          assignedProfileId: request.assignedProfileId,
        };

        queryClient.setQueryData<WeeklyCalendarResponse | undefined>(queryKey, (week) =>
          week
            ? {
                ...week,
                events: sortEvents([...week.events, optimisticEvent]),
              }
            : week,
        );
      }

      return { previousWeek, optimisticId };
    },
    onError: (_error, _request, context) => {
      queryClient.setQueryData(queryKey, context?.previousWeek);
    },
    onSuccess: (event, _request, context) => {
      queryClient.setQueryData<WeeklyCalendarResponse | undefined>(queryKey, (week) =>
        week
          ? {
              ...week,
              events: sortEvents(
                week.events.map((currentEvent) =>
                  currentEvent.id === context?.optimisticId ? event : currentEvent,
                ),
              ),
            }
          : week,
      );
    },
    onSettled: async () => {
      await Promise.all([
        queryClient.invalidateQueries({ queryKey }),
        queryClient.invalidateQueries({ queryKey: ['dashboard-overview'] }),
      ]);
    },
  });
}

export function useUpdateCalendarEvent(weekStart: string) {
  const { session } = useAuthSession();
  const queryClient = useQueryClient();
  const queryKey = calendarWeekKey(session?.accessToken, weekStart);

  return useMutation({
    mutationFn: ({ eventId, request }: { eventId: string; request: UpdateCalendarEventRequest }) =>
      updateCalendarEvent(session!.accessToken, eventId, request),
    onMutate: async ({ eventId, request }) => {
      await queryClient.cancelQueries({ queryKey });

      const previousWeek = queryClient.getQueryData<WeeklyCalendarResponse>(queryKey);

      queryClient.setQueryData<WeeklyCalendarResponse | undefined>(queryKey, (week) => {
        if (!week) {
          return week;
        }

        const remainingEvents = week.events.filter((event) => event.id !== eventId);
        const nextEvents = isEventInWeek(request.startAtUtc, weekStart)
          ? sortEvents([
              ...remainingEvents,
              {
                id: eventId,
                title: request.title,
                notes: request.notes,
                startAtUtc: request.startAtUtc,
                endAtUtc: request.endAtUtc,
                assignedProfileId: request.assignedProfileId,
              },
            ])
          : remainingEvents;

        return {
          ...week,
          events: nextEvents,
        };
      });

      return { previousWeek };
    },
    onError: (_error, _variables, context) => {
      queryClient.setQueryData(queryKey, context?.previousWeek);
    },
    onSuccess: (event) => {
      queryClient.setQueryData<WeeklyCalendarResponse | undefined>(queryKey, (week) => {
        if (!week) {
          return week;
        }

        const remainingEvents = week.events.filter((currentEvent) => currentEvent.id !== event.id);

        return {
          ...week,
          events: isEventInWeek(event.startAtUtc, weekStart)
            ? sortEvents([...remainingEvents, event])
            : remainingEvents,
        };
      });
    },
    onSettled: async () => {
      await Promise.all([
        queryClient.invalidateQueries({ queryKey }),
        queryClient.invalidateQueries({ queryKey: ['dashboard-overview'] }),
      ]);
    },
  });
}
