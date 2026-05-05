-- Policies de escritura para routine_schedules y routine_schedule_plans
-- Sigue el patrón de plans/members/payments: solo admins pueden escribir.

-- routine_schedules
CREATE POLICY "Admins can insert routine_schedules"
  ON routine_schedules FOR INSERT TO authenticated
  WITH CHECK (is_admin());

CREATE POLICY "Admins can update routine_schedules"
  ON routine_schedules FOR UPDATE TO authenticated
  USING (is_admin())
  WITH CHECK (is_admin());

CREATE POLICY "Admins can delete routine_schedules"
  ON routine_schedules FOR DELETE TO authenticated
  USING (is_admin());

-- routine_schedule_plans
CREATE POLICY "Admins can insert routine_schedule_plans"
  ON routine_schedule_plans FOR INSERT TO authenticated
  WITH CHECK (is_admin());

CREATE POLICY "Admins can update routine_schedule_plans"
  ON routine_schedule_plans FOR UPDATE TO authenticated
  USING (is_admin())
  WITH CHECK (is_admin());

CREATE POLICY "Admins can delete routine_schedule_plans"
  ON routine_schedule_plans FOR DELETE TO authenticated
  USING (is_admin());
