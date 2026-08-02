CREATE OR REPLACE FUNCTION public.update_mass_production_status(
  p_producao_id UUID,
  p_status TEXT
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
  v_status TEXT := btrim(p_status);
BEGIN
  IF v_user_id IS NULL THEN
    RAISE EXCEPTION 'Usuário não autenticado';
  END IF;

  IF v_status NOT IN ('planejado', 'em-andamento', 'concluido') THEN
    RAISE EXCEPTION 'Status de produção inválido';
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
    RAISE EXCEPTION 'Produção cancelada não pode ser alterada';
  END IF;

  IF v_producao.status = v_status THEN
    RETURN v_producao;
  END IF;

  IF v_producao.status = 'concluido' THEN
    RAISE EXCEPTION 'Produção concluída não pode voltar de status';
  END IF;

  IF v_status = 'concluido' AND v_producao.recipe_version_id IS NOT NULL THEN
    RAISE EXCEPTION 'Use o fluxo de conclusão da produção para consumir insumos';
  END IF;

  UPDATE public.producao_diaria
     SET status = v_status
   WHERE id = p_producao_id
     AND user_id = v_user_id
  RETURNING * INTO v_updated;

  INSERT INTO public.audit_log (user_id, entity_type, entity_id, action, metadata)
  VALUES (
    v_user_id,
    'producao_diaria',
    p_producao_id,
    'production_status_updated',
    jsonb_build_object(
      'brigadeiro_nome', v_producao.brigadeiro_nome,
      'data', v_producao.data,
      'status_anterior', v_producao.status,
      'status_novo', v_status,
      'quantidade', v_producao.quantidade
    )
  );

  RETURN v_updated;
END;
$$;

REVOKE ALL ON FUNCTION public.update_mass_production_status(UUID, TEXT) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.update_mass_production_status(UUID, TEXT) TO authenticated;
