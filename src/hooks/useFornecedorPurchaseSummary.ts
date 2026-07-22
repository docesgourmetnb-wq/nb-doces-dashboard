import { useCallback, useEffect, useState } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/hooks/useAuth';
import { useToast } from '@/hooks/use-toast';
import {
  type FornecedorPurchaseRow,
  type FornecedorPurchaseSummary,
  summarizeFornecedorPurchases,
} from '@/domain/fornecedores';

function getErrorMessage(error: unknown) {
  return error instanceof Error ? error.message : 'Erro inesperado';
}

export function useFornecedorPurchaseSummary() {
  const [summaryByFornecedorId, setSummaryByFornecedorId] = useState<Record<string, FornecedorPurchaseSummary>>({});
  const [loading, setLoading] = useState(true);
  const { user } = useAuth();
  const { toast } = useToast();

  const fetchSummary = useCallback(async () => {
    if (!user) {
      setLoading(false);
      return;
    }

    try {
      const { data, error } = await supabase
        .from('transacoes')
        .select('fornecedor_id, valor, data')
        .eq('tipo', 'saida')
        .eq('categoria', 'Insumos')
        .not('fornecedor_id', 'is', null);

      if (error) throw error;
      setSummaryByFornecedorId(summarizeFornecedorPurchases((data || []) as FornecedorPurchaseRow[]));
    } catch (error: unknown) {
      toast({
        title: 'Erro ao carregar compras por fornecedor',
        description: getErrorMessage(error),
        variant: 'destructive',
      });
    } finally {
      setLoading(false);
    }
  }, [user, toast]);

  useEffect(() => {
    fetchSummary();
  }, [fetchSummary]);

  return { summaryByFornecedorId, loading, refetch: fetchSummary };
}
