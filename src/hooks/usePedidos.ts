import { useState, useEffect, useCallback } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/hooks/useAuth';
import { useToast } from '@/hooks/use-toast';
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
  data: string;
  tipo_pedido: 'encomenda' | 'pronta-entrega' | 'evento';
  valor_total: number;
  forma_pagamento: 'pix' | 'cartao' | 'dinheiro' | 'transferencia';
  status: 'pendente' | 'em-producao' | 'pronto' | 'entregue' | 'cancelado';
  observacoes?: string | null;
  itens?: ItemPedido[];
  archived_at?: string | null;
  archived_reason?: string | null;
}

export function usePedidos() {
  const [pedidos, setPedidos] = useState<Pedido[]>([]);
  const [loading, setLoading] = useState(true);
  const [showArchived, setShowArchived] = useState(false);
  const { user } = useAuth();
  const { toast } = useToast();

  const fetchPedidos = useCallback(async () => {
    if (!user) return;
    
    try {
      let query = supabase
        .from('pedidos')
        .select('*')
        .order('data', { ascending: true });

      if (!showArchived) {
        query = query.is('archived_at', null);
      }

      const { data: pedidosData, error: pedidosError } = await query;

      if (pedidosError) throw pedidosError;

      // Fetch items for each order
      const pedidosWithItems = await Promise.all(
        (pedidosData || []).map(async (pedido) => {
          const { data: itens } = await supabase
            .from('itens_pedido')
            .select('*')
            .eq('pedido_id', pedido.id);
          return { ...pedido, itens: (itens || []) as ItemPedido[] } as Pedido;
        })
      );

      setPedidos(pedidosWithItems);
    } catch (error: any) {
      toast({
        title: 'Erro ao carregar pedidos',
        description: error.message,
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
      const { error } = await supabase
        .from('pedidos')
        .update({ status })
        .eq('id', id);

      if (error) throw error;

      // Fetch existing transactions for this order to determine cycle
      const { data: existingTxs } = await supabase
        .from('transacoes')
        .select('referencia')
        .like('referencia', `pedido:${id}:%`);

      const refs = (existingTxs || []).map(t => t.referencia || '');
      const vendaCount = refs.filter(r => r.includes(':venda:')).length;
      const estornoCount = refs.filter(r => r.includes(':estorno:')).length;

      // Entering "entregue" → create venda
      if (status === 'entregue' && pedido && pedido.status !== 'entregue') {
        const cycle = 1 + estornoCount;
        const vendaRef = `pedido:${id}:venda:${cycle}`;
        const alreadyExists = refs.includes(vendaRef);

        if (!alreadyExists && pedido.valor_total > 0) {
          await supabase.from('transacoes').insert({
            tipo: 'entrada',
            categoria: 'Vendas',
            descricao: `Venda - Pedido ${pedido.cliente}`,
            valor: pedido.valor_total,
            data: pedido.data,
            referencia: vendaRef,
            user_id: user!.id,
          });
        }
      }

      // Leaving "entregue" → create estorno
      if (pedido && pedido.status === 'entregue' && status !== 'entregue') {
        const cycle = Math.max(vendaCount, 1);
        const estornoRef = `pedido:${id}:estorno:${cycle}`;
        const alreadyExists = refs.includes(estornoRef);

        if (!alreadyExists && pedido.valor_total > 0) {
          await supabase.from('transacoes').insert({
            tipo: 'saida',
            categoria: 'Estornos',
            descricao: `Estorno - Pedido ${pedido.cliente}`,
            valor: pedido.valor_total,
            data: pedido.data,
            referencia: estornoRef,
            user_id: user!.id,
          });
        }
      }

      setPedidos(pedidos.map(p => p.id === id ? { ...p, status } : p));
      toast({ title: 'Status atualizado!' });
    } catch (error: any) {
      toast({
        title: 'Erro ao atualizar status',
        description: error.message,
        variant: 'destructive',
      });
    }
  };

  const addPedido = async (pedido: Omit<Pedido, 'id'>, itens: ItemPedido[]) => {
    if (!user) return;
    
    try {
      const { data: novoPedido, error: pedidoError } = await supabase
        .from('pedidos')
        .insert({
          cliente: pedido.cliente,
          data: pedido.data,
          tipo_pedido: pedido.tipo_pedido,
          valor_total: pedido.valor_total,
          forma_pagamento: pedido.forma_pagamento,
          status: pedido.status,
          observacoes: pedido.observacoes,
          user_id: user.id,
        })
        .select()
        .single();

      if (pedidoError) throw pedidoError;

      // Insert items
      if (itens.length > 0) {
        const { error: itensError } = await supabase
          .from('itens_pedido')
          .insert(itens.map(item => ({
            brigadeiro_id: item.brigadeiro_id,
            brigadeiro_nome: item.brigadeiro_nome,
            quantidade: item.quantidade,
            preco_unitario: item.preco_unitario,
            pedido_id: novoPedido.id,
          })));

        if (itensError) throw itensError;
      }

      // Se o pedido for "entregue", criar transação de entrada automaticamente (ciclo 1)
      if (pedido.status === 'entregue' && pedido.valor_total > 0) {
        await supabase.from('transacoes').insert({
          tipo: 'entrada',
          categoria: 'Vendas',
          descricao: `Venda - Pedido ${pedido.cliente}`,
          valor: pedido.valor_total,
          data: pedido.data,
          referencia: `pedido:${novoPedido.id}:venda:1`,
          user_id: user.id,
        });
      }

      await fetchPedidos();
      toast({ title: 'Pedido criado com sucesso!' });
      return novoPedido as Pedido;
    } catch (error: any) {
      toast({
        title: 'Erro ao criar pedido',
        description: error.message,
        variant: 'destructive',
      });
    }
  };

  const archivePedido = async (id: string, reason?: string) => {
    try {
      const { error } = await supabase
        .from('pedidos')
        .update({ archived_at: new Date().toISOString(), archived_reason: reason || null } as any)
        .eq('id', id);

      if (error) throw error;
      await fetchPedidos();
      toast({ title: 'Pedido arquivado!' });
    } catch (error: any) {
      toast({ title: 'Erro ao arquivar', description: error.message, variant: 'destructive' });
    }
  };

  const unarchivePedido = async (id: string) => {
    try {
      const { error } = await supabase
        .from('pedidos')
        .update({ archived_at: null, archived_reason: null } as any)
        .eq('id', id);

      if (error) throw error;
      await fetchPedidos();
      toast({ title: 'Pedido desarquivado!' });
    } catch (error: any) {
      toast({ title: 'Erro ao desarquivar', description: error.message, variant: 'destructive' });
    }
  };

  return { pedidos, loading, updatePedidoStatus, addPedido, refetch: fetchPedidos, showArchived, setShowArchived, archivePedido, unarchivePedido };
}
