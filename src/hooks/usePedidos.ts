import { useState, useEffect, useCallback } from 'react';
import { supabase } from '@/integrations/supabase/client';
import type { Tables, TablesUpdate } from '@/integrations/supabase/types';
import { useAuth } from '@/hooks/useAuth';
import { useToast } from '@/hooks/use-toast';
import { useAuditLog } from '@/hooks/useAuditLog';
import {
  getPedidoStatusUpdateErrorMessage,
  type CanalVenda,
  type EntregaTipo,
  type PedidoFinanceiroStatus,
  type PedidoStatus,
} from '@/domain/pedidos';

export interface ItemPedido {
  id?: string;
  brigadeiro_id?: string | null;
  brigadeiro_nome: string;
  brigadeiro_categoria?: 'brigadeiro' | 'bolo' | null;
  brigadeiro_tamanho_g?: number | null;
  quantidade: number;
  preco_unitario: number;
}

export interface Pedido {
  id: string;
  cliente: string;
  cliente_id?: string | null;
  cliente_nome?: string | null; // joined from clientes table
  data: string;
  data_entrega: string;
  tipo_pedido: 'encomenda' | 'pronta-entrega' | 'evento';
  tipo_entrega: EntregaTipo;
  endereco_entrega?: string | null;
  canal_venda: CanalVenda;
  valor_total: number;
  valor_pago: number;
  saldo_restante: number;
  forma_pagamento: 'pix' | 'cartao' | 'dinheiro' | 'transferencia';
  status: PedidoStatus;
  status_operacional: PedidoStatus;
  status_financeiro: PedidoFinanceiroStatus;
  observacoes?: string | null;
  itens?: ItemPedido[];
  archived_at?: string | null;
  archived_reason?: string | null;
}

export type PedidoInput = Omit<Pedido, 'id'>;

type PedidoRow = Tables<'pedidos'>;
type PedidoUpdate = TablesUpdate<'pedidos'>;
type ClienteRow = Pick<Tables<'clientes'>, 'nome'>;
type ItemPedidoRow = Tables<'itens_pedido'>;
type ItemPedidoWithProduto = ItemPedidoRow & {
  brigadeiros?: Pick<Tables<'brigadeiros'>, 'categoria' | 'tamanho_g'> | null;
};
type PedidoWithRelations = PedidoRow & {
  clientes?: ClienteRow | null;
  itens_pedido?: ItemPedidoWithProduto[] | null;
};

interface UpdatePedidoStatusRpc {
  (
    fn: 'update_pedido_status',
    params: {
      p_pedido_id: string;
      p_status: PedidoStatus;
    },
  ): Promise<{
    data: Partial<PedidoRow> | null;
    error: Error | null;
  }>;
}

interface UpdatePedidoPaymentRpc {
  (
    fn: 'update_pedido_payment',
    params: {
      p_pedido_id: string;
      p_valor_pago: number;
      p_data_pagamento?: string;
    },
  ): Promise<{
    data: Partial<PedidoRow> | null;
    error: Error | null;
  }>;
}

interface CreatePedidoWithItemsRpc {
  (
    fn: 'create_pedido_with_items',
    params: {
      p_cliente: string;
      p_cliente_id: string | null;
      p_data: string;
      p_tipo_pedido: Pedido['tipo_pedido'];
      p_valor_total: number;
      p_forma_pagamento: Pedido['forma_pagamento'];
      p_status: PedidoStatus;
      p_observacoes: string | null;
      p_itens: Array<{
        brigadeiro_id?: string | null;
        brigadeiro_nome: string;
        quantidade: number;
        preco_unitario: number;
      }>;
      p_data_entrega: string;
      p_tipo_entrega: EntregaTipo;
      p_endereco_entrega: string | null;
      p_canal_venda: CanalVenda;
      p_valor_pago: number;
    },
  ): Promise<{
    data: PedidoRow | null;
    error: Error | null;
  }>;
}

function getErrorMessage(error: unknown) {
  return error instanceof Error ? error.message : 'Erro inesperado';
}

export function toPedidoWithItems(pedido: PedidoWithRelations): Pedido {
  const p = pedido as unknown as Record<string, unknown>;
  return {
    id: pedido.id,
    cliente: pedido.cliente,
    cliente_id: pedido.cliente_id,
    cliente_nome: pedido.clientes?.nome || null,
    data: pedido.data,
    data_entrega: (p['data_entrega'] as string) ?? pedido.data,
    tipo_pedido: pedido.tipo_pedido as Pedido['tipo_pedido'],
    tipo_entrega: ((p['tipo_entrega'] as EntregaTipo) ?? 'retirada') as EntregaTipo,
    endereco_entrega: (p['endereco_entrega'] as string | null) ?? null,
    canal_venda: ((p['canal_venda'] as CanalVenda) ?? 'whatsapp') as CanalVenda,
    valor_total: pedido.valor_total,
    valor_pago: (p['valor_pago'] as number) ?? 0,
    saldo_restante: (p['saldo_restante'] as number) ?? pedido.valor_total,
    forma_pagamento: pedido.forma_pagamento as Pedido['forma_pagamento'],
    status: ((p['status_operacional'] as string) || pedido.status) as Pedido['status'],
    status_operacional: ((p['status_operacional'] as string) || pedido.status) as Pedido['status'],
    status_financeiro: ((p['status_financeiro'] as PedidoFinanceiroStatus) ?? 'nao_pago') as PedidoFinanceiroStatus,
    observacoes: pedido.observacoes,
    itens: (pedido.itens_pedido || []).map((item) => ({
      id: item.id,
      brigadeiro_id: item.brigadeiro_id,
      brigadeiro_nome: item.brigadeiro_nome,
      brigadeiro_categoria: (item.brigadeiros?.categoria as ItemPedido['brigadeiro_categoria']) ?? null,
      brigadeiro_tamanho_g: item.brigadeiros?.tamanho_g ?? null,
      quantidade: item.quantidade,
      preco_unitario: item.preco_unitario,
    })),
    archived_at: pedido.archived_at,
    archived_reason: pedido.archived_reason,
  };
}

// Helper: get display name prioritizing joined client
export function getClienteDisplayName(pedido: Pedido): string {
  return pedido.cliente_nome || pedido.cliente;
}

export function usePedidos() {
  const [pedidos, setPedidos] = useState<Pedido[]>([]);
  const [loading, setLoading] = useState(true);
  const [showArchived, setShowArchived] = useState(false);
  const { user } = useAuth();
  const { toast } = useToast();
  const { log: auditLog } = useAuditLog();

  const fetchPedidos = useCallback(async () => {
    if (!user) {
      setLoading(false);
      return;
    }
    
    try {
      let query = supabase
        .from('pedidos')
        .select('*, clientes(nome), itens_pedido(*, brigadeiros(categoria, tamanho_g))')
        .order('data', { ascending: true });

      if (!showArchived) {
        query = query.is('archived_at', null);
      }

      const { data: pedidosData, error: pedidosError } = await query;

      if (pedidosError) throw pedidosError;

      const pedidosWithItems = (pedidosData || []).map(toPedidoWithItems);

      setPedidos(pedidosWithItems);
    } catch (error: unknown) {
      toast({
        title: 'Erro ao carregar pedidos',
        description: getErrorMessage(error),
        variant: 'destructive',
      });
    } finally {
      setLoading(false);
    }
  }, [user, toast, showArchived]);

  useEffect(() => {
    fetchPedidos();
  }, [fetchPedidos]);

  const updatePedidoStatus = async (
    id: string,
    status: Pedido['status'],
    currentPedido?: Pick<Pedido, 'id' | 'status' | 'saldo_restante'>,
  ) => {
    try {
      const pedido = currentPedido ?? pedidos.find(p => p.id === id);
      if (pedido?.status === status) return true; // idempotency guard
      if (status === 'entregue' && pedido && pedido.saldo_restante > 0) {
        toast({
          title: 'Saldo pendente',
          description: 'Este pedido ainda possui saldo pendente e não pode ser marcado como entregue.',
          variant: 'destructive',
        });
        return false;
      }

      const updateStatusRpc = supabase.rpc.bind(supabase) as unknown as UpdatePedidoStatusRpc;
      const { error } = await updateStatusRpc('update_pedido_status', {
        p_pedido_id: id,
        p_status: status,
      });

      if (error) throw error;

      setPedidos(pedidos.map(p => p.id === id ? { ...p, status, status_operacional: status } : p));
      toast({ title: 'Status atualizado!' });
      return true;
    } catch (error: unknown) {
      toast({
        title: 'Erro ao atualizar status',
        description: getPedidoStatusUpdateErrorMessage(getErrorMessage(error)),
        variant: 'destructive',
      });
      return false;
    }
  };

  const updatePedidoPayment = async (id: string, valorPago: number, dataPagamento?: string) => {
    try {
      const updatePaymentRpc = supabase.rpc.bind(supabase) as unknown as UpdatePedidoPaymentRpc;
      const paymentParams: Parameters<UpdatePedidoPaymentRpc>[1] = {
        p_pedido_id: id,
        p_valor_pago: valorPago,
      };
      if (dataPagamento) {
        paymentParams.p_data_pagamento = dataPagamento;
      }

      const { error } = await updatePaymentRpc('update_pedido_payment', paymentParams);

      if (error) throw error;

      await fetchPedidos();
      toast({ title: 'Pagamento registrado!' });
    } catch (error: unknown) {
      toast({
        title: 'Erro ao registrar pagamento',
        description: getErrorMessage(error),
        variant: 'destructive',
      });
    }
  };

  const addPedido = async (pedido: PedidoInput, itens: ItemPedido[]) => {
    if (!user) return undefined;
    
    try {
      const createPedidoRpc = supabase.rpc.bind(supabase) as unknown as CreatePedidoWithItemsRpc;
      const { data: novoPedido, error } = await createPedidoRpc('create_pedido_with_items', {
        p_cliente: pedido.cliente,
        p_cliente_id: pedido.cliente_id || null,
        p_data: pedido.data,
        p_tipo_pedido: pedido.tipo_pedido,
        p_valor_total: pedido.valor_total,
        p_forma_pagamento: pedido.forma_pagamento,
        p_status: pedido.status,
        p_observacoes: pedido.observacoes || null,
        p_itens: itens.map(item => ({
            brigadeiro_id: item.brigadeiro_id ?? null,
            brigadeiro_nome: item.brigadeiro_nome,
            quantidade: item.quantidade,
            preco_unitario: item.preco_unitario,
          })),
        p_data_entrega: pedido.data_entrega,
        p_tipo_entrega: pedido.tipo_entrega,
        p_endereco_entrega: pedido.endereco_entrega || null,
        p_canal_venda: pedido.canal_venda,
        p_valor_pago: pedido.valor_pago,
      });

      if (error) throw error;

      await fetchPedidos();
      toast({ title: 'Pedido criado com sucesso!' });
      return novoPedido as unknown as Pedido;
    } catch (error: unknown) {
      toast({
        title: 'Erro ao criar pedido',
        description: getErrorMessage(error),
        variant: 'destructive',
      });
      return undefined;
    }
  };

  const archivePedido = async (id: string, reason?: string) => {
    try {
      const updates: PedidoUpdate = {
        archived_at: new Date().toISOString(),
        archived_reason: reason || null,
      };

      const { error } = await supabase
        .from('pedidos')
        .update(updates)
        .eq('id', id);

      if (error) throw error;
      await auditLog('pedido', id, 'archived', { reason: reason || null });
      await fetchPedidos();
      toast({ title: 'Pedido arquivado!' });
    } catch (error: unknown) {
      toast({ title: 'Erro ao arquivar', description: getErrorMessage(error), variant: 'destructive' });
    }
  };

  const unarchivePedido = async (id: string) => {
    try {
      const updates: PedidoUpdate = {
        archived_at: null,
        archived_reason: null,
      };

      const { error } = await supabase
        .from('pedidos')
        .update(updates)
        .eq('id', id);

      if (error) throw error;
      await auditLog('pedido', id, 'unarchived', {});
      await fetchPedidos();
      toast({ title: 'Pedido desarquivado!' });
    } catch (error: unknown) {
      toast({ title: 'Erro ao desarquivar', description: getErrorMessage(error), variant: 'destructive' });
    }
  };

  return {
    pedidos,
    loading,
    updatePedidoStatus,
    updatePedidoPayment,
    addPedido,
    refetch: fetchPedidos,
    showArchived,
    setShowArchived,
    archivePedido,
    unarchivePedido,
  };
}
