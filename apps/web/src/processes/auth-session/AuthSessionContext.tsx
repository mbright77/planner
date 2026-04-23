import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useState,
  type PropsWithChildren,
} from 'react';

import type { Session } from '../../shared/model/session';

const storageKey = 'planner.session';

type AuthSessionContextValue = {
  session: Session | null;
  setSession: (session: Session | null) => void;
  clearSession: () => void;
};

const AuthSessionContext = createContext<AuthSessionContextValue | null>(null);

function readSession(): Session | null {
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

export function AuthSessionProvider({ children }: PropsWithChildren) {
  const [session, setSessionState] = useState<Session | null>(null);

  useEffect(() => {
    setSessionState(readSession());
  }, []);

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

  const value = useMemo(
    () => ({ session, setSession, clearSession }),
    [clearSession, session, setSession],
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
