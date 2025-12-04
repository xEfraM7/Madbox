"use server"

import { createClient } from "@/utils/supabase/server"
import { revalidatePath } from "next/cache"
import type { TablesInsert, TablesUpdate } from "@/types/database"

export async function getSpecialClasses() {
  const supabase = await createClient()
  const { data, error } = await supabase
    .from("special_classes")
    .select("*")
    .order("name")

  if (error) throw error
  return data
}

export async function createSpecialClass(classData: TablesInsert<"special_classes">) {
  const supabase = await createClient()
  const { data, error } = await supabase
    .from("special_classes")
    .insert(classData)
    .select()
    .single()

  if (error) throw error
  revalidatePath("/dashboard/classes")
  return data
}

export async function updateSpecialClass(id: string, classData: TablesUpdate<"special_classes">) {
  const supabase = await createClient()
  const { data, error } = await supabase
    .from("special_classes")
    .update({ ...classData, updated_at: new Date().toISOString() })
    .eq("id", id)
    .select()
    .single()

  if (error) throw error
  revalidatePath("/dashboard/classes")
  return data
}

export async function deleteSpecialClass(id: string) {
  const supabase = await createClient()
  const { error } = await supabase.from("special_classes").delete().eq("id", id)

  if (error) throw error
  revalidatePath("/dashboard/classes")
}

export async function getSpecialClassPayments() {
  const supabase = await createClient()
  const { data, error } = await supabase
    .from("special_class_payments")
    .select("*, members(name), special_classes(name)")
    .order("payment_date", { ascending: false })

  if (error) throw error
  return data
}

export async function createSpecialClassPayment(payment: TablesInsert<"special_class_payments">) {
  const supabase = await createClient()
  const { data, error } = await supabase
    .from("special_class_payments")
    .insert(payment)
    .select()
    .single()

  if (error) throw error
  revalidatePath("/dashboard/classes")
  return data
}
