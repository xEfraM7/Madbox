"use server"

import { createClient } from "@/utils/supabase/server"
import { revalidatePath } from "next/cache"
import type { TablesInsert, TablesUpdate } from "@/types/database"
import { logActivity } from "./activity"
import { addToFund, subtractFromFund } from "./funds"

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

  await logActivity({
    action: "class_created",
    entityType: "special_class",
    entityId: data.id,
    entityName: data.name,
  })

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
  
  const { data: classItem } = await supabase
    .from("special_classes")
    .select("name")
    .eq("id", id)
    .single()

  const { error } = await supabase.from("special_classes").delete().eq("id", id)
  if (error) throw error

  await logActivity({
    action: "class_deleted",
    entityType: "special_class",
    entityId: id,
    entityName: classItem?.name,
  })

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
    .select("*, members(name), special_classes(name)")
    .single()

  if (error) throw error

  // Agregar al fondo correspondiente
  if (payment.status === "paid" && payment.method && payment.amount) {
    await addToFund(payment.method, payment.amount)
  }

  await logActivity({
    action: "class_payment_registered",
    entityType: "special_class_payment",
    entityId: data.id,
    entityName: (data as any).members?.name,
    details: { amount: payment.amount, class: (data as any).special_classes?.name }
  })

  revalidatePath("/dashboard/classes")
  revalidatePath("/dashboard")
  return data
}


export async function deleteSpecialClassPayment(id: string) {
  const supabase = await createClient()
  
  const { data: payment } = await supabase
    .from("special_class_payments")
    .select("amount, method, status, members(name)")
    .eq("id", id)
    .single()

  const { error } = await supabase.from("special_class_payments").delete().eq("id", id)
  if (error) throw error

  // Restar del fondo si el pago estaba pagado
  if (payment?.status === "paid" && payment.method && payment.amount) {
    await subtractFromFund(payment.method, payment.amount)
  }

  await logActivity({
    action: "class_payment_deleted",
    entityType: "special_class_payment",
    entityId: id,
    entityName: (payment as any)?.members?.name,
    details: { amount: payment?.amount }
  })

  revalidatePath("/dashboard/classes")
  revalidatePath("/dashboard")
}
