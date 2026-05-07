"use server"

import { createClient } from "@/utils/supabase/server"
import { revalidatePath } from "next/cache"
import { getCurrentAdminPermissions } from "./roles"
import { logActivity } from "./activity"
import { todayCaracasISO } from "@/lib/constants/wod-score"
import type { ScoreSlot } from "@/lib/constants/score-slots"
import { parseScoreSlots } from "@/lib/constants/score-slots"
import { scoreSlotsSchema } from "@/lib/schemas/score-slots"

// ─── Tipos ───────────────────────────────────────────────────

export interface RoutineSchedule {
  id: string
  date: string // YYYY-MM-DD
  name: string | null
  content: string
  score_slots: ScoreSlot[]
  created_at: string | null
  updated_at: string | null
  plans: Array<{ id: string; name: string }>
}

export interface CreateRoutineScheduleInput {
  date: string
  name?: string | null
  content?: string
  score_slots: ScoreSlot[]
  plan_ids: string[]
  replace_conflicts?: boolean
}

export interface UpdateRoutineScheduleInput {
  date?: string
  name?: string | null
  content?: string
  score_slots?: ScoreSlot[]
  plan_ids?: string[]
  replace_conflicts?: boolean
}

// ─── Helpers ─────────────────────────────────────────────────

async function checkPermission(required: string): Promise<boolean> {
  const { permissions, isAdmin } = await getCurrentAdminPermissions()
  if (isAdmin) return true
  return permissions.includes(required)
}

async function findConflictingPlans(
  date: string,
  planIds: string[],
  excludeScheduleId?: string,
): Promise<string[]> {
  if (planIds.length === 0) return []
  const supabase = await createClient()

  let query = supabase
    .from("routine_schedule_plans")
    .select("plan_id, schedule_id, routine_schedules!inner(date)")
    .in("plan_id", planIds)
    .eq("routine_schedules.date", date)

  if (excludeScheduleId) {
    query = query.neq("schedule_id", excludeScheduleId)
  }

  const { data, error } = await query
  if (error) throw error
  return Array.from(new Set((data ?? []).map((r: any) => r.plan_id)))
}

function shapeRoutineSchedule(row: any): RoutineSchedule {
  const plansArr = (row.routine_schedule_plans ?? []).map((rsp: any) => ({
    id: rsp.plans?.id ?? rsp.plan_id,
    name: rsp.plans?.name ?? "",
  }))
  return {
    id: row.id,
    date: row.date,
    name: row.name ?? null,
    content: row.content ?? "",
    score_slots: parseScoreSlots(row.score_slots),
    created_at: row.created_at ?? null,
    updated_at: row.updated_at ?? null,
    plans: plansArr,
  }
}

// ─── Lectura ─────────────────────────────────────────────────

export async function getRoutineSchedules(filters?: {
  from?: string
  to?: string
}): Promise<RoutineSchedule[]> {
  const supabase = await createClient()
  let query = supabase
    .from("routine_schedules")
    .select(
      "id, date, name, content, score_slots, created_at, updated_at, routine_schedule_plans(plan_id, plans(id, name))",
    )
    .order("date", { ascending: true })

  if (filters?.from) query = query.gte("date", filters.from)
  if (filters?.to) query = query.lte("date", filters.to)

  const { data, error } = await query
  if (error) throw error
  return (data ?? []).map(shapeRoutineSchedule)
}

export async function getRoutineSchedule(id: string): Promise<RoutineSchedule | null> {
  const supabase = await createClient()
  const { data, error } = await supabase
    .from("routine_schedules")
    .select(
      "id, date, name, content, score_slots, created_at, updated_at, routine_schedule_plans(plan_id, plans(id, name))",
    )
    .eq("id", id)
    .maybeSingle()

  if (error) throw error
  return data ? shapeRoutineSchedule(data) : null
}

export async function checkRoutineConflicts(input: {
  date: string
  plan_ids: string[]
  exclude_id?: string
}): Promise<string[]> {
  if (!(await checkPermission("routines.view"))) {
    throw new Error("No tienes permisos para ver rutinas")
  }
  return findConflictingPlans(input.date, input.plan_ids, input.exclude_id)
}

// ─── Escritura ───────────────────────────────────────────────

export async function createRoutineSchedule(
  input: CreateRoutineScheduleInput,
): Promise<RoutineSchedule> {
  if (!(await checkPermission("routines.edit"))) {
    throw new Error("No tienes permisos para programar rutinas")
  }

  if (!input.plan_ids?.length) {
    throw new Error("Selecciona al menos un plan")
  }

  // Validar score_slots con Zod (puede ser vacío)
  const parsedSlots = scoreSlotsSchema.safeParse(input.score_slots ?? [])
  if (!parsedSlots.success) {
    throw new Error(parsedSlots.error.issues[0]?.message ?? "Slots inválidos")
  }
  const score_slots = parsedSlots.data

  if (input.date < todayCaracasISO()) {
    throw new Error("No se permiten fechas pasadas")
  }

  const supabase = await createClient()

  const conflictPlanIds = await findConflictingPlans(input.date, input.plan_ids)
  if (conflictPlanIds.length > 0 && !input.replace_conflicts) {
    const err: any = new Error("Hay rutinas en conflicto")
    err.code = "CONFLICT"
    err.planIds = conflictPlanIds
    throw err
  }

  if (conflictPlanIds.length > 0 && input.replace_conflicts) {
    const { data: conflictRows, error: cErr } = await supabase
      .from("routine_schedule_plans")
      .select("schedule_id, routine_schedules!inner(date)")
      .in("plan_id", conflictPlanIds)
      .eq("routine_schedules.date", input.date)
    if (cErr) throw cErr
    const scheduleIds = Array.from(new Set((conflictRows ?? []).map((r: any) => r.schedule_id)))
    if (scheduleIds.length > 0) {
      const { error: dErr } = await supabase
        .from("routine_schedules")
        .delete()
        .in("id", scheduleIds)
      if (dErr) throw dErr
    }
  }

  const { data: inserted, error: iErr } = await supabase
    .from("routine_schedules")
    .insert({
      date: input.date,
      name: input.name?.trim() || null,
      content: input.content ?? "",
      score_slots: score_slots as any,
    })
    .select("id")
    .single()
  if (iErr) throw iErr

  const linkRows = input.plan_ids.map((pid) => ({
    schedule_id: inserted.id,
    plan_id: pid,
  }))
  const { error: lErr } = await supabase.from("routine_schedule_plans").insert(linkRows)
  if (lErr) {
    await supabase.from("routine_schedules").delete().eq("id", inserted.id)
    throw lErr
  }

  await logActivity({
    action: "routine_scheduled",
    entityType: "routine_schedule",
    entityId: inserted.id,
    entityName: `${input.name?.trim() || "Rutina"} · ${input.date}`,
  })

  revalidatePath("/dashboard/rutinas")
  revalidatePath("/portal")
  revalidatePath("/portal/rutinas")
  revalidatePath("/portal/wod")

  const final = await getRoutineSchedule(inserted.id)
  if (!final) throw new Error("Error al recuperar rutina creada")
  return final
}

export async function updateRoutineSchedule(
  id: string,
  input: UpdateRoutineScheduleInput,
): Promise<RoutineSchedule> {
  if (!(await checkPermission("routines.edit"))) {
    throw new Error("No tienes permisos para editar rutinas")
  }

  const current = await getRoutineSchedule(id)
  if (!current) throw new Error("Rutina no encontrada")

  const newDate = input.date ?? current.date
  const newPlanIds = input.plan_ids ?? current.plans.map((p) => p.id)

  if (newPlanIds.length === 0) {
    throw new Error("Selecciona al menos un plan")
  }

  let validatedSlots: ScoreSlot[] | undefined
  if (input.score_slots !== undefined) {
    const parsed = scoreSlotsSchema.safeParse(input.score_slots)
    if (!parsed.success) {
      throw new Error(parsed.error.issues[0]?.message ?? "Slots inválidos")
    }
    validatedSlots = parsed.data
  }

  const supabase = await createClient()

  const conflictPlanIds = await findConflictingPlans(newDate, newPlanIds, id)
  if (conflictPlanIds.length > 0 && !input.replace_conflicts) {
    const err: any = new Error("Hay rutinas en conflicto")
    err.code = "CONFLICT"
    err.planIds = conflictPlanIds
    throw err
  }

  if (conflictPlanIds.length > 0 && input.replace_conflicts) {
    const { data: conflictRows, error: cErr } = await supabase
      .from("routine_schedule_plans")
      .select("schedule_id, routine_schedules!inner(date)")
      .in("plan_id", conflictPlanIds)
      .eq("routine_schedules.date", newDate)
      .neq("schedule_id", id)
    if (cErr) throw cErr
    const scheduleIds = Array.from(new Set((conflictRows ?? []).map((r: any) => r.schedule_id)))
    if (scheduleIds.length > 0) {
      const { error: dErr } = await supabase
        .from("routine_schedules")
        .delete()
        .in("id", scheduleIds)
      if (dErr) throw dErr
    }
  }

  const updatePayload: Record<string, any> = { updated_at: new Date().toISOString() }
  if (input.date !== undefined) updatePayload.date = input.date
  if (input.name !== undefined) updatePayload.name = input.name?.trim() || null
  if (input.content !== undefined) updatePayload.content = input.content
  if (validatedSlots !== undefined) updatePayload.score_slots = validatedSlots

  const { error: uErr } = await supabase
    .from("routine_schedules")
    .update(updatePayload)
    .eq("id", id)
  if (uErr) throw uErr

  if (input.plan_ids !== undefined) {
    const { error: dErr } = await supabase
      .from("routine_schedule_plans")
      .delete()
      .eq("schedule_id", id)
    if (dErr) throw dErr

    const linkRows = newPlanIds.map((pid) => ({ schedule_id: id, plan_id: pid }))
    const { error: lErr } = await supabase.from("routine_schedule_plans").insert(linkRows)
    if (lErr) throw lErr
  }

  await logActivity({
    action: "routine_schedule_updated",
    entityType: "routine_schedule",
    entityId: id,
    entityName: `${updatePayload.name ?? current.name ?? "Rutina"} · ${newDate}`,
  })

  revalidatePath("/dashboard/rutinas")
  revalidatePath("/portal")
  revalidatePath("/portal/rutinas")
  revalidatePath("/portal/wod")

  const final = await getRoutineSchedule(id)
  if (!final) throw new Error("Error al recuperar rutina actualizada")
  return final
}

export async function deleteRoutineSchedule(id: string): Promise<void> {
  if (!(await checkPermission("routines.delete"))) {
    throw new Error("No tienes permisos para eliminar rutinas")
  }

  const current = await getRoutineSchedule(id)
  if (!current) return

  const supabase = await createClient()
  const { error } = await supabase.from("routine_schedules").delete().eq("id", id)
  if (error) throw error

  await logActivity({
    action: "routine_schedule_deleted",
    entityType: "routine_schedule",
    entityId: id,
    entityName: `${current.name ?? "Rutina"} · ${current.date}`,
  })

  revalidatePath("/dashboard/rutinas")
  revalidatePath("/portal")
  revalidatePath("/portal/rutinas")
}

// ─── Portal del miembro ──────────────────────────────────────

export async function getRoutineForMemberOnDate(
  date: string,
): Promise<RoutineSchedule | null> {
  const supabase = await createClient()
  const {
    data: { user },
  } = await supabase.auth.getUser()
  if (!user) return null

  const { data: member } = await supabase
    .from("members")
    .select("plan_id")
    .eq("auth_user_id", user.id)
    .maybeSingle()
  if (!member?.plan_id) return null

  const { data, error } = await supabase
    .from("routine_schedule_plans")
    .select(
      "schedule_id, routine_schedules!inner(id, date, name, content, score_slots, created_at, updated_at, routine_schedule_plans(plan_id, plans(id, name)))",
    )
    .eq("plan_id", member.plan_id)
    .eq("routine_schedules.date", date)
    .maybeSingle()

  if (error) throw error
  if (!data?.routine_schedules) return null

  const rs = Array.isArray(data.routine_schedules)
    ? data.routine_schedules[0]
    : data.routine_schedules
  return rs ? shapeRoutineSchedule(rs) : null
}

export async function getMemberRoutineDatesInRange(
  from: string,
  to: string,
): Promise<string[]> {
  const supabase = await createClient()
  const {
    data: { user },
  } = await supabase.auth.getUser()
  if (!user) return []

  const { data: member } = await supabase
    .from("members")
    .select("plan_id")
    .eq("auth_user_id", user.id)
    .maybeSingle()
  if (!member?.plan_id) return []

  const { data, error } = await supabase
    .from("routine_schedule_plans")
    .select("routine_schedules!inner(date)")
    .eq("plan_id", member.plan_id)
    .gte("routine_schedules.date", from)
    .lte("routine_schedules.date", to)

  if (error) throw error
  const dates = (data ?? []).map((row: any) => {
    const rs = Array.isArray(row.routine_schedules)
      ? row.routine_schedules[0]
      : row.routine_schedules
    return rs?.date as string
  })
  return Array.from(new Set(dates.filter(Boolean)))
}
