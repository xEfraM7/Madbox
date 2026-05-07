"use server"

import { createClient } from "@/utils/supabase/server"
import { createAdminClient } from "@/utils/supabase/admin"
import { revalidatePath } from "next/cache"
import { logActivity } from "./activity"
import {
  type ScoreType,
  compareScores,
  todayCaracasISO,
} from "@/lib/constants/wod-score"
import {
  parseScoreSlots,
  type ScoreSlot,
} from "@/lib/constants/score-slots"

// ─── Tipos públicos ──────────────────────────────────────────

export interface WodLog {
  id: string
  member_id: string
  routine_id: string
  slot_id: string
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
  slot_id: string
  score_type: ScoreType
  score_seconds?: number | null
  score_rounds?: number | null
  score_reps?: number | null
  score_kg?: number | null
  rx: boolean
  notes?: string | null
}

export interface RoutineForMemberToday {
  id: string
  date: string
  name: string | null
  content: string
  score_slots: ScoreSlot[]
  plan_ids: string[]
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
  position: number
}

export interface WodLeaderboardResult {
  routine_id: string
  slot_id: string
  gender: "male" | "female"
  entries: WodLeaderboardEntry[]
}

// ─── Helpers ─────────────────────────────────────────────────

async function getMyMemberRow(): Promise<{
  id: string
  plan_id: string | null
  gender: "male" | "female" | null
  show_wods: boolean
} | null> {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return null

  const { data, error } = await supabase
    .from("members")
    .select("id, plan_id, gender, show_wods")
    .eq("auth_user_id", user.id)
    .maybeSingle()

  if (error) throw error
  if (!data) return null
  return {
    id: data.id,
    plan_id: data.plan_id ?? null,
    gender: (data.gender as "male" | "female" | null) ?? null,
    show_wods: data.show_wods ?? true,
  }
}

// eslint-disable-next-line @typescript-eslint/no-explicit-any
function rowToWodLog(row: any): WodLog {
  return {
    id: row.id,
    member_id: row.member_id,
    routine_id: row.routine_id,
    slot_id: row.slot_id,
    date: row.date,
    score_type: row.score_type as ScoreType,
    score_seconds: row.score_seconds,
    score_rounds: row.score_rounds,
    score_reps: row.score_reps,
    score_kg: row.score_kg ? Number(row.score_kg) : null,
    rx: !!row.rx,
    notes: row.notes,
    created_at: row.created_at,
  }
}

// ─── Lecturas ────────────────────────────────────────────────

export async function getRoutineForToday(): Promise<RoutineForMemberToday | null> {
  const me = await getMyMemberRow()
  if (!me?.plan_id) return null

  const supabase = await createClient()
  const today = todayCaracasISO()

  const { data, error } = await supabase
    .from("routine_schedule_plans")
    .select(
      "schedule_id, plan_id, routine_schedules!inner(id, date, name, content, score_slots)",
    )
    .eq("plan_id", me.plan_id)
    .eq("routine_schedules.date", today)
    .maybeSingle()

  if (error) throw error
  if (!data?.routine_schedules) return null

  const rs = Array.isArray(data.routine_schedules)
    ? data.routine_schedules[0]
    : data.routine_schedules
  if (!rs) return null

  const { data: allPlans, error: pErr } = await supabase
    .from("routine_schedule_plans")
    .select("plan_id")
    .eq("schedule_id", rs.id)
  if (pErr) throw pErr

  return {
    id: rs.id,
    date: rs.date,
    name: rs.name ?? null,
    content: rs.content ?? "",
    score_slots: parseScoreSlots(rs.score_slots),
    plan_ids: (allPlans ?? []).map((r) => r.plan_id),
  }
}

export async function getMyWodLogsForRoutine(routineId: string): Promise<WodLog[]> {
  const me = await getMyMemberRow()
  if (!me) return []

  const supabase = await createClient()
  const { data, error } = await supabase
    .from("wod_logs")
    .select("*")
    .eq("member_id", me.id)
    .eq("routine_id", routineId)

  if (error) throw error
  return (data ?? []).map(rowToWodLog)
}

export async function getMyWodHistory(limit = 50, offset = 0): Promise<WodLog[]> {
  const me = await getMyMemberRow()
  if (!me) return []

  const supabase = await createClient()
  const { data, error } = await supabase
    .from("wod_logs")
    .select("*")
    .eq("member_id", me.id)
    .order("date", { ascending: false })
    .range(offset, offset + limit - 1)

  if (error) throw error
  return (data ?? []).map(rowToWodLog)
}

// ─── Escrituras ──────────────────────────────────────────────

export async function upsertWodLog(input: UpsertWodLogInput): Promise<WodLog> {
  const me = await getMyMemberRow()
  if (!me) throw new Error("No autenticado")
  if (!me.plan_id) throw new Error("No tienes plan asignado")

  if (!input.routine_id || !input.slot_id) {
    throw new Error("Datos de rutina/slot incompletos")
  }
  if ((input.notes ?? "").length > 500) {
    throw new Error("Las notas no pueden exceder 500 caracteres")
  }

  const supabase = await createClient()

  // 1. Validar que el schedule existe, contiene el slot y aplica al plan del miembro
  const { data: schedule, error: sErr } = await supabase
    .from("routine_schedules")
    .select("id, date, score_slots, routine_schedule_plans(plan_id)")
    .eq("id", input.routine_id)
    .maybeSingle()
  if (sErr) throw sErr
  if (!schedule) throw new Error("Rutina no encontrada")

  const slots = parseScoreSlots(schedule.score_slots)
  const slot = slots.find((s) => s.id === input.slot_id)
  if (!slot) throw new Error("Slot no encontrado en la rutina")

  if (slot.score_type !== input.score_type) {
    throw new Error("El tipo de score no corresponde al slot")
  }

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const planIds = (schedule.routine_schedule_plans ?? []).map((r: any) => r.plan_id)
  if (!planIds.includes(me.plan_id)) {
    throw new Error("Esta rutina no aplica a tu plan")
  }

  // 2. Validar rangos por score_type
  const errs: string[] = []
  switch (input.score_type) {
    case "for_time":
      if (!input.score_seconds || input.score_seconds < 1 || input.score_seconds > 14400) {
        errs.push("Tiempo fuera de rango (1s – 4h)")
      }
      break
    case "amrap": {
      const r = input.score_rounds ?? 0
      const reps = input.score_reps ?? 0
      if (r < 0 || reps < 0 || r + reps === 0) errs.push("Rounds o reps inválidos")
      break
    }
    case "for_reps":
      if (!input.score_reps || input.score_reps < 1 || input.score_reps > 99999) {
        errs.push("Reps fuera de rango (1 – 99999)")
      }
      break
    case "weight": {
      const kg = input.score_kg ?? 0
      if (kg < 0.5 || kg > 500) errs.push("Peso fuera de rango (0.5 – 500 kg)")
      break
    }
  }
  if (errs.length > 0) throw new Error(errs[0])

  // 3. Upsert
  const payload = {
    member_id: me.id,
    routine_id: input.routine_id,
    slot_id: input.slot_id,
    date: schedule.date,
    score_type: input.score_type,
    score_seconds: input.score_type === "for_time" ? input.score_seconds ?? null : null,
    score_rounds: input.score_type === "amrap" ? input.score_rounds ?? null : null,
    score_reps:
      input.score_type === "amrap" || input.score_type === "for_reps"
        ? input.score_reps ?? null
        : null,
    score_kg: input.score_type === "weight" ? input.score_kg ?? null : null,
    rx: input.rx,
    notes: input.notes && input.notes.trim().length > 0 ? input.notes.trim() : null,
    updated_at: new Date().toISOString(),
  }

  const { data, error } = await supabase
    .from("wod_logs")
    .upsert(payload, { onConflict: "member_id,routine_id,slot_id" })
    .select("*")
    .single()
  if (error) throw error

  await logActivity({
    action: "wod_logged",
    entityType: "wod_log",
    entityId: data.id,
    entityName: `${input.score_type} · ${schedule.date}`,
  })

  revalidatePath("/portal/wod")
  revalidatePath("/portal/rutinas")

  return rowToWodLog(data)
}

export async function deleteWodLog(id: string): Promise<void> {
  const me = await getMyMemberRow()
  if (!me) throw new Error("No autenticado")

  const supabase = await createClient()
  const { data: existing, error: gErr } = await supabase
    .from("wod_logs")
    .select("id, member_id, score_type, date")
    .eq("id", id)
    .maybeSingle()
  if (gErr) throw gErr
  if (!existing) return
  if (existing.member_id !== me.id) {
    throw new Error("No puedes borrar el log de otro miembro")
  }

  const { error } = await supabase.from("wod_logs").delete().eq("id", id)
  if (error) throw error

  await logActivity({
    action: "wod_deleted",
    entityType: "wod_log",
    entityId: existing.id,
    entityName: `${existing.score_type} · ${existing.date}`,
  })

  revalidatePath("/portal/wod")
  revalidatePath("/portal/rutinas")
}

// ─── Leaderboard ─────────────────────────────────────────────

export async function getLeaderboardForSlot(input: {
  routine_id: string
  slot_id: string
  gender: "male" | "female"
  limit?: number
}): Promise<WodLeaderboardResult> {
  const supabase = await createClient()
  const {
    data: { user },
  } = await supabase.auth.getUser()
  if (!user) throw new Error("No autenticado")

  const limit = input.limit ?? 10
  const admin = createAdminClient()

  // 1. Recuperar plan_ids del schedule
  const { data: planRows, error: pErr } = await admin
    .from("routine_schedule_plans")
    .select("plan_id")
    .eq("schedule_id", input.routine_id)
  if (pErr) throw pErr
  const planIds = (planRows ?? []).map((r) => r.plan_id)
  if (planIds.length === 0) {
    return {
      routine_id: input.routine_id,
      slot_id: input.slot_id,
      gender: input.gender,
      entries: [],
    }
  }

  // 2. Buscar miembros del plan + género + show_wods
  const { data: members, error: mErr } = await admin
    .from("members")
    .select("id, name, avatar_url, gender, show_wods, show_avatar, plan_id")
    .in("plan_id", planIds)
    .eq("gender", input.gender)
    .eq("show_wods", true)
  if (mErr) throw mErr
  if (!members || members.length === 0) {
    return {
      routine_id: input.routine_id,
      slot_id: input.slot_id,
      gender: input.gender,
      entries: [],
    }
  }

  const memberIds = members.map((m) => m.id)
  const memberMap = new Map(members.map((m) => [m.id, m]))

  // 3. Logs del slot para esos miembros
  const { data: logs, error: lErr } = await admin
    .from("wod_logs")
    .select("*")
    .eq("routine_id", input.routine_id)
    .eq("slot_id", input.slot_id)
    .in("member_id", memberIds)
  if (lErr) throw lErr

  // 4. Ordenar reusando compareScores; tomar Top N
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const sorted = (logs ?? [])
    .map((row: any) => ({
      member_id: row.member_id,
      score_type: row.score_type as ScoreType,
      score_seconds: row.score_seconds,
      score_rounds: row.score_rounds,
      score_reps: row.score_reps,
      score_kg: row.score_kg ? Number(row.score_kg) : null,
      rx: !!row.rx,
    }))
    .sort((a, b) =>
      compareScores(
        {
          score_type: a.score_type,
          score_seconds: a.score_seconds,
          score_rounds: a.score_rounds,
          score_reps: a.score_reps,
          score_kg: a.score_kg,
        },
        {
          score_type: b.score_type,
          score_seconds: b.score_seconds,
          score_rounds: b.score_rounds,
          score_reps: b.score_reps,
          score_kg: b.score_kg,
        },
      ),
    )
    .slice(0, limit)

  const entries: WodLeaderboardEntry[] = sorted.map((s, i) => {
    const m = memberMap.get(s.member_id)
    return {
      member_id: s.member_id,
      name: m?.name ?? "—",
      avatar_url: m?.show_avatar ? m.avatar_url : null,
      score_type: s.score_type,
      score_seconds: s.score_seconds,
      score_rounds: s.score_rounds,
      score_reps: s.score_reps,
      score_kg: s.score_kg,
      rx: s.rx,
      position: i + 1,
    }
  })

  return {
    routine_id: input.routine_id,
    slot_id: input.slot_id,
    gender: input.gender,
    entries,
  }
}

// ─── Vista pública de otro miembro ───────────────────────────

export interface WodLogWithRoutineName extends WodLog {
  routine_name: string | null
}

export async function getMemberRecentWods(
  memberId: string,
  limit = 5,
): Promise<WodLogWithRoutineName[]> {
  const supabase = await createClient()
  const {
    data: { user },
  } = await supabase.auth.getUser()
  if (!user) return []

  const admin = createAdminClient()
  const { data, error } = await admin
    .from("wod_logs")
    .select("*, routine_schedules(name)")
    .eq("member_id", memberId)
    .order("date", { ascending: false })
    .limit(limit)

  if (error) throw error
  return (data ?? []).map((row: any) => ({
    ...rowToWodLog(row),
    routine_name:
      (Array.isArray(row.routine_schedules)
        ? row.routine_schedules[0]?.name
        : row.routine_schedules?.name) ?? null,
  }))
}
