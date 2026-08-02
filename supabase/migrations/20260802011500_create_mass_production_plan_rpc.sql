CREATE OR REPLACE FUNCTION public.create_mass_production_plan(
  p_data DATE,
  p_brigadeiro_nome TEXT,
  p_quantidade INTEGER,
  p_recipe_version_id UUID DEFAULT NULL,
  p_consumir_estoque BOOLEAN DEFAULT FALSE,
  p_rendimento_previsto NUMERIC DEFAULT NULL,
  p_observacoes TEXT DEFAULT NULL,
  p_brigadeiro_id UUID DEFAULT NULL,
  p_custo_total NUMERIC DEFAULT 0
)
RETURNS public.producao_diaria
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_user_id UUID := auth.uid();
  v_recipe_exists BOOLEAN := FALSE;
  v_created public.producao_diaria%ROWTYPE;
  v_nome TEXT := btrim(COALESCE(p_brigadeiro_nome, ''));
BEGIN
  IF v_user_id IS NULL THEN
    RAISE EXCEPTION 'Usuário não autenticado';
  END IF;

  IF v_nome = '' THEN
    RAISE EXCEPTION 'Informe a massa da produção';
  END IF;

  IF p_quantidade IS NULL OR p_quantidade <= 0 THEN
    RAISE EXCEPTION 'Quantidade de receitas inválida';
  END IF;

  IF p_recipe_version_id IS NOT NULL THEN
    SELECT EXISTS (
      SELECT 1
      FROM public.recipe_versions
      WHERE id = p_recipe_version_id
        AND user_id = v_user_id
    )
    INTO v_recipe_exists;

    IF NOT v_recipe_exists THEN
      RAISE EXCEPTION 'Receita não encontrada';
    END IF;
  END IF;

  INSERT INTO public.producao_diaria (
    user_id,
    data,
    brigadeiro_id,
    brigadeiro_nome,
    quantidade,
    custo_total,
    status,
    recipe_version_id,
    consumir_estoque,
    rendimento_previsto,
    observacoes
  )
  VALUES (
    v_user_id,
    COALESCE(p_data, CURRENT_DATE),
    p_brigadeiro_id,
    v_nome,
    p_quantidade,
    COALESCE(p_custo_total, 0),
    'planejado',
    p_recipe_version_id,
    COALESCE(p_consumir_estoque, FALSE),
    p_rendimento_previsto,
    NULLIF(btrim(COALESCE(p_observacoes, '')), '')
  )
  RETURNING * INTO v_created;

  INSERT INTO public.audit_log (user_id, entity_type, entity_id, action, metadata)
  VALUES (
    v_user_id,
    'producao_diaria',
    v_created.id,
    'production_plan_created',
    jsonb_build_object(
      'brigadeiro_nome', v_created.brigadeiro_nome,
      'data', v_created.data,
      'quantidade', v_created.quantidade,
      'recipe_version_id', v_created.recipe_version_id,
      'consumir_estoque', v_created.consumir_estoque,
      'rendimento_previsto', v_created.rendimento_previsto
    )
  );

  RETURN v_created;
END;
$$;

REVOKE ALL ON FUNCTION public.create_mass_production_plan(
  DATE,
  TEXT,
  INTEGER,
  UUID,
  BOOLEAN,
  NUMERIC,
  TEXT,
  UUID,
  NUMERIC
) FROM PUBLIC;

GRANT EXECUTE ON FUNCTION public.create_mass_production_plan(
  DATE,
  TEXT,
  INTEGER,
  UUID,
  BOOLEAN,
  NUMERIC,
  TEXT,
  UUID,
  NUMERIC
) TO authenticated;
