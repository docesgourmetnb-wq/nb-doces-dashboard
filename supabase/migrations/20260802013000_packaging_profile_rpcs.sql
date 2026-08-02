CREATE OR REPLACE FUNCTION public.save_packaging_profile(
  p_profile_id UUID DEFAULT NULL,
  p_nome TEXT DEFAULT NULL,
  p_observacoes TEXT DEFAULT NULL
)
RETURNS public.packaging_profiles
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_user_id UUID := auth.uid();
  v_nome TEXT := btrim(COALESCE(p_nome, ''));
  v_saved public.packaging_profiles%ROWTYPE;
BEGIN
  IF v_user_id IS NULL THEN
    RAISE EXCEPTION 'Usuário não autenticado';
  END IF;

  IF v_nome = '' OR length(v_nome) > 120 THEN
    RAISE EXCEPTION 'Informe um nome válido para o modelo de embalagem';
  END IF;

  IF p_profile_id IS NULL THEN
    INSERT INTO public.packaging_profiles (user_id, nome, observacoes)
    VALUES (v_user_id, v_nome, NULLIF(btrim(COALESCE(p_observacoes, '')), ''))
    RETURNING * INTO v_saved;

    INSERT INTO public.audit_log (user_id, entity_type, entity_id, action, metadata)
    VALUES (
      v_user_id,
      'packaging_profiles',
      v_saved.id,
      'packaging_profile_created',
      jsonb_build_object('nome', v_saved.nome)
    );
  ELSE
    UPDATE public.packaging_profiles
       SET nome = v_nome,
           observacoes = NULLIF(btrim(COALESCE(p_observacoes, '')), '')
     WHERE id = p_profile_id
       AND user_id = v_user_id
       AND ativo = true
    RETURNING * INTO v_saved;

    IF NOT FOUND THEN
      RAISE EXCEPTION 'Modelo de embalagem não encontrado';
    END IF;

    INSERT INTO public.audit_log (user_id, entity_type, entity_id, action, metadata)
    VALUES (
      v_user_id,
      'packaging_profiles',
      v_saved.id,
      'packaging_profile_updated',
      jsonb_build_object('nome', v_saved.nome)
    );
  END IF;

  RETURN v_saved;
END;
$$;

CREATE OR REPLACE FUNCTION public.archive_packaging_profile(
  p_profile_id UUID
)
RETURNS public.packaging_profiles
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_user_id UUID := auth.uid();
  v_archived public.packaging_profiles%ROWTYPE;
BEGIN
  IF v_user_id IS NULL THEN
    RAISE EXCEPTION 'Usuário não autenticado';
  END IF;

  UPDATE public.packaging_profiles
     SET ativo = false
   WHERE id = p_profile_id
     AND user_id = v_user_id
     AND ativo = true
  RETURNING * INTO v_archived;

  IF NOT FOUND THEN
    RAISE EXCEPTION 'Modelo de embalagem não encontrado';
  END IF;

  INSERT INTO public.audit_log (user_id, entity_type, entity_id, action, metadata)
  VALUES (
    v_user_id,
    'packaging_profiles',
    p_profile_id,
    'packaging_profile_archived',
    jsonb_build_object('nome', v_archived.nome)
  );

  RETURN v_archived;
END;
$$;

CREATE OR REPLACE FUNCTION public.add_packaging_profile_item(
  p_profile_id UUID,
  p_insumo_id UUID,
  p_quantidade_por_pedido NUMERIC,
  p_observacoes TEXT DEFAULT NULL
)
RETURNS public.packaging_profile_items
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_user_id UUID := auth.uid();
  v_profile public.packaging_profiles%ROWTYPE;
  v_insumo public.insumos%ROWTYPE;
  v_saved public.packaging_profile_items%ROWTYPE;
BEGIN
  IF v_user_id IS NULL THEN
    RAISE EXCEPTION 'Usuário não autenticado';
  END IF;

  IF p_quantidade_por_pedido IS NULL OR p_quantidade_por_pedido <= 0 THEN
    RAISE EXCEPTION 'Quantidade por pedido inválida';
  END IF;

  SELECT * INTO v_profile
  FROM public.packaging_profiles
  WHERE id = p_profile_id
    AND user_id = v_user_id
    AND ativo = true;

  IF NOT FOUND THEN
    RAISE EXCEPTION 'Modelo de embalagem não encontrado';
  END IF;

  SELECT * INTO v_insumo
  FROM public.insumos
  WHERE id = p_insumo_id
    AND user_id = v_user_id
    AND ativo = true;

  IF NOT FOUND THEN
    RAISE EXCEPTION 'Embalagem não encontrada';
  END IF;

  IF v_insumo.tipo_estoque IS DISTINCT FROM 'embalagem' THEN
    RAISE EXCEPTION 'Selecione um item do tipo Embalagem';
  END IF;

  INSERT INTO public.packaging_profile_items (
    user_id,
    profile_id,
    insumo_id,
    quantidade_por_pedido,
    observacoes
  )
  VALUES (
    v_user_id,
    p_profile_id,
    p_insumo_id,
    p_quantidade_por_pedido,
    NULLIF(btrim(COALESCE(p_observacoes, '')), '')
  )
  RETURNING * INTO v_saved;

  INSERT INTO public.audit_log (user_id, entity_type, entity_id, action, metadata)
  VALUES (
    v_user_id,
    'packaging_profile_items',
    v_saved.id,
    'packaging_profile_item_added',
    jsonb_build_object(
      'profile_id', p_profile_id,
      'profile_nome', v_profile.nome,
      'insumo_id', p_insumo_id,
      'insumo_nome', v_insumo.nome,
      'quantidade_por_pedido', p_quantidade_por_pedido
    )
  );

  RETURN v_saved;
END;
$$;

CREATE OR REPLACE FUNCTION public.update_packaging_profile_item(
  p_item_id UUID,
  p_quantidade_por_pedido NUMERIC,
  p_observacoes TEXT DEFAULT NULL
)
RETURNS public.packaging_profile_items
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_user_id UUID := auth.uid();
  v_item public.packaging_profile_items%ROWTYPE;
  v_saved public.packaging_profile_items%ROWTYPE;
BEGIN
  IF v_user_id IS NULL THEN
    RAISE EXCEPTION 'Usuário não autenticado';
  END IF;

  IF p_quantidade_por_pedido IS NULL OR p_quantidade_por_pedido <= 0 THEN
    RAISE EXCEPTION 'Quantidade por pedido inválida';
  END IF;

  SELECT * INTO v_item
  FROM public.packaging_profile_items
  WHERE id = p_item_id
    AND user_id = v_user_id
  FOR UPDATE;

  IF NOT FOUND THEN
    RAISE EXCEPTION 'Item do modelo não encontrado';
  END IF;

  IF NOT EXISTS (
    SELECT 1
    FROM public.packaging_profiles profile
    WHERE profile.id = v_item.profile_id
      AND profile.user_id = v_user_id
      AND profile.ativo = true
  ) THEN
    RAISE EXCEPTION 'Modelo de embalagem não encontrado';
  END IF;

  UPDATE public.packaging_profile_items
     SET quantidade_por_pedido = p_quantidade_por_pedido,
         observacoes = NULLIF(btrim(COALESCE(p_observacoes, '')), '')
   WHERE id = p_item_id
     AND user_id = v_user_id
  RETURNING * INTO v_saved;

  INSERT INTO public.audit_log (user_id, entity_type, entity_id, action, metadata)
  VALUES (
    v_user_id,
    'packaging_profile_items',
    p_item_id,
    'packaging_profile_item_updated',
    jsonb_build_object(
      'profile_id', v_item.profile_id,
      'insumo_id', v_item.insumo_id,
      'quantidade_anterior', v_item.quantidade_por_pedido,
      'quantidade_nova', v_saved.quantidade_por_pedido
    )
  );

  RETURN v_saved;
END;
$$;

CREATE OR REPLACE FUNCTION public.remove_packaging_profile_item(
  p_item_id UUID
)
RETURNS public.packaging_profile_items
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_user_id UUID := auth.uid();
  v_deleted public.packaging_profile_items%ROWTYPE;
BEGIN
  IF v_user_id IS NULL THEN
    RAISE EXCEPTION 'Usuário não autenticado';
  END IF;

  DELETE FROM public.packaging_profile_items
   WHERE id = p_item_id
     AND user_id = v_user_id
  RETURNING * INTO v_deleted;

  IF NOT FOUND THEN
    RAISE EXCEPTION 'Item do modelo não encontrado';
  END IF;

  INSERT INTO public.audit_log (user_id, entity_type, entity_id, action, metadata)
  VALUES (
    v_user_id,
    'packaging_profile_items',
    p_item_id,
    'packaging_profile_item_removed',
    jsonb_build_object(
      'profile_id', v_deleted.profile_id,
      'insumo_id', v_deleted.insumo_id,
      'quantidade_por_pedido', v_deleted.quantidade_por_pedido
    )
  );

  RETURN v_deleted;
END;
$$;

REVOKE ALL ON FUNCTION public.save_packaging_profile(UUID, TEXT, TEXT) FROM PUBLIC;
REVOKE ALL ON FUNCTION public.archive_packaging_profile(UUID) FROM PUBLIC;
REVOKE ALL ON FUNCTION public.add_packaging_profile_item(UUID, UUID, NUMERIC, TEXT) FROM PUBLIC;
REVOKE ALL ON FUNCTION public.update_packaging_profile_item(UUID, NUMERIC, TEXT) FROM PUBLIC;
REVOKE ALL ON FUNCTION public.remove_packaging_profile_item(UUID) FROM PUBLIC;

GRANT EXECUTE ON FUNCTION public.save_packaging_profile(UUID, TEXT, TEXT) TO authenticated;
GRANT EXECUTE ON FUNCTION public.archive_packaging_profile(UUID) TO authenticated;
GRANT EXECUTE ON FUNCTION public.add_packaging_profile_item(UUID, UUID, NUMERIC, TEXT) TO authenticated;
GRANT EXECUTE ON FUNCTION public.update_packaging_profile_item(UUID, NUMERIC, TEXT) TO authenticated;
GRANT EXECUTE ON FUNCTION public.remove_packaging_profile_item(UUID) TO authenticated;
