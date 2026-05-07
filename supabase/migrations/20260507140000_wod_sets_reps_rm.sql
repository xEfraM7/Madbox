-- Agregar score_type 'sets_reps_rm' (fuerza con sets x reps x %RM)
-- y la columna score_weights jsonb para almacenar el peso por cada bloque.

-- 1. Nueva columna para los pesos por bloque
ALTER TABLE wod_logs
  ADD COLUMN IF NOT EXISTS score_weights jsonb;

-- 2. Reemplazar el CHECK del enum score_type para incluir el nuevo type
ALTER TABLE wod_logs
  DROP CONSTRAINT IF EXISTS wod_logs_score_type_check;
ALTER TABLE wod_logs
  ADD CONSTRAINT wod_logs_score_type_check
  CHECK (score_type IN ('for_time', 'amrap', 'weight', 'sets_reps_rm'));

-- 3. Reemplazar el shape check con la nueva rama
ALTER TABLE wod_logs
  DROP CONSTRAINT IF EXISTS wod_logs_score_shape;
ALTER TABLE wod_logs
  ADD CONSTRAINT wod_logs_score_shape
  CHECK (
       (score_type = 'for_time'     AND score_seconds IS NOT NULL AND score_rounds IS NULL     AND score_reps IS NULL AND score_kg IS NULL     AND score_weights IS NULL)
    OR (score_type = 'amrap'        AND score_seconds IS NULL     AND score_rounds IS NOT NULL AND score_kg IS NULL     AND score_weights IS NULL)
    OR (score_type = 'weight'       AND score_seconds IS NULL     AND score_rounds IS NULL     AND score_reps IS NULL AND score_kg IS NOT NULL AND score_weights IS NULL)
    OR (score_type = 'sets_reps_rm' AND score_seconds IS NULL     AND score_rounds IS NULL     AND score_reps IS NULL AND score_kg IS NULL     AND score_weights IS NOT NULL)
  );
