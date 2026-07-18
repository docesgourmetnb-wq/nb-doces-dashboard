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
    brigadeiro_nome: string;
    quantidade: number;
  }> | null;
};

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
      const { data, error } = await supabase
        .from('pedidos')
        .select('id, cliente, data_entrega, status, status_operacional, itens_pedido(brigadeiro_nome, quantidade)')
        .is('archived_at', null)
        .in('status_operacional', ['confirmado', 'em-producao'])
        .order('data_entrega', { ascending: true });

      if (error) throw error;

      const pedidos = ((data || []) as PedidoDemandRow[]).map<ProductionDemandPedidoInput>((pedido) => ({
        id: pedido.id,
        cliente: pedido.cliente,
        data_entrega: pedido.data_entrega,
        status: pedido.status_operacional || pedido.status,
        itens: pedido.itens_pedido || [],
      }));

      setItems(aggregateProductionDemand(pedidos));
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
