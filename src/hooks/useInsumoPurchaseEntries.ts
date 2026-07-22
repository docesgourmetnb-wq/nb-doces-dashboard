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
  unidade: string;
  valor_total: number;
  preco_unitario: number;
  data_compra: string;
  transacao_referencia: string | null;
  created_at: string;
}

interface UseInsumoPurchaseEntriesFilters {
  insumoId?: string;
  fornecedorId?: string;
}

function getErrorMessage(error: unknown) {
  return error instanceof Error ? error.message : 'Erro inesperado';
}

export function useInsumoPurchaseEntries(filters: UseInsumoPurchaseEntriesFilters = {}) {
  const [entries, setEntries] = useState<InsumoPurchaseEntry[]>([]);
  const [loading, setLoading] = useState(true);
  const { user } = useAuth();
  const { toast } = useToast();
  const { fornecedorId = 'todos', insumoId = 'todos' } = filters;

  const fetchEntries = useCallback(async () => {
    if (!user) {
      setEntries([]);
      setLoading(false);
      return;
    }

    try {
      setLoading(true);
      let query = supabase
        .from('insumo_purchase_entries')
        .select('*')
        .order('data_compra', { ascending: false })
        .order('created_at', { ascending: false })
        .limit(25);

      if (insumoId !== 'todos') {
        query = query.eq('insumo_id', insumoId);
      }

      if (fornecedorId === 'sem-fornecedor') {
        query = query.is('fornecedor_id', null);
      } else if (fornecedorId !== 'todos') {
        query = query.eq('fornecedor_id', fornecedorId);
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
  }, [fornecedorId, insumoId, toast, user]);

  useEffect(() => {
    fetchEntries();
  }, [fetchEntries]);

  return { entries, loading, refetch: fetchEntries };
}
