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
