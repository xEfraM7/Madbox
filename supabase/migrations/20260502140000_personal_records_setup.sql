-- Personal records (RMs) + visibility toggles en members

-- 1. Tabla personal_records
CREATE TABLE IF NOT EXISTS public.personal_records (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  member_id uuid NOT NULL REFERENCES public.members(id) ON DELETE CASCADE,
  movement text NOT NULL CHECK (movement IN (
    'snatch','power_snatch','hang_squat_snatch','hang_power_snatch',
    'clean','power_clean','hang_squat_clean','hang_power_clean','clean_and_jerk',
    'back_squat','front_squat','overhead_squat',
    'push_press','push_jerk','split_jerk',
    'deadlift','thruster'
  )),
  weight_kg numeric(5,2) NOT NULL CHECK (weight_kg > 0 AND weight_kg <= 500),
  achieved_at date CHECK (achieved_at <= current_date),
  created_at timestamptz DEFAULT now(),
  updated_at timestamptz DEFAULT now(),
  UNIQUE (member_id, movement)
);

CREATE INDEX IF NOT EXISTS personal_records_member_id_idx ON public.personal_records(member_id);

-- 2. RLS personal_records
ALTER TABLE public.personal_records ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "personal_records_self_or_admin_select" ON public.personal_records;
CREATE POLICY "personal_records_self_or_admin_select" ON public.personal_records
  FOR SELECT TO authenticated
  USING (
    EXISTS (SELECT 1 FROM public.admins WHERE auth_user_id = auth.uid())
    OR member_id IN (SELECT id FROM public.members WHERE auth_user_id = auth.uid())
  );

DROP POLICY IF EXISTS "personal_records_own_write" ON public.personal_records;
CREATE POLICY "personal_records_own_write" ON public.personal_records
  FOR ALL TO authenticated
  USING (member_id IN (SELECT id FROM public.members WHERE auth_user_id = auth.uid()))
  WITH CHECK (member_id IN (SELECT id FROM public.members WHERE auth_user_id = auth.uid()));

-- 3. Toggles de visibilidad en members
ALTER TABLE public.members
  ADD COLUMN IF NOT EXISTS discoverable boolean NOT NULL DEFAULT true,
  ADD COLUMN IF NOT EXISTS show_plan boolean NOT NULL DEFAULT true,
  ADD COLUMN IF NOT EXISTS show_avatar boolean NOT NULL DEFAULT true,
  ADD COLUMN IF NOT EXISTS show_rms boolean NOT NULL DEFAULT true;

CREATE INDEX IF NOT EXISTS members_discoverable_idx ON public.members(discoverable) WHERE discoverable = true;
