"use server"

import { createClient } from "@/utils/supabase/server"
import { revalidatePath } from "next/cache"
import type { TablesInsert, TablesUpdate } from "@/types/database"

export async function getPayments() {
  const supabase = await createClient()
  const { data, error } = await supabase
    .from("payments")
    .select("*, members(name, email), plans(name)")
    .order("created_at", { ascending: false })

  if (error) throw error
  return data
}

export async function createPayment(payment: TablesInsert<"payments">) {
  const supabase = await createClient()
  const { data, error } = await supabase
    .from("payments")
    .insert(payment)
    .select()
    .single()

  if (error) throw error

  // Actualizar la fecha de pago del cliente (due_date será su nueva fecha de pago)
  if (payment.member_id && payment.due_date) {
    await supabase
      .from("members")
      .update({ 
        payment_date: payment.due_date, 
        status: "active",
        updated_at: new Date().toISOString() 
      })
      .eq("id", payment.member_id)
  }

  revalidatePath("/dashboard/payments")
  revalidatePath("/dashboard/users")
  return data
}

export async function updatePayment(id: string, payment: TablesUpdate<"payments">) {
  const supabase = await createClient()
  const { data, error } = await supabase
    .from("payments")
    .update({ ...payment, updated_at: new Date().toISOString() })
    .eq("id", id)
    .select()
    .single()

  if (error) throw error
  revalidatePath("/dashboard/payments")
  return data
}

export async function getPaymentStats() {
  const supabase = await createClient()
  const { data, error } = await supabase.from("payments").select("amount, status")

  if (error) throw error

  const totalPaid = data.filter((p) => p.status === "paid").reduce((sum, p) => sum + p.amount, 0)
  const pendingCount = data.filter((p) => p.status === "pending").length
  const overdueCount = data.filter((p) => p.status === "overdue").length

  return { totalPaid, pendingCount, overdueCount }
}

export async function getMemberPayments(memberId: string) {
  const supabase = await createClient()
  const { data, error } = await supabase
    .from("payments")
    .select("*, plans(name)")
    .eq("member_id", memberId)
    .order("payment_date", { ascending: false })
    .limit(10)

  if (error) throw error
  return data
}
