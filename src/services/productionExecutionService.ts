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

/**
 * Runs the transaction-safe database routine that:
 * - snapshots recipe components
 * - consumes input stock via ledger movements
 * - writes produced output movement
 * in a single ACID transaction.
 */
export async function executeProductionOrder(payload: ExecuteProductionPayload): Promise<ExecuteProductionResult> {
  const { data, error } = await (supabase.rpc as any)('execute_production_order', {
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

export function buildProductionIdempotencyKey(seed: {
  recipeVersionId: string;
  outputItemId: string;
  plannedOutputQty: number;
  timestamp?: number;
}) {
  const t = seed.timestamp ?? Date.now();
  return `production:${seed.recipeVersionId}:${seed.outputItemId}:${seed.plannedOutputQty}:${t}`;
}
