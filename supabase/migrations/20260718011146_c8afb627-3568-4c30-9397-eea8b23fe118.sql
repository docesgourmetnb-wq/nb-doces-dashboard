DO $$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_type WHERE typname = 'app_role' AND typnamespace = 'public'::regnamespace) THEN
    CREATE TYPE public.app_role AS ENUM ('owner', 'admin', 'operator', 'viewer');
  END IF;
END $$;

ALTER TABLE public.profiles
  ADD COLUMN IF NOT EXISTS role public.app_role NOT NULL DEFAULT 'owner',
  ADD COLUMN IF NOT EXISTS active BOOLEAN NOT NULL DEFAULT true,
  ADD COLUMN IF NOT EXISTS permissions JSONB NOT NULL DEFAULT '{}'::jsonb;

UPDATE public.profiles
   SET role = COALESCE(role, 'owner'::public.app_role),
       active = COALESCE(active, true),
       permissions = COALESCE(permissions, '{}'::jsonb);

CREATE OR REPLACE FUNCTION public.default_permissions_for_role(p_role public.app_role)
RETURNS jsonb
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path TO 'public'
AS $$
  SELECT CASE p_role
    WHEN 'owner' THEN jsonb_build_object(
      'dashboard', true, 'produtos', true, 'clientes', true, 'pedidos', true,
      'producao', true, 'receitas', true, 'estoque', true, 'financeiro', true
    )
    WHEN 'admin' THEN jsonb_build_object(
      'dashboard', true, 'produtos', true, 'clientes', true, 'pedidos', true,
      'producao', true, 'receitas', true, 'estoque', true, 'financeiro', true
    )
    WHEN 'operator' THEN jsonb_build_object(
      'dashboard', true, 'produtos', true, 'clientes', true, 'pedidos', true,
      'producao', true, 'receitas', true, 'estoque', true, 'financeiro', false
    )
    ELSE jsonb_build_object(
      'dashboard', true, 'produtos', false, 'clientes', false, 'pedidos', false,
      'producao', false, 'receitas', false, 'estoque', false, 'financeiro', false
    )
  END;
$$;

UPDATE public.profiles
   SET permissions = public.default_permissions_for_role(role) || COALESCE(permissions, '{}'::jsonb);

CREATE OR REPLACE FUNCTION public.handle_new_user()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $$
BEGIN
  INSERT INTO public.profiles (user_id, email, nome, role, active, permissions)
  VALUES (
    NEW.id,
    NEW.email,
    COALESCE(NEW.raw_user_meta_data ->> 'nome', split_part(NEW.email, '@', 1)),
    'owner',
    true,
    public.default_permissions_for_role('owner')
  )
  ON CONFLICT (user_id) DO UPDATE
    SET email = EXCLUDED.email,
        nome = COALESCE(public.profiles.nome, EXCLUDED.nome),
        role = COALESCE(public.profiles.role, EXCLUDED.role),
        active = COALESCE(public.profiles.active, EXCLUDED.active),
        permissions = COALESCE(public.profiles.permissions, '{}'::jsonb) || EXCLUDED.permissions;
  RETURN NEW;
END;
$$;

CREATE OR REPLACE FUNCTION public.current_user_role()
RETURNS public.app_role
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path TO 'public'
AS $$
  SELECT p.role
  FROM public.profiles p
  WHERE p.user_id = auth.uid()
    AND p.active = true;
$$;

CREATE OR REPLACE FUNCTION public.can_access_module(p_module text)
RETURNS boolean
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path TO 'public'
AS $$
  SELECT COALESCE((
    SELECT (p.permissions ->> p_module)::boolean
    FROM public.profiles p
    WHERE p.user_id = auth.uid()
      AND p.active = true
  ), false);
$$;

REVOKE ALL ON FUNCTION public.default_permissions_for_role(public.app_role) FROM PUBLIC;
REVOKE ALL ON FUNCTION public.current_user_role() FROM PUBLIC;
REVOKE ALL ON FUNCTION public.can_access_module(text) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.current_user_role() TO authenticated;
GRANT EXECUTE ON FUNCTION public.can_access_module(text) TO authenticated;

DROP FUNCTION IF EXISTS public.get_dashboard_summary(integer, integer);

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
  delivered_year AS (
    SELECT p.*
    FROM public.pedidos p
    WHERE p.user_id = v_user_id
      AND p.data >= v_year_start
      AND p.data < v_year_next
      AND COALESCE(p.status_operacional, p.status) = 'entregue'
      AND p.archived_at IS NULL
  ),
  delivered_all AS (
    SELECT p.*
    FROM public.pedidos p
    WHERE p.user_id = v_user_id
      AND COALESCE(p.status_operacional, p.status) = 'entregue'
      AND p.archived_at IS NULL
  ),
  tx_period AS (
    SELECT t.*
    FROM public.transacoes t
    WHERE t.user_id = v_user_id
      AND t.data >= v_start
      AND t.data < v_next
  ),
  metrics AS (
    SELECT
      COALESCE((SELECT SUM(valor_total) FROM delivered_period), 0)::numeric AS vendas_periodo,
      COALESCE((SELECT SUM(valor) FROM tx_period WHERE tipo = 'saida'), 0)::numeric AS despesas_periodo,
      COALESCE((SELECT SUM(valor_total) FROM delivered_year), 0)::numeric AS vendas_ano,
      COALESCE((SELECT SUM(valor_total) FROM delivered_all), 0)::numeric AS vendas_total,
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
