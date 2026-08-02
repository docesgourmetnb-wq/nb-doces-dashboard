CREATE OR REPLACE FUNCTION public.update_mass_production_plan(
  p_producao_id UUID,
  p_data DATE DEFAULT NULL,
  p_quantidade INTEGER DEFAULT NULL
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
    RAISE EXCEPTION 'Produção cancelada não pode ser editada';
  END IF;

  IF v_producao.status = 'concluido' THEN
    RAISE EXCEPTION 'Produção concluída não pode ser editada';
  END IF;

  IF p_quantidade IS NOT NULL AND p_quantidade <= 0 THEN
    RAISE EXCEPTION 'Quantidade de receitas inválida';
  END IF;

  UPDATE public.producao_diaria
     SET data = COALESCE(p_data, v_producao.data),
         quantidade = COALESCE(p_quantidade, v_producao.quantidade)
   WHERE id = p_producao_id
     AND user_id = v_user_id
  RETURNING * INTO v_updated;

  INSERT INTO public.audit_log (user_id, entity_type, entity_id, action, metadata)
  VALUES (
    v_user_id,
    'producao_diaria',
    p_producao_id,
    'production_plan_updated',
    jsonb_build_object(
      'brigadeiro_nome', v_producao.brigadeiro_nome,
      'data_anterior', v_producao.data,
      'data_nova', v_updated.data,
      'quantidade_anterior', v_producao.quantidade,
      'quantidade_nova', v_updated.quantidade,
      'status', v_producao.status
    )
  );

  RETURN v_updated;
END;
$$;

REVOKE ALL ON FUNCTION public.update_mass_production_plan(UUID, DATE, INTEGER) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.update_mass_production_plan(UUID, DATE, INTEGER) TO authenticated;
