CREATE OR REPLACE FUNCTION public.is_official_financial_date(p_date DATE)
RETURNS BOOLEAN
LANGUAGE sql
IMMUTABLE
SET search_path = public
AS $$
  SELECT COALESCE(p_date, CURRENT_DATE) >= DATE '2026-08-01';
$$;

CREATE OR REPLACE FUNCTION public.get_financial_summary()
RETURNS TABLE (
  total_entradas NUMERIC,
  total_saidas NUMERIC,
  lucro_bruto NUMERIC
)
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT
    COALESCE(SUM(valor) FILTER (WHERE tipo = 'entrada'), 0) AS total_entradas,
    COALESCE(SUM(valor) FILTER (WHERE tipo = 'saida'), 0) AS total_saidas,
    COALESCE(SUM(
      CASE tipo
        WHEN 'entrada' THEN valor
        WHEN 'saida' THEN -valor
        ELSE 0
      END
    ), 0) AS lucro_bruto
  FROM public.transacoes
  WHERE user_id = auth.uid()
    AND data >= DATE '2026-08-01'
    AND NOT EXISTS (
      SELECT 1
      FROM public.pedidos p
      WHERE p.user_id = transacoes.user_id
        AND transacoes.referencia LIKE 'pedido:' || p.id::TEXT || ':%'
        AND NOT public.is_official_financial_date(p.data_entrega)
    );
$$;

REVOKE ALL ON FUNCTION public.get_financial_summary() FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.get_financial_summary() TO authenticated;

CREATE OR REPLACE FUNCTION public.get_dashboard_summary(p_year integer, p_month integer)
RETURNS TABLE(
  vendas_periodo numeric,
  despesas_periodo numeric,
  lucro_periodo numeric,
  vendas_ano numeric,
  vendas_total numeric,
  pedidos_periodo bigint,
  pedidos_entregues bigint,
  ticket_medio numeric,
  taxa_conversao numeric,
  top_clientes jsonb,
  top_produtos jsonb,
  sabores_mais_vendidos jsonb
)
LANGUAGE plpgsql
STABLE
SECURITY DEFINER
SET search_path TO 'public'
AS $$
DECLARE
  v_user_id uuid := auth.uid();
  v_cutoff date := DATE '2026-08-01';
  v_start date := make_date(p_year, p_month, 1);
  v_next date := (make_date(p_year, p_month, 1) + interval '1 month')::date;
  v_year_start date := make_date(p_year, 1, 1);
  v_year_next date := make_date(p_year + 1, 1, 1);
BEGIN
  IF v_user_id IS NULL THEN
    RAISE EXCEPTION 'Usuário não autenticado';
  END IF;

  RETURN QUERY
  WITH delivered_period AS (
    SELECT p.*
    FROM public.pedidos p
    WHERE p.user_id = v_user_id
      AND p.data >= v_start
      AND p.data < v_next
      AND COALESCE(p.status_operacional, p.status) = 'entregue'
      AND p.archived_at IS NULL
  ),
  created_period AS (
    SELECT p.*
    FROM public.pedidos p
    WHERE p.user_id = v_user_id
      AND p.data >= v_start
      AND p.data < v_next
      AND p.archived_at IS NULL
  ),
  tx_period AS (
    SELECT t.*
    FROM public.transacoes t
    WHERE t.user_id = v_user_id
      AND t.data >= GREATEST(v_start, v_cutoff)
      AND t.data < v_next
      AND NOT EXISTS (
        SELECT 1
        FROM public.pedidos p
        WHERE p.user_id = t.user_id
          AND t.referencia LIKE 'pedido:' || p.id::TEXT || ':%'
          AND NOT public.is_official_financial_date(p.data_entrega)
      )
  ),
  tx_year AS (
    SELECT t.*
    FROM public.transacoes t
    WHERE t.user_id = v_user_id
      AND t.data >= GREATEST(v_year_start, v_cutoff)
      AND t.data < v_year_next
      AND NOT EXISTS (
        SELECT 1
        FROM public.pedidos p
        WHERE p.user_id = t.user_id
          AND t.referencia LIKE 'pedido:' || p.id::TEXT || ':%'
          AND NOT public.is_official_financial_date(p.data_entrega)
      )
  ),
  tx_all AS (
    SELECT t.*
    FROM public.transacoes t
    WHERE t.user_id = v_user_id
      AND t.data >= v_cutoff
      AND NOT EXISTS (
        SELECT 1
        FROM public.pedidos p
        WHERE p.user_id = t.user_id
          AND t.referencia LIKE 'pedido:' || p.id::TEXT || ':%'
          AND NOT public.is_official_financial_date(p.data_entrega)
      )
  ),
  metrics AS (
    SELECT
      COALESCE((SELECT SUM(valor) FROM tx_period WHERE tipo = 'entrada'), 0)::numeric AS vendas_periodo,
      COALESCE((SELECT SUM(valor) FROM tx_period WHERE tipo = 'saida'), 0)::numeric AS despesas_periodo,
      COALESCE((SELECT SUM(valor) FROM tx_year WHERE tipo = 'entrada'), 0)::numeric AS vendas_ano,
      COALESCE((SELECT SUM(valor) FROM tx_all WHERE tipo = 'entrada'), 0)::numeric AS vendas_total,
      COALESCE((SELECT COUNT(*) FROM created_period), 0)::bigint AS pedidos_periodo,
      COALESCE((SELECT COUNT(*) FROM delivered_period), 0)::bigint AS pedidos_entregues
  ),
  clientes_rank AS (
    SELECT COALESCE(jsonb_agg(jsonb_build_object('nome', nome, 'pedidos', pedidos, 'valor', valor) ORDER BY valor DESC), '[]'::jsonb) AS data
    FROM (
      SELECT COALESCE(c.nome, p.cliente) AS nome, COUNT(*)::int AS pedidos, COALESCE(SUM(p.valor_total), 0)::numeric AS valor
      FROM delivered_period p
      LEFT JOIN public.clientes c ON c.id = p.cliente_id AND c.user_id = v_user_id
      GROUP BY COALESCE(c.nome, p.cliente)
      ORDER BY valor DESC
      LIMIT 5
    ) ranked
  ),
  produtos_rank AS (
    SELECT COALESCE(jsonb_agg(jsonb_build_object('nome', nome, 'quantidade', quantidade, 'receita', receita) ORDER BY receita DESC), '[]'::jsonb) AS data
    FROM (
      SELECT i.brigadeiro_nome AS nome, COALESCE(SUM(i.quantidade), 0)::int AS quantidade,
             COALESCE(SUM(i.quantidade * i.preco_unitario), 0)::numeric AS receita
      FROM delivered_period p
      JOIN public.itens_pedido i ON i.pedido_id = p.id
      GROUP BY i.brigadeiro_nome
      ORDER BY receita DESC
      LIMIT 5
    ) ranked
  ),
  sabores_rank AS (
    SELECT COALESCE(jsonb_agg(jsonb_build_object('nome', nome, 'quantidade', quantidade) ORDER BY quantidade DESC), '[]'::jsonb) AS data
    FROM (
      SELECT i.brigadeiro_nome AS nome, COALESCE(SUM(i.quantidade), 0)::int AS quantidade
      FROM delivered_period p
      JOIN public.itens_pedido i ON i.pedido_id = p.id
      GROUP BY i.brigadeiro_nome
      ORDER BY quantidade DESC
      LIMIT 5
    ) ranked
  )
  SELECT
    m.vendas_periodo,
    m.despesas_periodo,
    (m.vendas_periodo - m.despesas_periodo)::numeric AS lucro_periodo,
    m.vendas_ano,
    m.vendas_total,
    m.pedidos_periodo,
    m.pedidos_entregues,
    CASE WHEN m.pedidos_entregues > 0 THEN (m.vendas_periodo / m.pedidos_entregues)::numeric ELSE 0::numeric END AS ticket_medio,
    CASE WHEN m.pedidos_periodo > 0 THEN ROUND((m.pedidos_entregues::numeric / m.pedidos_periodo::numeric) * 100, 2) ELSE 0::numeric END AS taxa_conversao,
    cr.data AS top_clientes,
    pr.data AS top_produtos,
    sr.data AS sabores_mais_vendidos
  FROM metrics m
  CROSS JOIN clientes_rank cr
  CROSS JOIN produtos_rank pr
  CROSS JOIN sabores_rank sr;
END;
$$;

REVOKE ALL ON FUNCTION public.get_dashboard_summary(integer, integer) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.get_dashboard_summary(integer, integer) TO authenticated;

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
    user_id, cliente, cliente_id, data, data_entrega, tipo_pedido, tipo_entrega,
    endereco_entrega, canal_venda, valor_total, valor_pago, forma_pagamento,
    status, status_operacional, status_financeiro, observacoes
  )
  VALUES (
    v_user_id, btrim(p_cliente), p_cliente_id, COALESCE(p_data, CURRENT_DATE),
    COALESCE(p_data_entrega, p_data, CURRENT_DATE), p_tipo_pedido, p_tipo_entrega,
    NULLIF(btrim(COALESCE(p_endereco_entrega, '')), ''), p_canal_venda, p_valor_total,
    COALESCE(p_valor_pago, 0), p_forma_pagamento, v_status_operacional,
    v_status_operacional, v_status_financeiro, NULLIF(btrim(COALESCE(p_observacoes, '')), '')
  )
  RETURNING * INTO v_pedido;

  INSERT INTO public.itens_pedido (pedido_id, brigadeiro_id, brigadeiro_nome, quantidade, preco_unitario)
  SELECT
    v_pedido.id,
    NULLIF(item->>'brigadeiro_id', '')::UUID,
    item->>'brigadeiro_nome',
    (item->>'quantidade')::INTEGER,
    (item->>'preco_unitario')::NUMERIC
  FROM jsonb_array_elements(p_itens) AS item;

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

REVOKE ALL ON FUNCTION public.create_pedido_with_items(TEXT, UUID, DATE, TEXT, NUMERIC, TEXT, TEXT, TEXT, JSONB, DATE, TEXT, TEXT, TEXT, NUMERIC) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.create_pedido_with_items(TEXT, UUID, DATE, TEXT, NUMERIC, TEXT, TEXT, TEXT, JSONB, DATE, TEXT, TEXT, TEXT, NUMERIC) TO authenticated;

CREATE OR REPLACE FUNCTION public.update_pedido_payment(p_pedido_id UUID, p_valor_pago NUMERIC)
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
  v_is_official BOOLEAN;
BEGIN
  IF v_user_id IS NULL THEN
    RAISE EXCEPTION 'Usuário não autenticado';
  END IF;

  SELECT * INTO v_pedido
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
  v_is_official := public.is_official_financial_date(v_pedido.data_entrega);

  IF v_delta = 0 THEN
    RETURN v_pedido;
  END IF;

  UPDATE public.pedidos
     SET valor_pago = p_valor_pago,
         status_financeiro = v_status_financeiro,
         status = CASE WHEN status_operacional = 'orcamento' AND p_valor_pago > 0 THEN 'confirmado' ELSE status END,
         status_operacional = CASE WHEN status_operacional = 'orcamento' AND p_valor_pago > 0 THEN 'confirmado' ELSE status_operacional END
   WHERE id = p_pedido_id
     AND user_id = v_user_id
  RETURNING * INTO v_pedido;

  v_ref := 'pedido:' || p_pedido_id::TEXT || ':pagamento:' || md5(now()::TEXT || ':' || v_delta::TEXT);

  IF v_is_official THEN
    INSERT INTO public.transacoes (user_id, tipo, categoria, descricao, valor, data, referencia)
    VALUES (v_user_id, 'entrada', 'Vendas', 'Pagamento - Pedido ' || v_pedido.cliente,
            v_delta, CURRENT_DATE, v_ref);
  END IF;

  INSERT INTO public.audit_log (user_id, entity_type, entity_id, action, metadata)
  VALUES (
    v_user_id,
    'pedido',
    p_pedido_id,
    CASE WHEN v_is_official THEN 'payment_created' ELSE 'historical_payment_recorded' END,
    jsonb_build_object(
      'from', v_old_valor_pago,
      'to', p_valor_pago,
      'delta', v_delta,
      'referencia', v_ref,
      'financeiro_oficial', v_is_official
    )
  );

  RETURN v_pedido;
END;
$$;

REVOKE ALL ON FUNCTION public.update_pedido_payment(UUID, NUMERIC) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.update_pedido_payment(UUID, NUMERIC) TO authenticated;
