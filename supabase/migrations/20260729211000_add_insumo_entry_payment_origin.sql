ALTER TABLE public.insumo_purchase_entries
  ADD COLUMN IF NOT EXISTS origem_pagamento TEXT NOT NULL DEFAULT 'sem_valor';

ALTER TABLE public.insumo_purchase_entries
  DROP CONSTRAINT IF EXISTS insumo_purchase_entries_origem_pagamento_check;

ALTER TABLE public.insumo_purchase_entries
  ADD CONSTRAINT insumo_purchase_entries_origem_pagamento_check
  CHECK (origem_pagamento IN ('sem_valor', 'caixa', 'fora_caixa'));

CREATE OR REPLACE FUNCTION public.register_insumo_entry(
  p_insumo_id UUID,
  p_quantidade NUMERIC,
  p_valor_total NUMERIC DEFAULT 0,
  p_data_compra DATE DEFAULT NULL,
  p_fornecedor_id UUID DEFAULT NULL,
  p_quantidade_embalagens NUMERIC DEFAULT NULL,
  p_conteudo_por_embalagem NUMERIC DEFAULT NULL,
  p_gerar_saida_financeira BOOLEAN DEFAULT TRUE
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
  v_existing_entry public.insumo_purchase_entries%ROWTYPE;
  v_valor_total NUMERIC := COALESCE(p_valor_total, 0);
  v_gerar_saida_financeira BOOLEAN := COALESCE(p_gerar_saida_financeira, TRUE);
  v_origem_pagamento TEXT;
  v_ref TEXT;
  v_descricao TEXT;
  v_preco_unitario NUMERIC;
  v_transacao_data DATE := COALESCE(p_data_compra, CURRENT_DATE);
BEGIN
  IF v_user_id IS NULL THEN
    RAISE EXCEPTION 'Usuário não autenticado';
  END IF;

  IF p_quantidade IS NULL OR p_quantidade <= 0 THEN
    RAISE EXCEPTION 'Quantidade de entrada inválida';
  END IF;

  IF p_quantidade_embalagens IS NOT NULL AND p_quantidade_embalagens <= 0 THEN
    RAISE EXCEPTION 'Quantidade de embalagens inválida';
  END IF;

  IF p_conteudo_por_embalagem IS NOT NULL AND p_conteudo_por_embalagem <= 0 THEN
    RAISE EXCEPTION 'Conteúdo por embalagem inválido';
  END IF;

  IF v_valor_total < 0 THEN
    RAISE EXCEPTION 'Valor total inválido';
  END IF;

  v_origem_pagamento := CASE
    WHEN v_valor_total <= 0 THEN 'sem_valor'
    WHEN v_gerar_saida_financeira THEN 'caixa'
    ELSE 'fora_caixa'
  END;

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
         ultima_compra = CASE
           WHEN p_data_compra IS NOT NULL THEN p_data_compra
           ELSE ultima_compra
         END
   WHERE id = p_insumo_id
     AND user_id = v_user_id
  RETURNING * INTO v_updated;

  v_ref := 'insumo:' || p_insumo_id::TEXT || ':entrada:' || md5(now()::TEXT || ':' || p_quantidade::TEXT || ':' || v_valor_total::TEXT);
  v_descricao := 'Compra de insumo - ' || v_insumo.nome;
  IF p_fornecedor_id IS NOT NULL THEN
    v_descricao := v_descricao || ' (' || v_fornecedor.nome || ')';
  END IF;

  IF v_valor_total > 0 AND v_gerar_saida_financeira THEN
    INSERT INTO public.transacoes (user_id, tipo, categoria, descricao, valor, data, referencia, fornecedor_id)
    VALUES (
      v_user_id,
      'saida',
      'Insumos',
      v_descricao,
      v_valor_total,
      v_transacao_data,
      v_ref,
      p_fornecedor_id
    );
  END IF;

  IF p_data_compra IS NULL AND v_valor_total = 0 THEN
    SELECT * INTO v_existing_entry
    FROM public.insumo_purchase_entries
    WHERE user_id = v_user_id
      AND insumo_id = p_insumo_id
      AND fornecedor_id IS NOT DISTINCT FROM p_fornecedor_id
      AND data_compra IS NULL
      AND transacao_referencia IS NULL
      AND origem_pagamento = 'sem_valor'
    ORDER BY created_at ASC
    LIMIT 1
    FOR UPDATE;
  END IF;

  IF v_existing_entry.id IS NOT NULL THEN
    UPDATE public.insumo_purchase_entries
       SET quantidade = quantidade + p_quantidade,
           quantidade_embalagens = CASE
             WHEN p_quantidade_embalagens IS NULL THEN quantidade_embalagens
             WHEN quantidade_embalagens IS NULL THEN p_quantidade_embalagens
             WHEN conteudo_por_embalagem IS NOT DISTINCT FROM p_conteudo_por_embalagem THEN quantidade_embalagens + p_quantidade_embalagens
             ELSE NULL
           END,
           conteudo_por_embalagem = CASE
             WHEN p_conteudo_por_embalagem IS NULL THEN conteudo_por_embalagem
             WHEN conteudo_por_embalagem IS NULL THEN p_conteudo_por_embalagem
             WHEN conteudo_por_embalagem IS NOT DISTINCT FROM p_conteudo_por_embalagem THEN conteudo_por_embalagem
             ELSE NULL
           END
     WHERE id = v_existing_entry.id;
  ELSE
    INSERT INTO public.insumo_purchase_entries (
      user_id,
      insumo_id,
      fornecedor_id,
      quantidade,
      unidade,
      valor_total,
      preco_unitario,
      data_compra,
      transacao_referencia,
      origem_pagamento,
      quantidade_embalagens,
      conteudo_por_embalagem
    )
    VALUES (
      v_user_id,
      p_insumo_id,
      p_fornecedor_id,
      p_quantidade,
      v_insumo.unidade,
      v_valor_total,
      v_preco_unitario,
      p_data_compra,
      CASE WHEN v_valor_total > 0 AND v_gerar_saida_financeira THEN v_ref ELSE NULL END,
      v_origem_pagamento,
      p_quantidade_embalagens,
      p_conteudo_por_embalagem
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
      'data_compra', p_data_compra,
      'fornecedor_id', p_fornecedor_id,
      'fornecedor_nome', CASE WHEN p_fornecedor_id IS NOT NULL THEN v_fornecedor.nome ELSE NULL END,
      'quantidade_embalagens', p_quantidade_embalagens,
      'conteudo_por_embalagem', p_conteudo_por_embalagem,
      'origem_pagamento', v_origem_pagamento,
      'gera_saida_financeira', v_valor_total > 0 AND v_gerar_saida_financeira,
      'saldo_antigo_acumulado', p_data_compra IS NULL AND v_valor_total = 0 AND v_existing_entry.id IS NOT NULL,
      'preco_unitario_anterior', v_insumo.preco_unitario,
      'preco_unitario_atual', v_updated.preco_unitario,
      'referencia_financeira', CASE WHEN v_valor_total > 0 AND v_gerar_saida_financeira THEN v_ref ELSE NULL END
    )
  );

  RETURN v_updated;
END;
$$;

REVOKE ALL ON FUNCTION public.register_insumo_entry(UUID, NUMERIC, NUMERIC, DATE, UUID, NUMERIC, NUMERIC, BOOLEAN) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.register_insumo_entry(UUID, NUMERIC, NUMERIC, DATE, UUID, NUMERIC, NUMERIC, BOOLEAN) TO authenticated;
