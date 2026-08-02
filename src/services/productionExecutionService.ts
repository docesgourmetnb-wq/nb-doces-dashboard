import { supabase } from '@/integrations/supabase/client';

export interface ExecuteProductionPayload {
  recipeVersionId: string;
  outputItemId: string;
  plannedOutputQty: number;
  actualOutputQty?: number;
  notes?: string;
  idempotencyKey?: string;
}

export interface ExecuteProductionResult {
  production_order_id: string;
  movement_count: number;
}

export interface CompleteMassProductionResult {
  producao_id: string;
  movement_count: number;
}

export interface CancelMassProductionResult {
  id: string;
}

export interface UpdateMassProductionStatusResult {
  id: string;
  status: string;
}

interface ExecuteProductionRpcParams {
  p_recipe_version_id: string;
  p_output_item_id: string;
  p_planned_output_qty: number;
  p_actual_output_qty: number | null;
  p_notes: string | null;
  p_idempotency_key: string | null;
}

interface ExecuteProductionRpc {
  (
    fn: 'execute_production_order',
    params: ExecuteProductionRpcParams,
  ): Promise<{
    data: ExecuteProductionResult[] | ExecuteProductionResult | null;
    error: Error | null;
  }>;
}

interface CompleteMassProductionRpcParams {
  p_producao_id: string;
  p_rendimento_real: number | null;
}

interface CompleteMassProductionRpc {
  (
    fn: 'complete_mass_production',
    params: CompleteMassProductionRpcParams,
  ): Promise<{
    data: CompleteMassProductionResult[] | CompleteMassProductionResult | null;
    error: Error | null;
  }>;
}

interface CancelMassProductionRpcParams {
  p_producao_id: string;
  p_reason: string | null;
}

interface CancelMassProductionRpc {
  (
    fn: 'cancel_mass_production',
    params: CancelMassProductionRpcParams,
  ): Promise<{
    data: CancelMassProductionResult | null;
    error: Error | null;
  }>;
}

interface UpdateMassProductionStatusRpcParams {
  p_producao_id: string;
  p_status: string;
}

interface UpdateMassProductionStatusRpc {
  (
    fn: 'update_mass_production_status',
    params: UpdateMassProductionStatusRpcParams,
  ): Promise<{
    data: UpdateMassProductionStatusResult | null;
    error: Error | null;
  }>;
}

/**
 * Runs the transaction-safe database routine that:
 * - snapshots recipe components
 * - consumes input stock via ledger movements
 * - writes produced output movement
 * in a single ACID transaction.
 */
export async function executeProductionOrder(payload: ExecuteProductionPayload): Promise<ExecuteProductionResult> {
  const executeRpc = supabase.rpc.bind(supabase) as unknown as ExecuteProductionRpc;
  const { data, error } = await executeRpc('execute_production_order', {
    p_recipe_version_id: payload.recipeVersionId,
    p_output_item_id: payload.outputItemId,
    p_planned_output_qty: payload.plannedOutputQty,
    p_actual_output_qty: payload.actualOutputQty ?? null,
    p_notes: payload.notes ?? null,
    p_idempotency_key: payload.idempotencyKey ?? null,
  });

  if (error) {
    throw error;
  }

  const result = Array.isArray(data) ? data[0] : (data ?? null);
  if (!result?.production_order_id) {
    throw new Error('Falha ao executar produção: resposta inválida da RPC.');
  }

  return result as ExecuteProductionResult;
}

export async function completeMassProduction(payload: {
  producaoId: string;
  rendimentoReal?: number | null;
}): Promise<CompleteMassProductionResult> {
  const executeRpc = supabase.rpc.bind(supabase) as unknown as CompleteMassProductionRpc;
  const { data, error } = await executeRpc('complete_mass_production', {
    p_producao_id: payload.producaoId,
    p_rendimento_real: payload.rendimentoReal ?? null,
  });

  if (error) {
    throw error;
  }

  const result = Array.isArray(data) ? data[0] : (data ?? null);
  if (!result?.producao_id) {
    throw new Error('Falha ao concluir produção: resposta inválida da RPC.');
  }

  return result as CompleteMassProductionResult;
}

export async function cancelMassProduction(payload: {
  producaoId: string;
  reason?: string | null;
}): Promise<CancelMassProductionResult> {
  const cancelRpc = supabase.rpc.bind(supabase) as unknown as CancelMassProductionRpc;
  const { data, error } = await cancelRpc('cancel_mass_production', {
    p_producao_id: payload.producaoId,
    p_reason: payload.reason ?? null,
  });

  if (error) {
    throw error;
  }

  if (!data?.id) {
    throw new Error('Falha ao cancelar produção: resposta inválida da RPC.');
  }

  return data;
}

export async function updateMassProductionStatus(payload: {
  producaoId: string;
  status: string;
}): Promise<UpdateMassProductionStatusResult> {
  const updateStatusRpc = supabase.rpc.bind(supabase) as unknown as UpdateMassProductionStatusRpc;
  const { data, error } = await updateStatusRpc('update_mass_production_status', {
    p_producao_id: payload.producaoId,
    p_status: payload.status,
  });

  if (error) {
    throw error;
  }

  if (!data?.id) {
    throw new Error('Falha ao atualizar status da produção: resposta inválida da RPC.');
  }

  return data;
}

export function buildProductionIdempotencyKey(seed: {
  recipeVersionId: string;
  outputItemId: string;
  plannedOutputQty: number;
  timestamp?: number;
}) {
  const t = seed.timestamp ?? Date.now();
  return `production:${seed.recipeVersionId}:${seed.outputItemId}:${seed.plannedOutputQty}:${t}`;
}
