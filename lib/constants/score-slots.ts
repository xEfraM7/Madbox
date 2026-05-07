import type { ScoreType } from "@/lib/constants/wod-score"

export interface ScoreSlot {
  id: string         // UUID estable
  order: number      // 0-indexed
  name: string       // 1–100 chars
  score_type: ScoreType
}

export function createScoreSlot(score_type: ScoreType, order: number): ScoreSlot {
  return {
    id: typeof crypto !== "undefined" && "randomUUID" in crypto
      ? crypto.randomUUID()
      : `slot-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`,
    order,
    name: "",
    score_type,
  }
}

export function parseScoreSlots(raw: unknown): ScoreSlot[] {
  if (!Array.isArray(raw)) return []
  const valid: ScoreSlot[] = []
  for (const item of raw) {
    if (
      item &&
      typeof item === "object" &&
      typeof (item as any).id === "string" &&
      typeof (item as any).order === "number" &&
      typeof (item as any).name === "string" &&
      ["for_time", "amrap", "for_reps", "weight"].includes((item as any).score_type)
    ) {
      valid.push({
        id: (item as any).id,
        order: (item as any).order,
        name: (item as any).name,
        score_type: (item as any).score_type as ScoreType,
      })
    }
  }
  return valid.sort((a, b) => a.order - b.order)
}
