import type { Prescription, ScoreType } from "@/lib/constants/wod-score"

export interface ScoreSlot {
  id: string
  order: number
  name: string
  score_type: ScoreType
  prescription?: Prescription
}

export function createScoreSlot(score_type: ScoreType, order: number): ScoreSlot {
  const base: ScoreSlot = {
    id:
      typeof crypto !== "undefined" && "randomUUID" in crypto
        ? crypto.randomUUID()
        : `slot-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`,
    order,
    name: "",
    score_type,
  }
  if (score_type === "sets_reps_rm") {
    base.prescription = [{ sets: 1, reps: 5 }]
  }
  return base
}

const VALID_SCORE_TYPES: ScoreType[] = ["for_time", "amrap", "weight", "sets_reps_rm"]

// eslint-disable-next-line @typescript-eslint/no-explicit-any
function parsePrescription(raw: any): Prescription | undefined {
  if (!Array.isArray(raw)) return undefined
  const out: Prescription = []
  for (const row of raw) {
    if (
      row &&
      typeof row === "object" &&
      typeof row.sets === "number" &&
      typeof row.reps === "number"
    ) {
      const item: Prescription[number] = {
        sets: row.sets,
        reps: row.reps,
      }
      if (typeof row.percent === "number") item.percent = row.percent
      out.push(item)
    }
  }
  return out
}

export function parseScoreSlots(raw: unknown): ScoreSlot[] {
  if (!Array.isArray(raw)) return []
  const valid: ScoreSlot[] = []
  for (const item of raw) {
    if (
      item &&
      typeof item === "object" &&
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      typeof (item as any).id === "string" &&
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      typeof (item as any).order === "number" &&
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      typeof (item as any).name === "string" &&
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      VALID_SCORE_TYPES.includes((item as any).score_type)
    ) {
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      const row = item as any
      const slot: ScoreSlot = {
        id: row.id,
        order: row.order,
        name: row.name,
        score_type: row.score_type as ScoreType,
      }
      if (row.score_type === "sets_reps_rm") {
        const presc = parsePrescription(row.prescription)
        if (presc && presc.length > 0) slot.prescription = presc
      }
      valid.push(slot)
    }
  }
  return valid.sort((a, b) => a.order - b.order)
}
