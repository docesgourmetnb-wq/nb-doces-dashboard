import { useCallback, useEffect, useState } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/hooks/useAuth';
import { useToast } from '@/hooks/use-toast';

export interface InsumoPurchaseEntry {
  id: string;
  user_id: string;
  insumo_id: string;
  fornecedor_id: string | null;
  quantidade: number;
  quantidade_embalagens: number | null;
  conteudo_por_embalagem: number | null;
  unidade: string;
  valor_total: number;
  preco_unitario: number;
  data_compra: string | null;
  transacao_referencia: string | null;
  origem_pagamento?: 'sem_valor' | 'caixa' | 'fora_caixa';
  created_at: string;
}

interface UseInsumoPurchaseEntriesFilters {
  enabled?: boolean;
  insumoId?: string;
  insumoIds?: string[] | undefined;
  fornecedorId?: string;
  origemPagamento?: 'todos' | 'sem_valor' | 'caixa' | 'fora_caixa';
  limit?: number;
}

function getErrorMessage(error: unknown) {
  return error instanceof Error ? error.message : 'Erro inesperado';
}

export function useInsumoPurchaseEntries(filters: UseInsumoPurchaseEntriesFilters = {}) {
  const [entries, setEntries] = useState<InsumoPurchaseEntry[]>([]);
  const [loading, setLoading] = useState(true);
  const { user } = useAuth();
  const { toast } = useToast();
  const { enabled = true, fornecedorId = 'todos', insumoId = 'todos', insumoIds, origemPagamento = 'todos', limit = 25 } = filters;

  const fetchEntries = useCallback(async () => {
    if (!user || !enabled) {
      setEntries([]);
      setLoading(false);
      return;
    }

    try {
      setLoading(true);

      if (insumoId === 'todos' && insumoIds && insumoIds.length === 0) {
        setEntries([]);
        return;
      }

      let query = supabase
        .from('insumo_purchase_entries')
        .select('*')
        .order('data_compra', { ascending: false, nullsFirst: false })
        .order('created_at', { ascending: false })
        .limit(limit);

      if (insumoId !== 'todos') {
        query = query.eq('insumo_id', insumoId);
      } else if (insumoIds && insumoIds.length > 0) {
        query = query.in('insumo_id', insumoIds);
      }

      if (fornecedorId === 'sem-fornecedor') {
        query = query.is('fornecedor_id', null);
      } else if (fornecedorId !== 'todos') {
        query = query.eq('fornecedor_id', fornecedorId);
      }

      if (origemPagamento !== 'todos') {
        query = query.eq('origem_pagamento', origemPagamento);
      }

      const { data, error } = await query;

      if (error) throw error;
      setEntries((data || []) as InsumoPurchaseEntry[]);
    } catch (error: unknown) {
      toast({
        title: 'Erro ao carregar compras de insumos',
        description: getErrorMessage(error),
        variant: 'destructive',
      });
    } finally {
      setLoading(false);
    }
  }, [enabled, fornecedorId, insumoId, insumoIds, limit, origemPagamento, toast, user]);

  useEffect(() => {
    fetchEntries();
  }, [fetchEntries]);

  return { entries, loading, refetch: fetchEntries };
}
