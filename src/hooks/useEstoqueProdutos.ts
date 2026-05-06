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
  // Joined data
  brigadeiro?: Brigadeiro;
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
        .from('estoque_produtos')
        .select(`
          *,
          brigadeiro:brigadeiros(*)
        `);

      if (error) throw error;
      
      const sortedData = (data || []).sort((a: any, b: any) => {
        const nomeA = a.brigadeiro?.nome || '';
        const nomeB = b.brigadeiro?.nome || '';
        return nomeA.localeCompare(nomeB);
      });

      setProdutos(sortedData as EstoqueProduto[]);
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

  const addProduto = async (brigadeiro_id: string, quantidade_un: number) => {
    if (!user) return null;

    try {
      const { data, error } = await supabase
        .from('estoque_produtos')
        .insert([{ brigadeiro_id, quantidade_un, user_id: user.id }])
        .select(`*, brigadeiro:brigadeiros(*)`)
        .single();

      if (error) throw error;
      
      const novoProduto = data as EstoqueProduto;
      // We refetch to maintain sort order, or just update state and sort
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
        .from('estoque_produtos')
        .update({ quantidade_un: novaQuantidade, updated_at: new Date().toISOString() })
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
        .from('estoque_produtos')
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
