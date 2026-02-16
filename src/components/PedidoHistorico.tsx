import { useState, useEffect } from 'react';
import { History, Loader2 } from 'lucide-react';
import { useAuditLog, AuditLogEntry, getActionLabel } from '@/hooks/useAuditLog';
import { format } from 'date-fns';
import { ptBR } from 'date-fns/locale';

const STATUS_LABELS: Record<string, string> = {
  pendente: 'Pendente',
  'em-producao': 'Em Produção',
  pronto: 'Pronto',
  entregue: 'Entregue',
  cancelado: 'Cancelado',
};

function formatMeta(entry: AuditLogEntry): string | null {
  const m = entry.metadata;
  if (!m) return null;

  switch (entry.action) {
    case 'status_changed':
      return `${STATUS_LABELS[m.from] || m.from} → ${STATUS_LABELS[m.to] || m.to}`;
    case 'archived':
      return m.reason ? `Motivo: ${m.reason}` : null;
    case 'venda_created':
    case 'estorno_created':
      return m.valor != null
        ? `R$ ${Number(m.valor).toLocaleString('pt-BR', { minimumFractionDigits: 2 })}`
        : null;
    default:
      return null;
  }
}

export function PedidoHistorico({ pedidoId }: { pedidoId: string }) {
  const { fetchLogs } = useAuditLog();
  const [logs, setLogs] = useState<AuditLogEntry[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    let cancelled = false;
    setLoading(true);
    fetchLogs('pedido', pedidoId, 10).then((data) => {
      if (!cancelled) {
        setLogs(data);
        setLoading(false);
      }
    });
    return () => { cancelled = true; };
  }, [pedidoId, fetchLogs]);

  if (loading) {
    return (
      <div className="flex items-center justify-center py-4">
        <Loader2 className="w-4 h-4 animate-spin text-muted-foreground" />
      </div>
    );
  }

  if (logs.length === 0) {
    return (
      <p className="text-sm text-muted-foreground py-2">Nenhum evento registrado.</p>
    );
  }

  return (
    <div className="space-y-2">
      <div className="flex items-center gap-2 mb-2">
        <History className="w-4 h-4 text-muted-foreground" />
        <span className="text-sm font-medium text-muted-foreground">Histórico</span>
      </div>
      <div className="space-y-1.5 max-h-56 overflow-y-auto">
        {logs.map((entry) => {
          const detail = formatMeta(entry);
          return (
            <div key={entry.id} className="flex items-start gap-3 text-sm p-2 rounded-lg bg-muted/40">
              <span className="text-xs text-muted-foreground whitespace-nowrap mt-0.5">
                {format(new Date(entry.created_at), "dd/MM HH:mm", { locale: ptBR })}
              </span>
              <div className="min-w-0">
                <span className="font-medium">{getActionLabel(entry.action)}</span>
                {detail && (
                  <span className="ml-1.5 text-muted-foreground">{detail}</span>
                )}
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
}
