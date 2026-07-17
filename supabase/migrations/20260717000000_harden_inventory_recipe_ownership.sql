-- Harden inventory/recipe ownership for databases that already applied the
-- earlier migrations. Fresh databases get the same rules from the canonical
-- inventory migration.

DO $$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'stock_items_user_id_id_key') THEN
    ALTER TABLE public.stock_items
      ADD CONSTRAINT stock_items_user_id_id_key UNIQUE (user_id, id);
  END IF;

  IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'recipes_user_id_id_key') THEN
    ALTER TABLE public.recipes
      ADD CONSTRAINT recipes_user_id_id_key UNIQUE (user_id, id);
  END IF;

  IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'recipe_versions_user_id_id_key') THEN
    ALTER TABLE public.recipe_versions
      ADD CONSTRAINT recipe_versions_user_id_id_key UNIQUE (user_id, id);
  END IF;

  IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'recipe_components_user_id_id_key') THEN
    ALTER TABLE public.recipe_components
      ADD CONSTRAINT recipe_components_user_id_id_key UNIQUE (user_id, id);
  END IF;

  IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'production_orders_user_id_id_key') THEN
    ALTER TABLE public.production_orders
      ADD CONSTRAINT production_orders_user_id_id_key UNIQUE (user_id, id);
  END IF;

  IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'production_consumptions_user_id_id_key') THEN
    ALTER TABLE public.production_consumptions
      ADD CONSTRAINT production_consumptions_user_id_id_key UNIQUE (user_id, id);
  END IF;

  IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'stock_movements_user_id_id_key') THEN
    ALTER TABLE public.stock_movements
      ADD CONSTRAINT stock_movements_user_id_id_key UNIQUE (user_id, id);
  END IF;
END $$;

DO $$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'recipe_versions_recipe_owner_fkey') THEN
    ALTER TABLE public.recipe_versions
      ADD CONSTRAINT recipe_versions_recipe_owner_fkey
      FOREIGN KEY (user_id, recipe_id)
      REFERENCES public.recipes(user_id, id)
      ON DELETE CASCADE
      NOT VALID;
  END IF;

  IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'recipe_components_version_owner_fkey') THEN
    ALTER TABLE public.recipe_components
      ADD CONSTRAINT recipe_components_version_owner_fkey
      FOREIGN KEY (user_id, recipe_version_id)
      REFERENCES public.recipe_versions(user_id, id)
      ON DELETE CASCADE
      NOT VALID;
  END IF;

  IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'recipe_components_stock_item_owner_fkey') THEN
    ALTER TABLE public.recipe_components
      ADD CONSTRAINT recipe_components_stock_item_owner_fkey
      FOREIGN KEY (user_id, stock_item_id)
      REFERENCES public.stock_items(user_id, id)
      ON DELETE RESTRICT
      NOT VALID;
  END IF;

  IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'production_orders_recipe_version_owner_fkey') THEN
    ALTER TABLE public.production_orders
      ADD CONSTRAINT production_orders_recipe_version_owner_fkey
      FOREIGN KEY (user_id, recipe_version_id)
      REFERENCES public.recipe_versions(user_id, id)
      ON DELETE RESTRICT
      NOT VALID;
  END IF;

  IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'production_orders_output_item_owner_fkey') THEN
    ALTER TABLE public.production_orders
      ADD CONSTRAINT production_orders_output_item_owner_fkey
      FOREIGN KEY (user_id, output_item_id)
      REFERENCES public.stock_items(user_id, id)
      ON DELETE RESTRICT
      NOT VALID;
  END IF;

  IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'production_consumptions_order_owner_fkey') THEN
    ALTER TABLE public.production_consumptions
      ADD CONSTRAINT production_consumptions_order_owner_fkey
      FOREIGN KEY (user_id, production_order_id)
      REFERENCES public.production_orders(user_id, id)
      ON DELETE CASCADE
      NOT VALID;
  END IF;

  IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'production_consumptions_stock_item_owner_fkey') THEN
    ALTER TABLE public.production_consumptions
      ADD CONSTRAINT production_consumptions_stock_item_owner_fkey
      FOREIGN KEY (user_id, stock_item_id)
      REFERENCES public.stock_items(user_id, id)
      ON DELETE RESTRICT
      NOT VALID;
  END IF;

  IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'stock_movements_stock_item_owner_fkey') THEN
    ALTER TABLE public.stock_movements
      ADD CONSTRAINT stock_movements_stock_item_owner_fkey
      FOREIGN KEY (user_id, stock_item_id)
      REFERENCES public.stock_items(user_id, id)
      ON DELETE RESTRICT
      NOT VALID;
  END IF;
END $$;

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
LEFT JOIN public.stock_movements sm
  ON sm.user_id = si.user_id
 AND sm.stock_item_id = si.id
GROUP BY si.id, si.user_id, si.nome, si.unidade_base, si.tipo;

CREATE OR REPLACE FUNCTION public.get_stock_balance(p_user_id UUID, p_stock_item_id UUID)
RETURNS NUMERIC
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT COALESCE(SUM(
    CASE sm.direction
      WHEN 'in' THEN sm.quantity
      WHEN 'out' THEN -sm.quantity
      ELSE 0
    END
  ), 0)
  FROM public.stock_items si
  LEFT JOIN public.stock_movements sm
    ON sm.user_id = si.user_id
   AND sm.stock_item_id = si.id
  WHERE si.user_id = auth.uid()
    AND si.id = p_stock_item_id
    AND p_user_id = auth.uid();
$$;
