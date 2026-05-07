import { useState, useEffect, useCallback } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/hooks/useAuth';
import { useToast } from '@/hooks/use-toast';
import { type ProducaoStatus } from '@/domain/producao';
import { buildProductionIdempotencyKey, executeProductionOrder } from '@/services/productionExecutionService';

export interface ProducaoDiaria {
  id: string;
  data: string;
  brigadeiro_id?: string | null;
  brigadeiro_nome: string;
  quantidade: number;
  custo_total: number;
  status: ProducaoStatus;
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
    if (!user) {
      setLoading(false);
      return;
    }
    
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

  const addProducao = async (
    item: Omit<ProducaoDiaria, 'id'>,
    integration?: {
      enabled: boolean;
      recipeVersionId?: string;
      outputItemId?: string;
      notes?: string;
    }
  ) => {
    if (!user) return;
    
    try {
      if (integration?.enabled) {
        if (!integration.recipeVersionId || !integration.outputItemId) {
          throw new Error('Para integração de estoque, informe recipeVersionId e outputItemId.');
        }

        await executeProductionOrder({
          recipeVersionId: integration.recipeVersionId,
          outputItemId: integration.outputItemId,
          plannedOutputQty: item.quantidade,
          actualOutputQty: item.quantidade,
          notes: integration.notes ?? `Produção ${item.brigadeiro_nome} (${item.data})`,
          idempotencyKey: buildProductionIdempotencyKey({
            recipeVersionId: integration.recipeVersionId,
            outputItemId: integration.outputItemId,
            plannedOutputQty: item.quantidade,
          }),
        });
      }

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
      toast({ title: integration?.enabled ? 'Produção registrada e estoque movimentado!' : 'Produção planejada!' });
      return data as ProducaoDiaria;
    } catch (error: any) {
      toast({
        title: integration?.enabled ? 'Erro ao registrar produção integrada' : 'Erro ao planejar produção',
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
