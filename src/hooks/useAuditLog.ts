import { useCallback } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/hooks/useAuth';

export interface AuditLogEntry {
  id: string;
  user_id: string;
  entity_type: string;
  entity_id: string;
  action: string;
  metadata: Record<string, any> | null;
  created_at: string;
}

const ACTION_LABELS: Record<string, string> = {
  status_changed: 'Status alterado',
  archived: 'Pedido arquivado',
  unarchived: 'Pedido desarquivado',
  venda_created: 'Venda registrada',
  estorno_created: 'Estorno registrado',
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
      metadata?: Record<string, any>,
    ) => {
      if (!user) return;
      try {
        await supabase.from('audit_log').insert({
          user_id: user.id,
          entity_type: entityType,
          entity_id: entityId,
          action,
          metadata: metadata || null,
        } as any);
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
        .limit(limit) as any;
      return (data || []) as AuditLogEntry[];
    },
    [user],
  );

  return { log, fetchLogs };
}
