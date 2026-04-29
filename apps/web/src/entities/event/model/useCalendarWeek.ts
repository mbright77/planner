import { useMutation, useQueryClient } from '@tanstack/react-query';

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
import { runOrQueueOfflineMutation } from '../../../shared/lib/offlineMutationQueue';
import { syncOfflineQueryData } from '../../../shared/lib/offlineQuerySync';
import { useOfflineQuery } from '../../../shared/lib/useOfflineQuery';

function calendarWeekKey(accessToken: string | undefined, weekStart: string) {
  return ['calendar-week', accessToken, weekStart] as const;
}

function isEventInWeek(dateOnly: string, weekStart: string) {
  const weekStartDate = new Date(`${weekStart}T00:00:00.000Z`);
  const weekEndDate = new Date(weekStartDate);
  weekEndDate.setUTCDate(weekStartDate.getUTCDate() + 6);
  const weekEnd = weekEndDate.toISOString().slice(0, 10);

  return dateOnly >= weekStart && dateOnly <= weekEnd;
}

function sortEvents(events: CalendarEventResponse[]) {
  return [...events].sort((left, right) => left.startAtUtc.localeCompare(right.startAtUtc));
}

export function useCalendarWeek(weekStart: string) {
  const { session } = useAuthSession();

  return useOfflineQuery({
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
    mutationFn: (request: CreateCalendarEventRequest) =>
      runOrQueueOfflineMutation(
        {
          kind: 'calendar.create',
          accessToken: session!.accessToken,
          payload: request,
          invalidateKeys: [queryKey, ['dashboard-overview']],
        },
        () => createCalendarEvent(session!.accessToken, request),
      ),
    onMutate: async (request) => {
      await queryClient.cancelQueries({ queryKey });

      const previousWeek = queryClient.getQueryData<WeeklyCalendarResponse>(queryKey);
      const optimisticId = `event-${crypto.randomUUID()}`;
      if (isEventInWeek(request.date, weekStart)) {
        const optimisticEvent: CalendarEventResponse = {
          id: optimisticId,
          title: request.title,
          notes: request.notes,
          date: request.date,
          startAtUtc: new Date(`${request.date}T${request.startTime}`).toISOString(),
          endAtUtc: new Date(`${request.date}T${request.endTime}`).toISOString(),
          assignedProfileId: request.assignedProfileId,
          isRecurring: request.repeatsWeekly,
          repeatUntil: request.repeatUntil ?? null,
        } as unknown as CalendarEventResponse;

        queryClient.setQueryData<WeeklyCalendarResponse | undefined>(queryKey, (week) =>
          week
            ? {
                ...week,
                events: sortEvents([...week.events, optimisticEvent]),
              }
            : week,
        );
        await syncOfflineQueryData<WeeklyCalendarResponse>(queryClient, queryKey);
      }

      return { previousWeek, optimisticId };
    },
    onError: async (_error, _request, context) => {
      queryClient.setQueryData(queryKey, context?.previousWeek);
      await syncOfflineQueryData<WeeklyCalendarResponse>(queryClient, queryKey);
    },
    onSuccess: async (result, _request, context) => {
      if (result.status === 'queued') {
        return;
      }

      queryClient.setQueryData<WeeklyCalendarResponse | undefined>(queryKey, (week) =>
        week
          ? {
              ...week,
              events: sortEvents(
                week.events.map((currentEvent) => (currentEvent.id === context?.optimisticId ? result.data : currentEvent)),
              ),
            }
          : week,
      );
      await syncOfflineQueryData<WeeklyCalendarResponse>(queryClient, queryKey);
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
      runOrQueueOfflineMutation(
        {
          kind: 'calendar.update',
          accessToken: session!.accessToken,
          payload: { eventId, request },
          invalidateKeys: [queryKey, ['dashboard-overview']],
        },
        () => updateCalendarEvent(session!.accessToken, eventId, request),
      ),
    onMutate: async ({ eventId, request }) => {
      await queryClient.cancelQueries({ queryKey });

      const previousWeek = queryClient.getQueryData<WeeklyCalendarResponse>(queryKey);

      queryClient.setQueryData<WeeklyCalendarResponse | undefined>(queryKey, (week) => {
        if (!week) {
          return week;
        }

        const remainingEvents = week.events.filter((event) => event.id !== eventId);
        const nextEvents = isEventInWeek(request.date, weekStart)
          ? sortEvents([
              ...remainingEvents,
              {
                id: eventId,
                title: request.title,
                notes: request.notes,
                date: request.date,
                startAtUtc: new Date(`${request.date}T${request.startTime}`).toISOString(),
                endAtUtc: new Date(`${request.date}T${request.endTime}`).toISOString(),
                assignedProfileId: request.assignedProfileId,
                isRecurring: request.applyToSeries,
                repeatUntil: request.repeatUntil ?? null,
              },
            ])
          : remainingEvents;

        return {
          ...week,
          events: nextEvents,
        };
      });
      await syncOfflineQueryData<WeeklyCalendarResponse>(queryClient, queryKey);

      return { previousWeek };
    },
    onError: async (_error, _variables, context) => {
      queryClient.setQueryData(queryKey, context?.previousWeek);
      await syncOfflineQueryData<WeeklyCalendarResponse>(queryClient, queryKey);
    },
    onSuccess: async (result) => {
      if (result.status === 'queued') {
        return;
      }

      queryClient.setQueryData<WeeklyCalendarResponse | undefined>(queryKey, (week) => {
        if (!week) {
          return week;
        }

        const remainingEvents = week.events.filter((currentEvent) => currentEvent.id !== result.data.id);

        return {
          ...week,
          events: isEventInWeek(result.data.date ?? result.data.startAtUtc.slice(0, 10), weekStart)
            ? sortEvents([...remainingEvents, result.data])
            : remainingEvents,
        };
      });
      await syncOfflineQueryData<WeeklyCalendarResponse>(queryClient, queryKey);
    },
    onSettled: async () => {
      await Promise.all([
        queryClient.invalidateQueries({ queryKey }),
        queryClient.invalidateQueries({ queryKey: ['dashboard-overview'] }),
      ]);
    },
  });
}
