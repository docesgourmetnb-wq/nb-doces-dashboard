import { useCallback, useEffect, useState } from 'react';
import { supabase } from '@/integrations/supabase/client';
import type { Json } from '@/integrations/supabase/types';
import { useAuth } from '@/hooks/useAuth';
import { useToast } from '@/hooks/use-toast';

export interface InsumoManualExit {
  id: string;
  user_id: string;
  insumo_id: string;
  quantidade: number;
  unidade: string;
  motivo: string | null;
  saldo_anterior: number | null;
  saldo_atual: number | null;
  created_at: string;
}

interface UseInsumoManualExitsFilters {
  enabled?: boolean;
  insumoId?: string;
  insumoIds?: string[] | undefined;
  limit?: number;
}

function getErrorMessage(error: unknown) {
  return error instanceof Error ? error.message : 'Erro inesperado';
}

function readNumber(metadata: Record<string, Json | undefined>, key: string) {
  const value = metadata[key];
  return typeof value === 'number' && Number.isFinite(value) ? value : null;
}

function readString(metadata: Record<string, Json | undefined>, key: string) {
  const value = metadata[key];
  return typeof value === 'string' && value.trim() ? value.trim() : null;
}

function parseManualExitMetadata(metadata: Json | null) {
  if (!metadata || typeof metadata !== 'object' || Array.isArray(metadata)) {
    return {
      quantidade: 0,
      unidade: '',
      motivo: null,
      saldo_anterior: null,
      saldo_atual: null,
    };
  }

  return {
    quantidade: readNumber(metadata, 'quantidade') ?? 0,
    unidade: readString(metadata, 'unidade') ?? '',
    motivo: readString(metadata, 'motivo'),
    saldo_anterior: readNumber(metadata, 'saldo_anterior'),
    saldo_atual: readNumber(metadata, 'saldo_atual'),
  };
}

export function useInsumoManualExits(filters: UseInsumoManualExitsFilters = {}) {
  const [exits, setExits] = useState<InsumoManualExit[]>([]);
  const [loading, setLoading] = useState(true);
  const { user } = useAuth();
  const { toast } = useToast();
  const { enabled = true, insumoId = 'todos', insumoIds, limit = 25 } = filters;

  const fetchExits = useCallback(async () => {
    if (!user || !enabled) {
      setExits([]);
      setLoading(false);
      return;
    }

    try {
      setLoading(true);

      if (insumoId === 'todos' && insumoIds && insumoIds.length === 0) {
        setExits([]);
        return;
      }

      let query = supabase
        .from('audit_log')
        .select('*')
        .eq('entity_type', 'insumo')
        .eq('action', 'stock_manual_exit_registered')
        .order('created_at', { ascending: false })
        .limit(limit);

      if (insumoId !== 'todos') {
        query = query.eq('entity_id', insumoId);
      } else if (insumoIds && insumoIds.length > 0) {
        query = query.in('entity_id', insumoIds);
      }

      const { data, error } = await query;

      if (error) throw error;

      setExits((data || []).map((entry) => ({
        id: entry.id,
        user_id: entry.user_id,
        insumo_id: entry.entity_id,
        created_at: entry.created_at,
        ...parseManualExitMetadata(entry.metadata),
      })));
    } catch (error: unknown) {
      toast({
        title: 'Erro ao carregar saídas de insumos',
        description: getErrorMessage(error),
        variant: 'destructive',
      });
    } finally {
      setLoading(false);
    }
  }, [enabled, insumoId, insumoIds, limit, toast, user]);

  useEffect(() => {
    fetchExits();
  }, [fetchExits]);

  return { exits, loading, refetch: fetchExits };
}
