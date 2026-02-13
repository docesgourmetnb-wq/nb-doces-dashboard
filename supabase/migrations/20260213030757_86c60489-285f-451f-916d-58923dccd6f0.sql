
-- Add soft-delete and updated_at columns to producao_diaria
ALTER TABLE public.producao_diaria
  ADD COLUMN IF NOT EXISTS deleted_at timestamptz NULL,
  ADD COLUMN IF NOT EXISTS deleted_reason text NULL,
  ADD COLUMN IF NOT EXISTS updated_at timestamptz NOT NULL DEFAULT now();

-- Create trigger for updated_at on producao_diaria
CREATE TRIGGER update_producao_diaria_updated_at
  BEFORE UPDATE ON public.producao_diaria
  FOR EACH ROW
  EXECUTE FUNCTION public.update_updated_at_column();
