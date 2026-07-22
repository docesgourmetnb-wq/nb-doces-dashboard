CREATE OR REPLACE FUNCTION public.register_insumo_entry(
  p_insumo_id UUID,
  p_quantidade NUMERIC,
  p_valor_total NUMERIC DEFAULT 0,
  p_data_compra DATE DEFAULT CURRENT_DATE
)
RETURNS public.insumos
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_user_id UUID := auth.uid();
  v_insumo public.insumos%ROWTYPE;
  v_updated public.insumos%ROWTYPE;
  v_valor_total NUMERIC := COALESCE(p_valor_total, 0);
  v_data_compra DATE := COALESCE(p_data_compra, CURRENT_DATE);
  v_ref TEXT;
BEGIN
  IF v_user_id IS NULL THEN
    RAISE EXCEPTION 'Usuário não autenticado';
  END IF;

  IF p_quantidade IS NULL OR p_quantidade <= 0 THEN
    RAISE EXCEPTION 'Quantidade de entrada inválida';
  END IF;

  IF v_valor_total < 0 THEN
    RAISE EXCEPTION 'Valor total inválido';
  END IF;

  SELECT * INTO v_insumo
  FROM public.insumos
  WHERE id = p_insumo_id
    AND user_id = v_user_id
  FOR UPDATE;

  IF NOT FOUND THEN
    RAISE EXCEPTION 'Insumo não encontrado';
  END IF;

  UPDATE public.insumos
     SET quantidade_atual = quantidade_atual + p_quantidade,
         preco_unitario = CASE
           WHEN v_valor_total > 0 THEN v_valor_total / p_quantidade
           ELSE preco_unitario
         END,
         ultima_compra = v_data_compra
   WHERE id = p_insumo_id
     AND user_id = v_user_id
  RETURNING * INTO v_updated;

  v_ref := 'insumo:' || p_insumo_id::TEXT || ':entrada:' || md5(now()::TEXT || ':' || p_quantidade::TEXT || ':' || v_valor_total::TEXT);

  IF v_valor_total > 0 THEN
    INSERT INTO public.transacoes (user_id, tipo, categoria, descricao, valor, data, referencia)
    VALUES (
      v_user_id,
      'saida',
      'Insumos',
      'Compra de insumo - ' || v_insumo.nome,
      v_valor_total,
      v_data_compra,
      v_ref
    );
  END IF;

  INSERT INTO public.audit_log (user_id, entity_type, entity_id, action, metadata)
  VALUES (
    v_user_id,
    'insumo',
    p_insumo_id,
    'stock_entry_registered',
    jsonb_build_object(
      'quantidade', p_quantidade,
      'unidade', v_insumo.unidade,
      'valor_total', v_valor_total,
      'data_compra', v_data_compra,
      'preco_unitario_anterior', v_insumo.preco_unitario,
      'preco_unitario_atual', v_updated.preco_unitario,
      'referencia_financeira', CASE WHEN v_valor_total > 0 THEN v_ref ELSE NULL END
    )
  );

  RETURN v_updated;
END;
$$;

REVOKE ALL ON FUNCTION public.register_insumo_entry(UUID, NUMERIC, NUMERIC, DATE) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.register_insumo_entry(UUID, NUMERIC, NUMERIC, DATE) TO authenticated;
