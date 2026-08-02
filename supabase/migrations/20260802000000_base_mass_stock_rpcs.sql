CREATE OR REPLACE FUNCTION public.register_base_mass_stock(
  p_sabor TEXT,
  p_quantidade_inicial NUMERIC DEFAULT 0
)
RETURNS public.insumos
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_user_id UUID := auth.uid();
  v_sabor TEXT := btrim(p_sabor);
  v_existing public.insumos%ROWTYPE;
  v_updated public.insumos%ROWTYPE;
  v_nome_estoque TEXT;
BEGIN
  IF v_user_id IS NULL THEN
    RAISE EXCEPTION 'Usuário não autenticado';
  END IF;

  IF v_sabor IS NULL OR v_sabor = '' THEN
    RAISE EXCEPTION 'Informe o sabor da massa';
  END IF;

  IF p_quantidade_inicial IS NULL OR p_quantidade_inicial < 0 THEN
    RAISE EXCEPTION 'Quantidade inicial inválida';
  END IF;

  PERFORM pg_advisory_xact_lock(hashtext(v_user_id::TEXT || ':base-mass:' || lower(v_sabor)));

  v_nome_estoque := '[MASSA] ' || v_sabor;

  SELECT * INTO v_existing
  FROM public.insumos
  WHERE user_id = v_user_id
    AND unidade = 'SYS_MASSA'
    AND lower(replace(nome, '[MASSA] ', '')) = lower(v_sabor)
  ORDER BY ativo DESC, updated_at DESC
  LIMIT 1
  FOR UPDATE;

  IF FOUND THEN
    UPDATE public.insumos
       SET nome = v_nome_estoque,
           quantidade_atual = quantidade_atual + p_quantidade_inicial,
           quantidade_minima = 0,
           consumo_medio = 0,
           preco_unitario = 0,
           ativo = true,
           updated_at = now()
     WHERE id = v_existing.id
       AND user_id = v_user_id
    RETURNING * INTO v_updated;

    INSERT INTO public.audit_log (user_id, entity_type, entity_id, action, metadata)
    VALUES (
      v_user_id,
      'estoque_massa_base',
      v_updated.id,
      'base_mass_stock_reused',
      jsonb_build_object(
        'sabor', v_sabor,
        'quantidade_inicial', p_quantidade_inicial,
        'quantidade_anterior', v_existing.quantidade_atual,
        'quantidade_atual', v_updated.quantidade_atual,
        'reativado', NOT v_existing.ativo
      )
    );

    RETURN v_updated;
  END IF;

  INSERT INTO public.insumos (
    nome,
    unidade,
    quantidade_atual,
    quantidade_minima,
    consumo_medio,
    preco_unitario,
    ativo,
    user_id
  )
  VALUES (
    v_nome_estoque,
    'SYS_MASSA',
    p_quantidade_inicial,
    0,
    0,
    0,
    true,
    v_user_id
  )
  RETURNING * INTO v_updated;

  INSERT INTO public.audit_log (user_id, entity_type, entity_id, action, metadata)
  VALUES (
    v_user_id,
    'estoque_massa_base',
    v_updated.id,
    'base_mass_stock_registered',
    jsonb_build_object(
      'sabor', v_sabor,
      'quantidade_inicial', p_quantidade_inicial,
      'quantidade_atual', v_updated.quantidade_atual
    )
  );

  RETURN v_updated;
END;
$$;

CREATE OR REPLACE FUNCTION public.adjust_base_mass_stock(
  p_insumo_id UUID,
  p_quantidade_delta NUMERIC
)
RETURNS public.insumos
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_user_id UUID := auth.uid();
  v_massa public.insumos%ROWTYPE;
  v_updated public.insumos%ROWTYPE;
  v_nova_quantidade NUMERIC;
  v_sabor TEXT;
BEGIN
  IF v_user_id IS NULL THEN
    RAISE EXCEPTION 'Usuário não autenticado';
  END IF;

  IF p_quantidade_delta IS NULL OR p_quantidade_delta = 0 THEN
    RAISE EXCEPTION 'Informe uma quantidade de ajuste válida';
  END IF;

  SELECT * INTO v_massa
  FROM public.insumos
  WHERE id = p_insumo_id
    AND user_id = v_user_id
    AND unidade = 'SYS_MASSA'
    AND ativo = true
  FOR UPDATE;

  IF NOT FOUND THEN
    RAISE EXCEPTION 'Massa base não encontrada';
  END IF;

  v_nova_quantidade := v_massa.quantidade_atual + p_quantidade_delta;

  IF v_nova_quantidade < 0 THEN
    RAISE EXCEPTION 'Saldo insuficiente para %. Disponível: % g, necessário: % g',
      replace(v_massa.nome, '[MASSA] ', ''),
      v_massa.quantidade_atual,
      abs(p_quantidade_delta);
  END IF;

  UPDATE public.insumos
     SET quantidade_atual = v_nova_quantidade,
         updated_at = now()
   WHERE id = p_insumo_id
     AND user_id = v_user_id
  RETURNING * INTO v_updated;

  v_sabor := replace(v_massa.nome, '[MASSA] ', '');

  INSERT INTO public.audit_log (user_id, entity_type, entity_id, action, metadata)
  VALUES (
    v_user_id,
    'estoque_massa_base',
    p_insumo_id,
    'base_mass_stock_adjusted',
    jsonb_build_object(
      'sabor', v_sabor,
      'quantidade_anterior', v_massa.quantidade_atual,
      'quantidade_delta', p_quantidade_delta,
      'quantidade_atual', v_updated.quantidade_atual,
      'tipo', CASE WHEN p_quantidade_delta > 0 THEN 'entrada' ELSE 'saida' END
    )
  );

  RETURN v_updated;
END;
$$;

CREATE OR REPLACE FUNCTION public.inactivate_base_mass_stock(
  p_insumo_id UUID
)
RETURNS public.insumos
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_user_id UUID := auth.uid();
  v_massa public.insumos%ROWTYPE;
  v_updated public.insumos%ROWTYPE;
  v_sabor TEXT;
BEGIN
  IF v_user_id IS NULL THEN
    RAISE EXCEPTION 'Usuário não autenticado';
  END IF;

  SELECT * INTO v_massa
  FROM public.insumos
  WHERE id = p_insumo_id
    AND user_id = v_user_id
    AND unidade = 'SYS_MASSA'
  FOR UPDATE;

  IF NOT FOUND THEN
    RAISE EXCEPTION 'Massa base não encontrada';
  END IF;

  IF NOT v_massa.ativo THEN
    RETURN v_massa;
  END IF;

  UPDATE public.insumos
     SET ativo = false,
         updated_at = now()
   WHERE id = p_insumo_id
     AND user_id = v_user_id
  RETURNING * INTO v_updated;

  v_sabor := replace(v_massa.nome, '[MASSA] ', '');

  INSERT INTO public.audit_log (user_id, entity_type, entity_id, action, metadata)
  VALUES (
    v_user_id,
    'estoque_massa_base',
    p_insumo_id,
    'base_mass_stock_inactivated',
    jsonb_build_object(
      'sabor', v_sabor,
      'quantidade_atual', v_massa.quantidade_atual
    )
  );

  RETURN v_updated;
END;
$$;

REVOKE ALL ON FUNCTION public.register_base_mass_stock(TEXT, NUMERIC) FROM PUBLIC;
REVOKE ALL ON FUNCTION public.adjust_base_mass_stock(UUID, NUMERIC) FROM PUBLIC;
REVOKE ALL ON FUNCTION public.inactivate_base_mass_stock(UUID) FROM PUBLIC;

GRANT EXECUTE ON FUNCTION public.register_base_mass_stock(TEXT, NUMERIC) TO authenticated;
GRANT EXECUTE ON FUNCTION public.adjust_base_mass_stock(UUID, NUMERIC) TO authenticated;
GRANT EXECUTE ON FUNCTION public.inactivate_base_mass_stock(UUID) TO authenticated;
