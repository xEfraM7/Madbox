-- Reemplazo del modelo block-centric por score_slots.
-- Se hace drop de blocks (sin data viva), rename block_id -> slot_id,
-- y se reemplaza el constraint/índice asociado.

-- 1. Drop la columna blocks
ALTER TABLE routine_schedules DROP COLUMN blocks;

-- 2. Nueva columna score_slots
ALTER TABLE routine_schedules
  ADD COLUMN score_slots jsonb NOT NULL DEFAULT '[]'::jsonb;

-- 3. Renombrar block_id -> slot_id
ALTER TABLE wod_logs RENAME COLUMN block_id TO slot_id;

-- 4. Reemplazar constraint
ALTER TABLE wod_logs
  DROP CONSTRAINT IF EXISTS wod_logs_member_routine_block_key;
ALTER TABLE wod_logs
  ADD CONSTRAINT wod_logs_member_routine_slot_key
  UNIQUE (member_id, routine_id, slot_id);

-- 5. Reemplazar índice
DROP INDEX IF EXISTS idx_wod_logs_routine_block;
CREATE INDEX IF NOT EXISTS idx_wod_logs_routine_slot
  ON wod_logs(routine_id, slot_id);
