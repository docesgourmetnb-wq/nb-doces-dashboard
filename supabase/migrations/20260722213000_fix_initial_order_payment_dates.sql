-- A entrada inicial do pedido deve usar a data de criação/recebimento,
-- não a data futura de entrega. Isso mantém pagamentos antes de 01/08/2026
-- no histórico comercial.

UPDATE public.transacoes t
SET data = (t.created_at AT TIME ZONE 'America/Sao_Paulo')::date
FROM public.pedidos p
WHERE t.user_id = p.user_id
  AND t.referencia = 'pedido:' || p.id::TEXT || ':pagamento:entrada'
  AND t.tipo = 'entrada'
  AND t.data = COALESCE(p.data_entrega, p.data)
  AND (t.created_at AT TIME ZONE 'America/Sao_Paulo')::date < DATE '2026-08-01';

UPDATE public.pedidos p
SET data = (t.created_at AT TIME ZONE 'America/Sao_Paulo')::date
FROM public.transacoes t
WHERE t.user_id = p.user_id
  AND t.referencia = 'pedido:' || p.id::TEXT || ':pagamento:entrada'
  AND t.tipo = 'entrada'
  AND p.data = p.data_entrega
  AND p.data_entrega >= DATE '2026-08-01'
  AND (t.created_at AT TIME ZONE 'America/Sao_Paulo')::date < DATE '2026-08-01';
