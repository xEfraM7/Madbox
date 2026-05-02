-- Rutinas y asignaciones por (plan, día de semana)

-- 1. Tabla routines: biblioteca de rutinas reutilizables
CREATE TABLE IF NOT EXISTS public.routines (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  name text NOT NULL,
  content text NOT NULL DEFAULT '',
  created_at timestamptz DEFAULT now(),
  updated_at timestamptz DEFAULT now()
);

-- 2. Tabla routine_assignments: una rutina por (plan, día)
CREATE TABLE IF NOT EXISTS public.routine_assignments (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  plan_id uuid NOT NULL REFERENCES public.plans(id) ON DELETE CASCADE,
  routine_id uuid NOT NULL REFERENCES public.routines(id) ON DELETE CASCADE,
  day_of_week text NOT NULL CHECK (day_of_week IN
    ('Lunes','Martes','Miércoles','Jueves','Viernes','Sábado','Domingo')),
  created_at timestamptz DEFAULT now(),
  updated_at timestamptz DEFAULT now(),
  UNIQUE (plan_id, day_of_week)
);

CREATE INDEX IF NOT EXISTS routine_assignments_plan_id_idx ON public.routine_assignments(plan_id);
CREATE INDEX IF NOT EXISTS routine_assignments_routine_id_idx ON public.routine_assignments(routine_id);
CREATE INDEX IF NOT EXISTS routine_assignments_day_idx ON public.routine_assignments(day_of_week);

-- 3. RLS: routines
ALTER TABLE public.routines ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "routines_select_authenticated" ON public.routines;
CREATE POLICY "routines_select_authenticated" ON public.routines
  FOR SELECT TO authenticated
  USING (true);

DROP POLICY IF EXISTS "routines_admin_write" ON public.routines;
CREATE POLICY "routines_admin_write" ON public.routines
  FOR ALL TO authenticated
  USING (EXISTS (SELECT 1 FROM public.admins WHERE auth_user_id = auth.uid()))
  WITH CHECK (EXISTS (SELECT 1 FROM public.admins WHERE auth_user_id = auth.uid()));

-- 4. RLS: routine_assignments
ALTER TABLE public.routine_assignments ENABLE ROW LEVEL SECURITY;

-- Admins ven todas; miembros solo las de su plan
DROP POLICY IF EXISTS "routine_assignments_select" ON public.routine_assignments;
CREATE POLICY "routine_assignments_select" ON public.routine_assignments
  FOR SELECT TO authenticated
  USING (
    EXISTS (SELECT 1 FROM public.admins WHERE auth_user_id = auth.uid())
    OR plan_id IN (SELECT plan_id FROM public.members WHERE auth_user_id = auth.uid())
  );

DROP POLICY IF EXISTS "routine_assignments_admin_write" ON public.routine_assignments;
CREATE POLICY "routine_assignments_admin_write" ON public.routine_assignments
  FOR ALL TO authenticated
  USING (EXISTS (SELECT 1 FROM public.admins WHERE auth_user_id = auth.uid()))
  WITH CHECK (EXISTS (SELECT 1 FROM public.admins WHERE auth_user_id = auth.uid()));
