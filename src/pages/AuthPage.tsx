import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { useAuth } from '@/hooks/useAuth';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Mail, Lock, ArrowRight, ArrowLeft, CheckCircle } from 'lucide-react';
import { useToast } from '@/hooks/use-toast';
import { z } from 'zod';

const emailSchema = z.string().email('Email inválido');
const passwordSchema = z.string().min(6, 'A senha deve ter pelo menos 6 caracteres');
type AuthMode = 'login' | 'forgot';
type AuthFormErrors = { email?: string; password?: string };

function clearAuthError(errors: AuthFormErrors, key: keyof AuthFormErrors) {
  const nextErrors = { ...errors };
  delete nextErrors[key];
  return nextErrors;
}

export default function AuthPage() {
  const [mode, setMode] = useState<AuthMode>('login');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [loading, setLoading] = useState(false);
  const [errors, setErrors] = useState<AuthFormErrors>({});
  const [resetEmailSent, setResetEmailSent] = useState(false);
  
  const { signIn, resetPassword } = useAuth();
  const navigate = useNavigate();
  const { toast } = useToast();

  const validateForm = (skipPassword = false) => {
    const newErrors: { email?: string; password?: string } = {};
    
    const emailResult = emailSchema.safeParse(email);
    if (!emailResult.success) {
      newErrors.email = emailResult.error.errors[0]?.message || 'Email inválido';
    }
    
    if (!skipPassword) {
      const passwordResult = passwordSchema.safeParse(password);
      if (!passwordResult.success) {
        newErrors.password = passwordResult.error.errors[0]?.message || 'Senha inválida';
      }
    }
    
    setErrors(newErrors);
    return Object.keys(newErrors).length === 0;
  };

  const handleForgotPassword = async (e: React.FormEvent) => {
    e.preventDefault();
    
    if (!validateForm(true)) return;
    
    setLoading(true);
    
    try {
      const { error } = await resetPassword(email);
      
      if (error) {
        toast({
          title: 'Erro ao enviar email',
          description: error.message,
          variant: 'destructive',
        });
      } else {
        setResetEmailSent(true);
        toast({
          title: 'Email enviado!',
          description: 'Verifique sua caixa de entrada para redefinir sua senha.',
        });
      }
    } finally {
      setLoading(false);
    }
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    
    if (!validateForm()) return;
    
    setLoading(true);
    
    try {
      const { error } = await signIn(email, password);
      if (error) {
        if (error.message.includes('Invalid login credentials')) {
          toast({
            title: 'Erro no login',
            description: 'Email ou senha incorretos',
            variant: 'destructive',
          });
        } else {
          toast({
            title: 'Erro no login',
            description: error.message,
            variant: 'destructive',
          });
        }
      } else {
        toast({
          title: 'Bem-vindo!',
          description: 'Login realizado com sucesso',
        });
        navigate('/');
      }
    } finally {
      setLoading(false);
    }
  };

  const switchMode = (newMode: AuthMode) => {
    setMode(newMode);
    setErrors({});
    setResetEmailSent(false);
  };

  // Forgot password success view
  if (mode === 'forgot' && resetEmailSent) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-gradient-to-br from-background via-muted to-background p-4">
        <div className="w-full max-w-md">
          <div className="text-center mb-8">
            <div className="inline-flex items-center justify-center w-32 h-32 rounded-3xl shadow-chocolate mb-4 overflow-hidden border-2 border-primary/20">
              <img src="/logo.png" alt="NB Doces Gourmet" className="w-full h-full object-cover" />
            </div>
          </div>

          <div className="bg-card border border-border rounded-2xl p-8 shadow-lg text-center">
            <div className="inline-flex items-center justify-center p-4 bg-primary/20 rounded-full mb-4">
              <CheckCircle className="w-12 h-12 text-primary" />
            </div>
            <h2 className="font-display text-2xl font-semibold mb-2">Email Enviado!</h2>
            <p className="text-muted-foreground mb-6">
              Verifique sua caixa de entrada em <strong>{email}</strong> e clique no link para redefinir sua senha.
            </p>
            <Button
              variant="outline"
              className="gap-2"
              onClick={() => switchMode('login')}
            >
              <ArrowLeft size={18} />
              Voltar ao login
            </Button>
          </div>
        </div>
      </div>
    );
  }

  // Forgot password form
  if (mode === 'forgot') {
    return (
      <div className="min-h-screen flex items-center justify-center bg-gradient-to-br from-background via-muted to-background p-4">
        <div className="w-full max-w-md">
          <div className="text-center mb-8">
            <div className="inline-flex items-center justify-center w-32 h-32 rounded-3xl shadow-chocolate mb-4 overflow-hidden border-2 border-primary/20">
              <img src="/logo.png" alt="NB Doces Gourmet" className="w-full h-full object-cover" />
            </div>
            <p className="text-muted-foreground mt-2">Recuperar Senha</p>
          </div>

          <div className="bg-card border border-border rounded-2xl p-8 shadow-lg">
            <h2 className="font-display text-2xl font-semibold text-center mb-2">
              Esqueceu a senha?
            </h2>
            <p className="text-muted-foreground text-center text-sm mb-6">
              Digite seu email e enviaremos um link para redefinir sua senha.
            </p>

            <form onSubmit={handleForgotPassword} className="space-y-4">
              <div className="space-y-2">
                <Label htmlFor="email">Email</Label>
                <div className="relative">
                  <Mail className="absolute left-3 top-1/2 -translate-y-1/2 text-muted-foreground" size={18} />
                  <Input
                    id="email"
                    type="email"
                    value={email}
                    onChange={(e) => {
                      setEmail(e.target.value);
                      if (errors.email) setErrors(clearAuthError(errors, 'email'));
                    }}
                    placeholder="seu@email.com"
                    className="pl-10"
                    aria-invalid={!!errors.email}
                    aria-describedby={errors.email ? 'forgot-email-error' : undefined}
                  />
                </div>
                {errors.email && (
                  <p id="forgot-email-error" className="text-sm text-destructive">{errors.email}</p>
                )}
              </div>

              <Button type="submit" className="w-full gap-2" disabled={loading}>
                {loading ? 'Enviando...' : 'Enviar Link'}
                <ArrowRight size={18} />
              </Button>
            </form>

            <div className="mt-6 text-center">
              <button
                type="button"
                onClick={() => switchMode('login')}
                className="text-sm text-muted-foreground hover:text-foreground transition-colors inline-flex items-center gap-1"
              >
                <ArrowLeft size={14} />
                Voltar ao login
              </button>
            </div>
          </div>
        </div>
      </div>
    );
  }

  // Login form
  return (
    <div className="min-h-screen flex items-center justify-center bg-gradient-to-br from-background via-muted to-background p-4">
      <div className="w-full max-w-md">
        {/* Logo */}
        <div className="text-center mb-8">
          <div className="inline-flex items-center justify-center w-32 h-32 rounded-3xl shadow-chocolate mb-4 overflow-hidden border-2 border-primary/20">
            <img src="/logo.png" alt="NB Doces" className="w-full h-full object-cover" />
          </div>
          <p className="text-muted-foreground mt-2">Sistema de Gestão</p>
        </div>

        {/* Card */}
        <div className="bg-card border border-border rounded-2xl p-8 shadow-lg">
          <h2 className="font-display text-2xl font-semibold text-center mb-6">
            Entrar
          </h2>

          <form onSubmit={handleSubmit} className="space-y-4">
            <div className="space-y-2">
              <Label htmlFor="email">Email</Label>
              <div className="relative">
                <Mail className="absolute left-3 top-1/2 -translate-y-1/2 text-muted-foreground" size={18} />
                <Input
                  id="email"
                  type="email"
                  value={email}
                  onChange={(e) => {
                    setEmail(e.target.value);
                    if (errors.email) setErrors(clearAuthError(errors, 'email'));
                  }}
                  placeholder="seu@email.com"
                  className="pl-10"
                  aria-invalid={!!errors.email}
                  aria-describedby={errors.email ? 'auth-email-error' : undefined}
                />
              </div>
              {errors.email && (
                <p id="auth-email-error" className="text-sm text-destructive">{errors.email}</p>
              )}
            </div>

            <div className="space-y-2">
              <div className="flex items-center justify-between">
                <Label htmlFor="password">Senha</Label>
                <button
                  type="button"
                  onClick={() => switchMode('forgot')}
                  className="text-xs text-primary hover:underline underline-offset-4"
                >
                  Esqueceu a senha?
                </button>
              </div>
              <div className="relative">
                <Lock className="absolute left-3 top-1/2 -translate-y-1/2 text-muted-foreground" size={18} />
                <Input
                  id="password"
                  type="password"
                  value={password}
                  onChange={(e) => {
                    setPassword(e.target.value);
                    if (errors.password) setErrors(clearAuthError(errors, 'password'));
                  }}
                  placeholder="••••••••"
                  className="pl-10"
                  aria-invalid={!!errors.password}
                  aria-describedby={errors.password ? 'auth-password-error' : undefined}
                />
              </div>
              {errors.password && (
                <p id="auth-password-error" className="text-sm text-destructive">{errors.password}</p>
              )}
            </div>

            <Button type="submit" className="w-full gap-2" disabled={loading}>
              {loading ? 'Carregando...' : 'Entrar'}
              <ArrowRight size={18} />
            </Button>
          </form>

          <div className="mt-6 text-center">
            <p className="text-sm text-muted-foreground">Acesso restrito a contas autorizadas.</p>
          </div>
        </div>
      </div>
    </div>
  );
}
