WITH product_map AS (
  SELECT *
  FROM (
    VALUES
      ('Branquinho 25g', ARRAY['Branquinho 30g'], 0.95::numeric, 1.05::numeric, 3.00::numeric, 4.00::numeric),
      ('100% Cacau 25g', ARRAY['100% Cacau 30g'], 1.02::numeric, 1.13::numeric, 3.00::numeric, 4.00::numeric),
      ('Limão 25g', ARRAY['Limão 30g', 'Limao 30g'], 0.78::numeric, 0.86::numeric, 3.00::numeric, 4.00::numeric),
      ('Café 25g', ARRAY['Café 30g', 'Cafe 30g'], 0.94::numeric, 1.04::numeric, 3.00::numeric, 4.00::numeric),
      ('Coco Queimado 25g', ARRAY['Coco Queimado 30g', 'Coco queimado 30g'], 0.99::numeric, 1.12::numeric, 3.00::numeric, 4.00::numeric),
      ('Nozes Pecan 25g', ARRAY['Nozes Pecan 30g', 'Nozes pecan 30g', 'Nozes 30g'], 1.46::numeric, 1.71::numeric, 3.00::numeric, 4.00::numeric),
      ('Paçoca 25g', ARRAY['Paçoca 30g', 'Pacoca 30g'], 1.03::numeric, 1.14::numeric, 3.00::numeric, 4.00::numeric),
      ('Brûlée 25g', ARRAY['Brûlée 30g', 'Brulee 30g'], 0.93::numeric, 1.03::numeric, 3.00::numeric, 4.00::numeric),
      ('Oreo 25g', ARRAY['Oreo 30g'], 0.93::numeric, 1.03::numeric, 3.00::numeric, 4.00::numeric),
      ('Cheesecake de Goiabada 25g', ARRAY['Cheesecake de Goiabada 30g', 'Cheesecake com Goiabada 30g', 'Cheesecake com goiabada 30g'], 1.23::numeric, 1.37::numeric, 3.00::numeric, 4.00::numeric),
      ('Churros 25g', ARRAY['Churros 30g'], 0.88::numeric, 0.97::numeric, 3.00::numeric, 4.00::numeric),
      ('Ninho com Nutella 25g', ARRAY['Ninho com Nutella 30g'], 1.19::numeric, 1.32::numeric, 3.00::numeric, 4.00::numeric),
      ('Pistache 25g', ARRAY['Pistache 30g'], 2.07::numeric, 2.47::numeric, 3.50::numeric, 4.50::numeric)
  ) AS data(target_name, source_names, cost_25g, cost_30g, price_25g, price_30g)
),
source_products AS (
  SELECT DISTINCT ON (b.user_id, pm.target_name)
    b.user_id,
    b.id AS source_id,
    b.nome AS source_name,
    b.tipo,
    b.descricao,
    b.ativo,
    pm.target_name,
    pm.cost_25g,
    pm.cost_30g,
    pm.price_25g,
    pm.price_30g
  FROM public.brigadeiros b
  JOIN product_map pm ON b.nome = ANY(pm.source_names)
  ORDER BY b.user_id, pm.target_name, b.created_at DESC
),
updated_30g AS (
  UPDATE public.brigadeiros b
     SET preco_venda = sp.price_30g,
         custo_unitario = sp.cost_30g,
         updated_at = now()
    FROM source_products sp
   WHERE b.id = sp.source_id
  RETURNING b.id
),
updated_25g AS (
  UPDATE public.brigadeiros b
     SET tipo = sp.tipo,
         preco_venda = sp.price_25g,
         custo_unitario = sp.cost_25g,
         descricao = COALESCE(b.descricao, sp.descricao),
         ativo = sp.ativo,
         updated_at = now()
    FROM source_products sp
   WHERE b.user_id = sp.user_id
     AND b.nome = sp.target_name
  RETURNING b.id
)
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
  sp.user_id,
  sp.target_name,
  sp.tipo,
  sp.price_25g,
  sp.cost_25g,
  sp.descricao,
  sp.ativo
FROM source_products sp
WHERE NOT EXISTS (
  SELECT 1
  FROM public.brigadeiros b
  WHERE b.user_id = sp.user_id
    AND b.nome = sp.target_name
);
