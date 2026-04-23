import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';

import {
  createCalendarEvent,
  fetchCalendarWeek,
  updateCalendarEvent,
  type CreateCalendarEventRequest,
  type UpdateCalendarEventRequest,
} from '../../../shared/api/calendar';
import { useAuthSession } from '../../../processes/auth-session/AuthSessionContext';

export function useCalendarWeek(weekStart: string) {
  const { session } = useAuthSession();

  return useQuery({
    queryKey: ['calendar-week', session?.accessToken, weekStart],
    queryFn: () => fetchCalendarWeek(session!.accessToken, weekStart),
    enabled: Boolean(session?.accessToken),
  });
}

export function useCreateCalendarEvent(weekStart: string) {
  const { session } = useAuthSession();
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: (request: CreateCalendarEventRequest) => createCalendarEvent(session!.accessToken, request),
    onSuccess: async () => {
      await queryClient.invalidateQueries({ queryKey: ['calendar-week', session?.accessToken, weekStart] });
    },
  });
}

export function useUpdateCalendarEvent(weekStart: string) {
  const { session } = useAuthSession();
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: ({ eventId, request }: { eventId: string; request: UpdateCalendarEventRequest }) =>
      updateCalendarEvent(session!.accessToken, eventId, request),
    onSuccess: async () => {
      await queryClient.invalidateQueries({ queryKey: ['calendar-week', session?.accessToken, weekStart] });
    },
  });
}
