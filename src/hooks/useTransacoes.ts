import { useState, useEffect, useCallback } from 'react';
import { supabase } from '@/integrations/supabase/client';
import type { TablesInsert } from '@/integrations/supabase/types';
import { useAuth } from '@/hooks/useAuth';
import { useToast } from '@/hooks/use-toast';

export interface Transacao {
  id: string;
  tipo: 'entrada' | 'saida';
  categoria: string;
  descricao: string;
  valor: number;
  data: string;
  referencia?: string | null;
}

type TransacaoInsert = TablesInsert<'transacoes'>;

function getErrorMessage(error: unknown) {
  return error instanceof Error ? error.message : 'Erro inesperado';
}

export function useTransacoes() {
  const [transacoes, setTransacoes] = useState<Transacao[]>([]);
  const [loading, setLoading] = useState(true);
  const { user } = useAuth();
  const { toast } = useToast();

  const fetchTransacoes = useCallback(async () => {
    if (!user) {
      setLoading(false);
      return;
    }
    
    try {
      const { data, error } = await supabase
        .from('transacoes')
        .select('*')
        .order('data', { ascending: false });

      if (error) throw error;
      setTransacoes((data || []) as Transacao[]);
    } catch (error: unknown) {
      toast({
        title: 'Erro ao carregar transações',
        description: getErrorMessage(error),
        variant: 'destructive',
      });
    } finally {
      setLoading(false);
    }
  }, [user, toast]);

  useEffect(() => {
    fetchTransacoes();
  }, [fetchTransacoes]);

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
      const newTransacao = data as Transacao;
      setTransacoes([newTransacao, ...transacoes]);
      toast({ title: 'Transação registrada!' });
      return newTransacao;
    } catch (error: unknown) {
      toast({
        title: 'Erro ao registrar transação',
        description: getErrorMessage(error),
        variant: 'destructive',
      });
      return undefined;
    }
  };

  return { transacoes, loading, addTransacao, refetch: fetchTransacoes };
}
