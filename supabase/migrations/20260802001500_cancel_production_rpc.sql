CREATE OR REPLACE FUNCTION public.cancel_mass_production(
  p_producao_id UUID,
  p_reason TEXT DEFAULT NULL
)
RETURNS public.producao_diaria
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_user_id UUID := auth.uid();
  v_producao public.producao_diaria%ROWTYPE;
  v_updated public.producao_diaria%ROWTYPE;
  v_reason TEXT := NULLIF(btrim(p_reason), '');
BEGIN
  IF v_user_id IS NULL THEN
    RAISE EXCEPTION 'Usuário não autenticado';
  END IF;

  SELECT * INTO v_producao
  FROM public.producao_diaria
  WHERE id = p_producao_id
    AND user_id = v_user_id
  FOR UPDATE;

  IF NOT FOUND THEN
    RAISE EXCEPTION 'Produção não encontrada';
  END IF;

  IF v_producao.deleted_at IS NOT NULL THEN
    RETURN v_producao;
  END IF;

  IF v_producao.status = 'concluido' THEN
    RAISE EXCEPTION 'Produção concluída não pode ser cancelada';
  END IF;

  UPDATE public.producao_diaria
     SET deleted_at = now(),
         deleted_reason = v_reason,
         status = 'cancelado'
   WHERE id = p_producao_id
     AND user_id = v_user_id
  RETURNING * INTO v_updated;

  INSERT INTO public.audit_log (user_id, entity_type, entity_id, action, metadata)
  VALUES (
    v_user_id,
    'producao_diaria',
    p_producao_id,
    'production_canceled',
    jsonb_build_object(
      'brigadeiro_nome', v_producao.brigadeiro_nome,
      'data', v_producao.data,
      'status_anterior', v_producao.status,
      'quantidade', v_producao.quantidade,
      'motivo', v_reason
    )
  );

  RETURN v_updated;
END;
$$;

REVOKE ALL ON FUNCTION public.cancel_mass_production(UUID, TEXT) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.cancel_mass_production(UUID, TEXT) TO authenticated;
