-- Add commercial order fields for delivery, partial payment and operational/financial status.

ALTER TABLE public.pedidos
  ADD COLUMN IF NOT EXISTS data_entrega DATE,
  ADD COLUMN IF NOT EXISTS tipo_entrega TEXT NOT NULL DEFAULT 'retirada',
  ADD COLUMN IF NOT EXISTS endereco_entrega TEXT,
  ADD COLUMN IF NOT EXISTS canal_venda TEXT NOT NULL DEFAULT 'whatsapp',
  ADD COLUMN IF NOT EXISTS valor_pago NUMERIC(10,2) NOT NULL DEFAULT 0,
  ADD COLUMN IF NOT EXISTS saldo_restante NUMERIC(10,2) GENERATED ALWAYS AS (GREATEST(valor_total - valor_pago, 0)) STORED,
  ADD COLUMN IF NOT EXISTS status_financeiro TEXT NOT NULL DEFAULT 'nao_pago',
  ADD COLUMN IF NOT EXISTS status_operacional TEXT NOT NULL DEFAULT 'orcamento';

ALTER TABLE public.pedidos
  DROP CONSTRAINT IF EXISTS pedidos_status_check,
  DROP CONSTRAINT IF EXISTS pedidos_tipo_entrega_check,
  DROP CONSTRAINT IF EXISTS pedidos_canal_venda_check,
  DROP CONSTRAINT IF EXISTS pedidos_valor_pago_check,
  DROP CONSTRAINT IF EXISTS pedidos_status_financeiro_check,
  DROP CONSTRAINT IF EXISTS pedidos_status_operacional_check,
  ADD CONSTRAINT pedidos_tipo_entrega_check CHECK (tipo_entrega IN ('retirada', 'entrega')),
  ADD CONSTRAINT pedidos_canal_venda_check CHECK (canal_venda IN ('whatsapp', 'instagram')),
  ADD CONSTRAINT pedidos_valor_pago_check CHECK (valor_pago >= 0 AND valor_pago <= valor_total),
  ADD CONSTRAINT pedidos_status_financeiro_check CHECK (status_financeiro IN ('nao_pago', 'parcial', 'pago')),
  ADD CONSTRAINT pedidos_status_operacional_check CHECK (status_operacional IN ('orcamento', 'confirmado', 'em-producao', 'pronto', 'entregue', 'cancelado')),
  ADD CONSTRAINT pedidos_entrega_endereco_check CHECK (tipo_entrega <> 'entrega' OR NULLIF(btrim(COALESCE(endereco_entrega, '')), '') IS NOT NULL);

UPDATE public.pedidos
   SET data_entrega = COALESCE(data_entrega, data),
       valor_pago = CASE
         WHEN status IN ('pronto', 'entregue') AND valor_pago = 0 THEN valor_total
         ELSE valor_pago
       END,
       status_operacional = CASE status
         WHEN 'pendente' THEN 'confirmado'
         ELSE status
       END,
       status = CASE status
         WHEN 'pendente' THEN 'confirmado'
         ELSE status
       END;

UPDATE public.pedidos
   SET status_financeiro = CASE
         WHEN valor_pago <= 0 THEN 'nao_pago'
         WHEN valor_pago >= valor_total THEN 'pago'
         ELSE 'parcial'
       END;

ALTER TABLE public.pedidos
  ADD CONSTRAINT pedidos_status_check CHECK (status IN ('orcamento', 'confirmado', 'em-producao', 'pronto', 'entregue', 'cancelado'));

ALTER TABLE public.pedidos
  ALTER COLUMN data_entrega SET DEFAULT (now() AT TIME ZONE 'America/Sao_Paulo')::date,
  ALTER COLUMN data_entrega SET NOT NULL;

CREATE INDEX IF NOT EXISTS idx_pedidos_data_entrega ON public.pedidos (data_entrega);
CREATE INDEX IF NOT EXISTS idx_pedidos_status_operacional ON public.pedidos (status_operacional);
CREATE INDEX IF NOT EXISTS idx_pedidos_status_financeiro ON public.pedidos (status_financeiro);

CREATE OR REPLACE FUNCTION public.derive_pedido_financial_status(p_valor_total NUMERIC, p_valor_pago NUMERIC)
RETURNS TEXT
LANGUAGE sql
IMMUTABLE
SET search_path = public
AS $$
  SELECT CASE
    WHEN COALESCE(p_valor_pago, 0) <= 0 THEN 'nao_pago'
    WHEN COALESCE(p_valor_pago, 0) >= COALESCE(p_valor_total, 0) THEN 'pago'
    ELSE 'parcial'
  END;
$$;

DROP FUNCTION IF EXISTS public.create_pedido_with_items(TEXT, UUID, DATE, TEXT, NUMERIC, TEXT, TEXT, TEXT, JSONB);

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
  p_valor_pago NUMERIC DEFAULT 0
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
    user_id,
    cliente,
    cliente_id,
    data,
    data_entrega,
    tipo_pedido,
    tipo_entrega,
    endereco_entrega,
    canal_venda,
    valor_total,
    valor_pago,
    forma_pagamento,
    status,
    status_operacional,
    status_financeiro,
    observacoes
  )
  VALUES (
    v_user_id,
    btrim(p_cliente),
    p_cliente_id,
    COALESCE(p_data, CURRENT_DATE),
    COALESCE(p_data_entrega, p_data, CURRENT_DATE),
    p_tipo_pedido,
    p_tipo_entrega,
    NULLIF(btrim(COALESCE(p_endereco_entrega, '')), ''),
    p_canal_venda,
    p_valor_total,
    COALESCE(p_valor_pago, 0),
    p_forma_pagamento,
    v_status_operacional,
    v_status_operacional,
    v_status_financeiro,
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

  IF v_pedido.valor_pago > 0 THEN
    v_venda_ref := 'pedido:' || v_pedido.id::TEXT || ':pagamento:entrada';

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
      'Pagamento - Pedido ' || v_pedido.cliente,
      v_pedido.valor_pago,
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
      'payment_created',
      jsonb_build_object('valor', v_pedido.valor_pago, 'referencia', v_venda_ref)
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
  JSONB,
  DATE,
  TEXT,
  TEXT,
  TEXT,
  NUMERIC
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
  JSONB,
  DATE,
  TEXT,
  TEXT,
  TEXT,
  NUMERIC
) TO authenticated;

CREATE OR REPLACE FUNCTION public.update_pedido_status(
  p_pedido_id UUID,
  p_status TEXT
)
RETURNS public.pedidos
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_user_id UUID := auth.uid();
  v_pedido public.pedidos%ROWTYPE;
  v_old_status TEXT;
BEGIN
  IF v_user_id IS NULL THEN
    RAISE EXCEPTION 'Usuário não autenticado';
  END IF;

  IF p_status NOT IN ('orcamento', 'confirmado', 'em-producao', 'pronto', 'entregue', 'cancelado') THEN
    RAISE EXCEPTION 'Status inválido';
  END IF;

  SELECT *
    INTO v_pedido
  FROM public.pedidos
  WHERE id = p_pedido_id
    AND user_id = v_user_id
  FOR UPDATE;

  IF NOT FOUND THEN
    RAISE EXCEPTION 'Pedido não encontrado';
  END IF;

  v_old_status := v_pedido.status_operacional;

  IF v_old_status = p_status THEN
    RETURN v_pedido;
  END IF;

  IF p_status = 'entregue' AND v_pedido.saldo_restante > 0 THEN
    RAISE EXCEPTION 'Este pedido ainda possui saldo pendente';
  END IF;

  UPDATE public.pedidos
     SET status = p_status,
         status_operacional = p_status
   WHERE id = p_pedido_id
     AND user_id = v_user_id
  RETURNING * INTO v_pedido;

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
    p_pedido_id,
    'status_changed',
    jsonb_build_object(
      'from', v_old_status,
      'to', p_status,
      'cliente', v_pedido.cliente,
      'valor_total', v_pedido.valor_total,
      'saldo_restante', v_pedido.saldo_restante
    )
  );

  RETURN v_pedido;
END;
$$;

REVOKE ALL ON FUNCTION public.update_pedido_status(UUID, TEXT) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.update_pedido_status(UUID, TEXT) TO authenticated;

CREATE OR REPLACE FUNCTION public.update_pedido_payment(
  p_pedido_id UUID,
  p_valor_pago NUMERIC
)
RETURNS public.pedidos
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_user_id UUID := auth.uid();
  v_pedido public.pedidos%ROWTYPE;
  v_old_valor_pago NUMERIC;
  v_delta NUMERIC;
  v_status_financeiro TEXT;
  v_ref TEXT;
BEGIN
  IF v_user_id IS NULL THEN
    RAISE EXCEPTION 'Usuário não autenticado';
  END IF;

  SELECT *
    INTO v_pedido
  FROM public.pedidos
  WHERE id = p_pedido_id
    AND user_id = v_user_id
  FOR UPDATE;

  IF NOT FOUND THEN
    RAISE EXCEPTION 'Pedido não encontrado';
  END IF;

  IF p_valor_pago IS NULL OR p_valor_pago < v_pedido.valor_pago OR p_valor_pago > v_pedido.valor_total THEN
    RAISE EXCEPTION 'Valor pago inválido';
  END IF;

  v_old_valor_pago := v_pedido.valor_pago;
  v_delta := p_valor_pago - v_old_valor_pago;
  v_status_financeiro := public.derive_pedido_financial_status(v_pedido.valor_total, p_valor_pago);

  IF v_delta = 0 THEN
    RETURN v_pedido;
  END IF;

  UPDATE public.pedidos
     SET valor_pago = p_valor_pago,
         status_financeiro = v_status_financeiro,
         status = CASE
           WHEN status_operacional = 'orcamento' AND p_valor_pago > 0 THEN 'confirmado'
           ELSE status
         END,
         status_operacional = CASE
           WHEN status_operacional = 'orcamento' AND p_valor_pago > 0 THEN 'confirmado'
           ELSE status_operacional
         END
   WHERE id = p_pedido_id
     AND user_id = v_user_id
  RETURNING * INTO v_pedido;

  v_ref := 'pedido:' || p_pedido_id::TEXT || ':pagamento:' || md5(now()::TEXT || ':' || v_delta::TEXT);

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
    'Pagamento - Pedido ' || v_pedido.cliente,
    v_delta,
    CURRENT_DATE,
    v_ref
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
    p_pedido_id,
    'payment_created',
    jsonb_build_object(
      'from', v_old_valor_pago,
      'to', p_valor_pago,
      'delta', v_delta,
      'referencia', v_ref
    )
  );

  RETURN v_pedido;
END;
$$;

REVOKE ALL ON FUNCTION public.update_pedido_payment(UUID, NUMERIC) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.update_pedido_payment(UUID, NUMERIC) TO authenticated;
