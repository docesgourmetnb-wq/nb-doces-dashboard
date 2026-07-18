import { Toaster } from "@/components/ui/toaster";
import { Toaster as Sonner } from "@/components/ui/sonner";
import { TooltipProvider } from "@/components/ui/tooltip";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { BrowserRouter, Routes, Route, Navigate } from "react-router-dom";
import { AlertTriangle, RefreshCw } from "lucide-react";
import { AppErrorBoundary } from "@/components/AppErrorBoundary";
import { Button } from "@/components/ui/button";
import { AuthProvider } from "@/hooks/AuthProvider";
import { useAuth } from "@/hooks/useAuth";
import { supabaseConfigError } from "@/integrations/supabase/client";
import Index from "./pages/Index";
import AuthPage from "./pages/AuthPage";
import ResetPasswordPage from "./pages/ResetPasswordPage";
import NotFound from "./pages/NotFound";

const queryClient = new QueryClient();

function ProtectedRoute({ children }: { children: React.ReactNode }) {
  const { user, profile, loading } = useAuth();
  
  if (loading) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-background">
        <div className="animate-pulse text-muted-foreground">Carregando...</div>
      </div>
    );
  }
  
  if (!user) {
    return <Navigate to="/auth" replace />;
  }

  if (profile && !profile.active) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-background p-4">
        <div className="max-w-md text-center space-y-2">
          <h1 className="font-display text-2xl font-semibold text-foreground">Acesso desativado</h1>
          <p className="text-muted-foreground">Sua conta está inativa. Solicite reativação ao administrador.</p>
        </div>
      </div>
    );
  }
  
  return <>{children}</>;
}

function PublicRoute({ children }: { children: React.ReactNode }) {
  const { user, loading } = useAuth();
  
  if (loading) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-background">
        <div className="animate-pulse text-muted-foreground">Carregando...</div>
      </div>
    );
  }
  
  if (user) {
    return <Navigate to="/" replace />;
  }
  
  return <>{children}</>;
}

const AppRoutes = () => (
  <Routes>
    <Route path="/auth" element={
      <PublicRoute>
        <AuthPage />
      </PublicRoute>
    } />
    <Route path="/reset-password" element={
      <ResetPasswordPage />
    } />
    <Route path="/" element={
      <ProtectedRoute>
        <Index />
      </ProtectedRoute>
    } />
    <Route path="*" element={<NotFound />} />
  </Routes>
);

function SupabaseConfigFallback() {
  return (
    <div className="min-h-screen bg-background text-foreground flex items-center justify-center p-6">
      <div className="w-full max-w-md rounded-lg border border-border bg-card p-6 shadow-sm space-y-4">
        <div className="flex items-center gap-3">
          <div className="h-10 w-10 rounded-md bg-warning/10 text-warning flex items-center justify-center">
            <AlertTriangle className="h-5 w-5" />
          </div>
          <div>
            <h1 className="font-display text-xl font-semibold">Preview sem conexão</h1>
            <p className="text-sm text-muted-foreground">O Supabase não está configurado neste ambiente.</p>
          </div>
        </div>
        <p className="rounded-md bg-muted p-3 text-sm text-muted-foreground">{supabaseConfigError}</p>
        <Button className="w-full gap-2" onClick={() => window.location.reload()}>
          <RefreshCw className="h-4 w-4" />
          Recarregar preview
        </Button>
      </div>
    </div>
  );
}

const App = () => (
  <AppErrorBoundary>
    <QueryClientProvider client={queryClient}>
      <TooltipProvider>
        <Toaster />
        <Sonner />
        {supabaseConfigError ? (
          <SupabaseConfigFallback />
        ) : (
          <AuthProvider>
            <BrowserRouter>
              <AppRoutes />
            </BrowserRouter>
          </AuthProvider>
        )}
      </TooltipProvider>
    </QueryClientProvider>
  </AppErrorBoundary>
);

export default App;
