import { useState, useEffect, useCallback } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/hooks/useAuth';
import { useToast } from '@/hooks/use-toast';
import { getProducaoErrorMessage, type ProducaoStatus } from '@/domain/producao';
import {
  buildProductionIdempotencyKey,
  cancelMassProduction,
  completeMassProduction,
  createMassProductionPlan,
  executeProductionOrder,
  updateMassProductionPlan,
  updateMassProductionStatus,
} from '@/services/productionExecutionService';

export interface ProducaoDiaria {
  id: string;
  data: string;
  brigadeiro_id?: string | null;
  brigadeiro_nome: string;
  quantidade: number;
  custo_total: number;
  status: ProducaoStatus;
  recipe_version_id?: string | null;
  consumir_estoque?: boolean;
  insumos_consumidos_at?: string | null;
  rendimento_previsto?: number | null;
  rendimento_real?: number | null;
  observacoes?: string | null;
  deleted_at?: string | null;
  deleted_reason?: string | null;
}

function getErrorMessage(error: unknown) {
  if (error instanceof Error) return getProducaoErrorMessage(error.message);

  if (error && typeof error === 'object' && 'message' in error) {
    const message = String((error as { message?: unknown }).message || '').trim();
    if (message) return getProducaoErrorMessage(message);
  }

  return 'Erro inesperado';
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
    } catch (error: unknown) {
      toast({
        title: 'Erro ao carregar produção',
        description: getErrorMessage(error),
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
      consumeStockOnCompletion?: boolean;
      expectedYield?: number | null;
      notes?: string;
    }
  ) => {
    if (!user) return undefined;
    
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

      const data = await createMassProductionPlan({
        data: item.data,
        brigadeiroId: item.brigadeiro_id ?? null,
        brigadeiroNome: item.brigadeiro_nome,
        quantidade: item.quantidade,
        custoTotal: item.custo_total,
        recipeVersionId: integration?.recipeVersionId ?? item.recipe_version_id ?? null,
        consumirEstoque: integration?.consumeStockOnCompletion ?? item.consumir_estoque ?? false,
        rendimentoPrevisto: integration?.expectedYield ?? item.rendimento_previsto ?? null,
        observacoes: integration?.notes ?? item.observacoes ?? null,
      });

      await fetchProducao();
      toast({ title: integration?.enabled ? 'Produção registrada e estoque movimentado!' : 'Produção planejada!' });
      return data as ProducaoDiaria;
    } catch (error: unknown) {
      toast({
        title: integration?.enabled ? 'Erro ao registrar produção integrada' : 'Erro ao planejar produção',
        description: getErrorMessage(error),
        variant: 'destructive',
      });
      return undefined;
    }
  };

  const updateProducaoStatus = async (
    id: string,
    status: ProducaoDiaria['status'],
    options?: { rendimentoReal?: number | null },
  ) => {
    try {
      const item = producao.find((p) => p.id === id);
      if (status === 'concluido' && item?.recipe_version_id) {
        const result = await completeMassProduction({
          producaoId: id,
          rendimentoReal: options?.rendimentoReal ?? null,
        });
        await fetchProducao();
        toast({
          title: result.movement_count > 0 ? 'Produção concluída e insumos consumidos!' : 'Produção concluída!',
        });
        return;
      }

      const updated = await updateMassProductionStatus({ producaoId: id, status });
      setProducao(producao.map(p => p.id === id ? { ...p, status: updated.status as ProducaoStatus } : p));
      toast({ title: 'Status atualizado!' });
    } catch (error: unknown) {
      toast({
        title: 'Erro ao atualizar status',
        description: getErrorMessage(error),
        variant: 'destructive',
      });
    }
  };

  const updateProducao = async (id: string, updates: { data?: string; quantidade?: number; status?: ProducaoDiaria['status'] }) => {
    try {
      const shouldComplete = updates.status === 'concluido';
      const nonStatusUpdates = { ...updates };
      delete nonStatusUpdates.status;

      if (Object.keys(nonStatusUpdates).length > 0) {
        const planUpdates: { producaoId: string; data?: string; quantidade?: number } = { producaoId: id };
        if (nonStatusUpdates.data !== undefined) planUpdates.data = nonStatusUpdates.data;
        if (nonStatusUpdates.quantidade !== undefined) planUpdates.quantidade = nonStatusUpdates.quantidade;

        await updateMassProductionPlan(planUpdates);
      }

      if (shouldComplete) {
        const item = producao.find((p) => p.id === id);
        if (item?.recipe_version_id) {
          const result = await completeMassProduction({ producaoId: id });
          await fetchProducao();
          toast({
            title: result.movement_count > 0 ? 'Produção concluída e insumos consumidos!' : 'Produção concluída!',
          });
          return;
        }
      }

      if (shouldComplete) {
        await updateMassProductionStatus({ producaoId: id, status: 'concluido' });
      } else if (updates.status) {
        await updateMassProductionStatus({ producaoId: id, status: updates.status });
      }

      // Refetch to get recalculated custo_total from trigger
      await fetchProducao();
      toast({ title: 'Produção atualizada!' });
    } catch (error: unknown) {
      toast({
        title: 'Erro ao atualizar produção',
        description: getErrorMessage(error),
        variant: 'destructive',
      });
    }
  };

  const cancelProducao = async (id: string, reason?: string) => {
    try {
      await cancelMassProduction({ producaoId: id, reason: reason || null });
      await fetchProducao();
      toast({ title: 'Produção cancelada.' });
    } catch (error: unknown) {
      toast({
        title: 'Erro ao cancelar produção',
        description: getErrorMessage(error),
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
