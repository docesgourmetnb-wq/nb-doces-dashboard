import { useCallback, useEffect, useState } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/hooks/useAuth';
import { useToast } from '@/hooks/use-toast';

interface FinancialSummary {
  totalEntradas: number;
  totalSaidas: number;
  lucroBruto: number;
}

interface FinancialSummaryRow {
  total_entradas: number | string | null;
  total_saidas: number | string | null;
  lucro_bruto: number | string | null;
}

type FinancialSummaryRpc = (
  fn: 'get_financial_summary',
) => Promise<{ data: FinancialSummaryRow[] | null; error: { message: string } | null }>;

const emptySummary: FinancialSummary = {
  totalEntradas: 0,
  totalSaidas: 0,
  lucroBruto: 0,
};

export function useFinancialSummary() {
  const [summary, setSummary] = useState<FinancialSummary>(emptySummary);
  const [loading, setLoading] = useState(true);
  const { user } = useAuth();
  const { toast } = useToast();

  const fetchSummary = useCallback(async () => {
    if (!user) {
      setSummary(emptySummary);
      setLoading(false);
      return;
    }

    setLoading(true);
    try {
      const rpc = supabase.rpc as unknown as FinancialSummaryRpc;
      const { data, error } = await rpc('get_financial_summary');
      if (error) throw error;

      const row = Array.isArray(data) ? data[0] : null;
      setSummary({
        totalEntradas: Number(row?.total_entradas ?? 0),
        totalSaidas: Number(row?.total_saidas ?? 0),
        lucroBruto: Number(row?.lucro_bruto ?? 0),
      });
    } catch (error: unknown) {
      const message = error instanceof Error ? error.message : 'Erro inesperado';
      toast({
        title: 'Erro ao carregar resumo financeiro',
        description: message,
        variant: 'destructive',
      });
    } finally {
      setLoading(false);
    }
  }, [user, toast]);

  useEffect(() => {
    fetchSummary();
  }, [fetchSummary]);

  return { summary, loading, refetch: fetchSummary };
}
