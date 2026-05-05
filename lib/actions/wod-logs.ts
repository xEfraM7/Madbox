"use server"

import { type ScoreType } from "@/lib/constants/wod-score"

const DISABLED = "Registro de WOD deshabilitado mientras se migra el modelo de rutinas"

// ─── Tipos (preservados para no romper consumidores) ──────────

export interface WodLog {
  id: string
  member_id: string
  routine_id: string
  routine_name: string
  date: string
  score_type: ScoreType
  score_seconds: number | null
  score_rounds: number | null
  score_reps: number | null
  score_kg: number | null
  rx: boolean
  notes: string | null
  created_at: string
}

export interface UpsertWodLogInput {
  routine_id: string
  date: string
  score_type: ScoreType
  score_seconds?: number | null
  score_rounds?: number | null
  score_reps?: number | null
  score_kg?: number | null
  rx: boolean
  notes?: string | null
}

export interface PlanRoutineForDay {
  day_of_week: string
  routine: { id: string; name: string; content: string; blocks: unknown } | null
}

export interface WodLeaderboardEntry {
  member_id: string
  name: string
  avatar_url: string | null
  score_type: ScoreType
  score_seconds: number | null
  score_rounds: number | null
  score_reps: number | null
  score_kg: number | null
  rx: boolean
  rankable: number
  position: number
}

export interface WodLeaderboardResult {
  routine: { id: string; name: string; content: string; blocks: unknown } | null
  entries: WodLeaderboardEntry[]
}

// ─── Lectura: devuelven vacío para no romper consumidores ────

export async function getMyPlanRoutines(): Promise<PlanRoutineForDay[]> {
  return []
}

export async function getTodayWodLog(): Promise<WodLog | null> {
  return null
}

export async function getMyWodHistory(_limit = 50, _offset = 0): Promise<WodLog[]> {
  return []
}

export async function getTodayLeaderboard(): Promise<WodLeaderboardResult> {
  return { routine: null, entries: [] }
}

export async function getMemberRecentWods(
  _memberId: string,
  _limit = 5,
): Promise<WodLog[]> {
  return []
}

// ─── Escritura: deshabilitada ─────────────────────────────────

export async function upsertWodLog(_input: UpsertWodLogInput): Promise<WodLog> {
  throw new Error(DISABLED)
}

export async function deleteWodLog(_id: string): Promise<void> {
  throw new Error(DISABLED)
}
