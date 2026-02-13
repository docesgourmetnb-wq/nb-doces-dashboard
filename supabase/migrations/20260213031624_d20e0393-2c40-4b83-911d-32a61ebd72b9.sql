
-- Trigger already exists, just ensure it's correct
DROP TRIGGER IF EXISTS update_pedidos_updated_at ON public.pedidos;
CREATE TRIGGER update_pedidos_updated_at
BEFORE UPDATE ON public.pedidos
FOR EACH ROW
EXECUTE FUNCTION public.update_updated_at_column();
