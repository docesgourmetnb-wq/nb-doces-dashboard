-- Produção por receita/massa, sem saída obrigatória de produto final.
ALTER TABLE public.producao_diaria
  ADD COLUMN IF NOT EXISTS recipe_version_id UUID,
  ADD COLUMN IF NOT EXISTS consumir_estoque BOOLEAN NOT NULL DEFAULT false,
  ADD COLUMN IF NOT EXISTS insumos_consumidos_at TIMESTAMPTZ,
  ADD COLUMN IF NOT EXISTS rendimento_previsto NUMERIC(14,4),
  ADD COLUMN IF NOT EXISTS rendimento_real NUMERIC(14,4),
  ADD COLUMN IF NOT EXISTS observacoes TEXT;

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint WHERE conname = 'producao_diaria_recipe_version_owner_fkey'
  ) THEN
    ALTER TABLE public.producao_diaria
      ADD CONSTRAINT producao_diaria_recipe_version_owner_fkey
      FOREIGN KEY (user_id, recipe_version_id)
      REFERENCES public.recipe_versions(user_id, id)
      ON DELETE RESTRICT;
  END IF;
END $$;

CREATE OR REPLACE FUNCTION public.complete_mass_production(
  p_producao_id UUID,
  p_rendimento_real NUMERIC DEFAULT NULL
)
RETURNS TABLE (
  producao_id UUID,
  movement_count INTEGER
)
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_user_id UUID := auth.uid();
  v_producao public.producao_diaria%ROWTYPE;
  v_recipe_yield NUMERIC;
  v_predicted_yield NUMERIC;
  v_required NUMERIC;
  v_balance NUMERIC;
  v_movement_count INTEGER := 0;
  v_idempotency_key TEXT;
  rec_component RECORD;
BEGIN
  IF v_user_id IS NULL THEN
    RAISE EXCEPTION 'Usuário não autenticado';
  END IF;

  SELECT *
    INTO v_producao
  FROM public.producao_diaria
  WHERE id = p_producao_id
    AND user_id = v_user_id
  FOR UPDATE;

  IF v_producao.id IS NULL THEN
    RAISE EXCEPTION 'Produção não encontrada';
  END IF;

  IF v_producao.deleted_at IS NOT NULL THEN
    RAISE EXCEPTION 'Produção cancelada não pode ser concluída';
  END IF;

  IF v_producao.status = 'concluido' THEN
    RAISE EXCEPTION 'Produção já concluída';
  END IF;

  IF v_producao.quantidade IS NULL OR v_producao.quantidade <= 0 THEN
    RAISE EXCEPTION 'Quantidade de bateladas inválida';
  END IF;

  IF v_producao.recipe_version_id IS NULL THEN
    RAISE EXCEPTION 'Produção sem receita vinculada';
  END IF;

  SELECT rv.yield_qty
    INTO v_recipe_yield
  FROM public.recipe_versions rv
  JOIN public.recipes r
    ON r.id = rv.recipe_id
   AND r.user_id = rv.user_id
  WHERE rv.id = v_producao.recipe_version_id
    AND rv.user_id = v_user_id
    AND rv.status = 'active';

  IF v_recipe_yield IS NULL OR v_recipe_yield <= 0 THEN
    RAISE EXCEPTION 'Receita ativa inválida ou sem rendimento';
  END IF;

  v_predicted_yield := ROUND(v_recipe_yield * v_producao.quantidade, 4);

  IF v_producao.consumir_estoque THEN
    IF v_producao.insumos_consumidos_at IS NOT NULL OR EXISTS (
      SELECT 1
      FROM public.stock_movements sm
      WHERE sm.user_id = v_user_id
        AND sm.reference_type = 'producao_diaria'
        AND sm.reference_id = v_producao.id
        AND sm.reason = 'producao_consumo'
    ) THEN
      RAISE EXCEPTION 'Insumos desta produção já foram consumidos';
    END IF;

    PERFORM 1
    FROM public.recipe_components rc
    WHERE rc.recipe_version_id = v_producao.recipe_version_id
      AND rc.user_id = v_user_id
    FOR UPDATE;

    FOR rec_component IN
      SELECT
        rc.stock_item_id,
        si.nome AS stock_item_nome,
        rc.qty_per_batch,
        rc.uom,
        rc.waste_factor
      FROM public.recipe_components rc
      JOIN public.stock_items si
        ON si.id = rc.stock_item_id
       AND si.user_id = rc.user_id
      WHERE rc.recipe_version_id = v_producao.recipe_version_id
        AND rc.user_id = v_user_id
      ORDER BY rc.created_at
    LOOP
      v_required := (rec_component.qty_per_batch * v_producao.quantidade) * (1 + rec_component.waste_factor);
      v_required := ROUND(v_required, 4);

      PERFORM 1
      FROM public.stock_movements sm
      WHERE sm.user_id = v_user_id
        AND sm.stock_item_id = rec_component.stock_item_id
      FOR UPDATE;

      v_balance := public.get_stock_balance(v_user_id, rec_component.stock_item_id);
      IF v_balance < v_required THEN
        RAISE EXCEPTION 'Saldo insuficiente para insumo %: saldo %, necessário %',
          rec_component.stock_item_nome, v_balance, v_required;
      END IF;
    END LOOP;

    FOR rec_component IN
      SELECT
        rc.stock_item_id,
        si.nome AS stock_item_nome,
        rc.qty_per_batch,
        rc.uom,
        rc.waste_factor
      FROM public.recipe_components rc
      JOIN public.stock_items si
        ON si.id = rc.stock_item_id
       AND si.user_id = rc.user_id
      WHERE rc.recipe_version_id = v_producao.recipe_version_id
        AND rc.user_id = v_user_id
      ORDER BY rc.created_at
    LOOP
      v_required := (rec_component.qty_per_batch * v_producao.quantidade) * (1 + rec_component.waste_factor);
      v_required := ROUND(v_required, 4);
      v_idempotency_key := 'mass-production:' || v_producao.id::TEXT || ':' || rec_component.stock_item_id::TEXT;

      INSERT INTO public.stock_movements (
        user_id,
        stock_item_id,
        direction,
        quantity,
        uom,
        reason,
        reference_type,
        reference_id,
        idempotency_key,
        occurred_at,
        created_by
      )
      VALUES (
        v_user_id,
        rec_component.stock_item_id,
        'out',
        v_required,
        rec_component.uom,
        'producao_consumo',
        'producao_diaria',
        v_producao.id,
        v_idempotency_key,
        now(),
        v_user_id
      );

      v_movement_count := v_movement_count + 1;
    END LOOP;
  END IF;

  UPDATE public.producao_diaria
  SET
    status = 'concluido',
    rendimento_previsto = v_predicted_yield,
    rendimento_real = COALESCE(p_rendimento_real, v_predicted_yield),
    insumos_consumidos_at = CASE
      WHEN v_producao.consumir_estoque THEN COALESCE(v_producao.insumos_consumidos_at, now())
      ELSE v_producao.insumos_consumidos_at
    END
  WHERE id = v_producao.id
    AND user_id = v_user_id;

  RETURN QUERY SELECT v_producao.id, v_movement_count;
END;
$$;
