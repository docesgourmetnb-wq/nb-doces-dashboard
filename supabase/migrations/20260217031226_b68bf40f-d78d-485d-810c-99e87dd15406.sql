
-- Add archived_at if not exists
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_schema = 'public' AND table_name = 'pedidos' AND column_name = 'archived_at'
  ) THEN
    ALTER TABLE public.pedidos ADD COLUMN archived_at timestamptz NULL;
  END IF;
END $$;

-- Add archived_reason if not exists
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_schema = 'public' AND table_name = 'pedidos' AND column_name = 'archived_reason'
  ) THEN
    ALTER TABLE public.pedidos ADD COLUMN archived_reason text NULL;
  END IF;
END $$;

-- Add updated_at if not exists
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_schema = 'public' AND table_name = 'pedidos' AND column_name = 'updated_at'
  ) THEN
    ALTER TABLE public.pedidos ADD COLUMN updated_at timestamptz NOT NULL DEFAULT now();
  END IF;
END $$;

-- Index on archived_at
CREATE INDEX IF NOT EXISTS idx_pedidos_archived_at ON public.pedidos (archived_at);

-- Trigger for updated_at
DROP TRIGGER IF EXISTS update_pedidos_updated_at ON public.pedidos;
CREATE TRIGGER update_pedidos_updated_at
  BEFORE UPDATE ON public.pedidos
  FOR EACH ROW
  EXECUTE FUNCTION public.update_updated_at_column();
