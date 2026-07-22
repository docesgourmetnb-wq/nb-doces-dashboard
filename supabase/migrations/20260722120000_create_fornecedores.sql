CREATE TABLE IF NOT EXISTS public.fornecedores (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  nome TEXT NOT NULL,
  documento TEXT,
  telefone TEXT,
  email TEXT,
  observacoes TEXT,
  ativo BOOLEAN NOT NULL DEFAULT true,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  CONSTRAINT fornecedores_nome_length CHECK (length(btrim(nome)) > 0 AND length(nome) <= 200)
);

CREATE UNIQUE INDEX IF NOT EXISTS fornecedores_user_nome_unique
  ON public.fornecedores (user_id, lower(btrim(nome)));

ALTER TABLE public.fornecedores ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Users can view own fornecedores" ON public.fornecedores;
CREATE POLICY "Users can view own fornecedores"
  ON public.fornecedores
  FOR SELECT
  USING (auth.uid() = user_id);

DROP POLICY IF EXISTS "Users can insert own fornecedores" ON public.fornecedores;
CREATE POLICY "Users can insert own fornecedores"
  ON public.fornecedores
  FOR INSERT
  WITH CHECK (auth.uid() = user_id);

DROP POLICY IF EXISTS "Users can update own fornecedores" ON public.fornecedores;
CREATE POLICY "Users can update own fornecedores"
  ON public.fornecedores
  FOR UPDATE
  USING (auth.uid() = user_id)
  WITH CHECK (auth.uid() = user_id);

DROP POLICY IF EXISTS "Users can delete own fornecedores" ON public.fornecedores;
CREATE POLICY "Users can delete own fornecedores"
  ON public.fornecedores
  FOR DELETE
  USING (auth.uid() = user_id);

DROP TRIGGER IF EXISTS update_fornecedores_updated_at ON public.fornecedores;
CREATE TRIGGER update_fornecedores_updated_at
  BEFORE UPDATE ON public.fornecedores
  FOR EACH ROW
  EXECUTE FUNCTION public.update_updated_at_column();
