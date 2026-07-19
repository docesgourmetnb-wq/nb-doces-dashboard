CREATE OR REPLACE FUNCTION public.is_official_financial_transaction(p_user_id uuid, p_referencia text)
RETURNS boolean
LANGUAGE sql
STABLE
SET search_path TO 'public'
AS $$
  SELECT NOT EXISTS (
    SELECT 1
    FROM public.pedidos p
    WHERE p.user_id = p_user_id
      AND p_referencia LIKE 'pedido:' || p.id::TEXT || ':%'
      AND (
        p.archived_at IS NOT NULL
        OR COALESCE(p.data_entrega, p.data) < DATE '2026-08-01'
      )
  );
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
SET search_path TO 'public'
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
    AND public.is_official_financial_transaction(user_id, referencia);
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
  official_tx AS (
    SELECT t.*
    FROM public.transacoes t
    WHERE t.user_id = v_user_id
      AND t.data >= DATE '2026-08-01'
      AND public.is_official_financial_transaction(t.user_id, t.referencia)
  ),
  tx_period AS (
    SELECT t.*
    FROM official_tx t
    WHERE t.data >= v_start
      AND t.data < v_next
  ),
  tx_year AS (
    SELECT t.*
    FROM official_tx t
    WHERE t.data >= v_year_start
      AND t.data < v_year_next
  ),
  metrics AS (
    SELECT
      COALESCE((SELECT SUM(valor) FROM tx_period WHERE tipo = 'entrada'), 0)::numeric AS vendas_periodo,
      COALESCE((SELECT SUM(valor) FROM tx_period WHERE tipo = 'saida'), 0)::numeric AS despesas_periodo,
      COALESCE((SELECT SUM(valor) FROM tx_year WHERE tipo = 'entrada'), 0)::numeric AS vendas_ano,
      COALESCE((SELECT SUM(valor) FROM official_tx WHERE tipo = 'entrada'), 0)::numeric AS vendas_total,
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

REVOKE ALL ON FUNCTION public.is_official_financial_transaction(uuid, text) FROM PUBLIC;
REVOKE ALL ON FUNCTION public.get_financial_summary() FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.get_financial_summary() TO authenticated;
REVOKE ALL ON FUNCTION public.get_dashboard_summary(integer, integer) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.get_dashboard_summary(integer, integer) TO authenticated;
