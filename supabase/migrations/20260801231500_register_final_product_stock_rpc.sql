CREATE OR REPLACE FUNCTION public.register_final_product_stock(
  p_brigadeiro_id UUID,
  p_quantidade_inicial NUMERIC DEFAULT 0
)
RETURNS public.insumos
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_user_id UUID := auth.uid();
  v_brigadeiro public.brigadeiros%ROWTYPE;
  v_existing public.insumos%ROWTYPE;
  v_updated public.insumos%ROWTYPE;
  v_nome_estoque TEXT;
BEGIN
  IF v_user_id IS NULL THEN
    RAISE EXCEPTION 'Usuário não autenticado';
  END IF;

  IF p_quantidade_inicial IS NULL OR p_quantidade_inicial < 0 THEN
    RAISE EXCEPTION 'Quantidade inicial inválida';
  END IF;

  SELECT * INTO v_brigadeiro
  FROM public.brigadeiros
  WHERE id = p_brigadeiro_id
    AND user_id = v_user_id
    AND ativo = true;

  IF NOT FOUND THEN
    RAISE EXCEPTION 'Produto base não encontrado';
  END IF;

  PERFORM pg_advisory_xact_lock(hashtext(v_user_id::TEXT || ':final-product:' || p_brigadeiro_id::TEXT));

  v_nome_estoque := '[PRODUTO] ' || p_brigadeiro_id::TEXT || '::' || v_brigadeiro.nome;

  SELECT * INTO v_existing
  FROM public.insumos
  WHERE user_id = v_user_id
    AND unidade = 'SYS_PROD'
    AND nome LIKE ('[PRODUTO] ' || p_brigadeiro_id::TEXT || '::%')
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
      'estoque_produto_final',
      v_updated.id,
      'final_product_stock_reused',
      jsonb_build_object(
        'brigadeiro_id', p_brigadeiro_id,
        'produto_nome', v_brigadeiro.nome,
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
    'SYS_PROD',
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
    'estoque_produto_final',
    v_updated.id,
    'final_product_stock_registered',
    jsonb_build_object(
      'brigadeiro_id', p_brigadeiro_id,
      'produto_nome', v_brigadeiro.nome,
      'quantidade_inicial', p_quantidade_inicial,
      'quantidade_atual', v_updated.quantidade_atual
    )
  );

  RETURN v_updated;
END;
$$;

REVOKE ALL ON FUNCTION public.register_final_product_stock(UUID, NUMERIC) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.register_final_product_stock(UUID, NUMERIC) TO authenticated;
