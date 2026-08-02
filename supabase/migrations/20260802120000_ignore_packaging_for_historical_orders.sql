CREATE OR REPLACE FUNCTION public.create_pedido_with_items(
  p_cliente TEXT,
  p_cliente_id UUID,
  p_data DATE,
  p_tipo_pedido TEXT,
  p_valor_total NUMERIC,
  p_forma_pagamento TEXT,
  p_status TEXT,
  p_observacoes TEXT,
  p_itens JSONB DEFAULT '[]'::jsonb,
  p_data_entrega DATE DEFAULT NULL,
  p_tipo_entrega TEXT DEFAULT 'retirada',
  p_endereco_entrega TEXT DEFAULT NULL,
  p_canal_venda TEXT DEFAULT 'whatsapp',
  p_valor_pago NUMERIC DEFAULT 0,
  p_packaging_profile_id UUID DEFAULT NULL
)
RETURNS public.pedidos
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_user_id UUID := auth.uid();
  v_pedido public.pedidos%ROWTYPE;
  v_item JSONB;
  v_venda_ref TEXT;
  v_status_operacional TEXT;
  v_status_financeiro TEXT;
  v_brigadeiro_id UUID;
  v_produto_id UUID;
  v_produto_variacao_id UUID;
  v_brigadeiro_produto_id UUID;
  v_brigadeiro_variacao_id UUID;
  v_variacao_produto_id UUID;
  v_data_entrega DATE;
  v_is_historical_order BOOLEAN;
  v_effective_packaging_profile_id UUID;
  v_packaging_profile_nome TEXT;
BEGIN
  IF v_user_id IS NULL THEN
    RAISE EXCEPTION 'Usuário não autenticado';
  END IF;

  IF p_cliente IS NULL OR btrim(p_cliente) = '' THEN
    RAISE EXCEPTION 'Cliente é obrigatório';
  END IF;

  IF p_valor_total IS NULL OR p_valor_total < 0 THEN
    RAISE EXCEPTION 'Valor total inválido';
  END IF;

  IF COALESCE(p_valor_pago, 0) < 0 OR COALESCE(p_valor_pago, 0) > p_valor_total THEN
    RAISE EXCEPTION 'Valor pago inválido';
  END IF;

  IF p_tipo_entrega NOT IN ('retirada', 'entrega') THEN
    RAISE EXCEPTION 'Tipo de entrega inválido';
  END IF;

  IF p_tipo_entrega = 'entrega' AND NULLIF(btrim(COALESCE(p_endereco_entrega, '')), '') IS NULL THEN
    RAISE EXCEPTION 'Endereço de entrega é obrigatório';
  END IF;

  IF p_canal_venda NOT IN ('whatsapp', 'instagram') THEN
    RAISE EXCEPTION 'Canal de venda inválido';
  END IF;

  IF p_itens IS NULL OR jsonb_typeof(p_itens) <> 'array' THEN
    RAISE EXCEPTION 'Itens do pedido devem ser uma lista';
  END IF;

  IF p_cliente_id IS NOT NULL AND NOT EXISTS (
    SELECT 1
    FROM public.clientes c
    WHERE c.id = p_cliente_id
      AND c.user_id = v_user_id
  ) THEN
    RAISE EXCEPTION 'Cliente inválido para o usuário autenticado';
  END IF;

  v_data_entrega := COALESCE(p_data_entrega, p_data, CURRENT_DATE);
  v_is_historical_order := public.is_historical_order(v_data_entrega, p_data);
  v_effective_packaging_profile_id := CASE
    WHEN v_is_historical_order THEN NULL
    ELSE p_packaging_profile_id
  END;

  IF v_effective_packaging_profile_id IS NOT NULL THEN
    SELECT pp.nome
    INTO v_packaging_profile_nome
    FROM public.packaging_profiles pp
    WHERE pp.id = v_effective_packaging_profile_id
      AND pp.user_id = v_user_id
      AND pp.ativo = TRUE;

    IF v_packaging_profile_nome IS NULL THEN
      RAISE EXCEPTION 'Modelo de embalagem inválido para o usuário autenticado';
    END IF;
  END IF;

  FOR v_item IN SELECT value FROM jsonb_array_elements(p_itens)
  LOOP
    IF COALESCE((v_item->>'brigadeiro_nome'), '') = '' THEN
      RAISE EXCEPTION 'Nome do item é obrigatório';
    END IF;

    IF COALESCE((v_item->>'quantidade')::INTEGER, 0) <= 0 THEN
      RAISE EXCEPTION 'Quantidade do item inválida';
    END IF;

    IF COALESCE((v_item->>'preco_unitario')::NUMERIC, -1) < 0 THEN
      RAISE EXCEPTION 'Preço do item inválido';
    END IF;

    v_brigadeiro_id := NULLIF(v_item->>'brigadeiro_id', '')::UUID;
    v_produto_id := NULLIF(v_item->>'produto_id', '')::UUID;
    v_produto_variacao_id := NULLIF(v_item->>'produto_variacao_id', '')::UUID;
    v_brigadeiro_produto_id := NULL;
    v_brigadeiro_variacao_id := NULL;
    v_variacao_produto_id := NULL;

    IF v_brigadeiro_id IS NOT NULL THEN
      SELECT b.produto_id, b.produto_variacao_id
      INTO v_brigadeiro_produto_id, v_brigadeiro_variacao_id
      FROM public.brigadeiros b
      WHERE b.id = v_brigadeiro_id
        AND b.user_id = v_user_id;

      IF v_brigadeiro_produto_id IS NULL THEN
        RAISE EXCEPTION 'Brigadeiro inválido para o usuário autenticado';
      END IF;

      v_produto_id := COALESCE(v_produto_id, v_brigadeiro_produto_id);
      v_produto_variacao_id := COALESCE(v_produto_variacao_id, v_brigadeiro_variacao_id);
    END IF;

    IF v_produto_variacao_id IS NOT NULL THEN
      SELECT pv.produto_id
      INTO v_variacao_produto_id
      FROM public.produto_variacoes pv
      JOIN public.produtos p ON p.id = pv.produto_id
      WHERE pv.id = v_produto_variacao_id
        AND pv.user_id = v_user_id
        AND p.user_id = v_user_id
        AND pv.ativo = TRUE
        AND p.ativo = TRUE;

      IF v_variacao_produto_id IS NULL THEN
        RAISE EXCEPTION 'Variação de produto inválida para o usuário autenticado';
      END IF;

      IF v_produto_id IS NOT NULL AND v_produto_id <> v_variacao_produto_id THEN
        RAISE EXCEPTION 'Produto e variação não correspondem';
      END IF;

      v_produto_id := v_variacao_produto_id;
    END IF;
  END LOOP;

  v_status_financeiro := public.derive_pedido_financial_status(p_valor_total, COALESCE(p_valor_pago, 0));
  v_status_operacional := CASE
    WHEN p_status IN ('orcamento', 'confirmado', 'em-producao', 'pronto', 'entregue', 'cancelado') THEN p_status
    WHEN COALESCE(p_valor_pago, 0) > 0 THEN 'confirmado'
    ELSE 'orcamento'
  END;

  IF v_status_operacional = 'entregue' AND v_status_financeiro <> 'pago' THEN
    RAISE EXCEPTION 'Pedido com saldo pendente não pode ser entregue';
  END IF;

  INSERT INTO public.pedidos (
    user_id, cliente, cliente_id, data, data_entrega, tipo_pedido, tipo_entrega,
    endereco_entrega, canal_venda, valor_total, valor_pago, forma_pagamento,
    status, status_operacional, status_financeiro, observacoes,
    packaging_profile_id, packaging_profile_nome
  )
  VALUES (
    v_user_id, btrim(p_cliente), p_cliente_id, COALESCE(p_data, CURRENT_DATE),
    v_data_entrega, p_tipo_pedido, p_tipo_entrega,
    NULLIF(btrim(COALESCE(p_endereco_entrega, '')), ''), p_canal_venda, p_valor_total,
    COALESCE(p_valor_pago, 0), p_forma_pagamento, v_status_operacional,
    v_status_operacional, v_status_financeiro, NULLIF(btrim(COALESCE(p_observacoes, '')), ''),
    v_effective_packaging_profile_id, v_packaging_profile_nome
  )
  RETURNING * INTO v_pedido;

  FOR v_item IN SELECT value FROM jsonb_array_elements(p_itens)
  LOOP
    v_brigadeiro_id := NULLIF(v_item->>'brigadeiro_id', '')::UUID;
    v_produto_id := NULLIF(v_item->>'produto_id', '')::UUID;
    v_produto_variacao_id := NULLIF(v_item->>'produto_variacao_id', '')::UUID;
    v_brigadeiro_produto_id := NULL;
    v_brigadeiro_variacao_id := NULL;
    v_variacao_produto_id := NULL;

    IF v_brigadeiro_id IS NOT NULL THEN
      SELECT b.produto_id, b.produto_variacao_id
      INTO v_brigadeiro_produto_id, v_brigadeiro_variacao_id
      FROM public.brigadeiros b
      WHERE b.id = v_brigadeiro_id
        AND b.user_id = v_user_id;

      v_produto_id := COALESCE(v_produto_id, v_brigadeiro_produto_id);
      v_produto_variacao_id := COALESCE(v_produto_variacao_id, v_brigadeiro_variacao_id);
    END IF;

    IF v_produto_variacao_id IS NOT NULL THEN
      SELECT pv.produto_id
      INTO v_variacao_produto_id
      FROM public.produto_variacoes pv
      WHERE pv.id = v_produto_variacao_id
        AND pv.user_id = v_user_id;

      v_produto_id := COALESCE(v_produto_id, v_variacao_produto_id);
    END IF;

    INSERT INTO public.itens_pedido (
      pedido_id,
      brigadeiro_id,
      brigadeiro_nome,
      quantidade,
      preco_unitario,
      produto_id,
      produto_variacao_id
    )
    VALUES (
      v_pedido.id,
      v_brigadeiro_id,
      v_item->>'brigadeiro_nome',
      (v_item->>'quantidade')::INTEGER,
      (v_item->>'preco_unitario')::NUMERIC,
      v_produto_id,
      v_produto_variacao_id
    );
  END LOOP;

  IF v_pedido.valor_pago > 0 THEN
    v_venda_ref := 'pedido:' || v_pedido.id::TEXT || ':pagamento:entrada';

    IF public.is_official_financial_date(v_pedido.data_entrega) THEN
      INSERT INTO public.transacoes (user_id, tipo, categoria, descricao, valor, data, referencia)
      VALUES (v_user_id, 'entrada', 'Vendas', 'Pagamento - Pedido ' || v_pedido.cliente,
              v_pedido.valor_pago, v_pedido.data, v_venda_ref);
    END IF;

    INSERT INTO public.audit_log (user_id, entity_type, entity_id, action, metadata)
    VALUES (
      v_user_id,
      'pedido',
      v_pedido.id,
      CASE WHEN public.is_official_financial_date(v_pedido.data_entrega) THEN 'payment_created' ELSE 'historical_payment_recorded' END,
      jsonb_build_object('valor', v_pedido.valor_pago, 'referencia', v_venda_ref, 'financeiro_oficial', public.is_official_financial_date(v_pedido.data_entrega))
    );
  END IF;

  RETURN v_pedido;
END;
$$;

REVOKE ALL ON FUNCTION public.create_pedido_with_items(TEXT, UUID, DATE, TEXT, NUMERIC, TEXT, TEXT, TEXT, JSONB, DATE, TEXT, TEXT, TEXT, NUMERIC, UUID) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.create_pedido_with_items(TEXT, UUID, DATE, TEXT, NUMERIC, TEXT, TEXT, TEXT, JSONB, DATE, TEXT, TEXT, TEXT, NUMERIC, UUID) TO authenticated;
