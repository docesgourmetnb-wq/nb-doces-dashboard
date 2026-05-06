import { useState, useEffect, useCallback } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/hooks/useAuth';
import { useToast } from '@/hooks/use-toast';

export interface Insumo {
  id: string;
  nome: string;
  unidade: string;
  quantidade_atual: number;
  quantidade_minima: number;
  consumo_medio: number;
  preco_unitario: number;
  ultima_compra?: string | null;
}

export function useInsumos() {
  const [insumos, setInsumos] = useState<Insumo[]>([]);
  const [loading, setLoading] = useState(true);
  const { user } = useAuth();
  const { toast } = useToast();

  const fetchInsumos = useCallback(async () => {
    if (!user) {
      setLoading(false);
      return;
    }
    
    try {
      const { data, error } = await supabase
        .from('insumos')
        .select('*')
        .not('unidade', 'in', '("SYS_MASSA","SYS_PROD")')
        .order('nome');

      if (error) throw error;
      setInsumos((data || []) as Insumo[]);
    } catch (error: any) {
      toast({
        title: 'Erro ao carregar estoque',
        description: error.message,
        variant: 'destructive',
      });
    } finally {
      setLoading(false);
    }
  }, [user, toast]);

  useEffect(() => {
    fetchInsumos();
  }, [fetchInsumos]);

  const addInsumo = async (insumo: Omit<Insumo, 'id'>) => {
    if (!user) return;
    
    try {
      const { data, error } = await supabase
        .from('insumos')
        .insert({
          nome: insumo.nome,
          unidade: insumo.unidade,
          quantidade_atual: insumo.quantidade_atual,
          quantidade_minima: insumo.quantidade_minima,
          consumo_medio: insumo.consumo_medio,
          preco_unitario: insumo.preco_unitario,
          ultima_compra: insumo.ultima_compra,
          user_id: user.id,
        })
        .select()
        .single();

      if (error) throw error;
      const newInsumo = data as Insumo;
      setInsumos([...insumos, newInsumo]);
      toast({ title: 'Insumo adicionado!' });
      return newInsumo;
    } catch (error: any) {
      toast({
        title: 'Erro ao adicionar insumo',
        description: error.message,
        variant: 'destructive',
      });
    }
  };

  const updateInsumo = async (id: string, updates: Partial<Insumo>) => {
    try {
      const { data, error } = await supabase
        .from('insumos')
        .update(updates)
        .eq('id', id)
        .select()
        .single();

      if (error) throw error;
      const updatedInsumo = data as Insumo;
      setInsumos(insumos.map(i => i.id === id ? updatedInsumo : i));
      toast({ title: 'Insumo atualizado!' });
      return updatedInsumo;
    } catch (error: any) {
      toast({
        title: 'Erro ao atualizar insumo',
        description: error.message,
        variant: 'destructive',
      });
    }
  };

  const deleteInsumo = async (id: string) => {
    try {
      const { error } = await supabase
        .from('insumos')
        .delete()
        .eq('id', id);

      if (error) throw error;
      setInsumos(insumos.filter(i => i.id !== id));
      toast({ title: 'Insumo removido!' });
    } catch (error: any) {
      toast({
        title: 'Erro ao remover insumo',
        description: error.message,
        variant: 'destructive',
      });
    }
  };

  return { insumos, loading, addInsumo, updateInsumo, deleteInsumo, refetch: fetchInsumos };
}
