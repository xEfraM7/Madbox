-- WOD logging dinámico: bloques estructurados en routine_schedules
-- y block_id en wod_logs para soportar múltiples scores por rutina.

-- 1. Bloques estructurados en routine_schedules
ALTER TABLE routine_schedules
  ADD COLUMN blocks jsonb NOT NULL DEFAULT '[]'::jsonb;

-- 2. block_id en wod_logs
ALTER TABLE wod_logs
  ADD COLUMN block_id text NOT NULL DEFAULT '';

-- 3. Reemplazar la unicidad (member, routine, date) por (member, routine, block)
ALTER TABLE wod_logs
  DROP CONSTRAINT IF EXISTS wod_logs_member_id_routine_id_date_key;
ALTER TABLE wod_logs
  DROP CONSTRAINT IF EXISTS wod_logs_member_routine_date_key;

ALTER TABLE wod_logs
  ADD CONSTRAINT wod_logs_member_routine_block_key
  UNIQUE (member_id, routine_id, block_id);

-- 4. Índice de soporte para leaderboard
CREATE INDEX IF NOT EXISTS idx_wod_logs_routine_block
  ON wod_logs(routine_id, block_id);
