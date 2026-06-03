-- Deduplicación de notificaciones de renovación.
-- Permite enviar por RANGO (hoy..hoy+3) sin reenviar el mismo aviso cada día,
-- y hace el envío robusto ante fallos del cron (si se salta un día, igual avisa).

CREATE TABLE IF NOT EXISTS public.renewal_notification_sends (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  member_id uuid NOT NULL REFERENCES public.members(id) ON DELETE CASCADE,
  expiry_date date NOT NULL,
  kind text NOT NULL CHECK (kind IN ('reminder', 'urgent')),
  sent_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE (member_id, expiry_date, kind)
);

CREATE INDEX IF NOT EXISTS renewal_notification_sends_member_idx
  ON public.renewal_notification_sends(member_id, expiry_date);

ALTER TABLE public.renewal_notification_sends ENABLE ROW LEVEL SECURITY;

-- Solo lectura para admins (monitoreo). El cron escribe con service_role, que bypassa RLS.
DROP POLICY IF EXISTS "renewal_notification_sends_admin_select" ON public.renewal_notification_sends;
CREATE POLICY "renewal_notification_sends_admin_select" ON public.renewal_notification_sends
  FOR SELECT TO authenticated
  USING (EXISTS (SELECT 1 FROM public.admins WHERE auth_user_id = auth.uid()));
