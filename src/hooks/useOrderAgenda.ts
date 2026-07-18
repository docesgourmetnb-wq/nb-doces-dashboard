import { useCallback, useEffect, useState } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/hooks/useAuth';
import { useToast } from '@/hooks/use-toast';
import {
  buildOrderAgenda,
  type AgendaPedido,
  type AgendaPedidoInput,
} from '@/domain/orderAgenda';

type AgendaPedidoRow = {
  id: string;
  cliente: string;
  data_entrega: string;
  tipo_entrega: string;
  status: string;
  status_operacional: string | null;
  status_financeiro: string;
  valor_total: number;
  saldo_restante: number | null;
  itens_pedido?: Array<{
    quantidade: number;
  }> | null;
};

function getTodayKey() {
  const today = new Date();
  return `${today.getFullYear()}-${String(today.getMonth() + 1).padStart(2, '0')}-${String(today.getDate()).padStart(2, '0')}`;
}

function getErrorMessage(error: unknown) {
  if (error instanceof Error) return error.message;
  if (error && typeof error === 'object' && 'message' in error) {
    const message = (error as { message?: unknown }).message;
    if (typeof message === 'string') return message;
  }
  return 'Erro inesperado';
}

export function useOrderAgenda(limit = 6) {
  const [items, setItems] = useState<AgendaPedido[]>([]);
  const [loading, setLoading] = useState(true);
  const { user } = useAuth();
  const { toast } = useToast();

  const fetchAgenda = useCallback(async () => {
    if (!user) {
      setItems([]);
      setLoading(false);
      return;
    }

    setLoading(true);
    try {
      const { data, error } = await supabase
        .from('pedidos')
        .select('id, cliente, data_entrega, tipo_entrega, status, status_operacional, status_financeiro, valor_total, saldo_restante, itens_pedido(quantidade)')
        .is('archived_at', null)
        .not('status_operacional', 'in', '("entregue","cancelado")')
        .order('data_entrega', { ascending: true })
        .limit(limit);

      if (error) throw error;

      const pedidos = ((data || []) as AgendaPedidoRow[]).map<AgendaPedidoInput>((pedido) => ({
        id: pedido.id,
        cliente: pedido.cliente,
        data_entrega: pedido.data_entrega,
        tipo_entrega: pedido.tipo_entrega,
        status: pedido.status_operacional || pedido.status,
        status_financeiro: pedido.status_financeiro,
        valor_total: pedido.valor_total,
        saldo_restante: pedido.saldo_restante ?? 0,
        itens_total: (pedido.itens_pedido || []).reduce((total, item) => total + item.quantidade, 0),
      }));

      setItems(buildOrderAgenda(pedidos, getTodayKey(), limit));
    } catch (error: unknown) {
      toast({
        title: 'Erro ao carregar agenda de entregas',
        description: getErrorMessage(error),
        variant: 'destructive',
      });
    } finally {
      setLoading(false);
    }
  }, [user, toast, limit]);

  useEffect(() => {
    fetchAgenda();
  }, [fetchAgenda]);

  return {
    items,
    loading,
    pedidosHoje: items.filter((item) => item.urgency === 'hoje').length,
    pedidosAtrasados: items.filter((item) => item.urgency === 'atrasado').length,
    pedidosBloqueadosPorSaldo: items.filter((item) => item.bloqueadoPorSaldo).length,
    refetch: fetchAgenda,
  };
}
