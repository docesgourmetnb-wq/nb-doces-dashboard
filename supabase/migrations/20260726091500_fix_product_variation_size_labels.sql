CREATE OR REPLACE FUNCTION public.sync_brigadeiro_product_structure()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_nome_produto TEXT;
  v_nome_variacao TEXT;
  v_produto_id UUID;
  v_variacao_id UUID;
BEGIN
  IF NEW.categoria IS DISTINCT FROM 'brigadeiro' THEN
    RETURN NEW;
  END IF;

  v_nome_produto := btrim(regexp_replace(NEW.nome, '\s+[0-9]+(?:[,.][0-9]+)?\s*g$', '', 'i'));
  IF v_nome_produto = '' THEN
    v_nome_produto := btrim(NEW.nome);
  END IF;

  SELECT p.id
    INTO v_produto_id
    FROM public.produtos p
   WHERE p.user_id = NEW.user_id
     AND p.categoria_codigo = 'brigadeiro'
     AND lower(btrim(p.nome)) = lower(btrim(v_nome_produto))
   LIMIT 1;

  IF v_produto_id IS NULL THEN
    INSERT INTO public.produtos (
      user_id,
      categoria_codigo,
      nome,
      modelo_producao,
      ativo
    )
    VALUES (
      NEW.user_id,
      'brigadeiro',
      v_nome_produto,
      'ambos',
      true
    )
    RETURNING id INTO v_produto_id;
  END IF;

  v_nome_variacao := COALESCE(
    CASE
      WHEN NEW.tamanho_g IS NOT NULL
        THEN replace(NEW.tamanho_g::text, '.', ',') || 'g'
      ELSE NULL
    END,
    btrim(NEW.nome)
  );

  INSERT INTO public.produto_variacoes (
    user_id,
    produto_id,
    nome,
    tamanho,
    peso_aproximado_g,
    preco_venda,
    custo_calculado,
    disponivel_sob_encomenda,
    disponivel_pronta_entrega,
    ativo,
    brigadeiro_id
  )
  VALUES (
    NEW.user_id,
    v_produto_id,
    v_nome_variacao,
    CASE
      WHEN NEW.tamanho_g IS NOT NULL
        THEN replace(NEW.tamanho_g::text, '.', ',') || 'g'
      ELSE NULL
    END,
    NEW.tamanho_g,
    NEW.preco_venda,
    NEW.custo_unitario,
    true,
    true,
    NEW.ativo,
    NEW.id
  )
  ON CONFLICT (brigadeiro_id) WHERE brigadeiro_id IS NOT NULL DO UPDATE SET
    produto_id = EXCLUDED.produto_id,
    nome = EXCLUDED.nome,
    tamanho = EXCLUDED.tamanho,
    peso_aproximado_g = EXCLUDED.peso_aproximado_g,
    preco_venda = EXCLUDED.preco_venda,
    custo_calculado = EXCLUDED.custo_calculado,
    ativo = EXCLUDED.ativo,
    updated_at = now()
  RETURNING id INTO v_variacao_id;

  NEW.produto_id := v_produto_id;
  NEW.produto_variacao_id := v_variacao_id;
  RETURN NEW;
END;
$$;

UPDATE public.produto_variacoes pv
   SET nome = replace(b.tamanho_g::text, '.', ',') || 'g',
       tamanho = replace(b.tamanho_g::text, '.', ',') || 'g',
       updated_at = now()
  FROM public.brigadeiros b
 WHERE pv.brigadeiro_id = b.id
   AND b.categoria = 'brigadeiro'
   AND b.tamanho_g IS NOT NULL;
