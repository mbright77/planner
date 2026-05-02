import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useState,
  type PropsWithChildren,
} from 'react';
import { useQueryClient } from '@tanstack/react-query';
import { ApiError } from '@planner/api-client';

import { useAuthSession } from '../../processes/auth-session/AuthSessionContext';
import {
  createCalendarEvent,
  deleteCalendarEvent,
  updateCalendarEvent,
  type CreateCalendarEventRequest,
  type UpdateCalendarEventRequest,
} from '../api/calendar';
import {
  acceptMealRequest,
  assignMealRequest,
  createMealPlan,
  createMealRequest,
  deleteMealPlan,
  updateMealPlan,
  type CreateMealPlanRequest,
  type CreateMealRequestRequest,
  type UpdateMealPlanRequest,
} from '../api/meals';
import {
  createShoppingItem,
  deleteShoppingItem,
  updateShoppingItem,
  type CreateShoppingItemRequest,
} from '../api/shopping';
import {
  deleteOfflineQueueStore,
  listOfflineQueueStore,
  readOfflineQueueStore,
  writeOfflineQueueStore,
} from './offlineCache';
import { useNetworkStatus } from './useNetworkStatus';

const queueChangedEventName = 'planner-offline-queue-changed';

type QueueInvalidationKey = readonly unknown[];

type OfflineMutation = {
  id: string;
  accessToken: string;
  createdAt: string;
  invalidateKeys: QueueInvalidationKey[];
  replayStatus?: 'pending' | 'failed';
  lastErrorMessage?: string | null;
  lastErrorAt?: string | null;
} & (
  | {
      kind: 'shopping.create';
      payload: CreateShoppingItemRequest;
    }
  | {
      kind: 'shopping.update';
      payload: { itemId: string; isCompleted: boolean };
    }
  | {
      kind: 'shopping.delete';
      payload: { itemId: string };
    }
  | {
      kind: 'calendar.create';
      payload: CreateCalendarEventRequest;
    }
  | {
      kind: 'calendar.update';
      payload: { eventId: string; request: UpdateCalendarEventRequest };
    }
  | {
      kind: 'calendar.delete';
      payload: { eventId: string };
    }
  | {
      kind: 'meal.create';
      payload: CreateMealPlanRequest;
    }
  | {
      kind: 'meal.update';
      payload: { mealId: string; request: UpdateMealPlanRequest };
    }
  | {
      kind: 'meal.delete';
      payload: { mealId: string };
    }
  | {
      kind: 'meal-request.create';
      payload: CreateMealRequestRequest;
    }
  | {
      kind: 'meal-request.assign';
      payload: { requestId: string; assigneeProfileId: string | null };
    }
  | {
      kind: 'meal-request.accept';
      payload: { requestId: string };
    }
);

type QueueableMutation = Omit<OfflineMutation, 'id' | 'createdAt'>;

type OfflineMutationContextValue = {
  pendingCount: number;
  failedCount: number;
  isFlushing: boolean;
  hasBlockingFailure: boolean;
  latestFailureMessage: string | null;
};

type OfflineMutationResult<T> =
  | { status: 'queued' }
  | { status: 'completed'; data: T };

const OfflineMutationContext = createContext<OfflineMutationContextValue | null>(null);

function emitQueueChanged() {
  window.dispatchEvent(new CustomEvent(queueChangedEventName));
}

function isOfflineError(error: unknown) {
  return error instanceof TypeError && !window.navigator.onLine;
}

function getReplayErrorMessage(error: unknown) {
  if (error instanceof ApiError) {
    return error.status === 409
      ? 'An offline change conflicted with newer planner data and needs review.'
      : 'An offline change could not be applied and needs review.';
  }

  if (error instanceof Error && error.message) {
    return error.message;
  }

  return 'An offline change could not be applied and needs review.';
}

export async function enqueueOfflineMutation(mutation: QueueableMutation) {
  const id = crypto.randomUUID();
  const queuedMutation: OfflineMutation = {
    ...mutation,
    id,
    createdAt: new Date().toISOString(),
    replayStatus: 'pending',
    lastErrorMessage: null,
    lastErrorAt: null,
  } as OfflineMutation;

  await writeOfflineQueueStore(id, queuedMutation);

  emitQueueChanged();
}

async function listQueuedMutations(accessToken: string | undefined) {
  const entries = await listOfflineQueueStore<OfflineMutation>();

  return entries
    .map((entry) => entry.value)
    .filter((mutation) => mutation.accessToken === accessToken)
    .sort((left, right) => left.createdAt.localeCompare(right.createdAt));
}

async function updateQueuedMutation(mutation: OfflineMutation) {
  await writeOfflineQueueStore(mutation.id, mutation);
  emitQueueChanged();
}

async function removeQueuedMutation(id: string) {
  const entry = await readOfflineQueueStore<OfflineMutation>(id);

  if (!entry) {
    return;
  }

  await deleteOfflineQueueStore(id);
  emitQueueChanged();
}

async function executeQueuedMutation(mutation: OfflineMutation) {
  switch (mutation.kind) {
    case 'shopping.create':
      await createShoppingItem(mutation.accessToken, mutation.payload);
      return;
    case 'shopping.update':
      await updateShoppingItem(mutation.accessToken, mutation.payload.itemId, mutation.payload.isCompleted);
      return;
    case 'shopping.delete':
      await deleteShoppingItem(mutation.accessToken, mutation.payload.itemId);
      return;
    case 'calendar.create':
      await createCalendarEvent(mutation.accessToken, mutation.payload);
      return;
    case 'calendar.update':
      await updateCalendarEvent(mutation.accessToken, mutation.payload.eventId, mutation.payload.request);
      return;
    case 'calendar.delete':
      await deleteCalendarEvent(mutation.accessToken, mutation.payload.eventId);
      return;
    case 'meal.create':
      await createMealPlan(mutation.accessToken, mutation.payload);
      return;
    case 'meal.update':
      await updateMealPlan(mutation.accessToken, mutation.payload.mealId, mutation.payload.request);
      return;
    case 'meal.delete':
      await deleteMealPlan(mutation.accessToken, mutation.payload.mealId);
      return;
    case 'meal-request.create':
      await createMealRequest(mutation.accessToken, mutation.payload);
      return;
    case 'meal-request.assign':
      await assignMealRequest(mutation.accessToken, mutation.payload.requestId, mutation.payload.assigneeProfileId);
      return;
    case 'meal-request.accept':
      await acceptMealRequest(mutation.accessToken, mutation.payload.requestId);
      return;
  }
}

export async function runOrQueueOfflineMutation<T>(
  mutation: QueueableMutation,
  runOnline: () => Promise<T>,
): Promise<OfflineMutationResult<T>> {
  if (!window.navigator.onLine) {
    await enqueueOfflineMutation(mutation);
    return { status: 'queued' };
  }

  try {
    return { status: 'completed', data: await runOnline() };
  } catch (error) {
    if (!isOfflineError(error)) {
      throw error;
    }

    await enqueueOfflineMutation(mutation);
    return { status: 'queued' };
  }
}

export function OfflineMutationProvider({ children }: PropsWithChildren) {
  const { session } = useAuthSession();
  const { isOnline } = useNetworkStatus();
  const queryClient = useQueryClient();
  const [pendingCount, setPendingCount] = useState(0);
  const [failedCount, setFailedCount] = useState(0);
  const [isFlushing, setIsFlushing] = useState(false);
  const [latestFailureMessage, setLatestFailureMessage] = useState<string | null>(null);
  const accessToken = session?.accessToken;

  const refreshQueueState = useCallback(async () => {
    const queue = await listQueuedMutations(accessToken);
    const failedMutations = queue.filter((mutation) => mutation.replayStatus === 'failed');

    setPendingCount(queue.filter((mutation) => mutation.replayStatus !== 'failed').length);
    setFailedCount(failedMutations.length);
    setLatestFailureMessage(failedMutations.at(-1)?.lastErrorMessage ?? null);
  }, [accessToken]);

  useEffect(() => {
    void refreshQueueState();
  }, [refreshQueueState]);

  useEffect(() => {
    function handleQueueChanged() {
      void refreshQueueState();
    }

    window.addEventListener(queueChangedEventName, handleQueueChanged);

    return () => {
      window.removeEventListener(queueChangedEventName, handleQueueChanged);
    };
  }, [refreshQueueState]);

  useEffect(() => {
    if (!isOnline || !accessToken || isFlushing || pendingCount === 0) {
      return;
    }

    let cancelled = false;

    async function flushQueue() {
      setIsFlushing(true);

      try {
        const queue = await listQueuedMutations(accessToken);

        for (const mutation of queue) {
          if (cancelled) {
            return;
          }

          if (mutation.replayStatus === 'failed') {
            continue;
          }

          try {
            await executeQueuedMutation(mutation);
            await removeQueuedMutation(mutation.id);

            await Promise.all(
              mutation.invalidateKeys.map((queryKey) => queryClient.invalidateQueries({ queryKey })),
            );
          } catch (error) {
            if (!window.navigator.onLine) {
              break;
            }

            await updateQueuedMutation({
              ...mutation,
              replayStatus: 'failed',
              lastErrorAt: new Date().toISOString(),
              lastErrorMessage: getReplayErrorMessage(error),
            });
            console.error('Unable to flush offline planner mutation.', error);
          }
        }
      } finally {
        if (!cancelled) {
          setIsFlushing(false);
          await refreshQueueState();
        }
      }
    }

    void flushQueue();

    return () => {
      cancelled = true;
    };
  }, [accessToken, isFlushing, isOnline, pendingCount, queryClient, refreshQueueState]);

  const value = useMemo(
    () => ({
      pendingCount,
      failedCount,
      isFlushing,
      hasBlockingFailure: failedCount > 0,
      latestFailureMessage,
    }),
    [failedCount, isFlushing, latestFailureMessage, pendingCount],
  );

  return <OfflineMutationContext.Provider value={value}>{children}</OfflineMutationContext.Provider>;
}

export function useOfflineMutationState() {
  const context = useContext(OfflineMutationContext);

  if (!context) {
    throw new Error('useOfflineMutationState must be used inside OfflineMutationProvider.');
  }

  return context;
}
