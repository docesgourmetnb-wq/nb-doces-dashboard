import { useState, useEffect, useCallback } from 'react';
import { supabase } from '@/integrations/supabase/client';
import type { Tables } from '@/integrations/supabase/types';
import { useAuth } from '@/hooks/useAuth';
import { useToast } from '@/hooks/use-toast';
import { Brigadeiro } from './useBrigadeiros';

type InsumoRow = Tables<'insumos'>;

export interface EstoqueProduto {
  id: string;
  brigadeiro_id: string;
  quantidade_un: number;
  user_id: string;
  created_at: string;
  updated_at: string;
  brigadeiro?: Partial<Brigadeiro>;
}

function getErrorMessage(error: unknown) {
  return error instanceof Error ? error.message : 'Erro inesperado';
}

function toEstoqueProduto(insumo: InsumoRow, fallbackNome = 'Produto Desconhecido'): EstoqueProduto {
  const match = insumo.nome.match(/\[PRODUTO\] (.*?)::(.*)/);
  const brigadeiroId = match?.[1] || '';
  const brigadeiroNome = match?.[2] || fallbackNome;

  return {
    id: insumo.id,
    brigadeiro_id: brigadeiroId,
    quantidade_un: insumo.quantidade_atual || 0,
    user_id: insumo.user_id,
    created_at: insumo.created_at,
    updated_at: insumo.updated_at,
    brigadeiro: { id: brigadeiroId, nome: brigadeiroNome },
  };
}

function sortByBrigadeiroName(a: EstoqueProduto, b: EstoqueProduto) {
  return (a.brigadeiro?.nome || '').localeCompare(b.brigadeiro?.nome || '');
}

export function useEstoqueProdutos() {
  const [produtos, setProdutos] = useState<EstoqueProduto[]>([]);
  const [loading, setLoading] = useState(true);
  const { user } = useAuth();
  const { toast } = useToast();

  const fetchProdutos = useCallback(async () => {
    if (!user) {
      setLoading(false);
      return;
    }
    
    setLoading(true);
    try {
      const { data, error } = await supabase
        .from('insumos')
        .select('*')
        .eq('unidade', 'SYS_PROD');

      if (error) throw error;
      
      const produtosFormatados = (data || [])
        .map((item) => toEstoqueProduto(item))
        .sort(sortByBrigadeiroName);

      setProdutos(produtosFormatados);
    } catch (error: unknown) {
      console.error('Error fetching produtos:', error);
      toast({
        title: 'Erro ao carregar estoque final',
        description: getErrorMessage(error),
        variant: 'destructive',
      });
    } finally {
      setLoading(false);
    }
  }, [user, toast]);

  useEffect(() => {
    fetchProdutos();
  }, [fetchProdutos]);

  const addProduto = async (brigadeiro_id: string, quantidade_un: number, brigadeiro_nome: string) => {
    if (!user) return null;

    try {
      const { data, error } = await supabase
        .from('insumos')
        .insert([{ 
           nome: `[PRODUTO] ${brigadeiro_id}::${brigadeiro_nome}`, 
           unidade: 'SYS_PROD',
           quantidade_atual: quantidade_un,
           quantidade_minima: 0,
           consumo_medio: 0,
           preco_unitario: 0,
           user_id: user.id 
        }])
        .select()
        .single();

      if (error) throw error;
      
      const novoProduto = toEstoqueProduto(data, brigadeiro_nome);

      setProdutos(prev => {
          const newState = [...prev, novoProduto];
          return newState.sort(sortByBrigadeiroName);
      });

      toast({
        title: 'Produto adicionado',
        description: 'Produto cadastrado no estoque.',
      });
      return novoProduto;
    } catch (error: unknown) {
      toast({
        title: 'Erro ao cadastrar produto',
        description: getErrorMessage(error),
        variant: 'destructive',
      });
      return null;
    }
  };

  const updateQuantidade = async (id: string, quantidadeDelta: number) => {
    const produto = produtos.find(p => p.id === id);
    if (!produto) return false;

    const novaQuantidade = produto.quantidade_un + quantidadeDelta;
    if (novaQuantidade < 0) {
        toast({
            title: 'Operação inválida',
            description: 'A quantidade não pode ficar negativa.',
            variant: 'destructive',
          });
          return false;
    }

    try {
      const { error } = await supabase
        .from('insumos')
        .update({ quantidade_atual: novaQuantidade, updated_at: new Date().toISOString() })
        .eq('id', id);

      if (error) throw error;

      setProdutos(prev => prev.map(p => p.id === id ? { ...p, quantidade_un: novaQuantidade } : p));
      toast({
        title: 'Estoque atualizado',
        description: `Saldo de unidades atualizado com sucesso.`,
      });
      return true;
    } catch (error: unknown) {
      toast({
        title: 'Erro ao atualizar unidades',
        description: getErrorMessage(error),
        variant: 'destructive',
      });
      return false;
    }
  };

  const deleteProduto = async (id: string) => {
    try {
      const { error } = await supabase
        .from('insumos')
        .delete()
        .eq('id', id);

      if (error) throw error;

      setProdutos(prev => prev.filter(p => p.id !== id));
      toast({
        title: 'Registro excluído',
        description: 'Produto removido do estoque.',
      });
      return true;
    } catch (error: unknown) {
      toast({
        title: 'Erro ao excluir',
        description: getErrorMessage(error),
        variant: 'destructive',
      });
      return false;
    }
  };

  return {
    produtos,
    loading,
    addProduto,
    updateQuantidade,
    deleteProduto,
    refetch: fetchProdutos,
  };
}
