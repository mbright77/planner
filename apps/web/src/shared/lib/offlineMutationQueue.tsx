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

import { useAuthSession } from '../../processes/auth-session/AuthSessionContext';
import {
  createCalendarEvent,
  updateCalendarEvent,
  type CreateCalendarEventRequest,
  type UpdateCalendarEventRequest,
} from '../api/calendar';
import {
  acceptMealRequest,
  assignMealRequest,
  createMealPlan,
  createMealRequest,
  updateMealPlan,
  type CreateMealPlanRequest,
  type CreateMealRequestRequest,
  type UpdateMealPlanRequest,
} from '../api/meals';
import {
  createShoppingItem,
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
      kind: 'calendar.create';
      payload: CreateCalendarEventRequest;
    }
  | {
      kind: 'calendar.update';
      payload: { eventId: string; request: UpdateCalendarEventRequest };
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
  isFlushing: boolean;
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

export async function enqueueOfflineMutation(mutation: QueueableMutation) {
  const id = crypto.randomUUID();
  const queuedMutation: OfflineMutation = {
    ...mutation,
    id,
    createdAt: new Date().toISOString(),
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
    case 'calendar.create':
      await createCalendarEvent(mutation.accessToken, mutation.payload);
      return;
    case 'calendar.update':
      await updateCalendarEvent(mutation.accessToken, mutation.payload.eventId, mutation.payload.request);
      return;
    case 'meal.create':
      await createMealPlan(mutation.accessToken, mutation.payload);
      return;
    case 'meal.update':
      await updateMealPlan(mutation.accessToken, mutation.payload.mealId, mutation.payload.request);
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
  const [isFlushing, setIsFlushing] = useState(false);
  const accessToken = session?.accessToken;

  const refreshQueueState = useCallback(async () => {
    const queue = await listQueuedMutations(accessToken);
    setPendingCount(queue.length);
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

            console.error('Unable to flush offline planner mutation.', error);
            break;
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
    () => ({ pendingCount, isFlushing }),
    [isFlushing, pendingCount],
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
