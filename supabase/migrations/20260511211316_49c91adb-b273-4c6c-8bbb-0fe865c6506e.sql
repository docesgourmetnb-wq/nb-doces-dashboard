-- Stock items (referenced by recipe_components)
CREATE TABLE public.stock_items (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  user_id UUID NOT NULL,
  nome TEXT NOT NULL,
  unidade_base TEXT NOT NULL DEFAULT 'un',
  tipo TEXT NOT NULL DEFAULT 'insumo' CHECK (tipo IN ('insumo','massa_base','produto_final')),
  ativo BOOLEAN NOT NULL DEFAULT true,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
ALTER TABLE public.stock_items ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Users can view own stock_items" ON public.stock_items FOR SELECT TO authenticated USING (auth.uid() = user_id);
CREATE POLICY "Users can insert own stock_items" ON public.stock_items FOR INSERT TO authenticated WITH CHECK (auth.uid() = user_id);
CREATE POLICY "Users can update own stock_items" ON public.stock_items FOR UPDATE TO authenticated USING (auth.uid() = user_id);
CREATE POLICY "Users can delete own stock_items" ON public.stock_items FOR DELETE TO authenticated USING (auth.uid() = user_id);
CREATE TRIGGER stock_items_updated_at BEFORE UPDATE ON public.stock_items FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

-- Recipes
CREATE TABLE public.recipes (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  user_id UUID NOT NULL,
  nome TEXT NOT NULL,
  tipo TEXT NOT NULL DEFAULT 'consumo' CHECK (tipo IN ('consumo','massa_base','produto_final')),
  yield_uom TEXT NOT NULL DEFAULT 'lote',
  ativo BOOLEAN NOT NULL DEFAULT true,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
ALTER TABLE public.recipes ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Users can view own recipes" ON public.recipes FOR SELECT TO authenticated USING (auth.uid() = user_id);
CREATE POLICY "Users can insert own recipes" ON public.recipes FOR INSERT TO authenticated WITH CHECK (auth.uid() = user_id);
CREATE POLICY "Users can update own recipes" ON public.recipes FOR UPDATE TO authenticated USING (auth.uid() = user_id);
CREATE POLICY "Users can delete own recipes" ON public.recipes FOR DELETE TO authenticated USING (auth.uid() = user_id);
CREATE TRIGGER recipes_updated_at BEFORE UPDATE ON public.recipes FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

-- Recipe versions
CREATE TABLE public.recipe_versions (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  user_id UUID NOT NULL,
  recipe_id UUID NOT NULL REFERENCES public.recipes(id) ON DELETE CASCADE,
  version_no INTEGER NOT NULL DEFAULT 1,
  status TEXT NOT NULL DEFAULT 'draft' CHECK (status IN ('draft','active','archived')),
  yield_qty NUMERIC NOT NULL DEFAULT 0,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  UNIQUE (recipe_id, version_no)
);
ALTER TABLE public.recipe_versions ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Users can view own recipe_versions" ON public.recipe_versions FOR SELECT TO authenticated USING (auth.uid() = user_id);
CREATE POLICY "Users can insert own recipe_versions" ON public.recipe_versions FOR INSERT TO authenticated WITH CHECK (auth.uid() = user_id);
CREATE POLICY "Users can update own recipe_versions" ON public.recipe_versions FOR UPDATE TO authenticated USING (auth.uid() = user_id);
CREATE POLICY "Users can delete own recipe_versions" ON public.recipe_versions FOR DELETE TO authenticated USING (auth.uid() = user_id);
CREATE TRIGGER recipe_versions_updated_at BEFORE UPDATE ON public.recipe_versions FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

-- Recipe components
CREATE TABLE public.recipe_components (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  user_id UUID NOT NULL,
  recipe_version_id UUID NOT NULL REFERENCES public.recipe_versions(id) ON DELETE CASCADE,
  stock_item_id UUID NOT NULL REFERENCES public.stock_items(id) ON DELETE RESTRICT,
  qty_per_batch NUMERIC NOT NULL DEFAULT 0,
  uom TEXT NOT NULL DEFAULT 'un',
  component_type TEXT NOT NULL DEFAULT 'base' CHECK (component_type IN ('base','adicional','embalagem','perda_planejada')),
  waste_factor NUMERIC NOT NULL DEFAULT 0 CHECK (waste_factor >= 0 AND waste_factor < 1),
  sort_order INTEGER NOT NULL DEFAULT 0,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
ALTER TABLE public.recipe_components ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Users can view own recipe_components" ON public.recipe_components FOR SELECT TO authenticated USING (auth.uid() = user_id);
CREATE POLICY "Users can insert own recipe_components" ON public.recipe_components FOR INSERT TO authenticated WITH CHECK (auth.uid() = user_id);
CREATE POLICY "Users can update own recipe_components" ON public.recipe_components FOR UPDATE TO authenticated USING (auth.uid() = user_id);
CREATE POLICY "Users can delete own recipe_components" ON public.recipe_components FOR DELETE TO authenticated USING (auth.uid() = user_id);
CREATE TRIGGER recipe_components_updated_at BEFORE UPDATE ON public.recipe_components FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

CREATE INDEX idx_recipe_versions_recipe ON public.recipe_versions(recipe_id);
CREATE INDEX idx_recipe_components_version ON public.recipe_components(recipe_version_id);
CREATE INDEX idx_stock_items_user ON public.stock_items(user_id);