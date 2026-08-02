CREATE TABLE IF NOT EXISTS public.insumo_manual_exits (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL DEFAULT auth.uid() REFERENCES auth.users(id) ON DELETE CASCADE,
  insumo_id UUID NOT NULL,
  quantidade NUMERIC NOT NULL,
  unidade TEXT NOT NULL,
  motivo TEXT,
  saldo_anterior NUMERIC,
  saldo_atual NUMERIC,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  CONSTRAINT insumo_manual_exits_quantidade_positive CHECK (quantidade > 0)
);

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1
    FROM pg_constraint
    WHERE conname = 'insumo_manual_exits_insumo_owner_fkey'
  ) THEN
    ALTER TABLE public.insumo_manual_exits
      ADD CONSTRAINT insumo_manual_exits_insumo_owner_fkey
      FOREIGN KEY (user_id, insumo_id)
      REFERENCES public.insumos(user_id, id)
      ON DELETE CASCADE;
  END IF;
END $$;

CREATE INDEX IF NOT EXISTS insumo_manual_exits_user_created_idx
  ON public.insumo_manual_exits (user_id, created_at DESC);

CREATE INDEX IF NOT EXISTS insumo_manual_exits_user_insumo_created_idx
  ON public.insumo_manual_exits (user_id, insumo_id, created_at DESC);

ALTER TABLE public.insumo_manual_exits ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Users can view their own insumo manual exits" ON public.insumo_manual_exits;
CREATE POLICY "Users can view their own insumo manual exits"
  ON public.insumo_manual_exits
  FOR SELECT
  TO authenticated
  USING (auth.uid() = user_id);

DROP POLICY IF EXISTS "Users can create their own insumo manual exits" ON public.insumo_manual_exits;
CREATE POLICY "Users can create their own insumo manual exits"
  ON public.insumo_manual_exits
  FOR INSERT
  TO authenticated
  WITH CHECK (auth.uid() = user_id);

DROP POLICY IF EXISTS "Users can update their own insumo manual exits" ON public.insumo_manual_exits;
CREATE POLICY "Users can update their own insumo manual exits"
  ON public.insumo_manual_exits
  FOR UPDATE
  TO authenticated
  USING (auth.uid() = user_id)
  WITH CHECK (auth.uid() = user_id);

DROP POLICY IF EXISTS "Users can delete their own insumo manual exits" ON public.insumo_manual_exits;
CREATE POLICY "Users can delete their own insumo manual exits"
  ON public.insumo_manual_exits
  FOR DELETE
  TO authenticated
  USING (auth.uid() = user_id);

INSERT INTO public.insumo_manual_exits (
  id,
  user_id,
  insumo_id,
  quantidade,
  unidade,
  motivo,
  saldo_anterior,
  saldo_atual,
  created_at
)
SELECT
  audit_log.id,
  audit_log.user_id,
  audit_log.entity_id,
  (audit_log.metadata ->> 'quantidade')::NUMERIC,
  COALESCE(NULLIF(audit_log.metadata ->> 'unidade', ''), insumos.unidade, ''),
  NULLIF(audit_log.metadata ->> 'motivo', ''),
  CASE
    WHEN audit_log.metadata ->> 'saldo_anterior' ~ '^-?[0-9]+(\.[0-9]+)?$'
      THEN (audit_log.metadata ->> 'saldo_anterior')::NUMERIC
    ELSE NULL
  END,
  CASE
    WHEN audit_log.metadata ->> 'saldo_atual' ~ '^-?[0-9]+(\.[0-9]+)?$'
      THEN (audit_log.metadata ->> 'saldo_atual')::NUMERIC
    ELSE NULL
  END,
  audit_log.created_at
FROM public.audit_log
LEFT JOIN public.insumos
  ON insumos.id = audit_log.entity_id
 AND insumos.user_id = audit_log.user_id
WHERE audit_log.entity_type = 'insumo'
  AND audit_log.action = 'stock_manual_exit_registered'
  AND audit_log.entity_id IS NOT NULL
  AND audit_log.metadata ->> 'quantidade' ~ '^[0-9]+(\.[0-9]+)?$'
  AND NOT EXISTS (
    SELECT 1
    FROM public.insumo_manual_exits existing
    WHERE existing.id = audit_log.id
  );

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

  INSERT INTO public.insumo_manual_exits (
    user_id,
    insumo_id,
    quantidade,
    unidade,
    motivo,
    saldo_anterior,
    saldo_atual
  )
  VALUES (
    v_user_id,
    p_insumo_id,
    p_quantidade,
    v_insumo.unidade,
    v_motivo,
    v_insumo.quantidade_atual,
    v_updated.quantidade_atual
  );

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
