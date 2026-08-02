CREATE OR REPLACE FUNCTION public.inactivate_final_product_stock(
  p_insumo_id UUID
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
  v_produto_nome TEXT;
BEGIN
  IF v_user_id IS NULL THEN
    RAISE EXCEPTION 'Usuário não autenticado';
  END IF;

  SELECT * INTO v_produto
  FROM public.insumos
  WHERE id = p_insumo_id
    AND user_id = v_user_id
    AND unidade = 'SYS_PROD'
  FOR UPDATE;

  IF NOT FOUND THEN
    RAISE EXCEPTION 'Produto final não encontrado';
  END IF;

  IF NOT v_produto.ativo THEN
    RETURN v_produto;
  END IF;

  UPDATE public.insumos
     SET ativo = false,
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
    'final_product_stock_inactivated',
    jsonb_build_object(
      'produto_nome', v_produto_nome,
      'quantidade_atual', v_produto.quantidade_atual
    )
  );

  RETURN v_updated;
END;
$$;

REVOKE ALL ON FUNCTION public.inactivate_final_product_stock(UUID) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.inactivate_final_product_stock(UUID) TO authenticated;
