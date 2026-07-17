-- Add a first-class profile role/status model.
--
-- Existing users remain active owners so this migration does not lock anyone
-- out. Future UI and RPCs can use these helpers to gate modules/actions.

DO $$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_type WHERE typname = 'app_role') THEN
    CREATE TYPE public.app_role AS ENUM ('owner', 'admin', 'operator', 'viewer');
  END IF;
END $$;

ALTER TABLE public.profiles
  ADD COLUMN IF NOT EXISTS role public.app_role NOT NULL DEFAULT 'owner',
  ADD COLUMN IF NOT EXISTS active BOOLEAN NOT NULL DEFAULT true,
  ADD COLUMN IF NOT EXISTS permissions JSONB NOT NULL DEFAULT '{}'::jsonb;

UPDATE public.profiles
   SET role = COALESCE(role, 'owner'::public.app_role),
       active = COALESCE(active, true),
       permissions = COALESCE(permissions, '{}'::jsonb);

CREATE OR REPLACE FUNCTION public.default_permissions_for_role(p_role public.app_role)
RETURNS JSONB
LANGUAGE sql
IMMUTABLE
SET search_path = public
AS $$
  SELECT CASE p_role
    WHEN 'owner' THEN jsonb_build_object(
      'dashboard', true,
      'pedidos', true,
      'clientes', true,
      'produtos', true,
      'receitas', true,
      'estoque', true,
      'producao', true,
      'financeiro', true,
      'settings', true
    )
    WHEN 'admin' THEN jsonb_build_object(
      'dashboard', true,
      'pedidos', true,
      'clientes', true,
      'produtos', true,
      'receitas', true,
      'estoque', true,
      'producao', true,
      'financeiro', true,
      'settings', false
    )
    WHEN 'operator' THEN jsonb_build_object(
      'dashboard', true,
      'pedidos', true,
      'clientes', true,
      'produtos', true,
      'receitas', true,
      'estoque', true,
      'producao', true,
      'financeiro', false,
      'settings', false
    )
    ELSE jsonb_build_object(
      'dashboard', true,
      'pedidos', false,
      'clientes', false,
      'produtos', false,
      'receitas', false,
      'estoque', false,
      'producao', false,
      'financeiro', false,
      'settings', false
    )
  END;
$$;

UPDATE public.profiles
   SET permissions = public.default_permissions_for_role(role) || COALESCE(permissions, '{}'::jsonb);

CREATE OR REPLACE FUNCTION public.handle_new_user()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  INSERT INTO public.profiles (user_id, email, role, active, permissions)
  VALUES (
    NEW.id,
    NEW.email,
    'owner',
    true,
    public.default_permissions_for_role('owner')
  )
  ON CONFLICT (user_id) DO UPDATE
    SET email = EXCLUDED.email,
        updated_at = now();

  RETURN NEW;
END;
$$;

CREATE OR REPLACE FUNCTION public.current_user_role()
RETURNS public.app_role
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT p.role
  FROM public.profiles p
  WHERE p.user_id = auth.uid()
    AND p.active = true;
$$;

CREATE OR REPLACE FUNCTION public.current_user_can(p_module TEXT)
RETURNS BOOLEAN
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT COALESCE((
    SELECT (p.permissions ->> p_module)::BOOLEAN
    FROM public.profiles p
    WHERE p.user_id = auth.uid()
      AND p.active = true
  ), false);
$$;

DROP POLICY IF EXISTS "Users can update own profile" ON public.profiles;
CREATE POLICY "Users can update own profile details"
  ON public.profiles
  FOR UPDATE
  USING (auth.uid() = user_id)
  WITH CHECK (auth.uid() = user_id);

DROP POLICY IF EXISTS "Users can insert own profile" ON public.profiles;

REVOKE INSERT ON public.profiles FROM authenticated;
REVOKE UPDATE ON public.profiles FROM authenticated;
GRANT UPDATE (nome, email) ON public.profiles TO authenticated;

REVOKE ALL ON FUNCTION public.default_permissions_for_role(public.app_role) FROM PUBLIC;
REVOKE ALL ON FUNCTION public.current_user_role() FROM PUBLIC;
REVOKE ALL ON FUNCTION public.current_user_can(TEXT) FROM PUBLIC;

GRANT EXECUTE ON FUNCTION public.current_user_role() TO authenticated;
GRANT EXECUTE ON FUNCTION public.current_user_can(TEXT) TO authenticated;
