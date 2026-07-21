import { useCallback, useEffect, useState } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/hooks/useAuth';
import { useToast } from '@/hooks/use-toast';
import { FINANCIAL_CONTROL_START_DATE } from '@/domain/financeiro';
import { toFiniteNumber } from '@/domain/numeros';

interface FinancialSummary {
  totalEntradas: number;
  totalSaidas: number;
  lucroBruto: number;
  totalHistorico: number;
}

interface FinancialSummaryRow {
  total_entradas: number | string | null;
  total_saidas: number | string | null;
  lucro_bruto: number | string | null;
  total_historico?: number | string | null;
}

type FinancialSummaryRpc = (
  fn: 'get_financial_summary',
) => Promise<{ data: FinancialSummaryRow[] | null; error: { message: string } | null }>;

interface PedidoHistoricoSummaryRow {
  valor_pago: number | string | null;
  valor_total: number | string | null;
}

const emptySummary: FinancialSummary = {
  totalEntradas: 0,
  totalSaidas: 0,
  lucroBruto: 0,
  totalHistorico: 0,
};

function getErrorMessage(error: unknown) {
  if (error instanceof Error) return error.message;
  if (error && typeof error === 'object' && 'message' in error) {
    const message = (error as { message?: unknown }).message;
    if (typeof message === 'string') return message;
  }
  return 'Erro inesperado';
}

function buildHistoricalTotalFromRows(rows: PedidoHistoricoSummaryRow[]) {
  return rows.reduce((total, row) => {
    const valorPago = toFiniteNumber(row.valor_pago);
    return total + (valorPago > 0 ? valorPago : toFiniteNumber(row.valor_total));
  }, 0);
}

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
      const { data: pedidosHistoricos, error: pedidosHistoricosError } = await supabase
        .from('pedidos')
        .select('valor_pago, valor_total')
        .lt('data_entrega', FINANCIAL_CONTROL_START_DATE)
        .eq('status_financeiro', 'pago')
        .is('archived_at', null)
        .or('status_operacional.eq.entregue,status.eq.entregue');

      if (pedidosHistoricosError) throw pedidosHistoricosError;
      const totalHistorico = buildHistoricalTotalFromRows((pedidosHistoricos || []) as PedidoHistoricoSummaryRow[]);

      const rpc = supabase.rpc.bind(supabase) as unknown as FinancialSummaryRpc;
      const { data, error } = await rpc('get_financial_summary');
      if (error) throw error;

      const row = Array.isArray(data) ? data[0] : null;
      setSummary({
        totalEntradas: toFiniteNumber(row?.total_entradas),
        totalSaidas: toFiniteNumber(row?.total_saidas),
        lucroBruto: toFiniteNumber(row?.lucro_bruto),
        totalHistorico: toFiniteNumber(row?.total_historico, totalHistorico),
      });
    } catch (error: unknown) {
      toast({
        title: 'Erro ao carregar resumo financeiro',
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

  return { summary, loading, refetch: fetchSummary };
}
