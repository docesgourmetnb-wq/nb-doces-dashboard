-- ============================================
-- TABELA 1: Recipientes (Pratos de Vidro)
-- ============================================
CREATE TABLE public.recipientes (
    id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
    user_id UUID NOT NULL,
    codigo TEXT NOT NULL,
    tipo_recipiente TEXT NOT NULL DEFAULT 'Prato de vidro',
    peso_vazio NUMERIC NOT NULL,
    capacidade_aproximada NUMERIC,
    foto_url TEXT,
    observacoes TEXT,
    status TEXT NOT NULL DEFAULT 'disponivel',
    created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
    updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
    CONSTRAINT recipientes_codigo_user_unique UNIQUE (user_id, codigo),
    CONSTRAINT recipientes_status_check CHECK (status IN ('disponivel', 'em_uso', 'inativo'))
);

-- Enable RLS
ALTER TABLE public.recipientes ENABLE ROW LEVEL SECURITY;

-- RLS Policies for recipientes
CREATE POLICY "Users can view own recipientes" 
ON public.recipientes FOR SELECT 
USING (auth.uid() = user_id);

CREATE POLICY "Users can insert own recipientes" 
ON public.recipientes FOR INSERT 
WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Users can update own recipientes" 
ON public.recipientes FOR UPDATE 
USING (auth.uid() = user_id);

CREATE POLICY "Users can delete own recipientes" 
ON public.recipientes FOR DELETE 
USING (auth.uid() = user_id);

-- Trigger for updated_at
CREATE TRIGGER update_recipientes_updated_at
BEFORE UPDATE ON public.recipientes
FOR EACH ROW
EXECUTE FUNCTION public.update_updated_at_column();

-- ============================================
-- TABELA 2: Massas Congeladas
-- ============================================
CREATE TABLE public.massas_congeladas (
    id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
    user_id UUID NOT NULL,
    recipiente_id UUID NOT NULL REFERENCES public.recipientes(id) ON DELETE RESTRICT,
    tipo_massa TEXT NOT NULL DEFAULT 'branco',
    peso_total NUMERIC NOT NULL,
    data_producao DATE NOT NULL DEFAULT CURRENT_DATE,
    data_congelamento DATE NOT NULL DEFAULT CURRENT_DATE,
    validade DATE NOT NULL,
    foto_url TEXT,
    status TEXT NOT NULL DEFAULT 'congelado',
    created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
    updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
    CONSTRAINT massas_tipo_check CHECK (tipo_massa IN ('branco', '100_cacau', 'outros')),
    CONSTRAINT massas_status_check CHECK (status IN ('congelado', 'em_uso', 'consumido'))
);

-- Enable RLS
ALTER TABLE public.massas_congeladas ENABLE ROW LEVEL SECURITY;

-- RLS Policies for massas_congeladas
CREATE POLICY "Users can view own massas_congeladas" 
ON public.massas_congeladas FOR SELECT 
USING (auth.uid() = user_id);

CREATE POLICY "Users can insert own massas_congeladas" 
ON public.massas_congeladas FOR INSERT 
WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Users can update own massas_congeladas" 
ON public.massas_congeladas FOR UPDATE 
USING (auth.uid() = user_id);

CREATE POLICY "Users can delete own massas_congeladas" 
ON public.massas_congeladas FOR DELETE 
USING (auth.uid() = user_id);

-- Trigger for updated_at
CREATE TRIGGER update_massas_congeladas_updated_at
BEFORE UPDATE ON public.massas_congeladas
FOR EACH ROW
EXECUTE FUNCTION public.update_updated_at_column();

-- ============================================
-- STORAGE BUCKET para fotos
-- ============================================
INSERT INTO storage.buckets (id, name, public)
VALUES ('massas-fotos', 'massas-fotos', true);

-- Storage policies
CREATE POLICY "Users can view massas-fotos"
ON storage.objects FOR SELECT
USING (bucket_id = 'massas-fotos');

CREATE POLICY "Users can upload massas-fotos"
ON storage.objects FOR INSERT
WITH CHECK (bucket_id = 'massas-fotos' AND auth.uid()::text = (storage.foldername(name))[1]);

CREATE POLICY "Users can update own massas-fotos"
ON storage.objects FOR UPDATE
USING (bucket_id = 'massas-fotos' AND auth.uid()::text = (storage.foldername(name))[1]);

CREATE POLICY "Users can delete own massas-fotos"
ON storage.objects FOR DELETE
USING (bucket_id = 'massas-fotos' AND auth.uid()::text = (storage.foldername(name))[1]);