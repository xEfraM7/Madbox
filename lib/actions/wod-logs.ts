"use server"

import { createClient } from "@/utils/supabase/server"
import { createAdminClient } from "@/utils/supabase/admin"
import { revalidatePath } from "next/cache"
import {
  type ScoreType,
  todayCaracasISO,
  getDayOfWeekLabel,
  rankableValue,
  isLowerBetter,
} from "@/lib/constants/wod-score"
import { logActivity } from "./activity"

// ─── Helpers ─────────────────────────────────────────────

async function getMyMemberInfo(): Promise<{ id: string; plan_id: string | null }> {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) throw new Error("No autenticado")

  const { data, error } = await supabase
    .from("members")
    .select("id, plan_id")
    .eq("auth_user_id", user.id)
    .maybeSingle()

  if (error) throw error
  if (!data) throw new Error("Miembro no encontrado")
  return { id: data.id, plan_id: data.plan_id }
}

// ─── Tipos ───────────────────────────────────────────────

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

// ─── Validación ──────────────────────────────────────────

function validateScoreShape(input: UpsertWodLogInput): {
  score_seconds: number | null
  score_rounds: number | null
  score_reps: number | null
  score_kg: number | null
} {
  switch (input.score_type) {
    case "for_time": {
      const s = input.score_seconds
      if (typeof s !== "number" || s <= 0) throw new Error("Tiempo inválido")
      return { score_seconds: s, score_rounds: null, score_reps: null, score_kg: null }
    }
    case "amrap": {
      const r = input.score_rounds
      const reps = input.score_reps ?? 0
      if (typeof r !== "number" || r < 0) throw new Error("Rounds inválido")
      if (typeof reps !== "number" || reps < 0) throw new Error("Reps inválido")
      return { score_seconds: null, score_rounds: r, score_reps: reps, score_kg: null }
    }
    case "for_reps": {
      const reps = input.score_reps
      if (typeof reps !== "number" || reps <= 0) throw new Error("Reps inválido")
      return { score_seconds: null, score_rounds: null, score_reps: reps, score_kg: null }
    }
    case "weight": {
      const kg = input.score_kg
      if (typeof kg !== "number" || kg <= 0 || kg > 500) throw new Error("Peso fuera de rango")
      return { score_seconds: null, score_rounds: null, score_reps: null, score_kg: kg }
    }
  }
}

// ─── Plan routines (para que el modal sepa qué rutina atar a una fecha) ──

export async function getMyPlanRoutines(): Promise<PlanRoutineForDay[]> {
  const supabase = await createClient()
  const me = await getMyMemberInfo()

  if (!me.plan_id) return []

  const { data, error } = await supabase
    .from("routine_assignments")
    .select("day_of_week, routines(id, name, content, blocks)")
    .eq("plan_id", me.plan_id)

  if (error) throw error

  return (data ?? []).map((row: any) => ({
    day_of_week: row.day_of_week,
    routine: Array.isArray(row.routines) ? (row.routines[0] ?? null) : (row.routines ?? null),
  }))
}

// ─── Mis logs ────────────────────────────────────────────

export async function getTodayWodLog(): Promise<WodLog | null> {
  const supabase = await createClient()
  const me = await getMyMemberInfo()

  if (!me.plan_id) return null

  const today = todayCaracasISO()
  const todayLabel = getDayOfWeekLabel(today)

  // Encontrar la rutina del plan para hoy
  const { data: assignment, error: aErr } = await supabase
    .from("routine_assignments")
    .select("routine_id")
    .eq("plan_id", me.plan_id)
    .eq("day_of_week", todayLabel)
    .maybeSingle()

  if (aErr) throw aErr
  if (!assignment) return null

  const { data, error } = await supabase
    .from("wod_logs")
    .select("id, member_id, routine_id, date, score_type, score_seconds, score_rounds, score_reps, score_kg, rx, notes, created_at, routines(name)")
    .eq("member_id", me.id)
    .eq("routine_id", assignment.routine_id)
    .eq("date", today)
    .maybeSingle()

  if (error) throw error
  if (!data) return null

  const routineName = Array.isArray((data as any).routines)
    ? ((data as any).routines[0]?.name ?? "")
    : ((data as any).routines?.name ?? "")

  return {
    id: data.id,
    member_id: data.member_id,
    routine_id: data.routine_id,
    routine_name: routineName,
    date: data.date,
    score_type: data.score_type as ScoreType,
    score_seconds: data.score_seconds,
    score_rounds: data.score_rounds,
    score_reps: data.score_reps,
    score_kg: data.score_kg !== null ? Number(data.score_kg) : null,
    rx: data.rx,
    notes: data.notes,
    created_at: data.created_at,
  }
}

export async function getMyWodHistory(limit = 50, offset = 0): Promise<WodLog[]> {
  const supabase = await createClient()
  const me = await getMyMemberInfo()

  const { data, error } = await supabase
    .from("wod_logs")
    .select("id, member_id, routine_id, date, score_type, score_seconds, score_rounds, score_reps, score_kg, rx, notes, created_at, routines(name)")
    .eq("member_id", me.id)
    .order("date", { ascending: false })
    .order("created_at", { ascending: false })
    .range(offset, offset + limit - 1)

  if (error) throw error

  return (data ?? []).map((row: any) => ({
    id: row.id,
    member_id: row.member_id,
    routine_id: row.routine_id,
    routine_name: Array.isArray(row.routines) ? (row.routines[0]?.name ?? "") : (row.routines?.name ?? ""),
    date: row.date,
    score_type: row.score_type as ScoreType,
    score_seconds: row.score_seconds,
    score_rounds: row.score_rounds,
    score_reps: row.score_reps,
    score_kg: row.score_kg !== null ? Number(row.score_kg) : null,
    rx: row.rx,
    notes: row.notes,
    created_at: row.created_at,
  }))
}

export async function upsertWodLog(input: UpsertWodLogInput): Promise<WodLog> {
  if (input.notes && input.notes.length > 500) {
    throw new Error("Notas no pueden exceder 500 caracteres")
  }
  const today = todayCaracasISO()
  if (input.date > today) throw new Error("Fecha futura no permitida")

  const shape = validateScoreShape(input)

  const supabase = await createClient()
  const me = await getMyMemberInfo()

  const { data, error } = await supabase
    .from("wod_logs")
    .upsert(
      {
        member_id: me.id,
        routine_id: input.routine_id,
        date: input.date,
        score_type: input.score_type,
        score_seconds: shape.score_seconds,
        score_rounds: shape.score_rounds,
        score_reps: shape.score_reps,
        score_kg: shape.score_kg,
        rx: input.rx,
        notes: input.notes ?? null,
        updated_at: new Date().toISOString(),
      },
      { onConflict: "member_id,routine_id,date" },
    )
    .select("id, member_id, routine_id, date, score_type, score_seconds, score_rounds, score_reps, score_kg, rx, notes, created_at, routines(name)")
    .single()

  if (error) throw error

  const routineName = Array.isArray((data as any).routines)
    ? ((data as any).routines[0]?.name ?? "")
    : ((data as any).routines?.name ?? "")

  await logActivity({
    action: "wod_logged",
    entityType: "wod_log",
    entityId: data.id,
    entityName: `${routineName} · ${input.date}`,
  })

  revalidatePath("/portal")
  revalidatePath("/portal/wod")
  revalidatePath("/portal/descubrir")

  return {
    id: data.id,
    member_id: data.member_id,
    routine_id: data.routine_id,
    routine_name: routineName,
    date: data.date,
    score_type: data.score_type as ScoreType,
    score_seconds: data.score_seconds,
    score_rounds: data.score_rounds,
    score_reps: data.score_reps,
    score_kg: data.score_kg !== null ? Number(data.score_kg) : null,
    rx: data.rx,
    notes: data.notes,
    created_at: data.created_at,
  }
}

export async function deleteWodLog(id: string): Promise<void> {
  const supabase = await createClient()
  const me = await getMyMemberInfo()

  const { data: existing } = await supabase
    .from("wod_logs")
    .select("id, date, routines(name)")
    .eq("id", id)
    .eq("member_id", me.id)
    .maybeSingle()

  if (!existing) throw new Error("Log no encontrado")

  const { error } = await supabase
    .from("wod_logs")
    .delete()
    .eq("id", id)
    .eq("member_id", me.id)

  if (error) throw error

  const routineName = Array.isArray((existing as any).routines)
    ? ((existing as any).routines[0]?.name ?? "")
    : ((existing as any).routines?.name ?? "")

  await logActivity({
    action: "wod_deleted",
    entityType: "wod_log",
    entityId: id,
    entityName: `${routineName} · ${existing.date}`,
  })

  revalidatePath("/portal")
  revalidatePath("/portal/wod")
  revalidatePath("/portal/descubrir")
}

// ─── Cross-member ────────────────────────────────────────

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

async function ensureAuthenticatedAndGetMember(): Promise<{ id: string; plan_id: string | null }> {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) throw new Error("No autenticado")

  const { data, error } = await supabase
    .from("members")
    .select("id, plan_id")
    .eq("auth_user_id", user.id)
    .maybeSingle()

  if (error) throw error
  if (!data) throw new Error("Miembro no encontrado")
  return { id: data.id, plan_id: data.plan_id }
}

export async function getTodayLeaderboard(): Promise<WodLeaderboardResult> {
  const me = await ensureAuthenticatedAndGetMember()
  if (!me.plan_id) return { routine: null, entries: [] }

  const today = todayCaracasISO()
  const todayLabel = getDayOfWeekLabel(today)

  const admin = createAdminClient()

  const { data: assignment, error: aErr } = await admin
    .from("routine_assignments")
    .select("routine_id, routines(id, name, content, blocks)")
    .eq("plan_id", me.plan_id)
    .eq("day_of_week", todayLabel)
    .maybeSingle()

  if (aErr) throw aErr
  if (!assignment) return { routine: null, entries: [] }

  const routine = Array.isArray((assignment as any).routines)
    ? ((assignment as any).routines[0] ?? null)
    : ((assignment as any).routines ?? null)
  if (!routine) return { routine: null, entries: [] }

  const { data: logs, error: lErr } = await admin
    .from("wod_logs")
    .select("member_id, score_type, score_seconds, score_rounds, score_reps, score_kg, rx, created_at")
    .eq("routine_id", assignment.routine_id)
    .eq("date", today)

  if (lErr) throw lErr
  if (!logs || logs.length === 0) return { routine, entries: [] }

  const memberIds = Array.from(new Set(logs.map((l) => l.member_id)))

  const { data: members, error: mErr } = await admin
    .from("members")
    .select("id, name, avatar_url, discoverable, show_wods, show_avatar")
    .in("id", memberIds)
    .eq("discoverable", true)
    .eq("show_wods", true)

  if (mErr) throw mErr
  if (!members || members.length === 0) return { routine, entries: [] }

  const visibleIds = new Set(members.map((m) => m.id))
  const memberById = new Map(members.map((m) => [m.id, m]))

  const enriched = logs
    .filter((l) => visibleIds.has(l.member_id))
    .map((l) => {
      const m = memberById.get(l.member_id)!
      const score = {
        score_type: l.score_type as ScoreType,
        score_seconds: l.score_seconds,
        score_rounds: l.score_rounds,
        score_reps: l.score_reps,
        score_kg: l.score_kg !== null ? Number(l.score_kg) : null,
      }
      return {
        member_id: l.member_id,
        name: m.name,
        avatar_url: m.show_avatar ? m.avatar_url : null,
        score_type: score.score_type,
        score_seconds: score.score_seconds,
        score_rounds: score.score_rounds,
        score_reps: score.score_reps,
        score_kg: score.score_kg,
        rx: l.rx,
        rankable: rankableValue(score),
        created_at: l.created_at as string,
      }
    })

  enriched.sort((a, b) => {
    const lower = isLowerBetter(a.score_type)
    const cmp = lower ? a.rankable - b.rankable : b.rankable - a.rankable
    if (cmp !== 0) return cmp
    return a.created_at.localeCompare(b.created_at)
  })

  const top = enriched.slice(0, 10).map((e, i) => ({
    member_id: e.member_id,
    name: e.name,
    avatar_url: e.avatar_url,
    score_type: e.score_type,
    score_seconds: e.score_seconds,
    score_rounds: e.score_rounds,
    score_reps: e.score_reps,
    score_kg: e.score_kg,
    rx: e.rx,
    rankable: e.rankable,
    position: i + 1,
  }))

  return { routine, entries: top }
}

export async function getMemberRecentWods(memberId: string, limit = 5): Promise<WodLog[]> {
  await ensureAuthenticatedAndGetMember()
  const admin = createAdminClient()

  const { data: target, error: mErr } = await admin
    .from("members")
    .select("id, discoverable, show_wods")
    .eq("id", memberId)
    .maybeSingle()

  if (mErr) throw mErr
  if (!target || !target.discoverable || !target.show_wods) return []

  const { data, error } = await admin
    .from("wod_logs")
    .select("id, member_id, routine_id, date, score_type, score_seconds, score_rounds, score_reps, score_kg, rx, notes, created_at, routines(name)")
    .eq("member_id", memberId)
    .order("date", { ascending: false })
    .order("created_at", { ascending: false })
    .limit(limit)

  if (error) throw error

  return (data ?? []).map((row: any) => ({
    id: row.id,
    member_id: row.member_id,
    routine_id: row.routine_id,
    routine_name: Array.isArray(row.routines) ? (row.routines[0]?.name ?? "") : (row.routines?.name ?? ""),
    date: row.date,
    score_type: row.score_type as ScoreType,
    score_seconds: row.score_seconds,
    score_rounds: row.score_rounds,
    score_reps: row.score_reps,
    score_kg: row.score_kg !== null ? Number(row.score_kg) : null,
    rx: row.rx,
    notes: row.notes,
    created_at: row.created_at,
  }))
}
