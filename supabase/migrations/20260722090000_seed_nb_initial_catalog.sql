-- Seed inicial do catálogo operacional da NB Doces no Supabase próprio.
-- Mantém o banco novo utilizável sem depender dos dados internos do Lovable.

DO $$
DECLARE
  v_user_id uuid;
BEGIN
  SELECT id
    INTO v_user_id
  FROM auth.users
  WHERE lower(email) = 'docesgourmetnb@gmail.com'
  LIMIT 1;

  IF v_user_id IS NULL THEN
    RAISE NOTICE 'Usuário docesgourmetnb@gmail.com ainda não existe; seed inicial ignorado.';
    RETURN;
  END IF;

  INSERT INTO public.profiles (user_id, email, nome, role, active, permissions)
  VALUES (
    v_user_id,
    'docesgourmetnb@gmail.com',
    'NB Doces Gourmet',
    'owner',
    true,
    public.default_permissions_for_role('owner')
  )
  ON CONFLICT (user_id) DO UPDATE
    SET email = EXCLUDED.email,
        nome = COALESCE(public.profiles.nome, EXCLUDED.nome),
        role = 'owner',
        active = true,
        permissions = public.default_permissions_for_role('owner'),
        updated_at = now();

  INSERT INTO public.clientes (user_id, nome, telefone, email)
  SELECT v_user_id, data.nome, NULL, NULL
  FROM (VALUES
    ('Sotaque Bar'),
    ('Bárbaros Cervejas Artesanais')
  ) AS data(nome)
  WHERE NOT EXISTS (
    SELECT 1
    FROM public.clientes c
    WHERE c.user_id = v_user_id
      AND lower(trim(c.nome)) = lower(trim(data.nome))
  );

  INSERT INTO public.insumos (
    user_id,
    nome,
    unidade,
    quantidade_atual,
    quantidade_minima,
    consumo_medio,
    preco_unitario
  )
  SELECT
    v_user_id,
    data.nome,
    data.unidade,
    0,
    0,
    0,
    0
  FROM (VALUES
    ('Leite Condensado', 'g'),
    ('Creme de Leite', 'g'),
    ('Leite', 'ml'),
    ('Manteiga', 'g'),
    ('Chocolate 100% Cacau', 'g'),
    ('Limão', 'g'),
    ('Café', 'g'),
    ('Coco Queimado', 'g'),
    ('Nozes Pecan', 'g'),
    ('Paçoca', 'g'),
    ('Amendoim sem Sal', 'g'),
    ('Açúcar Cristal', 'g'),
    ('Oreo', 'g'),
    ('Goiabada', 'g'),
    ('Canela', 'g'),
    ('Leite Ninho', 'g'),
    ('Nutella', 'g'),
    ('Pistache', 'g')
  ) AS data(nome, unidade)
  WHERE NOT EXISTS (
    SELECT 1
    FROM public.insumos i
    WHERE i.user_id = v_user_id
      AND lower(trim(i.nome)) = lower(trim(data.nome))
  );

  INSERT INTO public.stock_items (user_id, nome, unidade_base, tipo, ativo)
  SELECT
    v_user_id,
    data.nome,
    data.unidade,
    'insumo'::public.stock_item_type,
    true
  FROM (VALUES
    ('Leite Condensado', 'g'),
    ('Creme de Leite', 'g'),
    ('Leite', 'ml'),
    ('Manteiga', 'g'),
    ('Chocolate 100% Cacau', 'g'),
    ('Limão', 'g'),
    ('Café', 'g'),
    ('Coco Queimado', 'g'),
    ('Nozes Pecan', 'g'),
    ('Paçoca', 'g'),
    ('Amendoim sem Sal', 'g'),
    ('Açúcar Cristal', 'g'),
    ('Oreo', 'g'),
    ('Goiabada', 'g'),
    ('Canela', 'g'),
    ('Leite Ninho', 'g'),
    ('Nutella', 'g'),
    ('Pistache', 'g')
  ) AS data(nome, unidade)
  ON CONFLICT (user_id, nome, tipo) DO UPDATE
    SET unidade_base = EXCLUDED.unidade_base,
        ativo = true,
        updated_at = now();

  INSERT INTO public.brigadeiros (
    user_id,
    nome,
    tipo,
    preco_venda,
    custo_unitario,
    descricao,
    ativo
  )
  SELECT
    v_user_id,
    data.nome,
    'gourmet',
    data.preco_venda,
    data.custo_unitario,
    NULL,
    true
  FROM (VALUES
    ('Branquinho 25g', 3.00::numeric, 0.95::numeric),
    ('Branquinho 30g', 4.00::numeric, 1.05::numeric),
    ('100% Cacau 25g', 3.00::numeric, 1.02::numeric),
    ('100% Cacau 30g', 4.00::numeric, 1.13::numeric),
    ('Limão 25g', 3.00::numeric, 0.78::numeric),
    ('Limão 30g', 4.00::numeric, 0.86::numeric),
    ('Café 25g', 3.00::numeric, 0.94::numeric),
    ('Café 30g', 4.00::numeric, 1.04::numeric),
    ('Coco Queimado 25g', 3.00::numeric, 0.99::numeric),
    ('Coco Queimado 30g', 4.00::numeric, 1.12::numeric),
    ('Nozes Pecan 25g', 3.00::numeric, 1.46::numeric),
    ('Nozes Pecan 30g', 4.00::numeric, 1.71::numeric),
    ('Paçoca 25g', 3.00::numeric, 1.03::numeric),
    ('Paçoca 30g', 4.00::numeric, 1.14::numeric),
    ('Brûlée 25g', 3.00::numeric, 0.93::numeric),
    ('Brûlée 30g', 4.00::numeric, 1.03::numeric),
    ('Oreo 25g', 3.00::numeric, 0.93::numeric),
    ('Oreo 30g', 4.00::numeric, 1.03::numeric),
    ('Cheesecake de Goiabada 25g', 3.00::numeric, 1.23::numeric),
    ('Cheesecake de Goiabada 30g', 4.00::numeric, 1.37::numeric),
    ('Churros 25g', 3.00::numeric, 0.88::numeric),
    ('Churros 30g', 4.00::numeric, 0.97::numeric),
    ('Ninho com Nutella 25g', 3.00::numeric, 1.19::numeric),
    ('Ninho com Nutella 30g', 4.00::numeric, 1.32::numeric),
    ('Pistache 25g', 3.50::numeric, 2.07::numeric),
    ('Pistache 30g', 4.50::numeric, 2.47::numeric)
  ) AS data(nome, preco_venda, custo_unitario)
  WHERE NOT EXISTS (
    SELECT 1
    FROM public.brigadeiros b
    WHERE b.user_id = v_user_id
      AND lower(trim(b.nome)) = lower(trim(data.nome))
  );

  UPDATE public.brigadeiros b
     SET preco_venda = data.preco_venda,
         custo_unitario = data.custo_unitario,
         tipo = 'gourmet',
         ativo = true,
         updated_at = now()
    FROM (VALUES
      ('Branquinho 25g', 3.00::numeric, 0.95::numeric),
      ('Branquinho 30g', 4.00::numeric, 1.05::numeric),
      ('100% Cacau 25g', 3.00::numeric, 1.02::numeric),
      ('100% Cacau 30g', 4.00::numeric, 1.13::numeric),
      ('Limão 25g', 3.00::numeric, 0.78::numeric),
      ('Limão 30g', 4.00::numeric, 0.86::numeric),
      ('Café 25g', 3.00::numeric, 0.94::numeric),
      ('Café 30g', 4.00::numeric, 1.04::numeric),
      ('Coco Queimado 25g', 3.00::numeric, 0.99::numeric),
      ('Coco Queimado 30g', 4.00::numeric, 1.12::numeric),
      ('Nozes Pecan 25g', 3.00::numeric, 1.46::numeric),
      ('Nozes Pecan 30g', 4.00::numeric, 1.71::numeric),
      ('Paçoca 25g', 3.00::numeric, 1.03::numeric),
      ('Paçoca 30g', 4.00::numeric, 1.14::numeric),
      ('Brûlée 25g', 3.00::numeric, 0.93::numeric),
      ('Brûlée 30g', 4.00::numeric, 1.03::numeric),
      ('Oreo 25g', 3.00::numeric, 0.93::numeric),
      ('Oreo 30g', 4.00::numeric, 1.03::numeric),
      ('Cheesecake de Goiabada 25g', 3.00::numeric, 1.23::numeric),
      ('Cheesecake de Goiabada 30g', 4.00::numeric, 1.37::numeric),
      ('Churros 25g', 3.00::numeric, 0.88::numeric),
      ('Churros 30g', 4.00::numeric, 0.97::numeric),
      ('Ninho com Nutella 25g', 3.00::numeric, 1.19::numeric),
      ('Ninho com Nutella 30g', 4.00::numeric, 1.32::numeric),
      ('Pistache 25g', 3.50::numeric, 2.07::numeric),
      ('Pistache 30g', 4.50::numeric, 2.47::numeric)
    ) AS data(nome, preco_venda, custo_unitario)
   WHERE b.user_id = v_user_id
     AND lower(trim(b.nome)) = lower(trim(data.nome));

  INSERT INTO public.stock_items (user_id, nome, unidade_base, tipo, ativo)
  SELECT
    v_user_id,
    data.nome,
    'un',
    'produto_final'::public.stock_item_type,
    true
  FROM (VALUES
    ('Branquinho 25g'), ('Branquinho 30g'),
    ('100% Cacau 25g'), ('100% Cacau 30g'),
    ('Limão 25g'), ('Limão 30g'),
    ('Café 25g'), ('Café 30g'),
    ('Coco Queimado 25g'), ('Coco Queimado 30g'),
    ('Nozes Pecan 25g'), ('Nozes Pecan 30g'),
    ('Paçoca 25g'), ('Paçoca 30g'),
    ('Brûlée 25g'), ('Brûlée 30g'),
    ('Oreo 25g'), ('Oreo 30g'),
    ('Cheesecake de Goiabada 25g'), ('Cheesecake de Goiabada 30g'),
    ('Churros 25g'), ('Churros 30g'),
    ('Ninho com Nutella 25g'), ('Ninho com Nutella 30g'),
    ('Pistache 25g'), ('Pistache 30g')
  ) AS data(nome)
  ON CONFLICT (user_id, nome, tipo) DO UPDATE
    SET unidade_base = 'un',
        ativo = true,
        updated_at = now();

  INSERT INTO public.stock_items (user_id, nome, unidade_base, tipo, ativo)
  SELECT
    v_user_id,
    data.nome,
    'g',
    'massa_base'::public.stock_item_type,
    true
  FROM (VALUES
    ('Branquinho'),
    ('100% Cacau'),
    ('Limão'),
    ('Café'),
    ('Coco Queimado'),
    ('Nozes Pecan'),
    ('Paçoca'),
    ('Brûlée'),
    ('Oreo'),
    ('Cheesecake de Goiabada'),
    ('Churros'),
    ('Ninho com Nutella'),
    ('Pistache')
  ) AS data(nome)
  ON CONFLICT (user_id, nome, tipo) DO UPDATE
    SET unidade_base = 'g',
        ativo = true,
        updated_at = now();

  INSERT INTO public.recipes (user_id, nome, tipo, yield_uom, ativo)
  SELECT
    v_user_id,
    data.nome,
    'massa_base'::public.recipe_type,
    'g',
    true
  FROM (VALUES
    ('Branquinho'),
    ('100% Cacau'),
    ('Limão'),
    ('Café'),
    ('Coco Queimado'),
    ('Nozes Pecan'),
    ('Paçoca'),
    ('Brûlée'),
    ('Oreo'),
    ('Cheesecake de Goiabada'),
    ('Churros'),
    ('Ninho com Nutella'),
    ('Pistache')
  ) AS data(nome)
  ON CONFLICT (user_id, nome, tipo) DO UPDATE
    SET yield_uom = 'g',
        ativo = true,
        deleted_at = NULL,
        updated_at = now();

  INSERT INTO public.recipe_versions (
    user_id,
    recipe_id,
    version_no,
    status,
    yield_qty,
    peso_total_massa_g,
    peso_unitario_base_g
  )
  SELECT
    r.user_id,
    r.id,
    1,
    'active'::public.recipe_version_status,
    510,
    510,
    30
  FROM public.recipes r
  WHERE r.user_id = v_user_id
    AND r.tipo = 'massa_base'::public.recipe_type
    AND r.nome IN (
      'Branquinho',
      '100% Cacau',
      'Limão',
      'Café',
      'Coco Queimado',
      'Nozes Pecan',
      'Paçoca',
      'Brûlée',
      'Oreo',
      'Cheesecake de Goiabada',
      'Churros',
      'Ninho com Nutella',
      'Pistache'
    )
  ON CONFLICT (recipe_id, version_no) DO UPDATE
    SET status = 'active'::public.recipe_version_status,
        yield_qty = EXCLUDED.yield_qty,
        peso_total_massa_g = EXCLUDED.peso_total_massa_g,
        peso_unitario_base_g = EXCLUDED.peso_unitario_base_g,
        updated_at = now();

  INSERT INTO public.recipe_components (
    user_id,
    recipe_version_id,
    stock_item_id,
    component_type,
    qty_per_batch,
    uom,
    waste_factor,
    sort_order
  )
  SELECT
    rv.user_id,
    rv.id,
    si.id,
    'base'::public.recipe_component_type,
    data.qty_per_batch,
    data.uom,
    0,
    data.sort_order
  FROM public.recipe_versions rv
  JOIN public.recipes r
    ON r.user_id = rv.user_id
   AND r.id = rv.recipe_id
  JOIN (VALUES
    ('Leite Condensado', 395::numeric, 'g', 1),
    ('Creme de Leite', 50::numeric, 'g', 2),
    ('Leite', 50::numeric, 'ml', 3),
    ('Manteiga', 15::numeric, 'g', 4)
  ) AS data(nome, qty_per_batch, uom, sort_order)
    ON true
  JOIN public.stock_items si
    ON si.user_id = rv.user_id
   AND si.nome = data.nome
   AND si.tipo = 'insumo'::public.stock_item_type
  WHERE rv.user_id = v_user_id
    AND rv.version_no = 1
    AND r.tipo = 'massa_base'::public.recipe_type
  ON CONFLICT (recipe_version_id, stock_item_id, component_type) DO UPDATE
    SET qty_per_batch = EXCLUDED.qty_per_batch,
        uom = EXCLUDED.uom,
        waste_factor = EXCLUDED.waste_factor,
        sort_order = EXCLUDED.sort_order,
        updated_at = now();
END $$;
