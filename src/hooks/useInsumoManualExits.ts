import { useCallback, useEffect, useState } from 'react';
import { supabase } from '@/integrations/supabase/client';
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
        .from('insumo_manual_exits')
        .select('*')
        .order('created_at', { ascending: false })
        .limit(limit);

      if (insumoId !== 'todos') {
        query = query.eq('insumo_id', insumoId);
      } else if (insumoIds && insumoIds.length > 0) {
        query = query.in('insumo_id', insumoIds);
      }

      const { data, error } = await query;

      if (error) throw error;

      setExits((data || []).map((entry) => ({
        id: entry.id,
        user_id: entry.user_id,
        insumo_id: entry.insumo_id,
        quantidade: Number(entry.quantidade || 0),
        unidade: entry.unidade || '',
        motivo: entry.motivo || null,
        saldo_anterior: entry.saldo_anterior === null ? null : Number(entry.saldo_anterior),
        saldo_atual: entry.saldo_atual === null ? null : Number(entry.saldo_atual),
        created_at: entry.created_at,
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
