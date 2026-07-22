CREATE UNIQUE INDEX IF NOT EXISTS insumos_user_id_id_unique
  ON public.insumos (user_id, id);

CREATE UNIQUE INDEX IF NOT EXISTS fornecedores_user_id_id_unique
  ON public.fornecedores (user_id, id);

CREATE TABLE IF NOT EXISTS public.insumo_purchase_entries (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  insumo_id UUID NOT NULL,
  fornecedor_id UUID,
  quantidade NUMERIC NOT NULL,
  unidade TEXT NOT NULL,
  valor_total NUMERIC NOT NULL DEFAULT 0,
  preco_unitario NUMERIC NOT NULL DEFAULT 0,
  data_compra DATE NOT NULL DEFAULT CURRENT_DATE,
  transacao_referencia TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  CONSTRAINT insumo_purchase_entries_quantidade_positive CHECK (quantidade > 0),
  CONSTRAINT insumo_purchase_entries_valor_total_non_negative CHECK (valor_total >= 0),
  CONSTRAINT insumo_purchase_entries_preco_unitario_non_negative CHECK (preco_unitario >= 0)
);

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1
    FROM pg_constraint
    WHERE conname = 'insumo_purchase_entries_insumo_owner_fkey'
  ) THEN
    ALTER TABLE public.insumo_purchase_entries
      ADD CONSTRAINT insumo_purchase_entries_insumo_owner_fkey
      FOREIGN KEY (user_id, insumo_id)
      REFERENCES public.insumos(user_id, id)
      ON DELETE CASCADE;
  END IF;

  IF NOT EXISTS (
    SELECT 1
    FROM pg_constraint
    WHERE conname = 'insumo_purchase_entries_fornecedor_owner_fkey'
  ) THEN
    ALTER TABLE public.insumo_purchase_entries
      ADD CONSTRAINT insumo_purchase_entries_fornecedor_owner_fkey
      FOREIGN KEY (user_id, fornecedor_id)
      REFERENCES public.fornecedores(user_id, id)
      ON DELETE SET NULL (fornecedor_id);
  END IF;
END $$;

CREATE INDEX IF NOT EXISTS insumo_purchase_entries_user_data_idx
  ON public.insumo_purchase_entries (user_id, data_compra DESC, created_at DESC);

CREATE INDEX IF NOT EXISTS insumo_purchase_entries_user_insumo_idx
  ON public.insumo_purchase_entries (user_id, insumo_id);

CREATE INDEX IF NOT EXISTS insumo_purchase_entries_user_fornecedor_idx
  ON public.insumo_purchase_entries (user_id, fornecedor_id)
  WHERE fornecedor_id IS NOT NULL;

ALTER TABLE public.insumo_purchase_entries ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Users can view their own insumo purchase entries" ON public.insumo_purchase_entries;
CREATE POLICY "Users can view their own insumo purchase entries"
  ON public.insumo_purchase_entries
  FOR SELECT
  TO authenticated
  USING (auth.uid() = user_id);

DROP POLICY IF EXISTS "Users can create their own insumo purchase entries" ON public.insumo_purchase_entries;
CREATE POLICY "Users can create their own insumo purchase entries"
  ON public.insumo_purchase_entries
  FOR INSERT
  TO authenticated
  WITH CHECK (auth.uid() = user_id);

DROP POLICY IF EXISTS "Users can update their own insumo purchase entries" ON public.insumo_purchase_entries;
CREATE POLICY "Users can update their own insumo purchase entries"
  ON public.insumo_purchase_entries
  FOR UPDATE
  TO authenticated
  USING (auth.uid() = user_id)
  WITH CHECK (auth.uid() = user_id);

DROP POLICY IF EXISTS "Users can delete their own insumo purchase entries" ON public.insumo_purchase_entries;
CREATE POLICY "Users can delete their own insumo purchase entries"
  ON public.insumo_purchase_entries
  FOR DELETE
  TO authenticated
  USING (auth.uid() = user_id);

CREATE OR REPLACE FUNCTION public.register_insumo_entry(
  p_insumo_id UUID,
  p_quantidade NUMERIC,
  p_valor_total NUMERIC DEFAULT 0,
  p_data_compra DATE DEFAULT CURRENT_DATE,
  p_fornecedor_id UUID DEFAULT NULL
)
RETURNS public.insumos
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_user_id UUID := auth.uid();
  v_insumo public.insumos%ROWTYPE;
  v_updated public.insumos%ROWTYPE;
  v_fornecedor public.fornecedores%ROWTYPE;
  v_valor_total NUMERIC := COALESCE(p_valor_total, 0);
  v_data_compra DATE := COALESCE(p_data_compra, CURRENT_DATE);
  v_ref TEXT;
  v_descricao TEXT;
  v_preco_unitario NUMERIC;
BEGIN
  IF v_user_id IS NULL THEN
    RAISE EXCEPTION 'Usuário não autenticado';
  END IF;

  IF p_quantidade IS NULL OR p_quantidade <= 0 THEN
    RAISE EXCEPTION 'Quantidade de entrada inválida';
  END IF;

  IF v_valor_total < 0 THEN
    RAISE EXCEPTION 'Valor total inválido';
  END IF;

  SELECT * INTO v_insumo
  FROM public.insumos
  WHERE id = p_insumo_id
    AND user_id = v_user_id
  FOR UPDATE;

  IF NOT FOUND THEN
    RAISE EXCEPTION 'Insumo não encontrado';
  END IF;

  IF p_fornecedor_id IS NOT NULL THEN
    SELECT * INTO v_fornecedor
    FROM public.fornecedores
    WHERE id = p_fornecedor_id
      AND user_id = v_user_id;

    IF NOT FOUND THEN
      RAISE EXCEPTION 'Fornecedor não encontrado';
    END IF;
  END IF;

  v_preco_unitario := CASE
    WHEN v_valor_total > 0 THEN v_valor_total / p_quantidade
    ELSE 0
  END;

  UPDATE public.insumos
     SET quantidade_atual = quantidade_atual + p_quantidade,
         preco_unitario = CASE
           WHEN v_valor_total > 0 THEN v_preco_unitario
           ELSE preco_unitario
         END,
         ultima_compra = v_data_compra
   WHERE id = p_insumo_id
     AND user_id = v_user_id
  RETURNING * INTO v_updated;

  v_ref := 'insumo:' || p_insumo_id::TEXT || ':entrada:' || md5(now()::TEXT || ':' || p_quantidade::TEXT || ':' || v_valor_total::TEXT);
  v_descricao := 'Compra de insumo - ' || v_insumo.nome;
  IF p_fornecedor_id IS NOT NULL THEN
    v_descricao := v_descricao || ' (' || v_fornecedor.nome || ')';
  END IF;

  IF v_valor_total > 0 THEN
    INSERT INTO public.transacoes (user_id, tipo, categoria, descricao, valor, data, referencia, fornecedor_id)
    VALUES (
      v_user_id,
      'saida',
      'Insumos',
      v_descricao,
      v_valor_total,
      v_data_compra,
      v_ref,
      p_fornecedor_id
    );
  END IF;

  INSERT INTO public.insumo_purchase_entries (
    user_id,
    insumo_id,
    fornecedor_id,
    quantidade,
    unidade,
    valor_total,
    preco_unitario,
    data_compra,
    transacao_referencia
  )
  VALUES (
    v_user_id,
    p_insumo_id,
    p_fornecedor_id,
    p_quantidade,
    v_insumo.unidade,
    v_valor_total,
    v_preco_unitario,
    v_data_compra,
    CASE WHEN v_valor_total > 0 THEN v_ref ELSE NULL END
  );

  INSERT INTO public.audit_log (user_id, entity_type, entity_id, action, metadata)
  VALUES (
    v_user_id,
    'insumo',
    p_insumo_id,
    'stock_entry_registered',
    jsonb_build_object(
      'quantidade', p_quantidade,
      'unidade', v_insumo.unidade,
      'valor_total', v_valor_total,
      'data_compra', v_data_compra,
      'fornecedor_id', p_fornecedor_id,
      'fornecedor_nome', CASE WHEN p_fornecedor_id IS NOT NULL THEN v_fornecedor.nome ELSE NULL END,
      'preco_unitario_anterior', v_insumo.preco_unitario,
      'preco_unitario_atual', v_updated.preco_unitario,
      'referencia_financeira', CASE WHEN v_valor_total > 0 THEN v_ref ELSE NULL END
    )
  );

  RETURN v_updated;
END;
$$;

REVOKE ALL ON FUNCTION public.register_insumo_entry(UUID, NUMERIC, NUMERIC, DATE, UUID) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.register_insumo_entry(UUID, NUMERIC, NUMERIC, DATE, UUID) TO authenticated;
