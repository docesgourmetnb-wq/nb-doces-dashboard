import { useState, useEffect, useCallback } from 'react';
import { supabase } from '@/integrations/supabase/client';
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

export function useTransacoes() {
  const [transacoes, setTransacoes] = useState<Transacao[]>([]);
  const [loading, setLoading] = useState(true);
  const { user } = useAuth();
  const { toast } = useToast();

  const fetchTransacoes = useCallback(async () => {
    if (!user) return;
    
    try {
      const { data, error } = await supabase
        .from('transacoes')
        .select('*')
        .order('data', { ascending: false });

      if (error) throw error;
      setTransacoes((data || []) as Transacao[]);
    } catch (error: any) {
      toast({
        title: 'Erro ao carregar transações',
        description: error.message,
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
    if (!user) return;
    
    try {
      const { data, error } = await supabase
        .from('transacoes')
        .insert({
          tipo: transacao.tipo,
          categoria: transacao.categoria,
          descricao: transacao.descricao,
          valor: transacao.valor,
          data: transacao.data,
          referencia: transacao.referencia,
          user_id: user.id,
        })
        .select()
        .single();

      if (error) throw error;
      const newTransacao = data as Transacao;
      setTransacoes([newTransacao, ...transacoes]);
      toast({ title: 'Transação registrada!' });
      return newTransacao;
    } catch (error: any) {
      toast({
        title: 'Erro ao registrar transação',
        description: error.message,
        variant: 'destructive',
      });
    }
  };

  return { transacoes, loading, addTransacao, refetch: fetchTransacoes };
}
