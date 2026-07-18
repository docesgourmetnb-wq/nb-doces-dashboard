import { useCallback, useEffect, useState } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/hooks/useAuth';
import { useToast } from '@/hooks/use-toast';
import {
  aggregateProductionDemand,
  type ProductionDemandItem,
  type ProductionDemandPedidoInput,
} from '@/domain/productionDemand';

type PedidoDemandRow = {
  id: string;
  cliente: string;
  data_entrega: string;
  status: string;
  status_operacional: string | null;
  itens_pedido?: Array<{
    brigadeiro_id: string | null;
    brigadeiro_nome: string;
    quantidade: number;
  }> | null;
};

type EstoqueProdutoRow = {
  nome: string;
  quantidade_atual: number | null;
};

function parseLegacyProdutoEstoque(row: EstoqueProdutoRow) {
  const match = row.nome.match(/\[PRODUTO\] (.*?)::(.*)/);

  return {
    brigadeiro_id: match?.[1] || null,
    nome: match?.[2] || row.nome,
    quantidade: row.quantidade_atual || 0,
  };
}

function getErrorMessage(error: unknown) {
  if (error instanceof Error) return error.message;
  if (error && typeof error === 'object' && 'message' in error) {
    const message = (error as { message?: unknown }).message;
    if (typeof message === 'string') return message;
  }
  return 'Erro inesperado';
}

export function useProductionDemand() {
  const [items, setItems] = useState<ProductionDemandItem[]>([]);
  const [loading, setLoading] = useState(true);
  const { user } = useAuth();
  const { toast } = useToast();

  const fetchDemand = useCallback(async () => {
    if (!user) {
      setItems([]);
      setLoading(false);
      return;
    }

    setLoading(true);
    try {
      const [pedidosResult, estoqueResult] = await Promise.all([
        supabase
          .from('pedidos')
          .select('id, cliente, data_entrega, status, status_operacional, itens_pedido(brigadeiro_id, brigadeiro_nome, quantidade)')
          .is('archived_at', null)
          .in('status_operacional', ['confirmado', 'em-producao'])
          .order('data_entrega', { ascending: true }),
        supabase
          .from('insumos')
          .select('nome, quantidade_atual')
          .eq('unidade', 'SYS_PROD'),
      ]);

      if (pedidosResult.error) throw pedidosResult.error;
      if (estoqueResult.error) throw estoqueResult.error;

      const pedidos = ((pedidosResult.data || []) as PedidoDemandRow[]).map<ProductionDemandPedidoInput>((pedido) => ({
        id: pedido.id,
        cliente: pedido.cliente,
        data_entrega: pedido.data_entrega,
        status: pedido.status_operacional || pedido.status,
        itens: pedido.itens_pedido || [],
      }));
      const estoquePronto = ((estoqueResult.data || []) as EstoqueProdutoRow[]).map(parseLegacyProdutoEstoque);

      setItems(aggregateProductionDemand(pedidos, estoquePronto));
    } catch (error: unknown) {
      toast({
        title: 'Erro ao carregar produção pendente',
        description: getErrorMessage(error),
        variant: 'destructive',
      });
    } finally {
      setLoading(false);
    }
  }, [user, toast]);

  useEffect(() => {
    fetchDemand();
  }, [fetchDemand]);

  return {
    items,
    loading,
    totalUnidades: items.reduce((total, item) => total + item.quantidade, 0),
    refetch: fetchDemand,
  };
}
