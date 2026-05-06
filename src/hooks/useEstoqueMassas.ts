import { useState, useEffect, useCallback } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/hooks/useAuth';
import { useToast } from '@/hooks/use-toast';

export interface EstoqueMassa {
  id: string;
  sabor: string;
  quantidade_g: number;
  user_id: string;
  created_at: string;
  updated_at: string;
}

export function useEstoqueMassas() {
  const [massas, setMassas] = useState<EstoqueMassa[]>([]);
  const [loading, setLoading] = useState(true);
  const { user } = useAuth();
  const { toast } = useToast();

  const fetchMassas = useCallback(async () => {
    if (!user) {
      setLoading(false);
      return;
    }
    
    setLoading(true);
    try {
      const { data, error } = await supabase
        .from('estoque_massas')
        .select('*')
        .order('sabor', { ascending: true });

      if (error) throw error;
      setMassas((data || []) as EstoqueMassa[]);
    } catch (error: any) {
      console.error('Error fetching massas:', error);
      toast({
        title: 'Erro ao carregar estoque de bases',
        description: error.message,
        variant: 'destructive',
      });
    } finally {
      setLoading(false);
    }
  }, [user, toast]);

  useEffect(() => {
    fetchMassas();
  }, [fetchMassas]);

  const addMassa = async (sabor: string, quantidade_g: number) => {
    if (!user) return null;

    try {
      const { data, error } = await supabase
        .from('estoque_massas')
        .insert([{ sabor, quantidade_g, user_id: user.id }])
        .select()
        .single();

      if (error) throw error;
      
      const novaMassa = data as EstoqueMassa;
      setMassas(prev => [...prev, novaMassa].sort((a, b) => a.sabor.localeCompare(b.sabor)));
      toast({
        title: 'Massa adicionada',
        description: 'Sabor cadastrado no estoque.',
      });
      return novaMassa;
    } catch (error: any) {
      toast({
        title: 'Erro ao cadastrar sabor',
        description: error.message,
        variant: 'destructive',
      });
      return null;
    }
  };

  const updateQuantidade = async (id: string, quantidadeDelta: number) => {
    const massa = massas.find(m => m.id === id);
    if (!massa) return false;

    const novaQuantidade = massa.quantidade_g + quantidadeDelta;
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
        .from('estoque_massas')
        .update({ quantidade_g: novaQuantidade, updated_at: new Date().toISOString() })
        .eq('id', id);

      if (error) throw error;

      setMassas(prev => prev.map(m => m.id === id ? { ...m, quantidade_g: novaQuantidade } : m));
      toast({
        title: 'Estoque atualizado',
        description: `Saldo atualizado com sucesso.`,
      });
      return true;
    } catch (error: any) {
      toast({
        title: 'Erro ao atualizar saldo',
        description: error.message,
        variant: 'destructive',
      });
      return false;
    }
  };

  const deleteMassa = async (id: string) => {
    try {
      const { error } = await supabase
        .from('estoque_massas')
        .delete()
        .eq('id', id);

      if (error) throw error;

      setMassas(prev => prev.filter(m => m.id !== id));
      toast({
        title: 'Registro excluído',
        description: 'Sabor removido do estoque.',
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
    massas,
    loading,
    addMassa,
    updateQuantidade,
    deleteMassa,
    refetch: fetchMassas,
  };
}
