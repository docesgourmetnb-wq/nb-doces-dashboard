import { Component, type ErrorInfo, type ReactNode } from 'react';
import { AlertTriangle, RefreshCw } from 'lucide-react';
import { Button } from '@/components/ui/button';

interface AppErrorBoundaryProps {
  children: ReactNode;
}

interface AppErrorBoundaryState {
  hasError: boolean;
  message: string;
}

export class AppErrorBoundary extends Component<AppErrorBoundaryProps, AppErrorBoundaryState> {
  override state: AppErrorBoundaryState = {
    hasError: false,
    message: '',
  };

  static getDerivedStateFromError(error: unknown): AppErrorBoundaryState {
    return {
      hasError: true,
      message: error instanceof Error ? error.message : 'Erro inesperado ao carregar o aplicativo.',
    };
  }

  override componentDidCatch(error: unknown, errorInfo: ErrorInfo) {
    if (import.meta.env.DEV) {
      console.error('[app error boundary]', error, errorInfo);
    }
  }

  override render() {
    if (!this.state.hasError) return this.props.children;

    return (
      <div className="min-h-screen bg-background text-foreground flex items-center justify-center p-6">
        <div className="w-full max-w-md rounded-lg border border-border bg-card p-6 shadow-sm space-y-4">
          <div className="flex items-center gap-3">
            <div className="h-10 w-10 rounded-md bg-destructive/10 text-destructive flex items-center justify-center">
              <AlertTriangle className="h-5 w-5" />
            </div>
            <div>
              <h1 className="font-display text-xl font-semibold">Não foi possível carregar</h1>
              <p className="text-sm text-muted-foreground">Recarregue o preview para tentar novamente.</p>
            </div>
          </div>
          {this.state.message && (
            <p className="rounded-md bg-muted p-3 text-sm text-muted-foreground">{this.state.message}</p>
          )}
          <Button className="w-full gap-2" onClick={() => window.location.reload()}>
            <RefreshCw className="h-4 w-4" />
            Recarregar
          </Button>
        </div>
      </div>
    );
  }
}
