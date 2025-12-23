"use server"

import { createClient } from "@/utils/supabase/server"
import { revalidatePath } from "next/cache"
import type { TablesInsert, TablesUpdate } from "@/types/database"
import { addToFund, subtractFromFund } from "./funds"
import { logActivity } from "./activity"

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

  // Actualizar la fecha de pago del cliente
  // La due_date del pago se convierte en el nuevo payment_date del miembro
  // Esto respeta el día de corte original del miembro
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

  // Agregar al fondo correspondiente si el pago está pagado
  if (payment.status === "paid" && payment.method && payment.amount) {
    await addToFund(payment.method, payment.amount)
  }

  // Obtener nombre del miembro para el log
  const { data: member } = await supabase
    .from("members")
    .select("name")
    .eq("id", payment.member_id)
    .single()

  await logActivity({
    action: "payment_registered",
    entityType: "payment",
    entityId: data.id,
    entityName: member?.name,
    details: { amount: payment.amount, method: payment.method }
  })

  revalidatePath("/dashboard/payments")
  revalidatePath("/dashboard/users")
  revalidatePath("/dashboard")
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


export async function deletePayment(id: string) {
  const supabase = await createClient()
  
  // Obtener el pago antes de eliminarlo para restar del fondo
  const { data: payment } = await supabase
    .from("payments")
    .select("method, amount, status, member_id, members(name)")
    .eq("id", id)
    .single()

  const { error } = await supabase.from("payments").delete().eq("id", id)
  if (error) throw error

  // Restar del fondo si el pago estaba pagado
  if (payment?.status === "paid" && payment.method && payment.amount) {
    await subtractFromFund(payment.method, payment.amount)
  }

  await logActivity({
    action: "payment_deleted",
    entityType: "payment",
    entityId: id,
    entityName: (payment as any)?.members?.name,
    details: { amount: payment?.amount }
  })

  revalidatePath("/dashboard/payments")
  revalidatePath("/dashboard")
}
