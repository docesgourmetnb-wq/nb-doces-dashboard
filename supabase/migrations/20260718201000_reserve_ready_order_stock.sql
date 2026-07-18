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
  v_stock_decrement NUMERIC;
  v_physical_qty NUMERIC;
  v_reserved_qty NUMERIC;
  v_available_qty NUMERIC;
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

  IF p_status IN ('pronto', 'entregue') AND v_old_status <> 'entregue' THEN
    FOR v_item IN
      SELECT brigadeiro_id, brigadeiro_nome, SUM(quantidade) AS quantidade
      FROM public.itens_pedido
      WHERE pedido_id = p_pedido_id
        AND quantidade > 0
      GROUP BY brigadeiro_id, brigadeiro_nome
    LOOP
      v_stock_pattern := CASE
        WHEN v_item.brigadeiro_id IS NOT NULL THEN '[PRODUTO] ' || v_item.brigadeiro_id::TEXT || '::%'
        ELSE NULL
      END;

      SELECT COALESCE(SUM(quantidade_atual), 0)
      INTO v_physical_qty
      FROM public.insumos
      WHERE user_id = v_user_id
        AND unidade = 'SYS_PROD'
        AND (
          (v_stock_pattern IS NOT NULL AND nome LIKE v_stock_pattern)
          OR (
            v_stock_pattern IS NULL
            AND lower(split_part(nome, '::', 2)) = lower(v_item.brigadeiro_nome)
          )
        );

      SELECT COALESCE(SUM(ip.quantidade), 0)
      INTO v_reserved_qty
      FROM public.itens_pedido ip
      JOIN public.pedidos p ON p.id = ip.pedido_id
      WHERE p.user_id = v_user_id
        AND p.id <> p_pedido_id
        AND p.archived_at IS NULL
        AND p.status_operacional = 'pronto'
        AND ip.quantidade > 0
        AND (
          (v_item.brigadeiro_id IS NOT NULL AND ip.brigadeiro_id = v_item.brigadeiro_id)
          OR (
            v_item.brigadeiro_id IS NULL
            AND lower(ip.brigadeiro_nome) = lower(v_item.brigadeiro_nome)
          )
        );

      v_available_qty := GREATEST(v_physical_qty - v_reserved_qty, 0);

      IF v_available_qty < v_item.quantidade THEN
        RAISE EXCEPTION 'Estoque pronto insuficiente para %. Necessário: %, disponível: %',
          v_item.brigadeiro_nome, v_item.quantidade, v_available_qty;
      END IF;
    END LOOP;
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
        v_consumed_qty := v_item.quantidade;

        FOR v_stock_row IN
          SELECT id, nome, quantidade_atual
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
            AND quantidade_atual > 0
          ORDER BY updated_at ASC
          FOR UPDATE
        LOOP
          EXIT WHEN v_consumed_qty <= 0;
          v_stock_decrement := LEAST(v_stock_row.quantidade_atual, v_consumed_qty);

          UPDATE public.insumos
             SET quantidade_atual = quantidade_atual - v_stock_decrement,
                 updated_at = now()
           WHERE id = v_stock_row.id;

          v_consumed_stock := v_consumed_stock || jsonb_build_array(jsonb_build_object(
            'insumo_id', v_stock_row.id,
            'nome', v_stock_row.nome,
            'pedido_item', v_item.brigadeiro_nome,
            'quantidade_pedido', v_item.quantidade,
            'quantidade_baixada', v_stock_decrement
          ));

          v_consumed_qty := v_consumed_qty - v_stock_decrement;
        END LOOP;
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
