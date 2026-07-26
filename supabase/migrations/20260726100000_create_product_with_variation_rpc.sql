CREATE OR REPLACE FUNCTION public.create_product_with_variation(
  p_categoria_codigo TEXT,
  p_nome TEXT,
  p_modelo_producao TEXT DEFAULT 'sob_encomenda',
  p_validade_dias INTEGER DEFAULT NULL,
  p_prazo_minimo_dias INTEGER DEFAULT NULL,
  p_necessita_refrigeracao BOOLEAN DEFAULT false,
  p_variacao_nome TEXT DEFAULT NULL,
  p_variacao_tamanho TEXT DEFAULT NULL,
  p_variacao_cobertura TEXT DEFAULT NULL,
  p_variacao_preco_venda NUMERIC DEFAULT 0,
  p_variacao_custo_calculado NUMERIC DEFAULT 0,
  p_variacao_sob_encomenda BOOLEAN DEFAULT true,
  p_variacao_pronta_entrega BOOLEAN DEFAULT false
)
RETURNS UUID
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_user_id UUID := auth.uid();
  v_produto_id UUID;
BEGIN
  IF v_user_id IS NULL THEN
    RAISE EXCEPTION 'Usuário não autenticado';
  END IF;

  IF NOT EXISTS (
    SELECT 1
      FROM public.categorias_produto c
     WHERE c.codigo = p_categoria_codigo
       AND c.ativa = true
  ) THEN
    RAISE EXCEPTION 'Categoria de produto inválida';
  END IF;

  IF length(btrim(COALESCE(p_nome, ''))) = 0 THEN
    RAISE EXCEPTION 'Informe o nome do produto';
  END IF;

  IF length(btrim(COALESCE(p_variacao_nome, ''))) = 0 THEN
    RAISE EXCEPTION 'Informe a variação do produto';
  END IF;

  IF p_modelo_producao NOT IN ('sob_encomenda', 'pronta_entrega', 'ambos') THEN
    RAISE EXCEPTION 'Modelo de produção inválido';
  END IF;

  INSERT INTO public.produtos (
    user_id,
    categoria_codigo,
    nome,
    modelo_producao,
    validade_dias,
    prazo_minimo_dias,
    necessita_refrigeracao,
    ativo
  )
  VALUES (
    v_user_id,
    p_categoria_codigo,
    btrim(p_nome),
    p_modelo_producao,
    p_validade_dias,
    p_prazo_minimo_dias,
    p_necessita_refrigeracao,
    true
  )
  RETURNING id INTO v_produto_id;

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
    v_produto_id,
    btrim(p_variacao_nome),
    NULLIF(btrim(COALESCE(p_variacao_tamanho, '')), ''),
    NULLIF(btrim(COALESCE(p_variacao_cobertura, '')), ''),
    p_variacao_preco_venda,
    p_variacao_custo_calculado,
    p_validade_dias,
    p_prazo_minimo_dias,
    p_variacao_sob_encomenda,
    p_variacao_pronta_entrega,
    true
  );

  RETURN v_produto_id;
END;
$$;
