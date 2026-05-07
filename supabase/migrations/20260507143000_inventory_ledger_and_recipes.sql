-- Inventory ledger and recipe model foundation
-- This migration introduces normalized stock items, recipe versioning,
-- production orders, and auditable stock movements.

-- Enums
DO $$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_type WHERE typname = 'stock_item_type') THEN
    CREATE TYPE public.stock_item_type AS ENUM ('insumo', 'massa_base', 'produto_final');
  END IF;
END $$;

DO $$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_type WHERE typname = 'recipe_type') THEN
    CREATE TYPE public.recipe_type AS ENUM ('massa_base', 'produto_final');
  END IF;
END $$;

DO $$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_type WHERE typname = 'recipe_version_status') THEN
    CREATE TYPE public.recipe_version_status AS ENUM ('draft', 'active', 'archived');
  END IF;
END $$;

DO $$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_type WHERE typname = 'recipe_component_type') THEN
    CREATE TYPE public.recipe_component_type AS ENUM ('base', 'adicional', 'embalagem', 'perda_planejada');
  END IF;
END $$;

DO $$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_type WHERE typname = 'movement_direction') THEN
    CREATE TYPE public.movement_direction AS ENUM ('in', 'out');
  END IF;
END $$;

DO $$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_type WHERE typname = 'movement_reason') THEN
    CREATE TYPE public.movement_reason AS ENUM (
      'saldo_inicial',
      'compra',
      'ajuste_manual',
      'producao_consumo',
      'producao_saida',
      'venda',
      'perda'
    );
  END IF;
END $$;

DO $$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_type WHERE typname = 'production_order_status') THEN
    CREATE TYPE public.production_order_status AS ENUM ('planned', 'executed', 'cancelled');
  END IF;
END $$;

-- Core inventory catalog
CREATE TABLE IF NOT EXISTS public.stock_items (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  nome TEXT NOT NULL,
  unidade_base TEXT NOT NULL,
  tipo public.stock_item_type NOT NULL,
  ativo BOOLEAN NOT NULL DEFAULT true,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  UNIQUE (user_id, nome, tipo)
);

-- Recipes
CREATE TABLE IF NOT EXISTS public.recipes (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  nome TEXT NOT NULL,
  tipo public.recipe_type NOT NULL,
  yield_uom TEXT NOT NULL DEFAULT 'g',
  ativo BOOLEAN NOT NULL DEFAULT true,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  UNIQUE (user_id, nome, tipo)
);

CREATE TABLE IF NOT EXISTS public.recipe_versions (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  recipe_id UUID NOT NULL REFERENCES public.recipes(id) ON DELETE CASCADE,
  version_no INTEGER NOT NULL CHECK (version_no > 0),
  status public.recipe_version_status NOT NULL DEFAULT 'draft',
  yield_qty NUMERIC(14,4) NOT NULL CHECK (yield_qty > 0),
  valid_from DATE,
  valid_to DATE,
  notes TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  UNIQUE (recipe_id, version_no)
);

CREATE UNIQUE INDEX IF NOT EXISTS uq_recipe_single_active_version
  ON public.recipe_versions (recipe_id)
  WHERE status = 'active';

CREATE TABLE IF NOT EXISTS public.recipe_components (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  recipe_version_id UUID NOT NULL REFERENCES public.recipe_versions(id) ON DELETE CASCADE,
  stock_item_id UUID NOT NULL REFERENCES public.stock_items(id) ON DELETE RESTRICT,
  component_type public.recipe_component_type NOT NULL DEFAULT 'base',
  qty_per_batch NUMERIC(14,4) NOT NULL CHECK (qty_per_batch > 0),
  uom TEXT NOT NULL,
  waste_factor NUMERIC(8,6) NOT NULL DEFAULT 0 CHECK (waste_factor >= 0 AND waste_factor < 1),
  sort_order INTEGER NOT NULL DEFAULT 0,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE UNIQUE INDEX IF NOT EXISTS uq_recipe_component_once
  ON public.recipe_components (recipe_version_id, stock_item_id, component_type);

-- Production execution
CREATE TABLE IF NOT EXISTS public.production_orders (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  recipe_version_id UUID NOT NULL REFERENCES public.recipe_versions(id) ON DELETE RESTRICT,
  output_item_id UUID NOT NULL REFERENCES public.stock_items(id) ON DELETE RESTRICT,
  planned_output_qty NUMERIC(14,4) NOT NULL CHECK (planned_output_qty > 0),
  actual_output_qty NUMERIC(14,4),
  output_uom TEXT NOT NULL,
  status public.production_order_status NOT NULL DEFAULT 'planned',
  notes TEXT,
  executed_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE TABLE IF NOT EXISTS public.production_consumptions (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  production_order_id UUID NOT NULL REFERENCES public.production_orders(id) ON DELETE CASCADE,
  stock_item_id UUID NOT NULL REFERENCES public.stock_items(id) ON DELETE RESTRICT,
  component_type public.recipe_component_type NOT NULL,
  required_qty NUMERIC(14,4) NOT NULL CHECK (required_qty >= 0),
  consumed_qty NUMERIC(14,4) NOT NULL CHECK (consumed_qty >= 0),
  uom TEXT NOT NULL,
  waste_factor NUMERIC(8,6) NOT NULL DEFAULT 0 CHECK (waste_factor >= 0 AND waste_factor < 1),
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- Ledger
CREATE TABLE IF NOT EXISTS public.stock_movements (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  stock_item_id UUID NOT NULL REFERENCES public.stock_items(id) ON DELETE RESTRICT,
  direction public.movement_direction NOT NULL,
  quantity NUMERIC(14,4) NOT NULL CHECK (quantity > 0),
  uom TEXT NOT NULL,
  reason public.movement_reason NOT NULL,
  reference_type TEXT,
  reference_id UUID,
  idempotency_key TEXT,
  occurred_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  created_by UUID REFERENCES auth.users(id) ON DELETE SET NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  CONSTRAINT chk_reference_pair CHECK (
    (reference_type IS NULL AND reference_id IS NULL) OR
    (reference_type IS NOT NULL AND reference_id IS NOT NULL)
  )
);

CREATE UNIQUE INDEX IF NOT EXISTS uq_stock_movements_idempotency
  ON public.stock_movements(user_id, idempotency_key)
  WHERE idempotency_key IS NOT NULL;

CREATE INDEX IF NOT EXISTS idx_stock_movements_item_time
  ON public.stock_movements(stock_item_id, occurred_at DESC);

-- Derived balance view
CREATE OR REPLACE VIEW public.v_stock_balance AS
SELECT
  si.id AS stock_item_id,
  si.user_id,
  si.nome,
  si.unidade_base,
  si.tipo,
  COALESCE(SUM(
    CASE sm.direction
      WHEN 'in' THEN sm.quantity
      WHEN 'out' THEN -sm.quantity
      ELSE 0
    END
  ), 0)::NUMERIC(14,4) AS saldo_atual
FROM public.stock_items si
LEFT JOIN public.stock_movements sm ON sm.stock_item_id = si.id
GROUP BY si.id, si.user_id, si.nome, si.unidade_base, si.tipo;

-- Helper function for consistent balance lookup
CREATE OR REPLACE FUNCTION public.get_stock_balance(p_user_id UUID, p_stock_item_id UUID)
RETURNS NUMERIC
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT COALESCE(SUM(
    CASE direction
      WHEN 'in' THEN quantity
      WHEN 'out' THEN -quantity
      ELSE 0
    END
  ), 0)
  FROM public.stock_movements
  WHERE user_id = p_user_id AND stock_item_id = p_stock_item_id;
$$;

-- Transaction-safe production execution
CREATE OR REPLACE FUNCTION public.execute_production_order(
  p_recipe_version_id UUID,
  p_output_item_id UUID,
  p_planned_output_qty NUMERIC,
  p_actual_output_qty NUMERIC DEFAULT NULL,
  p_notes TEXT DEFAULT NULL,
  p_idempotency_key TEXT DEFAULT NULL
)
RETURNS TABLE (
  production_order_id UUID,
  movement_count INTEGER
)
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_user_id UUID := auth.uid();
  v_order_id UUID;
  v_yield_qty NUMERIC;
  v_actual_output NUMERIC;
  v_scale_factor NUMERIC;
  v_required NUMERIC;
  v_balance NUMERIC;
  v_movement_count INTEGER := 0;
  rec_component RECORD;
BEGIN
  IF v_user_id IS NULL THEN
    RAISE EXCEPTION 'Usuário não autenticado';
  END IF;

  IF p_planned_output_qty IS NULL OR p_planned_output_qty <= 0 THEN
    RAISE EXCEPTION 'Quantidade planejada inválida';
  END IF;

  IF p_idempotency_key IS NOT NULL AND EXISTS (
    SELECT 1
    FROM public.stock_movements sm
    WHERE sm.user_id = v_user_id
      AND sm.idempotency_key = p_idempotency_key
  ) THEN
    RAISE EXCEPTION 'Operação já processada para esta chave de idempotência';
  END IF;

  SELECT rv.yield_qty
    INTO v_yield_qty
  FROM public.recipe_versions rv
  JOIN public.recipes r ON r.id = rv.recipe_id
  WHERE rv.id = p_recipe_version_id
    AND rv.user_id = v_user_id
    AND r.user_id = v_user_id;

  IF v_yield_qty IS NULL OR v_yield_qty <= 0 THEN
    RAISE EXCEPTION 'Versão de receita inválida ou sem rendimento';
  END IF;

  v_actual_output := COALESCE(p_actual_output_qty, p_planned_output_qty);
  IF v_actual_output <= 0 THEN
    RAISE EXCEPTION 'Quantidade de saída inválida';
  END IF;

  v_scale_factor := p_planned_output_qty / v_yield_qty;

  -- Lock all component rows to reduce concurrent edits in recipe execution window.
  PERFORM 1
  FROM public.recipe_components rc
  WHERE rc.recipe_version_id = p_recipe_version_id
    AND rc.user_id = v_user_id
  FOR UPDATE;

  -- Create order
  INSERT INTO public.production_orders (
    user_id,
    recipe_version_id,
    output_item_id,
    planned_output_qty,
    actual_output_qty,
    output_uom,
    status,
    notes,
    executed_at
  )
  VALUES (
    v_user_id,
    p_recipe_version_id,
    p_output_item_id,
    p_planned_output_qty,
    v_actual_output,
    (SELECT unidade_base FROM public.stock_items WHERE id = p_output_item_id AND user_id = v_user_id),
    'executed',
    p_notes,
    now()
  )
  RETURNING id INTO v_order_id;

  -- Validate and consume each component
  FOR rec_component IN
    SELECT
      rc.stock_item_id,
      rc.component_type,
      rc.qty_per_batch,
      rc.uom,
      rc.waste_factor
    FROM public.recipe_components rc
    WHERE rc.recipe_version_id = p_recipe_version_id
      AND rc.user_id = v_user_id
    ORDER BY rc.sort_order, rc.created_at
  LOOP
    v_required := (rec_component.qty_per_batch * v_scale_factor) * (1 + rec_component.waste_factor);
    v_required := ROUND(v_required, 4);

    -- Lock item balance source rows for concurrent safety
    PERFORM 1
    FROM public.stock_movements sm
    WHERE sm.user_id = v_user_id
      AND sm.stock_item_id = rec_component.stock_item_id
    FOR UPDATE;

    v_balance := public.get_stock_balance(v_user_id, rec_component.stock_item_id);
    IF v_balance < v_required THEN
      RAISE EXCEPTION 'Saldo insuficiente para item %: saldo %, requerido %',
        rec_component.stock_item_id, v_balance, v_required;
    END IF;

    INSERT INTO public.production_consumptions (
      user_id,
      production_order_id,
      stock_item_id,
      component_type,
      required_qty,
      consumed_qty,
      uom,
      waste_factor
    )
    VALUES (
      v_user_id,
      v_order_id,
      rec_component.stock_item_id,
      rec_component.component_type,
      v_required,
      v_required,
      rec_component.uom,
      rec_component.waste_factor
    );

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
      'production_order',
      v_order_id,
      p_idempotency_key,
      now(),
      v_user_id
    );

    v_movement_count := v_movement_count + 1;
  END LOOP;

  -- Output movement
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
    p_output_item_id,
    'in',
    v_actual_output,
    (SELECT unidade_base FROM public.stock_items WHERE id = p_output_item_id AND user_id = v_user_id),
    'producao_saida',
    'production_order',
    v_order_id,
    p_idempotency_key,
    now(),
    v_user_id
  );

  v_movement_count := v_movement_count + 1;

  RETURN QUERY SELECT v_order_id, v_movement_count;
END;
$$;

-- Backfill stock_items from legacy insumos table (idempotent)
INSERT INTO public.stock_items (user_id, nome, unidade_base, tipo, created_at, updated_at)
SELECT
  i.user_id,
  CASE
    WHEN i.unidade = 'SYS_MASSA' THEN REPLACE(i.nome, '[MASSA] ', '')
    WHEN i.unidade = 'SYS_PROD' THEN COALESCE(NULLIF(split_part(i.nome, '::', 2), ''), i.nome)
    ELSE i.nome
  END AS nome,
  CASE
    WHEN i.unidade = 'SYS_MASSA' THEN 'g'
    WHEN i.unidade = 'SYS_PROD' THEN 'un'
    ELSE i.unidade
  END AS unidade_base,
  CASE
    WHEN i.unidade = 'SYS_MASSA' THEN 'massa_base'::public.stock_item_type
    WHEN i.unidade = 'SYS_PROD' THEN 'produto_final'::public.stock_item_type
    ELSE 'insumo'::public.stock_item_type
  END AS tipo,
  i.created_at,
  i.updated_at
FROM public.insumos i
ON CONFLICT (user_id, nome, tipo) DO NOTHING;

-- Backfill initial balances from legacy direct stock
INSERT INTO public.stock_movements (
  user_id,
  stock_item_id,
  direction,
  quantity,
  uom,
  reason,
  reference_type,
  idempotency_key,
  occurred_at,
  created_by
)
SELECT
  i.user_id,
  si.id,
  'in',
  GREATEST(i.quantidade_atual, 0),
  si.unidade_base,
  'saldo_inicial',
  'legacy_insumos',
  CONCAT('legacy-initial-balance:', i.id::text),
  now(),
  i.user_id
FROM public.insumos i
JOIN public.stock_items si
  ON si.user_id = i.user_id
 AND si.nome = CASE
    WHEN i.unidade = 'SYS_MASSA' THEN REPLACE(i.nome, '[MASSA] ', '')
    WHEN i.unidade = 'SYS_PROD' THEN COALESCE(NULLIF(split_part(i.nome, '::', 2), ''), i.nome)
    ELSE i.nome
  END
 AND si.tipo = CASE
    WHEN i.unidade = 'SYS_MASSA' THEN 'massa_base'::public.stock_item_type
    WHEN i.unidade = 'SYS_PROD' THEN 'produto_final'::public.stock_item_type
    ELSE 'insumo'::public.stock_item_type
  END
WHERE i.quantidade_atual > 0
ON CONFLICT (user_id, idempotency_key) DO NOTHING;

-- RLS
ALTER TABLE public.stock_items ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.recipes ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.recipe_versions ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.recipe_components ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.production_orders ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.production_consumptions ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.stock_movements ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can view own stock_items" ON public.stock_items FOR SELECT USING (auth.uid() = user_id);
CREATE POLICY "Users can insert own stock_items" ON public.stock_items FOR INSERT WITH CHECK (auth.uid() = user_id);
CREATE POLICY "Users can update own stock_items" ON public.stock_items FOR UPDATE USING (auth.uid() = user_id);
CREATE POLICY "Users can delete own stock_items" ON public.stock_items FOR DELETE USING (auth.uid() = user_id);

CREATE POLICY "Users can view own recipes" ON public.recipes FOR SELECT USING (auth.uid() = user_id);
CREATE POLICY "Users can insert own recipes" ON public.recipes FOR INSERT WITH CHECK (auth.uid() = user_id);
CREATE POLICY "Users can update own recipes" ON public.recipes FOR UPDATE USING (auth.uid() = user_id);
CREATE POLICY "Users can delete own recipes" ON public.recipes FOR DELETE USING (auth.uid() = user_id);

CREATE POLICY "Users can view own recipe_versions" ON public.recipe_versions FOR SELECT USING (auth.uid() = user_id);
CREATE POLICY "Users can insert own recipe_versions" ON public.recipe_versions FOR INSERT WITH CHECK (auth.uid() = user_id);
CREATE POLICY "Users can update own recipe_versions" ON public.recipe_versions FOR UPDATE USING (auth.uid() = user_id);
CREATE POLICY "Users can delete own recipe_versions" ON public.recipe_versions FOR DELETE USING (auth.uid() = user_id);

CREATE POLICY "Users can view own recipe_components" ON public.recipe_components FOR SELECT USING (auth.uid() = user_id);
CREATE POLICY "Users can insert own recipe_components" ON public.recipe_components FOR INSERT WITH CHECK (auth.uid() = user_id);
CREATE POLICY "Users can update own recipe_components" ON public.recipe_components FOR UPDATE USING (auth.uid() = user_id);
CREATE POLICY "Users can delete own recipe_components" ON public.recipe_components FOR DELETE USING (auth.uid() = user_id);

CREATE POLICY "Users can view own production_orders" ON public.production_orders FOR SELECT USING (auth.uid() = user_id);
CREATE POLICY "Users can insert own production_orders" ON public.production_orders FOR INSERT WITH CHECK (auth.uid() = user_id);
CREATE POLICY "Users can update own production_orders" ON public.production_orders FOR UPDATE USING (auth.uid() = user_id);
CREATE POLICY "Users can delete own production_orders" ON public.production_orders FOR DELETE USING (auth.uid() = user_id);

CREATE POLICY "Users can view own production_consumptions" ON public.production_consumptions FOR SELECT USING (auth.uid() = user_id);
CREATE POLICY "Users can insert own production_consumptions" ON public.production_consumptions FOR INSERT WITH CHECK (auth.uid() = user_id);
CREATE POLICY "Users can update own production_consumptions" ON public.production_consumptions FOR UPDATE USING (auth.uid() = user_id);
CREATE POLICY "Users can delete own production_consumptions" ON public.production_consumptions FOR DELETE USING (auth.uid() = user_id);

CREATE POLICY "Users can view own stock_movements" ON public.stock_movements FOR SELECT USING (auth.uid() = user_id);
CREATE POLICY "Users can insert own stock_movements" ON public.stock_movements FOR INSERT WITH CHECK (auth.uid() = user_id);
CREATE POLICY "Users can update own stock_movements" ON public.stock_movements FOR UPDATE USING (auth.uid() = user_id);
CREATE POLICY "Users can delete own stock_movements" ON public.stock_movements FOR DELETE USING (auth.uid() = user_id);

-- updated_at triggers
CREATE TRIGGER update_stock_items_updated_at
BEFORE UPDATE ON public.stock_items
FOR EACH ROW
EXECUTE FUNCTION public.update_updated_at_column();

CREATE TRIGGER update_recipes_updated_at
BEFORE UPDATE ON public.recipes
FOR EACH ROW
EXECUTE FUNCTION public.update_updated_at_column();

CREATE TRIGGER update_recipe_versions_updated_at
BEFORE UPDATE ON public.recipe_versions
FOR EACH ROW
EXECUTE FUNCTION public.update_updated_at_column();

CREATE TRIGGER update_recipe_components_updated_at
BEFORE UPDATE ON public.recipe_components
FOR EACH ROW
EXECUTE FUNCTION public.update_updated_at_column();

CREATE TRIGGER update_production_orders_updated_at
BEFORE UPDATE ON public.production_orders
FOR EACH ROW
EXECUTE FUNCTION public.update_updated_at_column();
