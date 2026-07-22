import { useState, useEffect, useCallback } from 'react';
import { supabase } from '@/integrations/supabase/client';
import type { TablesInsert, TablesUpdate } from '@/integrations/supabase/types';
import { useAuth } from '@/hooks/useAuth';
import { useToast } from '@/hooks/use-toast';
import { Transacao } from '@/hooks/useTransacoes';
import { FINANCIAL_CONTROL_START_DATE } from '@/domain/financeiro';

const PAGE_SIZE = 20;
type TransacaoInsert = TablesInsert<'transacoes'>;
type TransacaoUpdate = TablesUpdate<'transacoes'>;

function getErrorMessage(error: unknown) {
  return error instanceof Error ? error.message : 'Erro inesperado';
}

export function usePaginatedTransacoes() {
  const [transacoes, setTransacoes] = useState<Transacao[]>([]);
  const [loading, setLoading] = useState(true);
  const [page, setPage] = useState(0);
  const [totalCount, setTotalCount] = useState(0);
  const [tipoFilter, setTipoFilter] = useState<string>('todos');
  const [categoriaFilter, setCategoriaFilter] = useState<string>('todas');
  const { user } = useAuth();
  const { toast } = useToast();

  const totalPages = Math.max(1, Math.ceil(totalCount / PAGE_SIZE));

  const fetchTransacoes = useCallback(async () => {
    if (!user) {
      setLoading(false);
      return;
    }
    setLoading(true);
    try {
      let countQuery = supabase
        .from('transacoes')
        .select('*', { count: 'exact', head: true })
        .gte('data', FINANCIAL_CONTROL_START_DATE);

      if (tipoFilter !== 'todos') {
        countQuery = countQuery.eq('tipo', tipoFilter);
      }
      if (categoriaFilter !== 'todas') {
        countQuery = countQuery.eq('categoria', categoriaFilter);
      }

      const { count, error: countError } = await countQuery;
      if (countError) throw countError;
      setTotalCount(count || 0);

      const from = page * PAGE_SIZE;
      const to = from + PAGE_SIZE - 1;

      let dataQuery = supabase
        .from('transacoes')
        .select('*')
        .gte('data', FINANCIAL_CONTROL_START_DATE)
        .order('data', { ascending: false })
        .range(from, to);

      if (tipoFilter !== 'todos') {
        dataQuery = dataQuery.eq('tipo', tipoFilter);
      }
      if (categoriaFilter !== 'todas') {
        dataQuery = dataQuery.eq('categoria', categoriaFilter);
      }

      const { data, error } = await dataQuery;
      if (error) throw error;
      setTransacoes((data || []) as Transacao[]);
    } catch (error: unknown) {
      toast({ title: 'Erro ao carregar transações', description: getErrorMessage(error), variant: 'destructive' });
    } finally {
      setLoading(false);
    }
  }, [user, toast, tipoFilter, categoriaFilter, page]);

  useEffect(() => {
    fetchTransacoes();
  }, [fetchTransacoes]);

  useEffect(() => {
    setPage(0);
  }, [tipoFilter, categoriaFilter]);

  const addTransacao = async (transacao: Omit<Transacao, 'id'>) => {
    if (!user) return undefined;

    try {
      const insertData: TransacaoInsert = {
        tipo: transacao.tipo,
        categoria: transacao.categoria,
        descricao: transacao.descricao,
        valor: transacao.valor,
        data: transacao.data,
        user_id: user.id,
      };
      if (transacao.referencia !== undefined) {
        insertData.referencia = transacao.referencia;
      }

      const { data, error } = await supabase
        .from('transacoes')
        .insert(insertData)
        .select()
        .single();

      if (error) throw error;
      await fetchTransacoes();
      toast({ title: 'Transação registrada!' });
      return data as Transacao;
    } catch (error: unknown) {
      toast({
        title: 'Erro ao registrar transação',
        description: getErrorMessage(error),
        variant: 'destructive',
      });
      return undefined;
    }
  };

  const deleteManualTransacao = async (id: string) => {
    try {
      const { error } = await supabase
        .from('transacoes')
        .delete()
        .eq('id', id)
        .is('referencia', null);

      if (error) throw error;
      await fetchTransacoes();
      toast({ title: 'Transação removida!' });
      return true;
    } catch (error: unknown) {
      toast({
        title: 'Erro ao remover transação',
        description: getErrorMessage(error),
        variant: 'destructive',
      });
      return false;
    }
  };

  const updateManualTransacao = async (
    id: string,
    transacao: Pick<Transacao, 'tipo' | 'categoria' | 'descricao' | 'valor' | 'data'>,
  ) => {
    try {
      const updateData: TransacaoUpdate = {
        tipo: transacao.tipo,
        categoria: transacao.categoria,
        descricao: transacao.descricao,
        valor: transacao.valor,
        data: transacao.data,
      };

      const { data, error } = await supabase
        .from('transacoes')
        .update(updateData)
        .eq('id', id)
        .is('referencia', null)
        .select()
        .maybeSingle();

      if (error) throw error;
      if (!data) throw new Error('Transações automáticas não podem ser editadas por aqui.');

      await fetchTransacoes();
      toast({ title: 'Transação atualizada!' });
      return true;
    } catch (error: unknown) {
      toast({
        title: 'Erro ao editar transação',
        description: getErrorMessage(error),
        variant: 'destructive',
      });
      return false;
    }
  };

  return {
    transacoes,
    loading,
    page,
    setPage,
    totalPages,
    totalCount,
    tipoFilter,
    setTipoFilter,
    categoriaFilter,
    setCategoriaFilter,
    addTransacao,
    deleteManualTransacao,
    updateManualTransacao,
    refetch: fetchTransacoes,
  };
}
