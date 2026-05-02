-- Agregar columna blocks (jsonb) a routines y migrar contenido legacy

-- 1. Columna nueva
ALTER TABLE public.routines
  ADD COLUMN IF NOT EXISTS blocks jsonb NOT NULL DEFAULT '[]'::jsonb;

-- 2. Migración M1: convertir content existente a un único bloque tipo 'notes'
UPDATE public.routines
SET blocks = jsonb_build_array(
  jsonb_build_object(
    'id', gen_random_uuid()::text,
    'order', 0,
    'type', 'notes',
    'text', content
  )
)
WHERE content IS NOT NULL
  AND content <> ''
  AND blocks = '[]'::jsonb;

-- 3. La columna content se mantiene por compatibilidad. Una migración
--    posterior la dropeará cuando confirmemos que nada la lee.

-- 4. Índice GIN sobre blocks para queries futuras (no usado todavía pero útil)
CREATE INDEX IF NOT EXISTS routines_blocks_gin_idx ON public.routines USING gin (blocks);
