-- Update pedido status, revenue transaction and audit log atomically.

CREATE OR REPLACE FUNCTION public.update_pedido_status(
  p_pedido_id UUID,
  p_status TEXT
)
RETURNS public.pedidos
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_user_id UUID := auth.uid();
  v_pedido public.pedidos%ROWTYPE;
  v_old_status TEXT;
  v_venda_count INTEGER;
  v_estorno_count INTEGER;
  v_ref TEXT;
BEGIN
  IF v_user_id IS NULL THEN
    RAISE EXCEPTION 'Usuário não autenticado';
  END IF;

  IF p_status NOT IN ('pendente', 'em-producao', 'pronto', 'entregue', 'cancelado') THEN
    RAISE EXCEPTION 'Status inválido';
  END IF;

  SELECT *
    INTO v_pedido
  FROM public.pedidos
  WHERE id = p_pedido_id
    AND user_id = v_user_id
  FOR UPDATE;

  IF NOT FOUND THEN
    RAISE EXCEPTION 'Pedido não encontrado';
  END IF;

  v_old_status := v_pedido.status;

  IF v_old_status = p_status THEN
    RETURN v_pedido;
  END IF;

  UPDATE public.pedidos
     SET status = p_status
   WHERE id = p_pedido_id
     AND user_id = v_user_id
  RETURNING * INTO v_pedido;

  INSERT INTO public.audit_log (
    user_id,
    entity_type,
    entity_id,
    action,
    metadata
  )
  VALUES (
    v_user_id,
    'pedido',
    p_pedido_id,
    'status_changed',
    jsonb_build_object(
      'from', v_old_status,
      'to', p_status,
      'cliente', v_pedido.cliente,
      'valor_total', v_pedido.valor_total
    )
  );

  SELECT
    COUNT(*) FILTER (WHERE referencia LIKE 'pedido:' || p_pedido_id::TEXT || ':venda:%'),
    COUNT(*) FILTER (WHERE referencia LIKE 'pedido:' || p_pedido_id::TEXT || ':estorno:%')
    INTO v_venda_count, v_estorno_count
  FROM public.transacoes
  WHERE user_id = v_user_id
    AND referencia LIKE 'pedido:' || p_pedido_id::TEXT || ':%';

  IF p_status = 'entregue' AND v_old_status <> 'entregue' AND v_pedido.valor_total > 0 THEN
    v_ref := 'pedido:' || p_pedido_id::TEXT || ':venda:' || (v_estorno_count + 1)::TEXT;

    IF NOT EXISTS (
      SELECT 1
      FROM public.transacoes
      WHERE user_id = v_user_id
        AND referencia = v_ref
    ) THEN
      INSERT INTO public.transacoes (
        user_id,
        tipo,
        categoria,
        descricao,
        valor,
        data,
        referencia
      )
      VALUES (
        v_user_id,
        'entrada',
        'Vendas',
        'Venda - Pedido ' || v_pedido.cliente,
        v_pedido.valor_total,
        v_pedido.data,
        v_ref
      );

      INSERT INTO public.audit_log (
        user_id,
        entity_type,
        entity_id,
        action,
        metadata
      )
      VALUES (
        v_user_id,
        'pedido',
        p_pedido_id,
        'venda_created',
        jsonb_build_object('valor', v_pedido.valor_total, 'referencia', v_ref)
      );
    END IF;
  END IF;

  IF v_old_status = 'entregue' AND p_status <> 'entregue' AND v_pedido.valor_total > 0 THEN
    v_ref := 'pedido:' || p_pedido_id::TEXT || ':estorno:' || GREATEST(v_venda_count, 1)::TEXT;

    IF NOT EXISTS (
      SELECT 1
      FROM public.transacoes
      WHERE user_id = v_user_id
        AND referencia = v_ref
    ) THEN
      INSERT INTO public.transacoes (
        user_id,
        tipo,
        categoria,
        descricao,
        valor,
        data,
        referencia
      )
      VALUES (
        v_user_id,
        'saida',
        'Estornos',
        'Estorno - Pedido ' || v_pedido.cliente,
        v_pedido.valor_total,
        v_pedido.data,
        v_ref
      );

      INSERT INTO public.audit_log (
        user_id,
        entity_type,
        entity_id,
        action,
        metadata
      )
      VALUES (
        v_user_id,
        'pedido',
        p_pedido_id,
        'estorno_created',
        jsonb_build_object('valor', v_pedido.valor_total, 'referencia', v_ref)
      );
    END IF;
  END IF;

  RETURN v_pedido;
END;
$$;

REVOKE ALL ON FUNCTION public.update_pedido_status(UUID, TEXT) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.update_pedido_status(UUID, TEXT) TO authenticated;
