import { useCallback } from 'react';
import { supabase } from '@/integrations/supabase/client';
import type { Json, Tables } from '@/integrations/supabase/types';
import { useAuth } from '@/hooks/useAuth';

export type AuditLogEntry = Tables<'audit_log'>;
export type AuditLogMetadata = Record<string, Json>;

const ACTION_LABELS: Record<string, string> = {
  status_changed: 'Status alterado',
  archived: 'Pedido arquivado',
  unarchived: 'Pedido desarquivado',
  venda_created: 'Venda registrada',
  estorno_created: 'Estorno registrado',
  payment_created: 'Pagamento registrado',
  historical_payment_recorded: 'Pagamento histórico registrado',
  stock_consumed: 'Estoque baixado',
  final_product_stock_adjusted: 'Estoque final ajustado',
  final_product_stock_inactivated: 'Produto final inativado',
};

export function getActionLabel(action: string): string {
  return ACTION_LABELS[action] || action;
}

export function useAuditLog() {
  const { user } = useAuth();

  const log = useCallback(
    async (
      entityType: string,
      entityId: string,
      action: string,
      metadata?: AuditLogMetadata,
    ) => {
      if (!user) return;
      try {
        await supabase.from('audit_log').insert({
          user_id: user.id,
          entity_type: entityType,
          entity_id: entityId,
          action,
          metadata: metadata || null,
        });
      } catch {
        // audit logging is best-effort, don't break the main flow
      }
    },
    [user],
  );

  const fetchLogs = useCallback(
    async (entityType: string, entityId: string, limit = 10): Promise<AuditLogEntry[]> => {
      if (!user) return [];
      const { data } = await supabase
        .from('audit_log')
        .select('*')
        .eq('entity_type', entityType)
        .eq('entity_id', entityId)
        .order('created_at', { ascending: false })
        .limit(limit);
      return data || [];
    },
    [user],
  );

  return { log, fetchLogs };
}
