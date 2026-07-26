import { useCallback } from 'react';
import { supabase } from '@/integrations/supabase/client';
import type { Json, Tables } from '@/integrations/supabase/types';
import { useAuth } from '@/hooks/useAuth';
import { getAuditActionLabel } from '@/domain/auditLog';

export type AuditLogEntry = Tables<'audit_log'>;
export type AuditLogMetadata = Record<string, Json>;

export function getActionLabel(action: string): string {
  return getAuditActionLabel(action);
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
