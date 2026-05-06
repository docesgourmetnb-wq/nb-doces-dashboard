import { useState, useEffect, useCallback } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/hooks/useAuth';
import { useToast } from '@/hooks/use-toast';
import { Brigadeiro } from './useBrigadeiros';

export interface EstoqueProduto {
  id: string;
  brigadeiro_id: string;
  quantidade_un: number;
  user_id: string;
  created_at: string;
  updated_at: string;
  brigadeiro?: Partial<Brigadeiro>;
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
      
      const produtosFormatados = (data || []).map((m: any) => {
        const [, brigId, brigNome] = m.nome.match(/\[PRODUTO\] (.*?)::(.*)/) || ['', '', 'Produto Desconhecido'];
        return {
          id: m.id,
          brigadeiro_id: brigId,
          quantidade_un: m.quantidade_atual || 0,
          user_id: m.user_id,
          created_at: m.created_at,
          updated_at: m.updated_at,
          brigadeiro: { id: brigId, nome: brigNome }
        } as EstoqueProduto;
      }).sort((a, b) => (a.brigadeiro?.nome || '').localeCompare(b.brigadeiro?.nome || ''));

      setProdutos(produtosFormatados);
    } catch (error: any) {
      console.error('Error fetching produtos:', error);
      toast({
        title: 'Erro ao carregar estoque final',
        description: error.message,
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
      
      const novoProduto = {
        id: data.id,
        brigadeiro_id: brigadeiro_id,
        quantidade_un: data.quantidade_atual || 0,
        user_id: data.user_id,
        created_at: data.created_at,
        updated_at: data.updated_at,
        brigadeiro: { id: brigadeiro_id, nome: brigadeiro_nome }
      } as EstoqueProduto;

      setProdutos(prev => {
          const newState = [...prev, novoProduto];
          return newState.sort((a, b) => (a.brigadeiro?.nome || '').localeCompare(b.brigadeiro?.nome || ''));
      });

      toast({
        title: 'Produto adicionado',
        description: 'Produto cadastrado no estoque.',
      });
      return novoProduto;
    } catch (error: any) {
      toast({
        title: 'Erro ao cadastrar produto',
        description: error.message,
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
    } catch (error: any) {
      toast({
        title: 'Erro ao atualizar unidades',
        description: error.message,
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
    } catch (error: any) {
      toast({
        title: 'Erro ao excluir',
        description: error.message,
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
