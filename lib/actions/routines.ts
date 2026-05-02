"use server"

import { createClient } from "@/utils/supabase/server"
import { revalidatePath } from "next/cache"
import type { TablesInsert, TablesUpdate } from "@/types/database"
import { getCurrentAdminPermissions } from "./roles"
import { logActivity } from "./activity"

async function checkPermission(required: string): Promise<boolean> {
  const { permissions, isAdmin } = await getCurrentAdminPermissions()
  if (isAdmin) return true
  return permissions.includes(required)
}

// ─── Biblioteca de rutinas ──────────────────────────────────

export async function getRoutines() {
  const supabase = await createClient()
  const { data, error } = await supabase
    .from("routines")
    .select("*, routine_assignments(count)")
    .order("name", { ascending: true })

  if (error) throw error
  return data
}

export async function getRoutine(id: string) {
  const supabase = await createClient()
  const { data, error } = await supabase
    .from("routines")
    .select("*, routine_assignments(id, plan_id, day_of_week)")
    .eq("id", id)
    .single()

  if (error) throw error
  return data
}

export async function createRoutine(routine: TablesInsert<"routines">) {
  if (!(await checkPermission("schedule.edit"))) {
    throw new Error("No tienes permisos para crear rutinas")
  }

  const supabase = await createClient()
  const { data, error } = await supabase
    .from("routines")
    .insert(routine)
    .select()
    .single()

  if (error) throw error

  await logActivity({
    action: "routine_created",
    entityType: "routine",
    entityId: data.id,
    entityName: data.name,
  })

  revalidatePath("/dashboard/horarios")
  return data
}

export async function updateRoutine(id: string, routine: TablesUpdate<"routines">) {
  if (!(await checkPermission("schedule.edit"))) {
    throw new Error("No tienes permisos para editar rutinas")
  }

  const supabase = await createClient()
  const { data, error } = await supabase
    .from("routines")
    .update({ ...routine, updated_at: new Date().toISOString() })
    .eq("id", id)
    .select()
    .single()

  if (error) throw error

  await logActivity({
    action: "routine_updated",
    entityType: "routine",
    entityId: data.id,
    entityName: data.name,
  })

  revalidatePath("/dashboard/horarios")
  revalidatePath("/portal")
  return data
}

export async function deleteRoutine(id: string) {
  if (!(await checkPermission("schedule.delete"))) {
    throw new Error("No tienes permisos para eliminar rutinas")
  }

  const supabase = await createClient()

  const { data: routine } = await supabase
    .from("routines")
    .select("name")
    .eq("id", id)
    .single()

  const { error } = await supabase.from("routines").delete().eq("id", id)
  if (error) throw error

  await logActivity({
    action: "routine_deleted",
    entityType: "routine",
    entityId: id,
    entityName: routine?.name ?? "(sin nombre)",
  })

  revalidatePath("/dashboard/horarios")
  revalidatePath("/portal")
}

// ─── Asignaciones (plan + día → rutina) ──────────────────────

export async function getRoutineAssignments() {
  const supabase = await createClient()
  const { data, error } = await supabase
    .from("routine_assignments")
    .select("id, plan_id, day_of_week, routine_id, routines (id, name, content, blocks)")

  if (error) throw error
  return data
}

interface UpsertAssignmentInput {
  plan_id: string
  day_of_week: string
  routine_id: string
}

export async function upsertRoutineAssignment(input: UpsertAssignmentInput) {
  if (!(await checkPermission("schedule.edit"))) {
    throw new Error("No tienes permisos para asignar rutinas")
  }

  const supabase = await createClient()

  const { data, error } = await supabase
    .from("routine_assignments")
    .upsert(
      {
        plan_id: input.plan_id,
        day_of_week: input.day_of_week,
        routine_id: input.routine_id,
        updated_at: new Date().toISOString(),
      },
      { onConflict: "plan_id,day_of_week" }
    )
    .select("*, routines(name), plans(name)")
    .single()

  if (error) throw error

  await logActivity({
    action: "routine_assigned",
    entityType: "routine_assignment",
    entityId: data.id,
    entityName: `${(data as any).plans?.name ?? "Plan"} · ${input.day_of_week} → ${(data as any).routines?.name ?? "Rutina"}`,
  })

  revalidatePath("/dashboard/horarios")
  revalidatePath("/portal")
  return data
}

interface DeleteAssignmentInput {
  plan_id: string
  day_of_week: string
}

export async function deleteRoutineAssignment(input: DeleteAssignmentInput) {
  if (!(await checkPermission("schedule.delete"))) {
    throw new Error("No tienes permisos para desasignar rutinas")
  }

  const supabase = await createClient()

  const { data: existing } = await supabase
    .from("routine_assignments")
    .select("id, plans(name), routines(name)")
    .eq("plan_id", input.plan_id)
    .eq("day_of_week", input.day_of_week)
    .maybeSingle()

  const { error } = await supabase
    .from("routine_assignments")
    .delete()
    .eq("plan_id", input.plan_id)
    .eq("day_of_week", input.day_of_week)

  if (error) throw error

  if (existing) {
    await logActivity({
      action: "routine_unassigned",
      entityType: "routine_assignment",
      entityId: existing.id,
      entityName: `${(existing as any).plans?.name ?? "Plan"} · ${input.day_of_week} ✕ ${(existing as any).routines?.name ?? "Rutina"}`,
    })
  }

  revalidatePath("/dashboard/horarios")
  revalidatePath("/portal")
}

// ─── Portal del miembro ──────────────────────────────────────

const DAY_MAP: Record<string, string> = {
  monday: "Lunes",
  tuesday: "Martes",
  wednesday: "Miércoles",
  thursday: "Jueves",
  friday: "Viernes",
  saturday: "Sábado",
  sunday: "Domingo",
}

function getTodayLabel(): string {
  // Calculado server-side en zona horaria de Venezuela
  const formatter = new Intl.DateTimeFormat("en-US", {
    timeZone: "America/Caracas",
    weekday: "long",
  })
  const englishDay = formatter.format(new Date()).toLowerCase()
  return DAY_MAP[englishDay] ?? "Lunes"
}

export async function getTodayRoutineForMember() {
  const supabase = await createClient()

  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return null

  const { data: member } = await supabase
    .from("members")
    .select("plan_id, plans(name)")
    .eq("auth_user_id", user.id)
    .maybeSingle()

  if (!member?.plan_id) return null

  const today = getTodayLabel()

  const { data, error } = await supabase
    .from("routine_assignments")
    .select("day_of_week, routines (id, name, content, blocks)")
    .eq("plan_id", member.plan_id)
    .eq("day_of_week", today)
    .maybeSingle()

  if (error) throw error
  if (!data?.routines) return { day_of_week: today, plan_name: (member as any).plans?.name ?? null, routine: null }

  const routine = Array.isArray(data.routines) ? data.routines[0] : data.routines

  return {
    day_of_week: today,
    plan_name: (member as any).plans?.name ?? null,
    routine: routine as { id: string; name: string; content: string; blocks: unknown },
  }
}
