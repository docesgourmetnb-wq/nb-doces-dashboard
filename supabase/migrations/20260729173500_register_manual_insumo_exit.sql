CREATE OR REPLACE FUNCTION public.register_insumo_manual_exit(
  p_insumo_id UUID,
  p_quantidade NUMERIC,
  p_motivo TEXT DEFAULT NULL
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
  v_motivo TEXT := NULLIF(BTRIM(COALESCE(p_motivo, '')), '');
BEGIN
  IF v_user_id IS NULL THEN
    RAISE EXCEPTION 'Usuário não autenticado';
  END IF;

  IF p_quantidade IS NULL OR p_quantidade <= 0 THEN
    RAISE EXCEPTION 'Quantidade de saída inválida';
  END IF;

  SELECT * INTO v_insumo
  FROM public.insumos
  WHERE id = p_insumo_id
    AND user_id = v_user_id
  FOR UPDATE;

  IF NOT FOUND THEN
    RAISE EXCEPTION 'Item não encontrado';
  END IF;

  IF v_insumo.quantidade_atual < p_quantidade THEN
    RAISE EXCEPTION 'Saldo insuficiente para %. Disponível: % %, necessário: % %',
      v_insumo.nome,
      v_insumo.quantidade_atual,
      v_insumo.unidade,
      p_quantidade,
      v_insumo.unidade;
  END IF;

  UPDATE public.insumos
     SET quantidade_atual = quantidade_atual - p_quantidade,
         updated_at = now()
   WHERE id = p_insumo_id
     AND user_id = v_user_id
  RETURNING * INTO v_updated;

  INSERT INTO public.audit_log (user_id, entity_type, entity_id, action, metadata)
  VALUES (
    v_user_id,
    'insumo',
    p_insumo_id,
    'stock_manual_exit_registered',
    jsonb_build_object(
      'quantidade', p_quantidade,
      'unidade', v_insumo.unidade,
      'motivo', v_motivo,
      'saldo_anterior', v_insumo.quantidade_atual,
      'saldo_atual', v_updated.quantidade_atual
    )
  );

  RETURN v_updated;
END;
$$;

REVOKE ALL ON FUNCTION public.register_insumo_manual_exit(UUID, NUMERIC, TEXT) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.register_insumo_manual_exit(UUID, NUMERIC, TEXT) TO authenticated;
