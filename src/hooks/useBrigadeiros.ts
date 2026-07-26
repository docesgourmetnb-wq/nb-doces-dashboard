import { useState, useEffect, useCallback } from 'react';
import { supabase } from '@/integrations/supabase/client';
import type { TablesInsert } from '@/integrations/supabase/types';
import { useAuth } from '@/hooks/useAuth';
import { useToast } from '@/hooks/use-toast';

export interface Brigadeiro {
  id: string;
  nome: string;
  categoria: 'brigadeiro' | 'bolo';
  tamanho_g?: number | null;
  tipo: 'tradicional' | 'gourmet' | 'premium';
  preco_venda: number;
  custo_unitario: number;
  margem_lucro: number;
  descricao?: string | null;
  ativo: boolean;
}

type BrigadeiroInsert = TablesInsert<'brigadeiros'>;

function getErrorMessage(error: unknown) {
  return error instanceof Error ? error.message : 'Erro inesperado';
}

export function useBrigadeiros() {
  const [brigadeiros, setBrigadeiros] = useState<Brigadeiro[]>([]);
  const [loading, setLoading] = useState(true);
  const { user } = useAuth();
  const { toast } = useToast();

  const fetchBrigadeiros = useCallback(async () => {
    if (!user) {
      setLoading(false);
      return;
    }
    
    try {
      const { data, error } = await supabase
        .from('brigadeiros')
        .select('*')
        .eq('ativo', true)
        .order('created_at', { ascending: false });

      if (error) throw error;
      setBrigadeiros((data || []) as Brigadeiro[]);
    } catch (error: unknown) {
      toast({
        title: 'Erro ao carregar produtos',
        description: getErrorMessage(error),
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
    if (!user) return undefined;
    
    try {
      const insertData: BrigadeiroInsert = {
        nome: brigadeiro.nome,
        categoria: brigadeiro.categoria,
        tamanho_g: brigadeiro.tamanho_g ?? null,
        tipo: brigadeiro.tipo,
        preco_venda: brigadeiro.preco_venda,
        custo_unitario: brigadeiro.custo_unitario,
        ativo: brigadeiro.ativo,
        user_id: user.id,
      };
      if (brigadeiro.descricao !== undefined) {
        insertData.descricao = brigadeiro.descricao;
      }

      const { data, error } = await supabase
        .from('brigadeiros')
        .insert(insertData)
        .select()
        .single();

      if (error) throw error;
      const newBrigadeiro = data as Brigadeiro;
      setBrigadeiros([newBrigadeiro, ...brigadeiros]);
      toast({ title: 'Produto adicionado com sucesso!' });
      return newBrigadeiro;
    } catch (error: unknown) {
      toast({
        title: 'Erro ao adicionar produto',
        description: getErrorMessage(error),
        variant: 'destructive',
      });
      return undefined;
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
    } catch (error: unknown) {
      toast({
        title: 'Erro ao atualizar produto',
        description: getErrorMessage(error),
        variant: 'destructive',
      });
      return undefined;
    }
  };

  const deleteBrigadeiro = async (id: string) => {
    try {
      const { error } = await supabase
        .from('brigadeiros')
        .update({ ativo: false })
        .eq('id', id);

      if (error) throw error;
      setBrigadeiros(brigadeiros.filter(b => b.id !== id));
      toast({ title: 'Produto inativado!' });
    } catch (error: unknown) {
      toast({
        title: 'Erro ao inativar produto',
        description: getErrorMessage(error),
        variant: 'destructive',
      });
    }
  };

  return { brigadeiros, loading, addBrigadeiro, updateBrigadeiro, deleteBrigadeiro, refetch: fetchBrigadeiros };
}
