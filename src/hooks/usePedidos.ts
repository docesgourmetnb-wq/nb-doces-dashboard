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
}

export function usePedidos() {
  const [pedidos, setPedidos] = useState<Pedido[]>([]);
  const [loading, setLoading] = useState(true);
  const { user } = useAuth();
  const { toast } = useToast();

  const fetchPedidos = useCallback(async () => {
    if (!user) return;
    
    try {
      const { data: pedidosData, error: pedidosError } = await supabase
        .from('pedidos')
        .select('*')
        .order('data', { ascending: true });

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
  }, [user, toast]);

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

      // Se mudar para "entregue", criar transação de entrada (se não existir)
      if (status === 'entregue' && pedido && pedido.status !== 'entregue') {
        // Verificar se já existe transação para este pedido
        const { data: existingTx } = await supabase
          .from('transacoes')
          .select('id')
          .eq('referencia', id)
          .maybeSingle();

        if (!existingTx && pedido.valor_total > 0) {
          await supabase.from('transacoes').insert({
            tipo: 'entrada',
            categoria: 'Venda',
            descricao: `Pedido - ${pedido.cliente}`,
            valor: pedido.valor_total,
            data: pedido.data,
            referencia: id,
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

      // Se o pedido for "entregue", criar transação de entrada automaticamente
      if (pedido.status === 'entregue' && pedido.valor_total > 0) {
        await supabase.from('transacoes').insert({
          tipo: 'entrada',
          categoria: 'Venda',
          descricao: `Pedido - ${pedido.cliente}`,
          valor: pedido.valor_total,
          data: pedido.data,
          referencia: novoPedido.id,
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

  return { pedidos, loading, updatePedidoStatus, addPedido, refetch: fetchPedidos };
}
