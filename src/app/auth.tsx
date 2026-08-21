import { createContext, useCallback, useContext, useEffect, useState, type ReactNode } from 'react';
import type { User } from '@supabase/supabase-js';
import { supabase, supabaseBackendEnabled } from '../data/supabase/client';

export type AuthMode = 'mock' | 'supabase';

interface AuthApi {
  mode: AuthMode;
  user: User | null;
  loading: boolean;
  /** Renvoie un message d'erreur, ou null si succès. */
  signIn: (email: string, password: string) => Promise<string | null>;
  signOut: () => Promise<void>;
}

const AuthCtx = createContext<AuthApi | null>(null);

export function useAuth(): AuthApi {
  const ctx = useContext(AuthCtx);
  if (!ctx) throw new Error('useAuth doit être utilisé dans un AuthProvider');
  return ctx;
}

export function AuthProvider({ children }: { children: ReactNode }) {
  const mode: AuthMode = supabaseBackendEnabled() ? 'supabase' : 'mock';
  const [user, setUser] = useState<User | null>(null);
  const [loading, setLoading] = useState(mode === 'supabase');

  useEffect(() => {
    if (mode !== 'supabase' || !supabase) return;
    let alive = true;
    supabase.auth.getSession().then(({ data }) => {
      if (alive) {
        setUser(data.session?.user ?? null);
        setLoading(false);
      }
    });
    const { data: sub } = supabase.auth.onAuthStateChange((_event, session) => {
      setUser(session?.user ?? null);
    });
    return () => {
      alive = false;
      sub.subscription.unsubscribe();
    };
  }, [mode]);

  const signIn = useCallback(async (email: string, password: string) => {
    if (!supabase) return 'Supabase non configuré';
    const { error } = await supabase.auth.signInWithPassword({ email, password });
    return error ? error.message : null;
  }, []);

  const signOut = useCallback(async () => {
    await supabase?.auth.signOut();
  }, []);

  return <AuthCtx.Provider value={{ mode, user, loading, signIn, signOut }}>{children}</AuthCtx.Provider>;
}
