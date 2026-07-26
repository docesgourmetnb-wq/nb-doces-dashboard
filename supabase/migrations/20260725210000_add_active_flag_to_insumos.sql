ALTER TABLE public.insumos
ADD COLUMN IF NOT EXISTS ativo BOOLEAN NOT NULL DEFAULT true;

UPDATE public.insumos
SET ativo = true
WHERE ativo IS DISTINCT FROM true;
