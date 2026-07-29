UPDATE public.insumos i
SET
  quantidade_atual = 3200,
  preco_unitario = 0
WHERE lower(i.nome) = 'creme de leite'
  AND i.unidade = 'g'
  AND i.quantidade_atual = 3210
  AND i.preco_unitario = 0.20
  AND EXISTS (
    SELECT 1
    FROM public.insumo_purchase_entries e
    WHERE e.user_id = i.user_id
      AND e.insumo_id = i.id
      AND e.conteudo_por_embalagem = 200
      AND e.quantidade = 3400
      AND e.valor_total = 0
  )
  AND NOT EXISTS (
    SELECT 1
    FROM public.insumo_purchase_entries e
    WHERE e.user_id = i.user_id
      AND e.insumo_id = i.id
      AND e.valor_total > 0
  );
