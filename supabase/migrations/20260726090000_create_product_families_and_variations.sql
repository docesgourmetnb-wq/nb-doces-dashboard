CREATE TABLE IF NOT EXISTS public.categorias_produto (
  codigo TEXT PRIMARY KEY,
  nome TEXT NOT NULL,
  ativa BOOLEAN NOT NULL DEFAULT true,
  controla_validade BOOLEAN NOT NULL DEFAULT false,
  permite_variacoes BOOLEAN NOT NULL DEFAULT true,
  permite_pronta_entrega BOOLEAN NOT NULL DEFAULT true,
  permite_sob_encomenda BOOLEAN NOT NULL DEFAULT true,
  unidade_comercial_padrao TEXT NOT NULL DEFAULT 'un',
  ordem INTEGER NOT NULL DEFAULT 0,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  CONSTRAINT categorias_produto_codigo_check CHECK (codigo ~ '^[a-z0-9_]+$'),
  CONSTRAINT categorias_produto_nome_check CHECK (length(btrim(nome)) > 0 AND length(nome) <= 80)
);

INSERT INTO public.categorias_produto (
  codigo,
  nome,
  controla_validade,
  permite_variacoes,
  permite_pronta_entrega,
  permite_sob_encomenda,
  unidade_comercial_padrao,
  ordem
)
VALUES
  ('brigadeiro', 'Brigadeiro', true, true, true, true, 'un', 10),
  ('bolo', 'Bolo', true, true, true, true, 'un', 20)
ON CONFLICT (codigo) DO UPDATE SET
  nome = EXCLUDED.nome,
  controla_validade = EXCLUDED.controla_validade,
  permite_variacoes = EXCLUDED.permite_variacoes,
  permite_pronta_entrega = EXCLUDED.permite_pronta_entrega,
  permite_sob_encomenda = EXCLUDED.permite_sob_encomenda,
  unidade_comercial_padrao = EXCLUDED.unidade_comercial_padrao,
  ordem = EXCLUDED.ordem,
  updated_at = now();

CREATE TABLE IF NOT EXISTS public.produtos (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  categoria_codigo TEXT NOT NULL REFERENCES public.categorias_produto(codigo),
  nome TEXT NOT NULL,
  descricao_curta TEXT,
  imagem_url TEXT,
  modelo_producao TEXT NOT NULL DEFAULT 'sob_encomenda',
  prazo_minimo_dias INTEGER,
  validade_dias INTEGER,
  necessita_refrigeracao BOOLEAN NOT NULL DEFAULT false,
  observacoes_internas TEXT,
  ordem INTEGER NOT NULL DEFAULT 0,
  ativo BOOLEAN NOT NULL DEFAULT true,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  CONSTRAINT produtos_nome_check CHECK (length(btrim(nome)) > 0 AND length(nome) <= 160),
  CONSTRAINT produtos_modelo_producao_check CHECK (modelo_producao IN ('sob_encomenda', 'pronta_entrega', 'ambos')),
  CONSTRAINT produtos_prazo_minimo_check CHECK (prazo_minimo_dias IS NULL OR prazo_minimo_dias >= 0),
  CONSTRAINT produtos_validade_check CHECK (validade_dias IS NULL OR validade_dias >= 0)
);

CREATE UNIQUE INDEX IF NOT EXISTS produtos_user_categoria_nome_unique
  ON public.produtos (user_id, categoria_codigo, lower(btrim(nome)));

CREATE INDEX IF NOT EXISTS idx_produtos_user_categoria
  ON public.produtos (user_id, categoria_codigo, ativo);

CREATE TABLE IF NOT EXISTS public.produto_variacoes (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  produto_id UUID NOT NULL REFERENCES public.produtos(id) ON DELETE CASCADE,
  nome TEXT NOT NULL,
  codigo_interno TEXT,
  tamanho TEXT,
  peso_aproximado_g NUMERIC,
  formato TEXT,
  cobertura TEXT,
  rendimento_fatias INTEGER,
  preco_venda NUMERIC NOT NULL DEFAULT 0,
  custo_calculado NUMERIC NOT NULL DEFAULT 0,
  prazo_minimo_dias INTEGER,
  validade_dias INTEGER,
  tipo_embalagem TEXT,
  disponivel_sob_encomenda BOOLEAN NOT NULL DEFAULT true,
  disponivel_pronta_entrega BOOLEAN NOT NULL DEFAULT true,
  ativo BOOLEAN NOT NULL DEFAULT true,
  brigadeiro_id UUID REFERENCES public.brigadeiros(id) ON DELETE SET NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  CONSTRAINT produto_variacoes_nome_check CHECK (length(btrim(nome)) > 0 AND length(nome) <= 160),
  CONSTRAINT produto_variacoes_preco_check CHECK (preco_venda >= 0),
  CONSTRAINT produto_variacoes_custo_check CHECK (custo_calculado >= 0),
  CONSTRAINT produto_variacoes_peso_check CHECK (peso_aproximado_g IS NULL OR peso_aproximado_g > 0),
  CONSTRAINT produto_variacoes_rendimento_check CHECK (rendimento_fatias IS NULL OR rendimento_fatias > 0),
  CONSTRAINT produto_variacoes_prazo_check CHECK (prazo_minimo_dias IS NULL OR prazo_minimo_dias >= 0),
  CONSTRAINT produto_variacoes_validade_check CHECK (validade_dias IS NULL OR validade_dias >= 0)
);

CREATE UNIQUE INDEX IF NOT EXISTS produto_variacoes_produto_nome_unique
  ON public.produto_variacoes (produto_id, lower(btrim(nome)));

CREATE UNIQUE INDEX IF NOT EXISTS produto_variacoes_brigadeiro_unique
  ON public.produto_variacoes (brigadeiro_id)
  WHERE brigadeiro_id IS NOT NULL;

CREATE INDEX IF NOT EXISTS idx_produto_variacoes_user_produto
  ON public.produto_variacoes (user_id, produto_id, ativo);

ALTER TABLE public.brigadeiros
  ADD COLUMN IF NOT EXISTS produto_id UUID REFERENCES public.produtos(id) ON DELETE SET NULL,
  ADD COLUMN IF NOT EXISTS produto_variacao_id UUID REFERENCES public.produto_variacoes(id) ON DELETE SET NULL;

ALTER TABLE public.categorias_produto ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.produtos ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.produto_variacoes ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Authenticated users can view product categories" ON public.categorias_produto;
CREATE POLICY "Authenticated users can view product categories"
  ON public.categorias_produto
  FOR SELECT
  USING (auth.role() = 'authenticated');

DROP POLICY IF EXISTS "Users can view own products" ON public.produtos;
CREATE POLICY "Users can view own products"
  ON public.produtos
  FOR SELECT
  USING (auth.uid() = user_id);

DROP POLICY IF EXISTS "Users can insert own products" ON public.produtos;
CREATE POLICY "Users can insert own products"
  ON public.produtos
  FOR INSERT
  WITH CHECK (auth.uid() = user_id);

DROP POLICY IF EXISTS "Users can update own products" ON public.produtos;
CREATE POLICY "Users can update own products"
  ON public.produtos
  FOR UPDATE
  USING (auth.uid() = user_id)
  WITH CHECK (auth.uid() = user_id);

DROP POLICY IF EXISTS "Users can delete own products" ON public.produtos;
CREATE POLICY "Users can delete own products"
  ON public.produtos
  FOR DELETE
  USING (auth.uid() = user_id);

DROP POLICY IF EXISTS "Users can view own product variations" ON public.produto_variacoes;
CREATE POLICY "Users can view own product variations"
  ON public.produto_variacoes
  FOR SELECT
  USING (auth.uid() = user_id);

DROP POLICY IF EXISTS "Users can insert own product variations" ON public.produto_variacoes;
CREATE POLICY "Users can insert own product variations"
  ON public.produto_variacoes
  FOR INSERT
  WITH CHECK (
    auth.uid() = user_id
    AND EXISTS (
      SELECT 1
        FROM public.produtos p
       WHERE p.id = produto_id
         AND p.user_id = auth.uid()
    )
  );

DROP POLICY IF EXISTS "Users can update own product variations" ON public.produto_variacoes;
CREATE POLICY "Users can update own product variations"
  ON public.produto_variacoes
  FOR UPDATE
  USING (auth.uid() = user_id)
  WITH CHECK (
    auth.uid() = user_id
    AND EXISTS (
      SELECT 1
        FROM public.produtos p
       WHERE p.id = produto_id
         AND p.user_id = auth.uid()
    )
  );

DROP POLICY IF EXISTS "Users can delete own product variations" ON public.produto_variacoes;
CREATE POLICY "Users can delete own product variations"
  ON public.produto_variacoes
  FOR DELETE
  USING (auth.uid() = user_id);

DROP TRIGGER IF EXISTS update_categorias_produto_updated_at ON public.categorias_produto;
CREATE TRIGGER update_categorias_produto_updated_at
  BEFORE UPDATE ON public.categorias_produto
  FOR EACH ROW
  EXECUTE FUNCTION public.update_updated_at_column();

DROP TRIGGER IF EXISTS update_produtos_updated_at ON public.produtos;
CREATE TRIGGER update_produtos_updated_at
  BEFORE UPDATE ON public.produtos
  FOR EACH ROW
  EXECUTE FUNCTION public.update_updated_at_column();

DROP TRIGGER IF EXISTS update_produto_variacoes_updated_at ON public.produto_variacoes;
CREATE TRIGGER update_produto_variacoes_updated_at
  BEFORE UPDATE ON public.produto_variacoes
  FOR EACH ROW
  EXECUTE FUNCTION public.update_updated_at_column();

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

DROP TRIGGER IF EXISTS sync_brigadeiro_product_structure_trigger ON public.brigadeiros;
CREATE TRIGGER sync_brigadeiro_product_structure_trigger
  BEFORE INSERT OR UPDATE OF nome, categoria, tamanho_g, preco_venda, custo_unitario, ativo
  ON public.brigadeiros
  FOR EACH ROW
  EXECUTE FUNCTION public.sync_brigadeiro_product_structure();

WITH brigadeiro_familias AS (
  SELECT
    b.user_id,
    b.categoria,
    lower(btrim(regexp_replace(regexp_replace(b.nome, '\s+[0-9]+(?:[,.][0-9]+)?\s*g$', '', 'i'), '\s+', ' ', 'g'))) AS nome_normalizado,
    min(regexp_replace(b.nome, '\s+[0-9]+(?:[,.][0-9]+)?\s*g$', '', 'i')) AS nome_produto,
    min(b.created_at) AS primeira_criacao
  FROM public.brigadeiros b
  WHERE b.categoria = 'brigadeiro'
  GROUP BY b.user_id, b.categoria, lower(btrim(regexp_replace(regexp_replace(b.nome, '\s+[0-9]+(?:[,.][0-9]+)?\s*g$', '', 'i'), '\s+', ' ', 'g')))
),
produtos_criados AS (
  INSERT INTO public.produtos (
    user_id,
    categoria_codigo,
    nome,
    modelo_producao,
    ativo,
    created_at,
    updated_at
  )
  SELECT
    user_id,
    categoria,
    btrim(nome_produto),
    'ambos',
    true,
    primeira_criacao,
    now()
  FROM brigadeiro_familias
  WHERE NOT EXISTS (
    SELECT 1
      FROM public.produtos p
     WHERE p.user_id = brigadeiro_familias.user_id
       AND p.categoria_codigo = brigadeiro_familias.categoria
       AND lower(btrim(p.nome)) = lower(btrim(brigadeiro_familias.nome_produto))
  )
  RETURNING id, user_id, categoria_codigo, nome
),
todos_produtos AS (
  SELECT id, user_id, categoria_codigo, nome FROM produtos_criados
  UNION
  SELECT p.id, p.user_id, p.categoria_codigo, p.nome
    FROM public.produtos p
   WHERE p.categoria_codigo = 'brigadeiro'
),
variacoes_criadas AS (
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
    brigadeiro_id,
    created_at,
    updated_at
  )
  SELECT
    b.user_id,
    p.id,
    COALESCE(
      CASE
        WHEN b.tamanho_g IS NOT NULL
          THEN replace(b.tamanho_g::text, '.', ',') || 'g'
        ELSE NULL
      END,
      b.nome
    ),
    CASE
      WHEN b.tamanho_g IS NOT NULL
        THEN replace(b.tamanho_g::text, '.', ',') || 'g'
      ELSE NULL
    END,
    b.tamanho_g,
    b.preco_venda,
    b.custo_unitario,
    true,
    true,
    b.ativo,
    b.id,
    b.created_at,
    now()
  FROM public.brigadeiros b
  JOIN todos_produtos p
    ON p.user_id = b.user_id
   AND p.categoria_codigo = b.categoria
   AND lower(btrim(p.nome)) = lower(btrim(regexp_replace(regexp_replace(b.nome, '\s+[0-9]+(?:[,.][0-9]+)?\s*g$', '', 'i'), '\s+', ' ', 'g')))
  WHERE b.categoria = 'brigadeiro'
  ON CONFLICT (brigadeiro_id) WHERE brigadeiro_id IS NOT NULL DO UPDATE SET
    produto_id = EXCLUDED.produto_id,
    nome = EXCLUDED.nome,
    tamanho = EXCLUDED.tamanho,
    peso_aproximado_g = EXCLUDED.peso_aproximado_g,
    preco_venda = EXCLUDED.preco_venda,
    custo_calculado = EXCLUDED.custo_calculado,
    ativo = EXCLUDED.ativo,
    updated_at = now()
  RETURNING id, produto_id, brigadeiro_id
)
UPDATE public.brigadeiros b
   SET produto_id = vc.produto_id,
       produto_variacao_id = vc.id
  FROM variacoes_criadas vc
 WHERE b.id = vc.brigadeiro_id;
