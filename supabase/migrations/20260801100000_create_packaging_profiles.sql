CREATE TABLE IF NOT EXISTS public.packaging_profiles (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL,
  nome TEXT NOT NULL,
  observacoes TEXT,
  ativo BOOLEAN NOT NULL DEFAULT true,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  CONSTRAINT packaging_profiles_nome_check CHECK (length(btrim(nome)) > 0 AND length(nome) <= 120)
);

CREATE UNIQUE INDEX IF NOT EXISTS packaging_profiles_user_nome_unique
  ON public.packaging_profiles (user_id, lower(btrim(nome)))
  WHERE ativo;

CREATE INDEX IF NOT EXISTS idx_packaging_profiles_user_active
  ON public.packaging_profiles (user_id, ativo, nome);

CREATE TABLE IF NOT EXISTS public.packaging_profile_items (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL,
  profile_id UUID NOT NULL REFERENCES public.packaging_profiles(id) ON DELETE CASCADE,
  insumo_id UUID NOT NULL REFERENCES public.insumos(id) ON DELETE RESTRICT,
  quantidade_por_pedido NUMERIC NOT NULL,
  observacoes TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  CONSTRAINT packaging_profile_items_quantidade_check CHECK (quantidade_por_pedido > 0)
);

CREATE UNIQUE INDEX IF NOT EXISTS packaging_profile_items_profile_insumo_unique
  ON public.packaging_profile_items (profile_id, insumo_id);

CREATE INDEX IF NOT EXISTS idx_packaging_profile_items_user_profile
  ON public.packaging_profile_items (user_id, profile_id);

ALTER TABLE public.packaging_profiles ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.packaging_profile_items ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Users can view own packaging profiles" ON public.packaging_profiles;
CREATE POLICY "Users can view own packaging profiles"
  ON public.packaging_profiles
  FOR SELECT
  USING (auth.uid() = user_id);

DROP POLICY IF EXISTS "Users can insert own packaging profiles" ON public.packaging_profiles;
CREATE POLICY "Users can insert own packaging profiles"
  ON public.packaging_profiles
  FOR INSERT
  WITH CHECK (auth.uid() = user_id);

DROP POLICY IF EXISTS "Users can update own packaging profiles" ON public.packaging_profiles;
CREATE POLICY "Users can update own packaging profiles"
  ON public.packaging_profiles
  FOR UPDATE
  USING (auth.uid() = user_id)
  WITH CHECK (auth.uid() = user_id);

DROP POLICY IF EXISTS "Users can delete own packaging profiles" ON public.packaging_profiles;
CREATE POLICY "Users can delete own packaging profiles"
  ON public.packaging_profiles
  FOR DELETE
  USING (auth.uid() = user_id);

DROP POLICY IF EXISTS "Users can view own packaging profile items" ON public.packaging_profile_items;
CREATE POLICY "Users can view own packaging profile items"
  ON public.packaging_profile_items
  FOR SELECT
  USING (auth.uid() = user_id);

DROP POLICY IF EXISTS "Users can insert own packaging profile items" ON public.packaging_profile_items;
CREATE POLICY "Users can insert own packaging profile items"
  ON public.packaging_profile_items
  FOR INSERT
  WITH CHECK (
    auth.uid() = user_id
    AND EXISTS (
      SELECT 1
      FROM public.packaging_profiles profile
      WHERE profile.id = packaging_profile_items.profile_id
        AND profile.user_id = packaging_profile_items.user_id
    )
    AND EXISTS (
      SELECT 1
      FROM public.insumos insumo
      WHERE insumo.id = packaging_profile_items.insumo_id
        AND insumo.user_id = packaging_profile_items.user_id
        AND insumo.tipo_estoque = 'embalagem'
    )
  );

DROP POLICY IF EXISTS "Users can update own packaging profile items" ON public.packaging_profile_items;
CREATE POLICY "Users can update own packaging profile items"
  ON public.packaging_profile_items
  FOR UPDATE
  USING (auth.uid() = user_id)
  WITH CHECK (
    auth.uid() = user_id
    AND EXISTS (
      SELECT 1
      FROM public.packaging_profiles profile
      WHERE profile.id = packaging_profile_items.profile_id
        AND profile.user_id = packaging_profile_items.user_id
    )
    AND EXISTS (
      SELECT 1
      FROM public.insumos insumo
      WHERE insumo.id = packaging_profile_items.insumo_id
        AND insumo.user_id = packaging_profile_items.user_id
        AND insumo.tipo_estoque = 'embalagem'
    )
  );

DROP POLICY IF EXISTS "Users can delete own packaging profile items" ON public.packaging_profile_items;
CREATE POLICY "Users can delete own packaging profile items"
  ON public.packaging_profile_items
  FOR DELETE
  USING (auth.uid() = user_id);

DROP TRIGGER IF EXISTS update_packaging_profiles_updated_at ON public.packaging_profiles;
CREATE TRIGGER update_packaging_profiles_updated_at
  BEFORE UPDATE ON public.packaging_profiles
  FOR EACH ROW
  EXECUTE FUNCTION public.update_updated_at_column();

DROP TRIGGER IF EXISTS update_packaging_profile_items_updated_at ON public.packaging_profile_items;
CREATE TRIGGER update_packaging_profile_items_updated_at
  BEFORE UPDATE ON public.packaging_profile_items
  FOR EACH ROW
  EXECUTE FUNCTION public.update_updated_at_column();
