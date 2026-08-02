CREATE OR REPLACE FUNCTION public.adjust_final_product_stock(
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
  v_produto public.insumos%ROWTYPE;
  v_updated public.insumos%ROWTYPE;
  v_nova_quantidade NUMERIC;
  v_produto_nome TEXT;
BEGIN
  IF v_user_id IS NULL THEN
    RAISE EXCEPTION 'Usuário não autenticado';
  END IF;

  IF p_quantidade_delta IS NULL OR p_quantidade_delta = 0 THEN
    RAISE EXCEPTION 'Informe uma quantidade de ajuste válida';
  END IF;

  SELECT * INTO v_produto
  FROM public.insumos
  WHERE id = p_insumo_id
    AND user_id = v_user_id
    AND unidade = 'SYS_PROD'
    AND ativo = true
  FOR UPDATE;

  IF NOT FOUND THEN
    RAISE EXCEPTION 'Produto final não encontrado';
  END IF;

  v_nova_quantidade := v_produto.quantidade_atual + p_quantidade_delta;

  IF v_nova_quantidade < 0 THEN
    RAISE EXCEPTION 'Saldo insuficiente para %. Disponível: % un, necessário: % un',
      split_part(v_produto.nome, '::', 2),
      v_produto.quantidade_atual,
      abs(p_quantidade_delta);
  END IF;

  UPDATE public.insumos
     SET quantidade_atual = v_nova_quantidade,
         updated_at = now()
   WHERE id = p_insumo_id
     AND user_id = v_user_id
  RETURNING * INTO v_updated;

  v_produto_nome := NULLIF(split_part(v_produto.nome, '::', 2), '');

  INSERT INTO public.audit_log (user_id, entity_type, entity_id, action, metadata)
  VALUES (
    v_user_id,
    'estoque_produto_final',
    p_insumo_id,
    'final_product_stock_adjusted',
    jsonb_build_object(
      'produto_nome', v_produto_nome,
      'quantidade_anterior', v_produto.quantidade_atual,
      'quantidade_delta', p_quantidade_delta,
      'quantidade_atual', v_updated.quantidade_atual,
      'tipo', CASE WHEN p_quantidade_delta > 0 THEN 'entrada' ELSE 'saida' END
    )
  );

  RETURN v_updated;
END;
$$;

REVOKE ALL ON FUNCTION public.adjust_final_product_stock(UUID, NUMERIC) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.adjust_final_product_stock(UUID, NUMERIC) TO authenticated;
