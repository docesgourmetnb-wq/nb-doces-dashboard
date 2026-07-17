import { createContext, useContext } from 'react';
import { User, Session } from '@supabase/supabase-js';

export type AppRole = 'owner' | 'admin' | 'operator' | 'viewer';

export interface AuthProfile {
  user_id: string;
  email: string | null;
  nome: string | null;
  role: AppRole;
  active: boolean;
  permissions: Record<string, boolean>;
}

export interface AuthContextType {
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

export const AuthContext = createContext<AuthContextType | undefined>(undefined);

export function useAuth() {
  const context = useContext(AuthContext);
  if (context === undefined) {
    throw new Error('useAuth must be used within an AuthProvider');
  }
  return context;
}
