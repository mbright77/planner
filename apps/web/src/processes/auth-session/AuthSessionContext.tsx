import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useRef,
  useState,
  type PropsWithChildren,
} from 'react';
import { useQueryClient } from '@tanstack/react-query';

import type { Session } from '../../shared/model/session';

const storageKey = 'planner.session';

type AuthSessionContextValue = {
  session: Session | null;
  isHydrated: boolean;
  isExpired: boolean;
  setSession: (session: Session | null) => void;
  clearSession: () => void;
};

const AuthSessionContext = createContext<AuthSessionContextValue | null>(null);

function readSession(): Session | null {
  if (typeof window === 'undefined') {
    return null;
  }

  const value = window.localStorage.getItem(storageKey);
  if (!value) {
    return null;
  }

  try {
    return JSON.parse(value) as Session;
  } catch {
    window.localStorage.removeItem(storageKey);
    return null;
  }
}

function isSessionExpired(session: Session | null) {
  if (!session) {
    return false;
  }

  const expiresAt = new Date(session.expiresAtUtc).getTime();

  if (!Number.isFinite(expiresAt)) {
    return true;
  }

  return expiresAt <= Date.now();
}

export function AuthSessionProvider({ children }: PropsWithChildren) {
  const queryClient = useQueryClient();
  const [session, setSessionState] = useState<Session | null>(() => readSession());
  const previousTokenRef = useRef<string | null>(session?.accessToken ?? null);
  const isExpired = isSessionExpired(session);

  const setSession = useCallback((nextSession: Session | null) => {
    setSessionState(nextSession);

    if (nextSession) {
      window.localStorage.setItem(storageKey, JSON.stringify(nextSession));
      return;
    }

    window.localStorage.removeItem(storageKey);
  }, []);

  const clearSession = useCallback(() => {
    setSession(null);
  }, [setSession]);

  useEffect(() => {
    const previousToken = previousTokenRef.current;
    const nextToken = session?.accessToken ?? null;

    if (previousToken && previousToken !== nextToken) {
      queryClient.removeQueries({
        predicate: (query) => query.queryKey.some((part) => part === previousToken),
      });
    }

    previousTokenRef.current = nextToken;
  }, [queryClient, session?.accessToken]);

  useEffect(() => {
    function enforceExpiry() {
      if (!session || !isSessionExpired(session)) {
        return;
      }

      if (window.navigator.onLine) {
        clearSession();
      }
    }

    function handleVisibilityChange() {
      if (document.visibilityState === 'visible') {
        enforceExpiry();
      }
    }

    enforceExpiry();
    window.addEventListener('focus', enforceExpiry);
    window.addEventListener('online', enforceExpiry);
    document.addEventListener('visibilitychange', handleVisibilityChange);

    return () => {
      window.removeEventListener('focus', enforceExpiry);
      window.removeEventListener('online', enforceExpiry);
      document.removeEventListener('visibilitychange', handleVisibilityChange);
    };
  }, [clearSession, session]);

  const value = useMemo(
    () => ({ session, isHydrated: true, isExpired, setSession, clearSession }),
    [clearSession, isExpired, session, setSession],
  );

  return <AuthSessionContext.Provider value={value}>{children}</AuthSessionContext.Provider>;
}

export function useAuthSession() {
  const context = useContext(AuthSessionContext);

  if (!context) {
    throw new Error('useAuthSession must be used inside AuthSessionProvider.');
  }

  return context;
}
