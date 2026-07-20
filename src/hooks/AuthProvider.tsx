import { ReactNode, useCallback, useEffect, useState } from 'react';
import { User, Session } from '@supabase/supabase-js';
import { supabase } from '@/integrations/supabase/client';
import { AuthContext, AuthProfile } from '@/hooks/useAuth';

const devAutoLoginEnabled =
  import.meta.env.VITE_DEV_AUTO_LOGIN === 'true';
const devAutoEmail = import.meta.env.VITE_DEV_AUTH_EMAIL;
const devAutoPassword = import.meta.env.VITE_DEV_AUTH_PASSWORD;

function isDevAutoLoginAllowed() {
  if (import.meta.env.DEV) return true;
  if (typeof window === 'undefined') return false;

  const { hostname } = window.location;
  return hostname === 'localhost' || hostname === '127.0.0.1' || hostname.startsWith('id-preview--');
}

function withTimeout<T, TTimeout>(promise: PromiseLike<T>, timeoutMs: number, timeoutValue: TTimeout) {
  return new Promise<T | TTimeout>((resolve) => {
    const timeoutId = window.setTimeout(() => resolve(timeoutValue), timeoutMs);

    Promise.resolve(promise)
      .then((value) => {
        window.clearTimeout(timeoutId);
        resolve(value);
      })
      .catch(() => {
        window.clearTimeout(timeoutId);
        resolve(timeoutValue);
      });
  });
}

export function AuthProvider({ children }: { children: ReactNode }) {
  const [user, setUser] = useState<User | null>(null);
  const [session, setSession] = useState<Session | null>(null);
  const [profile, setProfile] = useState<AuthProfile | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    let mounted = true;

    const loadProfile = async (currentUser: User | null) => {
      if (!currentUser) {
        if (mounted) setProfile(null);
        return;
      }

      const profileResult = await withTimeout(
        supabase
          .from('profiles')
          .select('user_id,email,nome,role,active,permissions')
          .eq('user_id', currentUser.id)
          .maybeSingle() as PromiseLike<{ data: unknown | null }>,
        5000,
        { data: null },
      );
      const data = profileResult.data;

      if (!mounted) return;

      if (!data) {
        setProfile(null);
        return;
      }

      const row = data as unknown as AuthProfile;
      setProfile({
        user_id: row.user_id,
        email: row.email,
        nome: row.nome,
        role: row.role || 'owner',
        active: row.active !== false,
        permissions: row.permissions || {},
      });
    };

    const { data: { subscription } } = supabase.auth.onAuthStateChange(
      (_event, session) => {
        setSession(session);
        setUser(session?.user ?? null);
        // Defer any Supabase calls to avoid deadlocking the auth callback
        setTimeout(() => {
          void loadProfile(session?.user ?? null);
        }, 0);
        setLoading(false);
      },
    );

    const initializeAuth = async () => {
      const sessionResult = await withTimeout(
        supabase.auth.getSession(),
        5000,
        null,
      );

      let nextSession = sessionResult?.data.session ?? null;

      if (!nextSession && devAutoLoginEnabled && isDevAutoLoginAllowed() && devAutoEmail && devAutoPassword) {
        const loginResult = await withTimeout(
          supabase.auth.signInWithPassword({
            email: devAutoEmail,
            password: devAutoPassword,
          }),
          8000,
          null,
        );

        if (loginResult?.error && import.meta.env.DEV) {
          console.warn('[dev auto-login] failed:', loginResult.error.message);
        }

        nextSession = loginResult?.data.session ?? null;
      }

      if (!mounted) return;

      setSession(nextSession);
      setUser(nextSession?.user ?? null);
      setLoading(false);

      setTimeout(() => {
        void loadProfile(nextSession?.user ?? null);
      }, 0);
    };

    void initializeAuth();

    return () => {
      mounted = false;
      subscription.unsubscribe();
    };
  }, []);

  const canAccess = useCallback((moduleId: string) => {
    if (user && !profile) return true;
    if (!profile?.active) return false;
    if (profile.role === 'owner') return true;
    return profile.permissions[moduleId] === true;
  }, [profile, user]);

  const signUp = async () => {
    return { error: new Error('Cadastro público desativado. Solicite acesso ao administrador.') };
  };

  const signIn = async (email: string, password: string) => {
    const { error } = await supabase.auth.signInWithPassword({
      email,
      password,
    });

    return { error: error as Error | null };
  };

  const signOut = async () => {
    await supabase.auth.signOut();
  };

  const resetPassword = async (email: string) => {
    const redirectUrl = `${window.location.origin}/reset-password`;

    const { error } = await supabase.auth.resetPasswordForEmail(email, {
      redirectTo: redirectUrl,
    });

    return { error: error as Error | null };
  };

  const updatePassword = async (newPassword: string) => {
    const { error } = await supabase.auth.updateUser({
      password: newPassword,
    });

    return { error: error as Error | null };
  };

  return (
    <AuthContext.Provider value={{ user, session, profile, loading, canAccess, signUp, signIn, signOut, resetPassword, updatePassword }}>
      {children}
    </AuthContext.Provider>
  );
}
