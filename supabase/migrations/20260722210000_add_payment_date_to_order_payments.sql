CREATE OR REPLACE FUNCTION public.update_pedido_payment(
  p_pedido_id UUID,
  p_valor_pago NUMERIC,
  p_data_pagamento DATE DEFAULT CURRENT_DATE
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
  v_financeiro_oficial BOOLEAN;
  v_data_pagamento DATE := COALESCE(p_data_pagamento, CURRENT_DATE);
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

  v_ref := 'pedido:' || p_pedido_id::TEXT || ':pagamento:' || md5(now()::TEXT || ':' || v_delta::TEXT || ':' || v_data_pagamento::TEXT);
  v_financeiro_oficial := public.is_official_financial_transaction(v_user_id, v_ref, v_data_pagamento);

  INSERT INTO public.transacoes (user_id, tipo, categoria, descricao, valor, data, referencia)
  VALUES (v_user_id, 'entrada', 'Vendas', 'Pagamento - Pedido ' || v_pedido.cliente,
          v_delta, v_data_pagamento, v_ref);

  INSERT INTO public.audit_log (user_id, entity_type, entity_id, action, metadata)
  VALUES (
    v_user_id,
    'pedido',
    p_pedido_id,
    CASE WHEN v_financeiro_oficial THEN 'payment_created' ELSE 'historical_payment_recorded' END,
    jsonb_build_object(
      'from', v_old_valor_pago,
      'to', p_valor_pago,
      'delta', v_delta,
      'data_pagamento', v_data_pagamento,
      'referencia', v_ref,
      'financeiro_oficial', v_financeiro_oficial
    )
  );

  RETURN v_pedido;
END;
$$;

CREATE OR REPLACE FUNCTION public.update_pedido_payment(p_pedido_id UUID, p_valor_pago NUMERIC)
RETURNS public.pedidos
LANGUAGE sql
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT public.update_pedido_payment(p_pedido_id, p_valor_pago, CURRENT_DATE);
$$;

CREATE OR REPLACE FUNCTION public.get_financial_summary()
RETURNS TABLE (
  total_entradas NUMERIC,
  total_saidas NUMERIC,
  lucro_bruto NUMERIC,
  total_historico NUMERIC
)
LANGUAGE plpgsql
STABLE
SECURITY DEFINER
SET search_path TO 'public'
AS $$
DECLARE
  v_user_id uuid := auth.uid();
BEGIN
  IF v_user_id IS NULL THEN
    RAISE EXCEPTION 'Usuário não autenticado';
  END IF;

  RETURN QUERY
  WITH tx AS (
    SELECT
      t.*,
      t.data AS data_efetiva
    FROM public.transacoes t
    WHERE t.user_id = v_user_id
  ),
  historical_delivered_orders AS (
    SELECT p.id
    FROM public.pedidos p
    WHERE p.user_id = v_user_id
      AND COALESCE(p.data_entrega, p.data) < DATE '2026-08-01'
      AND p.archived_at IS NULL
      AND COALESCE(p.status_operacional, p.status) = 'entregue'
  ),
  historical_orders AS (
    SELECT p.id, COALESCE(NULLIF(p.valor_pago, 0), p.valor_total, 0)::numeric AS valor
    FROM public.pedidos p
    JOIN historical_delivered_orders hdo ON hdo.id = p.id
    WHERE p.status_financeiro = 'pago'
  ),
  historical_pre_start_order_entries AS (
    SELECT tx.valor::numeric AS valor
    FROM tx
    JOIN public.pedidos p
      ON p.user_id = tx.user_id
     AND COALESCE(tx.referencia, '') LIKE 'pedido:' || p.id::TEXT || ':%'
    LEFT JOIN historical_delivered_orders hdo ON hdo.id = p.id
    WHERE tx.tipo = 'entrada'
      AND tx.data_efetiva < DATE '2026-08-01'
      AND tx.referencia LIKE 'pedido:%:pagamento:%'
      AND hdo.id IS NULL
      AND p.archived_at IS NULL
      AND COALESCE(p.data_entrega, p.data) >= DATE '2026-08-01'
  ),
  official_tx AS (
    SELECT tx.*
    FROM tx
    WHERE public.is_official_financial_transaction(tx.user_id, tx.referencia, tx.data_efetiva)
  )
  SELECT
    COALESCE(SUM(valor) FILTER (WHERE tipo = 'entrada'), 0) AS total_entradas,
    COALESCE(SUM(valor) FILTER (WHERE tipo = 'saida'), 0) AS total_saidas,
    COALESCE(SUM(
      CASE tipo
        WHEN 'entrada' THEN valor
        WHEN 'saida' THEN -valor
        ELSE 0
      END
    ), 0) AS lucro_bruto,
    (
      COALESCE((SELECT SUM(valor) FROM historical_orders), 0)
      + COALESCE((SELECT SUM(valor) FROM historical_pre_start_order_entries), 0)
    )::numeric AS total_historico
  FROM official_tx;
END;
$$;

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
      AND COALESCE(p.data_entrega, p.data) >= v_start
      AND COALESCE(p.data_entrega, p.data) < v_next
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
  tx AS (
    SELECT
      t.*,
      t.data AS data_efetiva
    FROM public.transacoes t
    WHERE t.user_id = v_user_id
  ),
  official_tx AS (
    SELECT tx.*
    FROM tx
    WHERE public.is_official_financial_transaction(tx.user_id, tx.referencia, tx.data_efetiva)
  ),
  tx_period AS (
    SELECT t.*
    FROM official_tx t
    WHERE t.data_efetiva >= v_start
      AND t.data_efetiva < v_next
  ),
  tx_year AS (
    SELECT t.*
    FROM official_tx t
    WHERE t.data_efetiva >= v_year_start
      AND t.data_efetiva < v_year_next
  ),
  metrics AS (
    SELECT
      COALESCE((SELECT SUM(valor) FROM tx_period WHERE tipo = 'entrada'), 0)::numeric AS vendas_periodo,
      COALESCE((SELECT SUM(valor) FROM tx_period WHERE tipo = 'saida'), 0)::numeric AS despesas_periodo,
      COALESCE((SELECT SUM(valor) FROM tx_year WHERE tipo = 'entrada'), 0)::numeric AS vendas_ano,
      COALESCE((SELECT SUM(valor) FROM official_tx WHERE tipo = 'entrada'), 0)::numeric AS vendas_total,
      COALESCE((SELECT COUNT(*) FROM created_period), 0)::bigint AS pedidos_periodo,
      COALESCE((SELECT COUNT(*) FROM delivered_period), 0)::bigint AS pedidos_entregues,
      COALESCE((SELECT SUM(valor_total) FROM delivered_period), 0)::numeric AS valor_entregue_periodo
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
    CASE WHEN m.pedidos_entregues > 0 THEN (m.valor_entregue_periodo / m.pedidos_entregues)::numeric ELSE 0::numeric END AS ticket_medio,
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

REVOKE ALL ON FUNCTION public.update_pedido_payment(UUID, NUMERIC, DATE) FROM PUBLIC;
REVOKE ALL ON FUNCTION public.update_pedido_payment(UUID, NUMERIC) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.update_pedido_payment(UUID, NUMERIC, DATE) TO authenticated;
GRANT EXECUTE ON FUNCTION public.update_pedido_payment(UUID, NUMERIC) TO authenticated;
REVOKE ALL ON FUNCTION public.get_financial_summary() FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.get_financial_summary() TO authenticated;
REVOKE ALL ON FUNCTION public.get_dashboard_summary(integer, integer) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.get_dashboard_summary(integer, integer) TO authenticated;
