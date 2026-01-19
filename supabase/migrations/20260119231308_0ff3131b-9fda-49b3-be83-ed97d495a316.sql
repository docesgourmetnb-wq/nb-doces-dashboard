-- 1. Tornar bucket privado para segurança
UPDATE storage.buckets 
SET public = false 
WHERE id = 'massas-fotos';

-- 2. Adicionar CHECK constraints para validação server-side

-- brigadeiros: preços e custos não-negativos, nome com limite
ALTER TABLE public.brigadeiros 
ADD CONSTRAINT brigadeiros_preco_venda_positive CHECK (preco_venda >= 0),
ADD CONSTRAINT brigadeiros_custo_unitario_positive CHECK (custo_unitario >= 0),
ADD CONSTRAINT brigadeiros_nome_length CHECK (length(nome) > 0 AND length(nome) <= 200);

-- pedidos: valor total não-negativo, cliente com limite
ALTER TABLE public.pedidos
ADD CONSTRAINT pedidos_valor_total_positive CHECK (valor_total >= 0),
ADD CONSTRAINT pedidos_cliente_length CHECK (length(cliente) > 0 AND length(cliente) <= 200);

-- insumos: quantidade e preço não-negativos, nome com limite
ALTER TABLE public.insumos
ADD CONSTRAINT insumos_quantidade_atual_nonnegative CHECK (quantidade_atual >= 0),
ADD CONSTRAINT insumos_preco_unitario_positive CHECK (preco_unitario >= 0),
ADD CONSTRAINT insumos_nome_length CHECK (length(nome) > 0 AND length(nome) <= 200);

-- massas_congeladas: peso positivo
ALTER TABLE public.massas_congeladas
ADD CONSTRAINT massas_peso_total_positive CHECK (peso_total > 0);

-- recipientes: peso positivo, código com limite
ALTER TABLE public.recipientes
ADD CONSTRAINT recipientes_peso_vazio_positive CHECK (peso_vazio > 0),
ADD CONSTRAINT recipientes_codigo_length CHECK (length(codigo) > 0 AND length(codigo) <= 50);

-- transacoes: valor não-negativo, descrição com limite
ALTER TABLE public.transacoes
ADD CONSTRAINT transacoes_valor_positive CHECK (valor >= 0),
ADD CONSTRAINT transacoes_descricao_length CHECK (length(descricao) > 0 AND length(descricao) <= 500);

-- clientes: nome com limite
ALTER TABLE public.clientes
ADD CONSTRAINT clientes_nome_length CHECK (length(nome) > 0 AND length(nome) <= 200);