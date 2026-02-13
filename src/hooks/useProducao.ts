import { useState, useEffect, useCallback } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/hooks/useAuth';
import { useToast } from '@/hooks/use-toast';

export interface ProducaoDiaria {
  id: string;
  data: string;
  brigadeiro_id?: string | null;
  brigadeiro_nome: string;
  quantidade: number;
  custo_total: number;
  status: 'planejado' | 'em-andamento' | 'concluido';
  deleted_at?: string | null;
  deleted_reason?: string | null;
}

export function useProducao() {
  const [producao, setProducao] = useState<ProducaoDiaria[]>([]);
  const [loading, setLoading] = useState(true);
  const [showDeleted, setShowDeleted] = useState(false);
  const { user } = useAuth();
  const { toast } = useToast();

  const fetchProducao = useCallback(async () => {
    if (!user) return;
    
    try {
      let query = supabase
        .from('producao_diaria')
        .select('*')
        .order('data', { ascending: false });

      if (!showDeleted) {
        query = query.is('deleted_at', null);
      }

      const { data, error } = await query;

      if (error) throw error;
      setProducao((data || []) as ProducaoDiaria[]);
    } catch (error: any) {
      toast({
        title: 'Erro ao carregar produção',
        description: error.message,
        variant: 'destructive',
      });
    } finally {
      setLoading(false);
    }
  }, [user, toast, showDeleted]);

  useEffect(() => {
    fetchProducao();
  }, [fetchProducao]);

  const addProducao = async (item: Omit<ProducaoDiaria, 'id'>) => {
    if (!user) return;
    
    try {
      const { data, error } = await supabase
        .from('producao_diaria')
        .insert({
          data: item.data,
          brigadeiro_id: item.brigadeiro_id,
          brigadeiro_nome: item.brigadeiro_nome,
          quantidade: item.quantidade,
          custo_total: item.custo_total,
          status: item.status,
          user_id: user.id,
        })
        .select()
        .single();

      if (error) throw error;
      await fetchProducao();
      toast({ title: 'Produção planejada!' });
      return data as ProducaoDiaria;
    } catch (error: any) {
      toast({
        title: 'Erro ao planejar produção',
        description: error.message,
        variant: 'destructive',
      });
    }
  };

  const updateProducaoStatus = async (id: string, status: ProducaoDiaria['status']) => {
    try {
      const { error } = await supabase
        .from('producao_diaria')
        .update({ status })
        .eq('id', id);

      if (error) throw error;
      setProducao(producao.map(p => p.id === id ? { ...p, status } : p));
      toast({ title: 'Status atualizado!' });
    } catch (error: any) {
      toast({
        title: 'Erro ao atualizar status',
        description: error.message,
        variant: 'destructive',
      });
    }
  };

  const updateProducao = async (id: string, updates: { data?: string; quantidade?: number; status?: ProducaoDiaria['status'] }) => {
    try {
      const { error } = await supabase
        .from('producao_diaria')
        .update(updates)
        .eq('id', id);

      if (error) throw error;
      // Refetch to get recalculated custo_total from trigger
      await fetchProducao();
      toast({ title: 'Produção atualizada!' });
    } catch (error: any) {
      toast({
        title: 'Erro ao atualizar produção',
        description: error.message,
        variant: 'destructive',
      });
    }
  };

  const cancelProducao = async (id: string, reason?: string) => {
    try {
      const { error } = await supabase
        .from('producao_diaria')
        .update({ deleted_at: new Date().toISOString(), deleted_reason: reason || null })
        .eq('id', id);

      if (error) throw error;
      await fetchProducao();
      toast({ title: 'Produção cancelada.' });
    } catch (error: any) {
      toast({
        title: 'Erro ao cancelar produção',
        description: error.message,
        variant: 'destructive',
      });
    }
  };

  return {
    producao,
    loading,
    showDeleted,
    setShowDeleted,
    addProducao,
    updateProducaoStatus,
    updateProducao,
    cancelProducao,
    refetch: fetchProducao,
  };
}
