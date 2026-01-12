import { useState, useEffect, useCallback } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/hooks/useAuth';
import { useToast } from '@/hooks/use-toast';

export interface Brigadeiro {
  id: string;
  nome: string;
  tipo: 'tradicional' | 'gourmet' | 'premium';
  preco_venda: number;
  custo_unitario: number;
  margem_lucro: number;
  descricao?: string | null;
  ativo: boolean;
}

export function useBrigadeiros() {
  const [brigadeiros, setBrigadeiros] = useState<Brigadeiro[]>([]);
  const [loading, setLoading] = useState(true);
  const { user } = useAuth();
  const { toast } = useToast();

  const fetchBrigadeiros = useCallback(async () => {
    if (!user) return;
    
    try {
      const { data, error } = await supabase
        .from('brigadeiros')
        .select('*')
        .order('created_at', { ascending: false });

      if (error) throw error;
      setBrigadeiros((data || []) as Brigadeiro[]);
    } catch (error: any) {
      toast({
        title: 'Erro ao carregar produtos',
        description: error.message,
        variant: 'destructive',
      });
    } finally {
      setLoading(false);
    }
  }, [user, toast]);

  useEffect(() => {
    fetchBrigadeiros();
  }, [fetchBrigadeiros]);

  const addBrigadeiro = async (brigadeiro: Omit<Brigadeiro, 'id' | 'margem_lucro'>) => {
    if (!user) return;
    
    try {
      const { data, error } = await supabase
        .from('brigadeiros')
        .insert({
          nome: brigadeiro.nome,
          tipo: brigadeiro.tipo,
          preco_venda: brigadeiro.preco_venda,
          custo_unitario: brigadeiro.custo_unitario,
          descricao: brigadeiro.descricao,
          ativo: brigadeiro.ativo,
          user_id: user.id,
        })
        .select()
        .single();

      if (error) throw error;
      const newBrigadeiro = data as Brigadeiro;
      setBrigadeiros([newBrigadeiro, ...brigadeiros]);
      toast({ title: 'Produto adicionado com sucesso!' });
      return newBrigadeiro;
    } catch (error: any) {
      toast({
        title: 'Erro ao adicionar produto',
        description: error.message,
        variant: 'destructive',
      });
    }
  };

  const updateBrigadeiro = async (id: string, updates: Partial<Brigadeiro>) => {
    try {
      const { data, error } = await supabase
        .from('brigadeiros')
        .update(updates)
        .eq('id', id)
        .select()
        .single();

      if (error) throw error;
      const updatedBrigadeiro = data as Brigadeiro;
      setBrigadeiros(brigadeiros.map(b => b.id === id ? updatedBrigadeiro : b));
      toast({ title: 'Produto atualizado!' });
      return updatedBrigadeiro;
    } catch (error: any) {
      toast({
        title: 'Erro ao atualizar produto',
        description: error.message,
        variant: 'destructive',
      });
    }
  };

  const deleteBrigadeiro = async (id: string) => {
    try {
      const { error } = await supabase
        .from('brigadeiros')
        .delete()
        .eq('id', id);

      if (error) throw error;
      setBrigadeiros(brigadeiros.filter(b => b.id !== id));
      toast({ title: 'Produto removido!' });
    } catch (error: any) {
      toast({
        title: 'Erro ao remover produto',
        description: error.message,
        variant: 'destructive',
      });
    }
  };

  return { brigadeiros, loading, addBrigadeiro, updateBrigadeiro, deleteBrigadeiro, refetch: fetchBrigadeiros };
}
