ALTER TABLE public.insumos
  ADD COLUMN IF NOT EXISTS tipo_estoque TEXT NOT NULL DEFAULT 'producao';

ALTER TABLE public.insumos
  DROP CONSTRAINT IF EXISTS insumos_tipo_estoque_check;

ALTER TABLE public.insumos
  ADD CONSTRAINT insumos_tipo_estoque_check
  CHECK (tipo_estoque IN ('producao', 'embalagem'));

UPDATE public.insumos
   SET tipo_estoque = 'producao'
 WHERE tipo_estoque IS NULL;

CREATE INDEX IF NOT EXISTS idx_insumos_user_tipo_estoque
  ON public.insumos (user_id, tipo_estoque, ativo);
