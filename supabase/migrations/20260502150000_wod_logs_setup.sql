-- WOD logs + toggle show_wods en members

-- 1. Tabla wod_logs
CREATE TABLE IF NOT EXISTS public.wod_logs (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  member_id uuid NOT NULL REFERENCES public.members(id) ON DELETE CASCADE,
  routine_id uuid NOT NULL REFERENCES public.routines(id) ON DELETE CASCADE,
  date date NOT NULL CHECK (date <= current_date),
  score_type text NOT NULL CHECK (score_type IN ('for_time','amrap','for_reps','weight')),
  score_seconds integer CHECK (score_seconds IS NULL OR score_seconds > 0),
  score_rounds  integer CHECK (score_rounds  IS NULL OR score_rounds  >= 0),
  score_reps    integer CHECK (score_reps    IS NULL OR score_reps    >= 0),
  score_kg      numeric(6,2) CHECK (score_kg IS NULL OR (score_kg > 0 AND score_kg <= 500)),
  rx boolean NOT NULL DEFAULT false,
  notes text,
  created_at timestamptz DEFAULT now(),
  updated_at timestamptz DEFAULT now(),
  UNIQUE (member_id, routine_id, date),
  CONSTRAINT wod_logs_score_shape CHECK (
    (score_type = 'for_time' AND score_seconds IS NOT NULL AND score_rounds IS NULL AND score_reps IS NULL AND score_kg IS NULL)
    OR (score_type = 'amrap'    AND score_seconds IS NULL AND score_rounds IS NOT NULL AND score_kg IS NULL)
    OR (score_type = 'for_reps' AND score_seconds IS NULL AND score_rounds IS NULL AND score_reps IS NOT NULL AND score_kg IS NULL)
    OR (score_type = 'weight'   AND score_seconds IS NULL AND score_rounds IS NULL AND score_reps IS NULL AND score_kg IS NOT NULL)
  )
);

CREATE INDEX IF NOT EXISTS wod_logs_member_date_idx ON public.wod_logs (member_id, date DESC);
CREATE INDEX IF NOT EXISTS wod_logs_routine_date_idx ON public.wod_logs (routine_id, date DESC);

-- 2. RLS
ALTER TABLE public.wod_logs ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "wod_logs_self_or_admin_select" ON public.wod_logs;
CREATE POLICY "wod_logs_self_or_admin_select" ON public.wod_logs
  FOR SELECT TO authenticated
  USING (
    EXISTS (SELECT 1 FROM public.admins WHERE auth_user_id = auth.uid())
    OR member_id IN (SELECT id FROM public.members WHERE auth_user_id = auth.uid())
  );

DROP POLICY IF EXISTS "wod_logs_own_write" ON public.wod_logs;
CREATE POLICY "wod_logs_own_write" ON public.wod_logs
  FOR ALL TO authenticated
  USING (member_id IN (SELECT id FROM public.members WHERE auth_user_id = auth.uid()))
  WITH CHECK (member_id IN (SELECT id FROM public.members WHERE auth_user_id = auth.uid()));

-- 3. Toggle show_wods en members
ALTER TABLE public.members
  ADD COLUMN IF NOT EXISTS show_wods boolean NOT NULL DEFAULT true;
