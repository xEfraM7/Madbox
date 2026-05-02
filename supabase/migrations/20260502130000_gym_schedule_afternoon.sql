-- Soporte de turno tarde para gym_schedule (CrossFit típicamente abre mañana y tarde)

ALTER TABLE public.gym_schedule
  ADD COLUMN IF NOT EXISTS afternoon_open  time,
  ADD COLUMN IF NOT EXISTS afternoon_close time;
