import { useState, useEffect, useCallback } from 'react';
import { supabase } from '@/integrations/supabase/client';
import type { Tables, TablesUpdate } from '@/integrations/supabase/types';
import { useAuth } from '@/hooks/useAuth';
import { useToast } from '@/hooks/use-toast';
import { useAuditLog } from '@/hooks/useAuditLog';
import { type PedidoStatus } from '@/domain/pedidos';
import { format } from 'date-fns';

export interface ItemPedido {
  id?: string;
  brigadeiro_id?: string | null;
  brigadeiro_nome: string;
  quantidade: number;
  preco_unitario: number;
}

export interface Pedido {
  id: string;
  cliente: string;
  cliente_id?: string | null;
  cliente_nome?: string | null; // joined from clientes table
  data: string;
  tipo_pedido: 'encomenda' | 'pronta-entrega' | 'evento';
  valor_total: number;
  forma_pagamento: 'pix' | 'cartao' | 'dinheiro' | 'transferencia';
  status: PedidoStatus;
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
type PedidoWithRelations = PedidoRow & {
  clientes?: ClienteRow | null;
  itens_pedido?: ItemPedidoRow[] | null;
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
  return {
    id: pedido.id,
    cliente: pedido.cliente,
    cliente_id: pedido.cliente_id,
    cliente_nome: pedido.clientes?.nome || null,
    data: pedido.data,
    tipo_pedido: pedido.tipo_pedido as Pedido['tipo_pedido'],
    valor_total: pedido.valor_total,
    forma_pagamento: pedido.forma_pagamento as Pedido['forma_pagamento'],
    status: pedido.status as Pedido['status'],
    observacoes: pedido.observacoes,
    itens: pedido.itens_pedido || [],
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
        .select('*, clientes(nome), itens_pedido(*)')
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

  const updatePedidoStatus = async (id: string, status: Pedido['status']) => {
    try {
      const pedido = pedidos.find(p => p.id === id);
      if (!pedido || pedido.status === status) return; // idempotency guard

      const updateStatusRpc = supabase.rpc as unknown as UpdatePedidoStatusRpc;
      const { data: updatedPedido, error } = await updateStatusRpc('update_pedido_status', {
        p_pedido_id: id,
        p_status: status,
      });

      if (error) throw error;

      setPedidos(pedidos.map(p => p.id === id ? { ...p, status } : p));
      toast({ title: 'Status atualizado!' });
    } catch (error: unknown) {
      toast({
        title: 'Erro ao atualizar status',
        description: getErrorMessage(error),
        variant: 'destructive',
      });
    }
  };

  const addPedido = async (pedido: PedidoInput, itens: ItemPedido[]) => {
    if (!user) return;
    
    try {
      const createPedidoRpc = supabase.rpc as unknown as CreatePedidoWithItemsRpc;
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
            brigadeiro_id: item.brigadeiro_id,
            brigadeiro_nome: item.brigadeiro_nome,
            quantidade: item.quantidade,
            preco_unitario: item.preco_unitario,
          })),
      });

      if (error) throw error;

      await fetchPedidos();
      toast({ title: 'Pedido criado com sucesso!' });
      return novoPedido as Pedido;
    } catch (error: unknown) {
      toast({
        title: 'Erro ao criar pedido',
        description: getErrorMessage(error),
        variant: 'destructive',
      });
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

  return { pedidos, loading, updatePedidoStatus, addPedido, refetch: fetchPedidos, showArchived, setShowArchived, archivePedido, unarchivePedido };
}
