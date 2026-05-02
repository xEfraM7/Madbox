import {
  Activity, Dumbbell, Target,
  Infinity as InfinityIcon, Timer, Clock, Hash, RotateCw,
  Wind, StickyNote,
  type LucideIcon,
} from "lucide-react"
import type { ScoreType } from "./wod-score"

// ─── Types ───────────────────────────────────────────────

export type BlockType =
  | "warmup" | "strength" | "skill"
  | "amrap" | "emom" | "for_time" | "for_reps" | "rft"
  | "cooldown" | "notes"

export interface BlockBase {
  id: string
  order: number
  type: BlockType
}

export interface WarmupBlock extends BlockBase { type: "warmup"; text: string }
export interface CooldownBlock extends BlockBase { type: "cooldown"; text: string }
export interface NotesBlock extends BlockBase { type: "notes"; text: string }

export interface StrengthBlock extends BlockBase {
  type: "strength"
  exercise: string
  sets: number
  reps: string
  weight?: string
  notes?: string
}

export interface SkillBlock extends BlockBase {
  type: "skill"
  exercises: string[]
  notes?: string
}

export interface AmrapBlock extends BlockBase { type: "amrap"; minutes: number; movements: string[] }
export interface EmomBlock extends BlockBase { type: "emom"; minutes: number; movements: string[]; alternating: boolean }
export interface ForTimeBlock extends BlockBase { type: "for_time"; movements: string[]; time_cap_min?: number }
export interface ForRepsBlock extends BlockBase { type: "for_reps"; target_reps: number; movements: string[] }
export interface RftBlock extends BlockBase { type: "rft"; rounds: number; movements: string[] }

export type RoutineBlock =
  | WarmupBlock | CooldownBlock | NotesBlock
  | StrengthBlock | SkillBlock
  | AmrapBlock | EmomBlock | ForTimeBlock | ForRepsBlock | RftBlock

// ─── Metadata por tipo ───────────────────────────────────

export interface BlockMeta {
  label: string
  icon: LucideIcon
}

export const BLOCK_META: Record<BlockType, BlockMeta> = {
  warmup:   { label: "Warm-up",       icon: Activity },
  strength: { label: "Strength",      icon: Dumbbell },
  skill:    { label: "Skill",         icon: Target },
  amrap:    { label: "AMRAP",         icon: InfinityIcon },
  emom:     { label: "EMOM",          icon: Timer },
  for_time: { label: "For Time",      icon: Clock },
  for_reps: { label: "For Reps",      icon: Hash },
  rft:      { label: "Rounds For Time", icon: RotateCw },
  cooldown: { label: "Cool-down",     icon: Wind },
  notes:    { label: "Notas",         icon: StickyNote },
}

// Orden estable para el dropdown del BlockPicker
export const BLOCK_TYPE_ORDER: BlockType[] = [
  "warmup",
  "strength",
  "skill",
  "amrap",
  "emom",
  "for_time",
  "rft",
  "for_reps",
  "cooldown",
  "notes",
]

// ─── Mapeo bloque → score_type del WOD logging ───────────

export const CONDITIONING_SCORE_TYPE: Partial<Record<BlockType, ScoreType>> = {
  amrap: "amrap",
  for_time: "for_time",
  rft: "for_time",
  for_reps: "for_reps",
  strength: "weight",
}

/**
 * Devuelve el primer bloque de la rutina cuyo tipo mapea a un score_type
 * (es decir, "registrable" en el WOD logging). Si no hay → null.
 */
export function getPrimaryConditioningBlock(blocks: RoutineBlock[]): RoutineBlock | null {
  const sorted = [...blocks].sort((a, b) => a.order - b.order)
  for (const b of sorted) {
    if (CONDITIONING_SCORE_TYPE[b.type]) return b
  }
  return null
}

/** Score type derivado del bloque principal, o null si no es registrable. */
export function getScoreTypeForBlock(block: RoutineBlock | null): ScoreType | null {
  if (!block) return null
  return CONDITIONING_SCORE_TYPE[block.type] ?? null
}

// ─── Factory de bloques nuevos (con defaults sanos) ──────

export function createBlock(type: BlockType, order: number): RoutineBlock {
  const id = (typeof crypto !== "undefined" && "randomUUID" in crypto)
    ? crypto.randomUUID()
    : Math.random().toString(36).slice(2, 12)
  switch (type) {
    case "warmup":   return { id, order, type, text: "" }
    case "cooldown": return { id, order, type, text: "" }
    case "notes":    return { id, order, type, text: "" }
    case "strength": return { id, order, type, exercise: "", sets: 1, reps: "5", weight: "", notes: "" }
    case "skill":    return { id, order, type, exercises: [""], notes: "" }
    case "amrap":    return { id, order, type, minutes: 10, movements: [""] }
    case "emom":     return { id, order, type, minutes: 10, movements: [""], alternating: false }
    case "for_time": return { id, order, type, movements: [""], time_cap_min: undefined }
    case "for_reps": return { id, order, type, target_reps: 100, movements: [""] }
    case "rft":      return { id, order, type, rounds: 5, movements: [""] }
  }
}

// ─── Helpers JSON safe ───────────────────────────────────

/**
 * Toma el campo blocks del DB (jsonb → unknown) y lo valida superficialmente.
 * Si la forma no es válida, devuelve [].
 */
export function parseBlocks(raw: unknown): RoutineBlock[] {
  if (!Array.isArray(raw)) return []
  return raw.filter((b): b is RoutineBlock => {
    if (!b || typeof b !== "object") return false
    const t = (b as { type?: unknown }).type
    return typeof t === "string" && t in BLOCK_META
  })
}
