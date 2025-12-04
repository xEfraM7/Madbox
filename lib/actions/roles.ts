"use server"

import { createClient } from "@/utils/supabase/server"
import { revalidatePath } from "next/cache"
import type { TablesInsert, TablesUpdate } from "@/types/database"

export async function getRoles() {
  const supabase = await createClient()
  const { data, error } = await supabase.from("roles").select("*").order("name")

  if (error) throw error
  return data
}

export async function createRole(role: TablesInsert<"roles">) {
  const supabase = await createClient()
  const { data, error } = await supabase.from("roles").insert(role).select().single()

  if (error) throw error
  revalidatePath("/dashboard/roles")
  return data
}

export async function updateRole(id: string, role: TablesUpdate<"roles">) {
  const supabase = await createClient()
  const { data, error } = await supabase
    .from("roles")
    .update({ ...role, updated_at: new Date().toISOString() })
    .eq("id", id)
    .select()
    .single()

  if (error) throw error
  revalidatePath("/dashboard/roles")
  return data
}

export async function deleteRole(id: string) {
  const supabase = await createClient()
  const { error } = await supabase.from("roles").delete().eq("id", id)

  if (error) throw error
  revalidatePath("/dashboard/roles")
}

export async function getAdmins() {
  const supabase = await createClient()
  const { data, error } = await supabase
    .from("admins")
    .select("*, roles(name)")
    .order("name")

  if (error) throw error
  return data
}

export async function createAdmin(admin: TablesInsert<"admins">) {
  const supabase = await createClient()
  const { data, error } = await supabase.from("admins").insert(admin).select().single()

  if (error) throw error
  revalidatePath("/dashboard/roles")
  return data
}

export async function updateAdmin(id: string, admin: TablesUpdate<"admins">) {
  const supabase = await createClient()
  const { data, error } = await supabase
    .from("admins")
    .update({ ...admin, updated_at: new Date().toISOString() })
    .eq("id", id)
    .select()
    .single()

  if (error) throw error
  revalidatePath("/dashboard/roles")
  return data
}

export async function deleteAdmin(id: string) {
  const supabase = await createClient()
  const { error } = await supabase.from("admins").delete().eq("id", id)

  if (error) throw error
  revalidatePath("/dashboard/roles")
}
