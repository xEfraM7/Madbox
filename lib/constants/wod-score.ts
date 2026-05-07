export type ScoreType = 'for_time' | 'amrap' | 'weight'

export interface WodScore {
  score_type: ScoreType
  score_seconds: number | null
  score_rounds: number | null
  score_reps: number | null
  score_kg: number | null
}

export const SCORE_TYPE_LABEL: Record<ScoreType, string> = {
  for_time: 'For Time',
  amrap: 'AMRAP',
  weight: 'Peso',
}

export const SCORE_TYPE_ORDER: ScoreType[] = ['for_time', 'amrap', 'weight']

// Más es mejor para todos excepto for_time.
export function isLowerBetter(t: ScoreType): boolean {
  return t === 'for_time'
}

// Valor único comparable. Para AMRAP: rounds * 1000 + reps_extra (reps por round siempre < 1000 en CrossFit).
export function rankableValue(s: WodScore): number {
  switch (s.score_type) {
    case 'for_time': return s.score_seconds ?? 0
    case 'amrap':    return (s.score_rounds ?? 0) * 1000 + (s.score_reps ?? 0)
    case 'weight':   return Number(s.score_kg ?? 0)
  }
}

export function compareScores(a: WodScore, b: WodScore): number {
  if (a.score_type !== b.score_type) return 0
  const va = rankableValue(a)
  const vb = rankableValue(b)
  return isLowerBetter(a.score_type) ? va - vb : vb - va
}

export function formatScore(s: WodScore): string {
  switch (s.score_type) {
    case 'for_time': {
      const sec = s.score_seconds ?? 0
      const m = Math.floor(sec / 60)
      const r = sec % 60
      return `${m}:${r.toString().padStart(2, '0')}`
    }
    case 'amrap': {
      const r = s.score_rounds ?? 0
      const reps = s.score_reps ?? 0
      return reps > 0 ? `${r} + ${reps}` : `${r} rounds`
    }
    case 'weight':
      return `${Number(s.score_kg ?? 0).toLocaleString('es-VE')} kg`
  }
}

// Mapeo de date (YYYY-MM-DD) → label de día en español, en zona América/Caracas.
const DAY_LABELS = ['Domingo','Lunes','Martes','Miércoles','Jueves','Viernes','Sábado']

export function getDayOfWeekLabel(dateISO: string): string {
  const d = new Date(dateISO + 'T12:00:00')
  // Forzar zona Venezuela vía Intl
  const fmt = new Intl.DateTimeFormat('en-US', { timeZone: 'America/Caracas', weekday: 'long' })
  const eng = fmt.format(d).toLowerCase()
  const map: Record<string, string> = {
    monday: 'Lunes', tuesday: 'Martes', wednesday: 'Miércoles',
    thursday: 'Jueves', friday: 'Viernes', saturday: 'Sábado', sunday: 'Domingo',
  }
  return map[eng] ?? DAY_LABELS[d.getDay()]
}

export function todayCaracasISO(): string {
  // YYYY-MM-DD en zona Venezuela
  const fmt = new Intl.DateTimeFormat('en-CA', { timeZone: 'America/Caracas', year: 'numeric', month: '2-digit', day: '2-digit' })
  return fmt.format(new Date())
}
