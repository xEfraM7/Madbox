-- Eliminar 'for_reps' de los score_types soportados.
-- Solo quedan: for_time, amrap, weight.

-- 1. Reemplazar el CHECK del enum score_type
ALTER TABLE wod_logs
  DROP CONSTRAINT IF EXISTS wod_logs_score_type_check;
ALTER TABLE wod_logs
  ADD CONSTRAINT wod_logs_score_type_check
  CHECK (score_type IN ('for_time', 'amrap', 'weight'));

-- 2. Reemplazar el shape check sin la rama for_reps
ALTER TABLE wod_logs
  DROP CONSTRAINT IF EXISTS wod_logs_score_shape;
ALTER TABLE wod_logs
  ADD CONSTRAINT wod_logs_score_shape
  CHECK (
    (score_type = 'for_time' AND score_seconds IS NOT NULL AND score_rounds IS NULL AND score_reps IS NULL AND score_kg IS NULL)
    OR (score_type = 'amrap'  AND score_seconds IS NULL AND score_rounds IS NOT NULL AND score_kg IS NULL)
    OR (score_type = 'weight' AND score_seconds IS NULL AND score_rounds IS NULL AND score_reps IS NULL AND score_kg IS NOT NULL)
  );
