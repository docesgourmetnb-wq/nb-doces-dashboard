import { useState, useEffect, useCallback } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/hooks/useAuth';
import { useToast } from '@/hooks/use-toast';
import { Transacao } from '@/hooks/useTransacoes';

const PAGE_SIZE = 20;

export function usePaginatedTransacoes() {
  const [transacoes, setTransacoes] = useState<Transacao[]>([]);
  const [loading, setLoading] = useState(true);
  const [page, setPage] = useState(0);
  const [totalCount, setTotalCount] = useState(0);
  const [tipoFilter, setTipoFilter] = useState<string>('todos');
  const { user } = useAuth();
  const { toast } = useToast();

  const totalPages = Math.max(1, Math.ceil(totalCount / PAGE_SIZE));

  const fetchTransacoes = useCallback(async () => {
    if (!user) return;
    setLoading(true);
    try {
      let countQuery = supabase
        .from('transacoes')
        .select('*', { count: 'exact', head: true });

      if (tipoFilter !== 'todos') {
        countQuery = countQuery.eq('tipo', tipoFilter);
      }

      const { count, error: countError } = await countQuery;
      if (countError) throw countError;
      setTotalCount(count || 0);

      const from = page * PAGE_SIZE;
      const to = from + PAGE_SIZE - 1;

      let dataQuery = supabase
        .from('transacoes')
        .select('*')
        .order('data', { ascending: false })
        .range(from, to);

      if (tipoFilter !== 'todos') {
        dataQuery = dataQuery.eq('tipo', tipoFilter);
      }

      const { data, error } = await dataQuery;
      if (error) throw error;
      setTransacoes((data || []) as Transacao[]);
    } catch (error: any) {
      toast({ title: 'Erro ao carregar transações', description: error.message, variant: 'destructive' });
    } finally {
      setLoading(false);
    }
  }, [user, toast, tipoFilter, page]);

  useEffect(() => {
    fetchTransacoes();
  }, [fetchTransacoes]);

  useEffect(() => {
    setPage(0);
  }, [tipoFilter]);

  return {
    transacoes,
    loading,
    page,
    setPage,
    totalPages,
    totalCount,
    tipoFilter,
    setTipoFilter,
    refetch: fetchTransacoes,
  };
}
