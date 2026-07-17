-- Aggregate dashboard metrics without loading all pedidos and transacoes.

CREATE OR REPLACE FUNCTION public.get_dashboard_summary(
  p_year INTEGER,
  p_month INTEGER
)
RETURNS TABLE (
  vendas_periodo NUMERIC,
  despesas_periodo NUMERIC,
  lucro_periodo NUMERIC,
  vendas_ano NUMERIC,
  vendas_total NUMERIC,
  pedidos_periodo INTEGER,
  pedidos_entregues INTEGER,
  ticket_medio NUMERIC,
  taxa_conversao NUMERIC,
  top_clientes JSONB,
  top_produtos JSONB,
  sabores_mais_vendidos JSONB
)
LANGUAGE plpgsql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_user_id UUID := auth.uid();
  v_period_start DATE;
  v_period_end DATE;
  v_year_start DATE;
  v_year_end DATE;
BEGIN
  IF v_user_id IS NULL THEN
    RAISE EXCEPTION 'Usuário não autenticado';
  END IF;

  IF p_year IS NULL OR p_month IS NULL OR p_month < 1 OR p_month > 12 THEN
    RAISE EXCEPTION 'Período inválido';
  END IF;

  v_period_start := make_date(p_year, p_month, 1);
  v_period_end := (v_period_start + INTERVAL '1 month')::DATE;
  v_year_start := make_date(p_year, 1, 1);
  v_year_end := make_date(p_year + 1, 1, 1);

  RETURN QUERY
  WITH
    transacoes_periodo AS (
      SELECT t.tipo, t.valor
      FROM public.transacoes t
      WHERE t.user_id = v_user_id
        AND t.data >= v_period_start
        AND t.data < v_period_end
    ),
    transacoes_periodo_stats AS (
      SELECT
        COALESCE(SUM(valor) FILTER (WHERE tipo = 'entrada'), 0) AS vendas_periodo,
        COALESCE(SUM(valor) FILTER (WHERE tipo = 'saida'), 0) AS despesas_periodo,
        COALESCE(SUM(
          CASE tipo
            WHEN 'entrada' THEN valor
            WHEN 'saida' THEN -valor
            ELSE 0
          END
        ), 0) AS lucro_periodo
      FROM transacoes_periodo
    ),
    transacoes_totais AS (
      SELECT
        COALESCE(SUM(t.valor) FILTER (WHERE t.tipo = 'entrada' AND t.data >= v_year_start AND t.data < v_year_end), 0) AS vendas_ano,
        COALESCE(SUM(t.valor) FILTER (WHERE t.tipo = 'entrada'), 0) AS vendas_total
      FROM public.transacoes t
      WHERE t.user_id = v_user_id
    ),
    pedidos_periodo AS (
      SELECT p.*
      FROM public.pedidos p
      WHERE p.user_id = v_user_id
        AND p.data >= v_period_start
        AND p.data < v_period_end
        AND p.archived_at IS NULL
    ),
    pedidos_stats AS (
      SELECT
        COUNT(*)::INTEGER AS pedidos_periodo,
        COUNT(*) FILTER (WHERE status = 'entregue')::INTEGER AS pedidos_entregues,
        COALESCE(SUM(valor_total) FILTER (WHERE status = 'entregue'), 0) AS receita_entregues
      FROM pedidos_periodo
    ),
    top_clientes AS (
      SELECT COALESCE(jsonb_agg(row_data ORDER BY (row_data->>'valor')::NUMERIC DESC), '[]'::jsonb) AS data
      FROM (
        SELECT jsonb_build_object(
          'nome', MAX(COALESCE(c.nome, p.cliente)),
          'pedidos', COUNT(*)::INTEGER,
          'valor', SUM(p.valor_total)
        ) AS row_data
        FROM pedidos_periodo p
        LEFT JOIN public.clientes c
          ON c.id = p.cliente_id
         AND c.user_id = p.user_id
        WHERE p.status = 'entregue'
        GROUP BY COALESCE(p.cliente_id::TEXT, lower(p.cliente))
        ORDER BY SUM(p.valor_total) DESC
        LIMIT 5
      ) ranked
    ),
    top_produtos AS (
      SELECT COALESCE(jsonb_agg(row_data ORDER BY (row_data->>'receita')::NUMERIC DESC), '[]'::jsonb) AS data
      FROM (
        SELECT jsonb_build_object(
          'nome', MAX(ip.brigadeiro_nome),
          'quantidade', SUM(ip.quantidade)::INTEGER,
          'receita', SUM(ip.quantidade * ip.preco_unitario)
        ) AS row_data
        FROM pedidos_periodo p
        JOIN public.itens_pedido ip ON ip.pedido_id = p.id
        WHERE p.status = 'entregue'
        GROUP BY COALESCE(ip.brigadeiro_id::TEXT, lower(ip.brigadeiro_nome))
        ORDER BY SUM(ip.quantidade * ip.preco_unitario) DESC
        LIMIT 10
      ) ranked
    ),
    sabores AS (
      SELECT COALESCE(jsonb_agg(row_data ORDER BY (row_data->>'quantidade')::INTEGER DESC), '[]'::jsonb) AS data
      FROM (
        SELECT jsonb_build_object(
          'nome', MAX(ip.brigadeiro_nome),
          'quantidade', SUM(ip.quantidade)::INTEGER
        ) AS row_data
        FROM pedidos_periodo p
        JOIN public.itens_pedido ip ON ip.pedido_id = p.id
        GROUP BY COALESCE(ip.brigadeiro_id::TEXT, lower(ip.brigadeiro_nome))
        ORDER BY SUM(ip.quantidade) DESC
      ) ranked
    )
  SELECT
    tps.vendas_periodo,
    tps.despesas_periodo,
    tps.lucro_periodo,
    tt.vendas_ano,
    tt.vendas_total,
    ps.pedidos_periodo,
    ps.pedidos_entregues,
    CASE WHEN ps.pedidos_entregues > 0 THEN ps.receita_entregues / ps.pedidos_entregues ELSE 0 END AS ticket_medio,
    CASE WHEN ps.pedidos_periodo > 0 THEN (ps.pedidos_entregues::NUMERIC / ps.pedidos_periodo) * 100 ELSE 0 END AS taxa_conversao,
    tc.data AS top_clientes,
    tprod.data AS top_produtos,
    s.data AS sabores_mais_vendidos
  FROM transacoes_periodo_stats tps
  CROSS JOIN transacoes_totais tt
  CROSS JOIN pedidos_stats ps
  CROSS JOIN top_clientes tc
  CROSS JOIN top_produtos tprod
  CROSS JOIN sabores s
  ;
END;
$$;

REVOKE ALL ON FUNCTION public.get_dashboard_summary(INTEGER, INTEGER) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.get_dashboard_summary(INTEGER, INTEGER) TO authenticated;
