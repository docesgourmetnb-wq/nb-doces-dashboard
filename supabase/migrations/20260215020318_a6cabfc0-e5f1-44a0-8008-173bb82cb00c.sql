
-- Add cliente_id column to pedidos
ALTER TABLE public.pedidos
ADD COLUMN cliente_id uuid NULL REFERENCES public.clientes(id) ON DELETE SET NULL;

-- Create index for performance
CREATE INDEX idx_pedidos_cliente_id ON public.pedidos(cliente_id);
