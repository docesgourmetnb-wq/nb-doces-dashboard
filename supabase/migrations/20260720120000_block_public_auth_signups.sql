-- Public signups are disabled at the application layer. This database guard
-- keeps Auth closed even if someone calls the Supabase signup endpoint directly.
--
-- To authorize a future user, insert the normalized email here before creating
-- the Auth account:
--   insert into public.allowed_signup_emails (email) values ('pessoa@email.com');

CREATE TABLE IF NOT EXISTS public.allowed_signup_emails (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  email TEXT NOT NULL,
  active BOOLEAN NOT NULL DEFAULT TRUE,
  used_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  CONSTRAINT allowed_signup_emails_email_not_empty CHECK (length(trim(email)) > 0)
);

CREATE UNIQUE INDEX IF NOT EXISTS allowed_signup_emails_email_unique
  ON public.allowed_signup_emails (lower(trim(email)));

ALTER TABLE public.allowed_signup_emails ENABLE ROW LEVEL SECURITY;

REVOKE ALL ON public.allowed_signup_emails FROM anon;
REVOKE ALL ON public.allowed_signup_emails FROM authenticated;

DROP TRIGGER IF EXISTS update_allowed_signup_emails_updated_at ON public.allowed_signup_emails;
CREATE TRIGGER update_allowed_signup_emails_updated_at
  BEFORE UPDATE ON public.allowed_signup_emails
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

CREATE OR REPLACE FUNCTION public.enforce_allowed_auth_email()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_email TEXT := lower(trim(COALESCE(NEW.email, '')));
BEGIN
  IF v_email = '' THEN
    RAISE EXCEPTION 'Cadastro público desativado. Solicite acesso ao administrador.'
      USING ERRCODE = '28000';
  END IF;

  UPDATE public.allowed_signup_emails
     SET used_at = COALESCE(used_at, now()),
         updated_at = now()
   WHERE lower(trim(email)) = v_email
     AND active = TRUE
     AND used_at IS NULL;

  IF NOT FOUND THEN
    RAISE EXCEPTION 'Cadastro público desativado. Solicite acesso ao administrador.'
      USING ERRCODE = '28000';
  END IF;

  RETURN NEW;
END;
$$;

REVOKE ALL ON FUNCTION public.enforce_allowed_auth_email() FROM anon;
REVOKE ALL ON FUNCTION public.enforce_allowed_auth_email() FROM authenticated;

DROP TRIGGER IF EXISTS enforce_allowed_auth_email_before_insert ON auth.users;
CREATE TRIGGER enforce_allowed_auth_email_before_insert
  BEFORE INSERT ON auth.users
  FOR EACH ROW EXECUTE FUNCTION public.enforce_allowed_auth_email();
