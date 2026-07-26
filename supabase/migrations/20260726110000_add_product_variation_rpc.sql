CREATE OR REPLACE FUNCTION public.add_product_variation(
  p_produto_id UUID,
  p_variacao_nome TEXT,
  p_variacao_tamanho TEXT DEFAULT NULL,
  p_variacao_cobertura TEXT DEFAULT NULL,
  p_variacao_preco_venda NUMERIC DEFAULT 0,
  p_variacao_custo_calculado NUMERIC DEFAULT 0,
  p_variacao_sob_encomenda BOOLEAN DEFAULT true,
  p_variacao_pronta_entrega BOOLEAN DEFAULT false,
  p_validade_dias INTEGER DEFAULT NULL,
  p_prazo_minimo_dias INTEGER DEFAULT NULL
)
RETURNS UUID
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_user_id UUID := auth.uid();
  v_variacao_id UUID;
BEGIN
  IF v_user_id IS NULL THEN
    RAISE EXCEPTION 'Usuário não autenticado';
  END IF;

  IF p_produto_id IS NULL OR NOT EXISTS (
    SELECT 1
    FROM public.produtos p
    WHERE p.id = p_produto_id
      AND p.user_id = v_user_id
      AND p.ativo = TRUE
  ) THEN
    RAISE EXCEPTION 'Produto inválido para o usuário autenticado';
  END IF;

  IF length(btrim(COALESCE(p_variacao_nome, ''))) = 0 THEN
    RAISE EXCEPTION 'Informe a variação do produto';
  END IF;

  IF COALESCE(p_variacao_preco_venda, 0) <= 0 THEN
    RAISE EXCEPTION 'Preço de venda deve ser maior que zero';
  END IF;

  IF COALESCE(p_variacao_custo_calculado, 0) < 0 THEN
    RAISE EXCEPTION 'Custo não pode ser negativo';
  END IF;

  INSERT INTO public.produto_variacoes (
    user_id,
    produto_id,
    nome,
    tamanho,
    cobertura,
    preco_venda,
    custo_calculado,
    validade_dias,
    prazo_minimo_dias,
    disponivel_sob_encomenda,
    disponivel_pronta_entrega,
    ativo
  )
  VALUES (
    v_user_id,
    p_produto_id,
    btrim(p_variacao_nome),
    NULLIF(btrim(COALESCE(p_variacao_tamanho, '')), ''),
    NULLIF(btrim(COALESCE(p_variacao_cobertura, '')), ''),
    p_variacao_preco_venda,
    p_variacao_custo_calculado,
    p_validade_dias,
    p_prazo_minimo_dias,
    p_variacao_sob_encomenda,
    p_variacao_pronta_entrega,
    TRUE
  )
  RETURNING id INTO v_variacao_id;

  RETURN v_variacao_id;
END;
$$;

REVOKE ALL ON FUNCTION public.add_product_variation(UUID, TEXT, TEXT, TEXT, NUMERIC, NUMERIC, BOOLEAN, BOOLEAN, INTEGER, INTEGER) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.add_product_variation(UUID, TEXT, TEXT, TEXT, NUMERIC, NUMERIC, BOOLEAN, BOOLEAN, INTEGER, INTEGER) TO authenticated;
