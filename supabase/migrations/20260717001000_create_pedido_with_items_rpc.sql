-- Create pedidos, items, revenue transaction and audit log atomically.

CREATE OR REPLACE FUNCTION public.create_pedido_with_items(
  p_cliente TEXT,
  p_cliente_id UUID,
  p_data DATE,
  p_tipo_pedido TEXT,
  p_valor_total NUMERIC,
  p_forma_pagamento TEXT,
  p_status TEXT,
  p_observacoes TEXT,
  p_itens JSONB DEFAULT '[]'::jsonb
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
  END LOOP;

  INSERT INTO public.pedidos (
    user_id,
    cliente,
    cliente_id,
    data,
    tipo_pedido,
    valor_total,
    forma_pagamento,
    status,
    observacoes
  )
  VALUES (
    v_user_id,
    btrim(p_cliente),
    p_cliente_id,
    COALESCE(p_data, CURRENT_DATE),
    p_tipo_pedido,
    p_valor_total,
    p_forma_pagamento,
    p_status,
    NULLIF(btrim(COALESCE(p_observacoes, '')), '')
  )
  RETURNING * INTO v_pedido;

  INSERT INTO public.itens_pedido (
    pedido_id,
    brigadeiro_id,
    brigadeiro_nome,
    quantidade,
    preco_unitario
  )
  SELECT
    v_pedido.id,
    NULLIF(item->>'brigadeiro_id', '')::UUID,
    item->>'brigadeiro_nome',
    (item->>'quantidade')::INTEGER,
    (item->>'preco_unitario')::NUMERIC
  FROM jsonb_array_elements(p_itens) AS item;

  IF p_status IN ('pronto', 'entregue') AND p_valor_total > 0 THEN
    v_venda_ref := 'pedido:' || v_pedido.id::TEXT || ':venda:1';

    INSERT INTO public.transacoes (
      user_id,
      tipo,
      categoria,
      descricao,
      valor,
      data,
      referencia
    )
    VALUES (
      v_user_id,
      'entrada',
      'Vendas',
      'Venda - Pedido ' || v_pedido.cliente,
      p_valor_total,
      v_pedido.data,
      v_venda_ref
    );

    INSERT INTO public.audit_log (
      user_id,
      entity_type,
      entity_id,
      action,
      metadata
    )
    VALUES (
      v_user_id,
      'pedido',
      v_pedido.id,
      'venda_created',
      jsonb_build_object('valor', p_valor_total, 'referencia', v_venda_ref)
    );
  END IF;

  RETURN v_pedido;
END;
$$;

REVOKE ALL ON FUNCTION public.create_pedido_with_items(
  TEXT,
  UUID,
  DATE,
  TEXT,
  NUMERIC,
  TEXT,
  TEXT,
  TEXT,
  JSONB
) FROM PUBLIC;

GRANT EXECUTE ON FUNCTION public.create_pedido_with_items(
  TEXT,
  UUID,
  DATE,
  TEXT,
  NUMERIC,
  TEXT,
  TEXT,
  TEXT,
  JSONB
) TO authenticated;
