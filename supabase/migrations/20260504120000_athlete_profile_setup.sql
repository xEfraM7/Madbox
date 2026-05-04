-- Perfil de atleta: género, datos físicos, nivel, frase y toggle de privacidad

ALTER TABLE public.members
  ADD COLUMN IF NOT EXISTS gender text CHECK (gender IN ('male','female')),
  ADD COLUMN IF NOT EXISTS birth_date date,
  ADD COLUMN IF NOT EXISTS weight_kg numeric(5,2),
  ADD COLUMN IF NOT EXISTS height_cm numeric(5,1),
  ADD COLUMN IF NOT EXISTS athlete_since date,
  ADD COLUMN IF NOT EXISTS athlete_level text CHECK (athlete_level IN ('rx','scaled','beginner')),
  ADD COLUMN IF NOT EXISTS quote text,
  ADD COLUMN IF NOT EXISTS show_body_metrics boolean DEFAULT false NOT NULL;

-- Index para tab de género (Descubrir filtra por gender + discoverable)
CREATE INDEX IF NOT EXISTS members_gender_discoverable_idx
  ON public.members(gender, discoverable)
  WHERE discoverable = true AND gender IS NOT NULL;
