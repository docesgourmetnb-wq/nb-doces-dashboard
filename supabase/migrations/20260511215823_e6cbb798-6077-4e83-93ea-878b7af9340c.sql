-- Soft delete em recipes
ALTER TABLE public.recipes
  ADD COLUMN IF NOT EXISTS deleted_at timestamptz NULL;

-- Novos campos em recipe_versions
ALTER TABLE public.recipe_versions
  ADD COLUMN IF NOT EXISTS peso_total_massa_g numeric NULL,
  ADD COLUMN IF NOT EXISTS peso_unitario_base_g numeric NOT NULL DEFAULT 20;

-- Backfill: usar yield_qty como peso_total_massa_g se ainda não preenchido
UPDATE public.recipe_versions
   SET peso_total_massa_g = yield_qty
 WHERE peso_total_massa_g IS NULL;

-- Restringir unidades de medida em recipe_components
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint WHERE conname = 'recipe_components_uom_check'
  ) THEN
    ALTER TABLE public.recipe_components
      ADD CONSTRAINT recipe_components_uom_check
      CHECK (uom IN ('g','kg','ml','l','un'));
  END IF;
END$$;

-- Index para filtragem rápida de receitas ativas
CREATE INDEX IF NOT EXISTS idx_recipes_user_deleted
  ON public.recipes (user_id) WHERE deleted_at IS NULL;