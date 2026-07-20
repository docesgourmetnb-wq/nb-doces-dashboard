import { useCallback, useEffect, useState } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/hooks/useAuth';
import { useToast } from '@/hooks/use-toast';
import { toFiniteNumber } from '@/domain/numeros';

export interface DashboardClientRank {
  nome: string;
  pedidos: number;
  valor: number;
}

export interface DashboardProductRank {
  nome: string;
  quantidade: number;
  receita: number;
}

export interface DashboardFlavorRank {
  nome: string;
  quantidade: number;
}

export interface DashboardSummary {
  vendasPeriodo: number;
  despesasPeriodo: number;
  lucroPeriodo: number;
  vendasAno: number;
  vendasTotal: number;
  pedidosPeriodo: number;
  pedidosEntregues: number;
  ticketMedio: number;
  taxaConversao: number;
  topClientes: DashboardClientRank[];
  topProdutos: DashboardProductRank[];
  saboresMaisVendidos: DashboardFlavorRank[];
}

interface DashboardSummaryRow {
  vendas_periodo: number | string | null;
  despesas_periodo: number | string | null;
  lucro_periodo: number | string | null;
  vendas_ano: number | string | null;
  vendas_total: number | string | null;
  pedidos_periodo: number | string | null;
  pedidos_entregues: number | string | null;
  ticket_medio: number | string | null;
  taxa_conversao: number | string | null;
  top_clientes: unknown;
  top_produtos: unknown;
  sabores_mais_vendidos: unknown;
}

type DashboardSummaryRpc = (
  fn: 'get_dashboard_summary',
  args: { p_year: number; p_month: number },
) => Promise<{ data: DashboardSummaryRow[] | null; error: { message: string } | null }>;

const emptySummary: DashboardSummary = {
  vendasPeriodo: 0,
  despesasPeriodo: 0,
  lucroPeriodo: 0,
  vendasAno: 0,
  vendasTotal: 0,
  pedidosPeriodo: 0,
  pedidosEntregues: 0,
  ticketMedio: 0,
  taxaConversao: 0,
  topClientes: [],
  topProdutos: [],
  saboresMaisVendidos: [],
};

function normalizeArray<T>(value: unknown): T[] {
  return Array.isArray(value) ? (value as T[]) : [];
}

export function useDashboardSummary(year: number, month: number) {
  const [summary, setSummary] = useState<DashboardSummary>(emptySummary);
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
      const rpc = supabase.rpc.bind(supabase) as unknown as DashboardSummaryRpc;
      const { data, error } = await rpc('get_dashboard_summary', {
        p_year: year,
        p_month: month,
      });
      if (error) throw error;

      const row = data?.[0];
      setSummary({
        vendasPeriodo: toFiniteNumber(row?.vendas_periodo),
        despesasPeriodo: toFiniteNumber(row?.despesas_periodo),
        lucroPeriodo: toFiniteNumber(row?.lucro_periodo),
        vendasAno: toFiniteNumber(row?.vendas_ano),
        vendasTotal: toFiniteNumber(row?.vendas_total),
        pedidosPeriodo: toFiniteNumber(row?.pedidos_periodo),
        pedidosEntregues: toFiniteNumber(row?.pedidos_entregues),
        ticketMedio: toFiniteNumber(row?.ticket_medio),
        taxaConversao: toFiniteNumber(row?.taxa_conversao),
        topClientes: normalizeArray<DashboardClientRank>(row?.top_clientes),
        topProdutos: normalizeArray<DashboardProductRank>(row?.top_produtos),
        saboresMaisVendidos: normalizeArray<DashboardFlavorRank>(row?.sabores_mais_vendidos),
      });
    } catch (error: unknown) {
      const message = error instanceof Error ? error.message : 'Erro inesperado';
      toast({
        title: 'Erro ao carregar dashboard',
        description: message,
        variant: 'destructive',
      });
    } finally {
      setLoading(false);
    }
  }, [user, toast, year, month]);

  useEffect(() => {
    fetchSummary();
  }, [fetchSummary]);

  return { summary, loading, refetch: fetchSummary };
}
