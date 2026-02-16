
-- Create audit_log table
CREATE TABLE public.audit_log (
  id uuid NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  user_id uuid NOT NULL,
  entity_type text NOT NULL,
  entity_id uuid NOT NULL,
  action text NOT NULL,
  metadata jsonb NULL,
  created_at timestamptz NOT NULL DEFAULT now()
);

-- Enable RLS
ALTER TABLE public.audit_log ENABLE ROW LEVEL SECURITY;

-- Users can view their own audit logs
CREATE POLICY "Users can view own audit_log"
  ON public.audit_log FOR SELECT
  USING (auth.uid() = user_id);

-- Users can insert their own audit logs
CREATE POLICY "Users can insert own audit_log"
  ON public.audit_log FOR INSERT
  WITH CHECK (auth.uid() = user_id);

-- Index for efficient querying by entity
CREATE INDEX idx_audit_log_entity ON public.audit_log(entity_type, entity_id);
CREATE INDEX idx_audit_log_user ON public.audit_log(user_id);
