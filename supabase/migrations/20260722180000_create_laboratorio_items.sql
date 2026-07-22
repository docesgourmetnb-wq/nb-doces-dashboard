CREATE TABLE IF NOT EXISTS public.laboratorio_items (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  tipo TEXT NOT NULL DEFAULT 'ideia',
  titulo TEXT NOT NULL,
  descricao TEXT,
  status TEXT NOT NULL DEFAULT 'ideia',
  prioridade TEXT NOT NULL DEFAULT 'media',
  cliente TEXT,
  produto_relacionado TEXT,
  canal TEXT,
  data_registro DATE NOT NULL DEFAULT CURRENT_DATE,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  CONSTRAINT laboratorio_items_titulo_length CHECK (length(btrim(titulo)) > 0 AND length(titulo) <= 200),
  CONSTRAINT laboratorio_items_tipo_check CHECK (tipo IN ('ideia', 'teste', 'feedback')),
  CONSTRAINT laboratorio_items_status_check CHECK (status IN ('ideia', 'em_teste', 'aprovado', 'descartado', 'acao_gerada')),
  CONSTRAINT laboratorio_items_prioridade_check CHECK (prioridade IN ('baixa', 'media', 'alta')),
  CONSTRAINT laboratorio_items_canal_check CHECK (canal IS NULL OR canal IN ('whatsapp', 'instagram', 'presencial', 'outro'))
);

ALTER TABLE public.laboratorio_items ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Users can view own laboratorio items" ON public.laboratorio_items;
CREATE POLICY "Users can view own laboratorio items"
  ON public.laboratorio_items
  FOR SELECT
  USING (auth.uid() = user_id);

DROP POLICY IF EXISTS "Users can insert own laboratorio items" ON public.laboratorio_items;
CREATE POLICY "Users can insert own laboratorio items"
  ON public.laboratorio_items
  FOR INSERT
  WITH CHECK (auth.uid() = user_id);

DROP POLICY IF EXISTS "Users can update own laboratorio items" ON public.laboratorio_items;
CREATE POLICY "Users can update own laboratorio items"
  ON public.laboratorio_items
  FOR UPDATE
  USING (auth.uid() = user_id)
  WITH CHECK (auth.uid() = user_id);

DROP POLICY IF EXISTS "Users can delete own laboratorio items" ON public.laboratorio_items;
CREATE POLICY "Users can delete own laboratorio items"
  ON public.laboratorio_items
  FOR DELETE
  USING (auth.uid() = user_id);

DROP TRIGGER IF EXISTS update_laboratorio_items_updated_at ON public.laboratorio_items;
CREATE TRIGGER update_laboratorio_items_updated_at
  BEFORE UPDATE ON public.laboratorio_items
  FOR EACH ROW
  EXECUTE FUNCTION public.update_updated_at_column();
