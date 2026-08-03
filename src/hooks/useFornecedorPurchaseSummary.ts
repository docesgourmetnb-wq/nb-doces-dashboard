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
      const [{ data: stockEntries, error: stockError }, { data: looseEntries, error: looseError }] = await Promise.all([
        supabase
          .from('insumo_purchase_entries')
          .select('fornecedor_id, valor_total, data_compra')
          .not('fornecedor_id', 'is', null)
          .gt('valor_total', 0),
        supabase
          .from('fornecedor_purchase_entries')
          .select('fornecedor_id, valor_total, data_compra')
          .gt('valor_total', 0),
      ]);

      if (stockError) throw stockError;
      if (looseError) throw looseError;

      const stockRows: FornecedorPurchaseRow[] = (stockEntries || []).map((entry) => ({
        fornecedor_id: entry.fornecedor_id,
        valor: Number(entry.valor_total) || 0,
        data: entry.data_compra,
      }));

      const looseRows: FornecedorPurchaseRow[] = (looseEntries || []).map((entry) => ({
        fornecedor_id: entry.fornecedor_id,
        valor: Number(entry.valor_total) || 0,
        data: entry.data_compra,
      }));

      setSummaryByFornecedorId(summarizeFornecedorPurchases([...stockRows, ...looseRows]));
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
