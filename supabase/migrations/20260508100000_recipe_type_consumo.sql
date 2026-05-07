-- Generic recipe type: consumption of raw materials (insumos), no massa/produto split in UX
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1
    FROM pg_enum e
    JOIN pg_type t ON e.enumtypid = t.oid
    WHERE t.typname = 'recipe_type'
      AND e.enumlabel = 'consumo'
  ) THEN
    ALTER TYPE public.recipe_type ADD VALUE 'consumo';
  END IF;
END $$;
