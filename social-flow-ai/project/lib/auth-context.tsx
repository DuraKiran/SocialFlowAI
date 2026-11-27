'use client';

import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useState,
  type ReactNode,
} from 'react';
import { useRouter } from 'next/navigation';
import type { Session } from './types';

const SESSION_KEY = 'socialflow.session';

interface AuthContextValue {
  session: Session | null;
  loading: boolean;
  signIn: (session: Session) => void;
  signOut: () => void;
}

const AuthContext = createContext<AuthContextValue>({
  session: null,
  loading: true,
  signIn: () => {},
  signOut: () => {},
});

export function AuthProvider({ children }: { children: ReactNode }) {
  const [session, setSession] = useState<Session | null>(null);
  const [loading, setLoading] = useState(true);
  const router = useRouter();

  useEffect(() => {
    try {
      const raw = window.localStorage.getItem(SESSION_KEY);
      if (raw) setSession(JSON.parse(raw) as Session);
    } catch {
      // ignore corrupt session
    }
    setLoading(false);
  }, []);

  const signIn = useCallback(
    (s: Session) => {
      window.localStorage.setItem(SESSION_KEY, JSON.stringify(s));
      setSession(s);
    },
    []
  );

  const signOut = useCallback(() => {
    window.localStorage.removeItem(SESSION_KEY);
    setSession(null);
    router.push('/');
  }, [router]);

  const value = useMemo(
    () => ({ session, loading, signIn, signOut }),
    [session, loading, signIn, signOut]
  );

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
}

export function useAuth() {
  return useContext(AuthContext);
}
