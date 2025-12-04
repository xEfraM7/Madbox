"use server"

import { createClient } from "@/utils/supabase/server"
import { revalidatePath } from "next/cache"
import type { TablesUpdate } from "@/types/database"

export async function getGymSettings() {
  const supabase = await createClient()
  const { data, error } = await supabase.from("gym_settings").select("*").single()

  if (error) throw error
  return data
}

export async function updateGymSettings(id: string, settings: TablesUpdate<"gym_settings">) {
  const supabase = await createClient()
  const { data, error } = await supabase
    .from("gym_settings")
    .update({ ...settings, updated_at: new Date().toISOString() })
    .eq("id", id)
    .select()
    .single()

  if (error) throw error
  revalidatePath("/dashboard/settings")
  return data
}

export async function getGymSchedule() {
  const supabase = await createClient()
  const { data, error } = await supabase
    .from("gym_schedule")
    .select("*")
    .order("id")

  if (error) throw error
  return data
}

export async function updateGymSchedule(id: string, schedule: { open_time: string; close_time: string }) {
  const supabase = await createClient()
  const { error } = await supabase
    .from("gym_schedule")
    .update(schedule)
    .eq("id", id)

  if (error) throw error
  revalidatePath("/dashboard/settings")
}
