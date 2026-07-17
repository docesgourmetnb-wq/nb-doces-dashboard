-- Compatibility migration for the inventory/recipe model.
--
-- The canonical schema is created in:
-- 20260507143000_inventory_ledger_and_recipes.sql
--
-- This migration used to recreate stock_items, recipes, recipe_versions and
-- recipe_components, which made a fresh database fail when migrations were
-- applied in order. Keep only idempotent indexes here.

CREATE INDEX IF NOT EXISTS idx_recipe_versions_recipe
  ON public.recipe_versions(recipe_id);

CREATE INDEX IF NOT EXISTS idx_recipe_components_version
  ON public.recipe_components(recipe_version_id);

CREATE INDEX IF NOT EXISTS idx_stock_items_user
  ON public.stock_items(user_id);
