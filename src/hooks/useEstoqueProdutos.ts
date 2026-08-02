import { useState, useEffect, useCallback } from 'react';
import { supabase } from '@/integrations/supabase/client';
import type { Tables } from '@/integrations/supabase/types';
import { useAuth } from '@/hooks/useAuth';
import { useToast } from '@/hooks/use-toast';
import { useAuditLog } from '@/hooks/useAuditLog';
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

interface AdjustFinalProductStockRpc {
  (
    fn: 'adjust_final_product_stock',
    params: {
      p_insumo_id: string;
      p_quantidade_delta: number;
    },
  ): Promise<{
    data: InsumoRow | null;
    error: Error | null;
  }>;
}

interface RegisterFinalProductStockRpc {
  (
    fn: 'register_final_product_stock',
    params: {
      p_brigadeiro_id: string;
      p_quantidade_inicial: number;
    },
  ): Promise<{
    data: InsumoRow | null;
    error: Error | null;
  }>;
}

export function useEstoqueProdutos() {
  const [produtos, setProdutos] = useState<EstoqueProduto[]>([]);
  const [loading, setLoading] = useState(true);
  const { user } = useAuth();
  const { toast } = useToast();
  const { log: auditLog } = useAuditLog();

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
        .eq('unidade', 'SYS_PROD')
        .eq('ativo', true);

      if (error) throw error;
      
      const produtosFormatados = (data || [])
        .map((item) => toEstoqueProduto(item))
        .sort(sortByBrigadeiroName);

      setProdutos(produtosFormatados);
    } catch (error: unknown) {
      if (import.meta.env.DEV) console.error('Error fetching produtos:', error);
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
    try {
      const registerStockRpc = supabase.rpc.bind(supabase) as unknown as RegisterFinalProductStockRpc;
      const { data, error } = await registerStockRpc('register_final_product_stock', {
        p_brigadeiro_id: brigadeiro_id,
        p_quantidade_inicial: quantidade_un,
      });

      if (error) throw error;
      if (!data) throw new Error('Produto final não retornado pelo banco');
      
      const novoProduto = toEstoqueProduto(data, brigadeiro_nome);

      setProdutos(prev => {
          const exists = prev.some((produto) => produto.id === novoProduto.id);
          const newState = exists
            ? prev.map((produto) => produto.id === novoProduto.id ? novoProduto : produto)
            : [...prev, novoProduto];
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
      const adjustStockRpc = supabase.rpc.bind(supabase) as unknown as AdjustFinalProductStockRpc;
      const { data, error } = await adjustStockRpc('adjust_final_product_stock', {
        p_insumo_id: id,
        p_quantidade_delta: quantidadeDelta,
      });

      if (error) throw error;

      const quantidadeAtual = data?.quantidade_atual ?? novaQuantidade;
      setProdutos(prev => prev.map(p => p.id === id ? { ...p, quantidade_un: quantidadeAtual } : p));
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
        .update({ ativo: false, updated_at: new Date().toISOString() })
        .eq('id', id);

      if (error) throw error;

      const produto = produtos.find(p => p.id === id);
      setProdutos(prev => prev.filter(p => p.id !== id));
      await auditLog('estoque_produto_final', id, 'final_product_stock_inactivated', {
        produto_nome: produto?.brigadeiro?.nome || null,
        quantidade_atual: produto?.quantidade_un ?? null,
      });
      toast({
        title: 'Produto final inativado',
        description: 'Produto removido da operação, com histórico preservado.',
      });
      return true;
    } catch (error: unknown) {
      toast({
        title: 'Erro ao inativar produto final',
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
