CREATE TABLE IF NOT EXISTS public.fornecedor_purchase_entries (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  fornecedor_id UUID NOT NULL,
  descricao TEXT NOT NULL,
  categoria TEXT NOT NULL DEFAULT 'Outros',
  valor_total NUMERIC NOT NULL DEFAULT 0,
  data_compra DATE,
  origem_pagamento TEXT NOT NULL DEFAULT 'fora_caixa',
  transacao_referencia TEXT,
  observacoes TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  CONSTRAINT fornecedor_purchase_entries_descricao_length CHECK (length(btrim(descricao)) > 0 AND length(descricao) <= 200),
  CONSTRAINT fornecedor_purchase_entries_valor_total_non_negative CHECK (valor_total >= 0),
  CONSTRAINT fornecedor_purchase_entries_origem_pagamento_check CHECK (origem_pagamento IN ('caixa', 'fora_caixa'))
);

CREATE UNIQUE INDEX IF NOT EXISTS fornecedores_user_id_id_unique
  ON public.fornecedores (user_id, id);

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1
    FROM pg_constraint
    WHERE conname = 'fornecedor_purchase_entries_fornecedor_owner_fkey'
  ) THEN
    ALTER TABLE public.fornecedor_purchase_entries
      ADD CONSTRAINT fornecedor_purchase_entries_fornecedor_owner_fkey
      FOREIGN KEY (user_id, fornecedor_id)
      REFERENCES public.fornecedores(user_id, id)
      ON DELETE CASCADE;
  END IF;
END $$;

CREATE INDEX IF NOT EXISTS fornecedor_purchase_entries_user_data_idx
  ON public.fornecedor_purchase_entries (user_id, data_compra DESC NULLS LAST, created_at DESC);

CREATE INDEX IF NOT EXISTS fornecedor_purchase_entries_user_fornecedor_idx
  ON public.fornecedor_purchase_entries (user_id, fornecedor_id);

ALTER TABLE public.fornecedor_purchase_entries ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Users can view own fornecedor purchase entries" ON public.fornecedor_purchase_entries;
CREATE POLICY "Users can view own fornecedor purchase entries"
  ON public.fornecedor_purchase_entries
  FOR SELECT
  USING (auth.uid() = user_id);

DROP POLICY IF EXISTS "Users can create own fornecedor purchase entries" ON public.fornecedor_purchase_entries;
CREATE POLICY "Users can create own fornecedor purchase entries"
  ON public.fornecedor_purchase_entries
  FOR INSERT
  WITH CHECK (auth.uid() = user_id);

DROP POLICY IF EXISTS "Users can update own fornecedor purchase entries" ON public.fornecedor_purchase_entries;
CREATE POLICY "Users can update own fornecedor purchase entries"
  ON public.fornecedor_purchase_entries
  FOR UPDATE
  USING (auth.uid() = user_id)
  WITH CHECK (auth.uid() = user_id);

DROP POLICY IF EXISTS "Users can delete own fornecedor purchase entries" ON public.fornecedor_purchase_entries;
CREATE POLICY "Users can delete own fornecedor purchase entries"
  ON public.fornecedor_purchase_entries
  FOR DELETE
  USING (auth.uid() = user_id);
