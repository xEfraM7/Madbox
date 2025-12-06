"use server"

import { createClient } from "@/utils/supabase/server"
import { revalidatePath } from "next/cache"
import type { TablesInsert, TablesUpdate } from "@/types/database"

export async function getPlans() {
  const supabase = await createClient()
  const { data, error } = await supabase
    .from("plans")
    .select("*")
    .order("price", { ascending: true })

  if (error) throw error
  return data
}

export async function createPlan(plan: TablesInsert<"plans">) {
  const supabase = await createClient()
  const { data, error } = await supabase
    .from("plans")
    .insert(plan)
    .select()
    .single()

  if (error) throw error
  revalidatePath("/dashboard/plans")
  return data
}

export async function updatePlan(id: string, plan: TablesUpdate<"plans">) {
  const supabase = await createClient()
  const { data, error } = await supabase
    .from("plans")
    .update({ ...plan, updated_at: new Date().toISOString() })
    .eq("id", id)
    .select()
    .single()

  if (error) throw error
  revalidatePath("/dashboard/plans")
  return data
}

export async function deletePlan(id: string) {
  const supabase = await createClient()
  const { error } = await supabase.from("plans").delete().eq("id", id)

  if (error) throw error
  revalidatePath("/dashboard/plans")
}
