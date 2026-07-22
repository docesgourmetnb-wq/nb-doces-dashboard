ALTER TABLE public.transacoes
  ADD COLUMN IF NOT EXISTS fornecedor_id UUID;

CREATE UNIQUE INDEX IF NOT EXISTS fornecedores_user_id_id_unique
  ON public.fornecedores (user_id, id);

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1
    FROM pg_constraint
    WHERE conname = 'transacoes_fornecedor_owner_fkey'
  ) THEN
    ALTER TABLE public.transacoes
      ADD CONSTRAINT transacoes_fornecedor_owner_fkey
      FOREIGN KEY (user_id, fornecedor_id)
      REFERENCES public.fornecedores(user_id, id)
      ON DELETE SET NULL;
  END IF;
END $$;

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

  UPDATE public.insumos
     SET quantidade_atual = quantidade_atual + p_quantidade,
         preco_unitario = CASE
           WHEN v_valor_total > 0 THEN v_valor_total / p_quantidade
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
