import React, { createContext, useContext, useEffect, useState, useRef, ReactNode } from 'react';
import { Session, User as SupabaseUser } from '@supabase/supabase-js';
import type { User } from '@/types';

// ─── Context Type ────────────────────────────────────────────────────────────
interface AuthContextValue {
  session: Session | null;
  supabaseUser: SupabaseUser | null;
  user: User | null;
  loading: boolean;
  signIn: (email: string, password: string) => Promise<void>;
  signUp: (email: string, password: string, fullName: string, role: string) => Promise<void>;
  signOut: () => Promise<void>;
  refreshUser: () => Promise<void>;
}

const AuthContext = createContext<AuthContextValue | undefined>(undefined);

export function AuthProvider({ children }: { children: ReactNode }) {
  const [session, setSession] = useState<Session | null>(null);
  const [supabaseUser, setSupabaseUser] = useState<SupabaseUser | null>(null);
  const [user, setUser] = useState<User | null>(null);
  const [loading, setLoading] = useState(true);

  // Guard: only run Supabase listener once
  const listenerRegistered = useRef(false);

  useEffect(() => {
    if (listenerRegistered.current) return;
    listenerRegistered.current = true;

    // Attempt to use real Supabase session if configured
    const tryRealAuth = async () => {
      try {
        const { supabase } = await import('@/lib/supabase');
        const { data: { session: realSession } } = await supabase.auth.getSession();

        if (realSession) {
          setSession(realSession);
          setSupabaseUser(realSession.user);
          // Try to fetch profile from DB
          try {
            const { data } = await supabase
              .from('users')
              .select('*')
              .eq('id', realSession.user.id)
              .maybeSingle();
            if (data) setUser(data as User);
          } catch {
            // Non-fatal
          }
        }

        // Listen for real auth changes (sign in / sign out)
        const { data: { subscription } } = supabase.auth.onAuthStateChange((_event, s) => {
          if (s) {
            setSession(s);
            setSupabaseUser(s.user);
          } else {
            setSession(null);
            setSupabaseUser(null);
            setUser(null);
          }
        });

        setLoading(false);
        return () => subscription.unsubscribe();
      } catch {
        setLoading(false);
      }
    };

    tryRealAuth();
  }, []);

  const refreshUser = async () => {
    if (!supabaseUser) return;
    try {
      const { supabase } = await import('@/lib/supabase');
      const { data } = await supabase
        .from('users')
        .select('*')
        .eq('id', supabaseUser.id)
        .maybeSingle();
      if (data) setUser(data as User);
    } catch {
      console.warn('[CCID] Could not refresh user profile');
    }
  };

  const signIn = async (email: string, password: string) => {
    const { supabase } = await import('@/lib/supabase');
    const { data, error } = await supabase.auth.signInWithPassword({ email, password });
    if (error) throw error;
    if (data.session) {
      setSession(data.session);
      setSupabaseUser(data.user);
    }
  };

  const signUp = async (email: string, password: string, fullName: string, role: string) => {
    const { supabase } = await import('@/lib/supabase');
    const { data, error } = await supabase.auth.signUp({
      email,
      password,
      options: {
        data: {
          full_name: fullName,
          role: role,
        },
      },
    });
    if (error) throw error;
    if (data.session) {
      setSession(data.session);
      setSupabaseUser(data.user);
      setUser({ id: data.user!.id, email, full_name: fullName, role, created_at: new Date().toISOString() } as User);
    } else if (data.user) {
      // If email confirmation is required, session might be null.
      setSupabaseUser(data.user);
      setUser({ id: data.user.id, email, full_name: fullName, role, created_at: new Date().toISOString() } as User);
    }
  };

  const signOut = async () => {
    try {
      const { supabase } = await import('@/lib/supabase');
      await supabase.auth.signOut();
    } catch { /* ignore */ }
    setSession(null);
    setSupabaseUser(null);
    setUser(null);
  };

  return (
    <AuthContext.Provider value={{ session, supabaseUser, user, loading, signIn, signUp, signOut, refreshUser }}>
      {children}
    </AuthContext.Provider>
  );
}

export function useAuth(): AuthContextValue {
  const ctx = useContext(AuthContext);
  if (!ctx) throw new Error('useAuth must be used within AuthProvider');
  return ctx;
}
