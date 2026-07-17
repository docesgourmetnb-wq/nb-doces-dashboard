import { useState, useEffect, createContext, useContext, ReactNode, useCallback } from 'react';
import { User, Session } from '@supabase/supabase-js';
import { supabase } from '@/integrations/supabase/client';

const signupEnabled = import.meta.env.VITE_ENABLE_SIGNUP === 'true';

export type AppRole = 'owner' | 'admin' | 'operator' | 'viewer';

export interface AuthProfile {
  user_id: string;
  email: string | null;
  nome: string | null;
  role: AppRole;
  active: boolean;
  permissions: Record<string, boolean>;
}

interface AuthContextType {
  user: User | null;
  session: Session | null;
  profile: AuthProfile | null;
  loading: boolean;
  canAccess: (moduleId: string) => boolean;
  signUp: (email: string, password: string, nome?: string) => Promise<{ error: Error | null }>;
  signIn: (email: string, password: string) => Promise<{ error: Error | null }>;
  signOut: () => Promise<void>;
  resetPassword: (email: string) => Promise<{ error: Error | null }>;
  updatePassword: (newPassword: string) => Promise<{ error: Error | null }>;
}

const AuthContext = createContext<AuthContextType | undefined>(undefined);

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

      const { data } = await supabase
        .from('profiles')
        .select('user_id,email,nome,role,active,permissions')
        .eq('user_id', currentUser.id)
        .maybeSingle();

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

    // Set up auth state listener FIRST
    const { data: { subscription } } = supabase.auth.onAuthStateChange(
      async (event, session) => {
        setSession(session);
        setUser(session?.user ?? null);
        await loadProfile(session?.user ?? null);
        setLoading(false);
      }
    );

    // THEN check for existing session
    supabase.auth.getSession().then(async ({ data: { session } }) => {
      setSession(session);
      setUser(session?.user ?? null);
      await loadProfile(session?.user ?? null);
      setLoading(false);
    });

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
        }
      }
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

export function useAuth() {
  const context = useContext(AuthContext);
  if (context === undefined) {
    throw new Error('useAuth must be used within an AuthProvider');
  }
  return context;
}
