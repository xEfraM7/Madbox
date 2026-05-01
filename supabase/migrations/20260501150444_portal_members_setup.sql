-- Portal de miembros: columnas auth, RLS y políticas

-- 1. Nuevas columnas en members
ALTER TABLE public.members
  ADD COLUMN IF NOT EXISTS auth_user_id uuid REFERENCES auth.users(id) ON DELETE SET NULL,
  ADD COLUMN IF NOT EXISTS avatar_url text,
  ADD COLUMN IF NOT EXISTS must_change_password boolean DEFAULT true;

CREATE UNIQUE INDEX IF NOT EXISTS members_auth_user_id_key
  ON public.members(auth_user_id) WHERE auth_user_id IS NOT NULL;

-- 2. RLS: members lee/edita su propia fila
ALTER TABLE public.members ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "members_select_own" ON public.members;
CREATE POLICY "members_select_own" ON public.members
  FOR SELECT TO authenticated
  USING (auth_user_id = auth.uid());

DROP POLICY IF EXISTS "members_update_own" ON public.members;
CREATE POLICY "members_update_own" ON public.members
  FOR UPDATE TO authenticated
  USING (auth_user_id = auth.uid())
  WITH CHECK (auth_user_id = auth.uid());

-- 3. RLS: payments — el miembro lee solo sus pagos
ALTER TABLE public.payments ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "payments_select_own" ON public.payments;
CREATE POLICY "payments_select_own" ON public.payments
  FOR SELECT TO authenticated
  USING (member_id IN (SELECT id FROM public.members WHERE auth_user_id = auth.uid()));

-- 4. RLS: special_class_payments — el miembro lee sus inscripciones
ALTER TABLE public.special_class_payments ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "scp_select_own" ON public.special_class_payments;
CREATE POLICY "scp_select_own" ON public.special_class_payments
  FOR SELECT TO authenticated
  USING (member_id IN (SELECT id FROM public.members WHERE auth_user_id = auth.uid()));

-- 5. RLS: catálogos abiertos a authenticated
ALTER TABLE public.special_classes ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "special_classes_select_all" ON public.special_classes;
CREATE POLICY "special_classes_select_all" ON public.special_classes
  FOR SELECT TO authenticated USING (true);

ALTER TABLE public.plans ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "plans_select_all" ON public.plans;
CREATE POLICY "plans_select_all" ON public.plans
  FOR SELECT TO authenticated USING (true);
