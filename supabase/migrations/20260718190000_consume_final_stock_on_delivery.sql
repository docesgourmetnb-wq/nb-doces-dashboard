CREATE OR REPLACE FUNCTION public.update_pedido_status(p_pedido_id UUID, p_status TEXT)
RETURNS public.pedidos
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_user_id UUID := auth.uid();
  v_pedido public.pedidos%ROWTYPE;
  v_old_status TEXT;
  v_consumed_stock JSONB := '[]'::JSONB;
  v_stock_already_consumed BOOLEAN;
  v_stock_row RECORD;
  v_consumed_qty NUMERIC;
  v_stock_pattern TEXT;
  v_item RECORD;
BEGIN
  IF v_user_id IS NULL THEN RAISE EXCEPTION 'Usuário não autenticado'; END IF;
  IF p_status NOT IN ('orcamento', 'confirmado', 'em-producao', 'pronto', 'entregue', 'cancelado') THEN
    RAISE EXCEPTION 'Status inválido';
  END IF;

  SELECT * INTO v_pedido FROM public.pedidos WHERE id = p_pedido_id AND user_id = v_user_id FOR UPDATE;
  IF NOT FOUND THEN RAISE EXCEPTION 'Pedido não encontrado'; END IF;

  v_old_status := v_pedido.status_operacional;
  IF v_old_status = p_status THEN RETURN v_pedido; END IF;
  IF p_status = 'entregue' AND v_pedido.saldo_restante > 0 THEN
    RAISE EXCEPTION 'Este pedido ainda possui saldo pendente';
  END IF;

  IF p_status = 'entregue' AND v_old_status <> 'entregue' THEN
    SELECT EXISTS (
      SELECT 1
      FROM public.audit_log
      WHERE user_id = v_user_id
        AND entity_type = 'pedido'
        AND entity_id = p_pedido_id
        AND action = 'stock_consumed'
    ) INTO v_stock_already_consumed;

    IF NOT v_stock_already_consumed THEN
      FOR v_item IN
        SELECT brigadeiro_id, brigadeiro_nome, quantidade
        FROM public.itens_pedido
        WHERE pedido_id = p_pedido_id
          AND quantidade > 0
      LOOP
        v_stock_pattern := CASE
          WHEN v_item.brigadeiro_id IS NOT NULL THEN '[PRODUTO] ' || v_item.brigadeiro_id::TEXT || '::%'
          ELSE NULL
        END;

        SELECT id, nome, quantidade_atual
        INTO v_stock_row
        FROM public.insumos
        WHERE user_id = v_user_id
          AND unidade = 'SYS_PROD'
          AND (
            (v_stock_pattern IS NOT NULL AND nome LIKE v_stock_pattern)
            OR (
              v_stock_pattern IS NULL
              AND lower(split_part(nome, '::', 2)) = lower(v_item.brigadeiro_nome)
            )
          )
        ORDER BY updated_at DESC
        LIMIT 1
        FOR UPDATE;

        IF FOUND THEN
          v_consumed_qty := LEAST(v_stock_row.quantidade_atual, v_item.quantidade);

          IF v_consumed_qty > 0 THEN
            UPDATE public.insumos
               SET quantidade_atual = quantidade_atual - v_consumed_qty,
                   updated_at = now()
             WHERE id = v_stock_row.id;

            v_consumed_stock := v_consumed_stock || jsonb_build_array(jsonb_build_object(
              'insumo_id', v_stock_row.id,
              'nome', v_stock_row.nome,
              'pedido_item', v_item.brigadeiro_nome,
              'quantidade_pedido', v_item.quantidade,
              'quantidade_baixada', v_consumed_qty
            ));
          END IF;
        END IF;
      END LOOP;

      IF jsonb_array_length(v_consumed_stock) > 0 THEN
        INSERT INTO public.audit_log (user_id, entity_type, entity_id, action, metadata)
        VALUES (v_user_id, 'pedido', p_pedido_id, 'stock_consumed', jsonb_build_object(
          'from', v_old_status,
          'to', p_status,
          'itens', v_consumed_stock
        ));
      END IF;
    END IF;
  END IF;

  UPDATE public.pedidos SET status = p_status, status_operacional = p_status
   WHERE id = p_pedido_id AND user_id = v_user_id RETURNING * INTO v_pedido;

  INSERT INTO public.audit_log (user_id, entity_type, entity_id, action, metadata)
  VALUES (v_user_id, 'pedido', p_pedido_id, 'status_changed',
    jsonb_build_object('from', v_old_status, 'to', p_status, 'cliente', v_pedido.cliente,
      'valor_total', v_pedido.valor_total, 'saldo_restante', v_pedido.saldo_restante));

  RETURN v_pedido;
END;
$$;

REVOKE ALL ON FUNCTION public.update_pedido_status(UUID, TEXT) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.update_pedido_status(UUID, TEXT) TO authenticated;
