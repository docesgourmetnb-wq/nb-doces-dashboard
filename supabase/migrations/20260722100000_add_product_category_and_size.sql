ALTER TABLE public.brigadeiros
  ADD COLUMN IF NOT EXISTS categoria TEXT NOT NULL DEFAULT 'brigadeiro',
  ADD COLUMN IF NOT EXISTS tamanho_g NUMERIC NULL;

ALTER TABLE public.brigadeiros
  DROP CONSTRAINT IF EXISTS brigadeiros_categoria_check;

ALTER TABLE public.brigadeiros
  ADD CONSTRAINT brigadeiros_categoria_check
  CHECK (categoria IN ('brigadeiro', 'bolo'));

UPDATE public.brigadeiros
   SET categoria = 'brigadeiro',
       tamanho_g = COALESCE(
         tamanho_g,
         NULLIF(
           replace(
             substring(nome from '([0-9]+(?:[,.][0-9]+)?)\s*g$'),
             ',',
             '.'
           ),
           ''
         )::numeric
       )
 WHERE categoria = 'brigadeiro';
