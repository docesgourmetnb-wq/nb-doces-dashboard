import { useState, useEffect, useCallback } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/hooks/useAuth';
import { useToast } from '@/hooks/use-toast';
import { Pedido, toPedidoWithItems } from '@/hooks/usePedidos';

const PAGE_SIZE = 20;

function getErrorMessage(error: unknown) {
  return error instanceof Error ? error.message : 'Erro inesperado';
}

export function usePaginatedPedidos() {
  const [pedidos, setPedidos] = useState<Pedido[]>([]);
  const [loading, setLoading] = useState(true);
  const [page, setPage] = useState(0);
  const [totalCount, setTotalCount] = useState(0);
  const [showArchived, setShowArchived] = useState(false);
  const [statusFilter, setStatusFilter] = useState<string>('todos');
  const [search, setSearch] = useState('');
  const { user } = useAuth();
  const { toast } = useToast();

  const totalPages = Math.max(1, Math.ceil(totalCount / PAGE_SIZE));

  const fetchPedidos = useCallback(async () => {
    if (!user) {
      setPedidos([]);
      setTotalCount(0);
      setLoading(false);
      return;
    }
    setLoading(true);
    try {
      // Count query
      let countQuery = supabase
        .from('pedidos')
        .select('*', { count: 'exact', head: true });

      if (!showArchived) {
        countQuery = countQuery.is('archived_at', null);
      }
      if (statusFilter !== 'todos') {
        countQuery = countQuery.eq('status_operacional', statusFilter);
      }
      if (search) {
        countQuery = countQuery.ilike('cliente', `%${search}%`);
      }

      const { count, error: countError } = await countQuery;
      if (countError) throw countError;
      setTotalCount(count || 0);

      // Data query with range
      const from = page * PAGE_SIZE;
      const to = from + PAGE_SIZE - 1;

      let dataQuery = supabase
        .from('pedidos')
        .select('*, clientes(nome), itens_pedido(*)')
        .order('data_entrega', { ascending: false })
        .range(from, to);

      if (!showArchived) {
        dataQuery = dataQuery.is('archived_at', null);
      }
      if (statusFilter !== 'todos') {
        dataQuery = dataQuery.eq('status_operacional', statusFilter);
      }
      if (search) {
        dataQuery = dataQuery.ilike('cliente', `%${search}%`);
      }

      const { data: pedidosData, error } = await dataQuery;
      if (error) throw error;

      const pedidosWithItems = (pedidosData || []).map(toPedidoWithItems);

      setPedidos(pedidosWithItems);
    } catch (error: unknown) {
      toast({ title: 'Erro ao carregar pedidos', description: getErrorMessage(error), variant: 'destructive' });
    } finally {
      setLoading(false);
    }
  }, [user, toast, showArchived, statusFilter, search, page]);

  useEffect(() => {
    fetchPedidos();
  }, [fetchPedidos]);

  // Reset page when filters change
  useEffect(() => {
    setPage(0);
  }, [showArchived, statusFilter, search]);

  return {
    pedidos,
    loading,
    page,
    setPage,
    totalPages,
    totalCount,
    showArchived,
    setShowArchived,
    statusFilter,
    setStatusFilter,
    search,
    setSearch,
    refetch: fetchPedidos,
  };
}
