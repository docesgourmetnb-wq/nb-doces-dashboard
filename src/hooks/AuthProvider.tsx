import { ReactNode, useCallback, useEffect, useState } from 'react';
import { User, Session } from '@supabase/supabase-js';
import { supabase } from '@/integrations/supabase/client';
import { AuthContext, AuthProfile } from '@/hooks/useAuth';

const signupEnabled = import.meta.env.VITE_ENABLE_SIGNUP === 'true';
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

function withTimeout<T>(promise: PromiseLike<T>, timeoutMs: number, timeoutValue: T) {
  return new Promise<T>((resolve) => {
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

      const { data } = await withTimeout(
        supabase
          .from('profiles')
          .select('user_id,email,nome,role,active,permissions')
          .eq('user_id', currentUser.id)
          .maybeSingle(),
        5000,
        { data: null, error: null },
      );

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
        { data: { session: null }, error: null },
      );

      let nextSession = sessionResult.data.session;

      if (!nextSession && devAutoLoginEnabled && isDevAutoLoginAllowed() && devAutoEmail && devAutoPassword) {
        const { data, error } = await withTimeout(
          supabase.auth.signInWithPassword({
            email: devAutoEmail,
            password: devAutoPassword,
          }),
          8000,
          { data: { user: null, session: null }, error: new Error('Tempo excedido no login automático.') },
        );

        if (error && import.meta.env.DEV) {
          console.warn('[dev auto-login] failed:', error.message);
        }

        nextSession = data.session;
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

  const signUp = async (email: string, password: string, nome?: string) => {
    if (!signupEnabled) {
      return { error: new Error('Cadastro desativado. Solicite acesso ao administrador.') };
    }

    const redirectUrl = `${window.location.origin}/`;

    const { error } = await supabase.auth.signUp({
      email,
      password,
      options: {
        emailRedirectTo: redirectUrl,
        data: {
          nome: nome || email.split('@')[0],
        },
      },
    });

    return { error: error as Error | null };
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
