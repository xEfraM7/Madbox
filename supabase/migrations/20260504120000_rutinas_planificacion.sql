-- Reemplaza el modelo de horarios/rutinas semanales por planificación por fecha.
-- 1. Limpiar wod_logs antes del DROP por FK
TRUNCATE TABLE wod_logs CASCADE;

-- 2. Drop modelo viejo
DROP TABLE IF EXISTS routine_assignments CASCADE;
DROP TABLE IF EXISTS routines CASCADE;
DROP TABLE IF EXISTS gym_schedule CASCADE;

-- 3. Tablas nuevas
CREATE TABLE routine_schedules (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  date date NOT NULL,
  name text,
  content text NOT NULL DEFAULT '',
  created_at timestamptz DEFAULT now(),
  updated_at timestamptz DEFAULT now()
);
CREATE INDEX idx_routine_schedules_date ON routine_schedules(date);

CREATE TABLE routine_schedule_plans (
  schedule_id uuid REFERENCES routine_schedules(id) ON DELETE CASCADE,
  plan_id uuid REFERENCES plans(id) ON DELETE CASCADE,
  PRIMARY KEY (schedule_id, plan_id)
);
CREATE INDEX idx_rsp_plan ON routine_schedule_plans(plan_id);

-- 4. Re-vincular wod_logs al nuevo modelo (vacía por TRUNCATE)
ALTER TABLE wod_logs
  DROP CONSTRAINT IF EXISTS wod_logs_routine_id_fkey,
  ADD CONSTRAINT wod_logs_routine_id_fkey
    FOREIGN KEY (routine_id) REFERENCES routine_schedules(id) ON DELETE CASCADE;

-- 5. Renombrar permisos en roles existentes
UPDATE roles
SET permissions = ARRAY(
  SELECT CASE
    WHEN p = 'schedule.view'   THEN 'routines.view'
    WHEN p = 'schedule.edit'   THEN 'routines.edit'
    WHEN p = 'schedule.delete' THEN 'routines.delete'
    ELSE p
  END
  FROM unnest(permissions) AS p
);

-- 6. RLS
ALTER TABLE routine_schedules ENABLE ROW LEVEL SECURITY;
ALTER TABLE routine_schedule_plans ENABLE ROW LEVEL SECURITY;

CREATE POLICY "auth read routine_schedules"
  ON routine_schedules FOR SELECT TO authenticated USING (true);
CREATE POLICY "auth read routine_schedule_plans"
  ON routine_schedule_plans FOR SELECT TO authenticated USING (true);
