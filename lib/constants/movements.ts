export type MovementId =
  | 'snatch' | 'power_snatch' | 'hang_squat_snatch' | 'hang_power_snatch'
  | 'clean' | 'power_clean' | 'hang_squat_clean' | 'hang_power_clean' | 'clean_and_jerk'
  | 'back_squat' | 'front_squat' | 'overhead_squat'
  | 'push_press' | 'push_jerk' | 'split_jerk'
  | 'deadlift'
  | 'thruster'

export type MovementFamily = 'olympic' | 'squat' | 'press' | 'pull' | 'hybrid'

export interface Movement {
  id: MovementId
  label: string
  family: MovementFamily
  inOlympicTotal?: boolean
  inSquatTotal?: boolean
  inPressTotal?: boolean
}

export const MOVEMENTS: Movement[] = [
  { id: 'snatch', label: 'Snatch', family: 'olympic', inOlympicTotal: true },
  { id: 'power_snatch', label: 'Power Snatch', family: 'olympic' },
  { id: 'hang_squat_snatch', label: 'Hang Squat Snatch', family: 'olympic' },
  { id: 'hang_power_snatch', label: 'Hang Power Snatch', family: 'olympic' },
  { id: 'clean', label: 'Clean', family: 'olympic' },
  { id: 'power_clean', label: 'Power Clean', family: 'olympic' },
  { id: 'hang_squat_clean', label: 'Hang Squat Clean', family: 'olympic' },
  { id: 'hang_power_clean', label: 'Hang Power Clean', family: 'olympic' },
  { id: 'clean_and_jerk', label: 'Clean & Jerk', family: 'olympic', inOlympicTotal: true },
  { id: 'back_squat', label: 'Back Squat', family: 'squat', inSquatTotal: true },
  { id: 'front_squat', label: 'Front Squat', family: 'squat', inSquatTotal: true },
  { id: 'overhead_squat', label: 'Overhead Squat', family: 'squat', inSquatTotal: true },
  { id: 'push_press', label: 'Push Press', family: 'press', inPressTotal: true },
  { id: 'push_jerk', label: 'Push Jerk', family: 'press', inPressTotal: true },
  { id: 'split_jerk', label: 'Split Jerk', family: 'press', inPressTotal: true },
  { id: 'deadlift', label: 'Deadlift', family: 'pull' },
  { id: 'thruster', label: 'Thruster', family: 'hybrid' },
]

export const FAMILY_LABEL: Record<MovementFamily, string> = {
  olympic: 'Halterofilia',
  squat: 'Squats',
  press: 'Presses & Jerks',
  pull: 'Pulls',
  hybrid: 'Hybrid',
}

export const FAMILY_ORDER: MovementFamily[] = ['olympic', 'squat', 'press', 'pull', 'hybrid']

// Los 3 levantamientos olímpicos destacados en la ficha de atleta y en
// las tarjetas de Descubrir. Orden fijo y explícito (no "top por peso").
export const OLYMPIC_DISPLAY_MOVEMENTS: MovementId[] = [
  'snatch',
  'clean_and_jerk',
  'split_jerk',
]

// Etiqueta corta para mostrar en contextos compactos (ej. "Jerk" en vez
// de "Split Jerk" cuando ya está en una sección de levantamientos).
export const OLYMPIC_DISPLAY_LABEL: Record<MovementId, string> = {
  snatch: 'Snatch',
  clean_and_jerk: 'Clean & Jerk',
  split_jerk: 'Jerk',
} as Record<MovementId, string>

export function getMovement(id: MovementId): Movement {
  const m = MOVEMENTS.find((x) => x.id === id)
  if (!m) throw new Error(`Unknown movement: ${id}`)
  return m
}

export function getMovementsByFamily(family: MovementFamily): Movement[] {
  return MOVEMENTS.filter((m) => m.family === family)
}

// Calcula los 4 totales a partir de un map de PRs (movimiento -> peso).
export function calculateTotals(records: Record<string, number>): {
  grand: number
  olympic: number
  squat: number
  press: number
} {
  let grand = 0, olympic = 0, squat = 0, press = 0
  for (const m of MOVEMENTS) {
    const w = records[m.id] ?? 0
    grand += w
    if (m.inOlympicTotal) olympic += w
    if (m.inSquatTotal) squat += w
    if (m.inPressTotal) press += w
  }
  return { grand, olympic, squat, press }
}
