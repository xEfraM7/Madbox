"use server"

import { createClient } from "@/utils/supabase/server"
import { revalidatePath } from "next/cache"
import type { TablesInsert, TablesUpdate } from "@/types/database"
import { addToFund, subtractFromFund } from "./funds"
import { logActivity } from "./activity"
import { toUsd } from "@/lib/utils"

export async function getPayments() {
  const supabase = await createClient()
  const { data, error } = await supabase
    .from("payments")
    .select("*, members(name, email), plans(name)")
    .order("created_at", { ascending: false })

  if (error) throw error
  return data
}

export async function createPayment(
  payment: TablesInsert<"payments">,
  options?: { enforceFullPayment?: boolean },
) {
  const supabase = await createClient()

  // --- Calcular saldo del periodo (lógica de abonos) ---
  // El saldo se lleva en USD. El primer abono (balance_due <= 0) abre el periodo
  // y avanza la fecha de corte; los siguientes solo reducen el saldo.
  let isInstallment = false
  let newBalance = 0
  let opensPeriod = true
  let memberFrozen = false

  if (payment.member_id) {
    const { data: member } = await supabase
      .from("members")
      .select("balance_due, frozen, plan_id")
      .eq("id", payment.member_id)
      .single()

    memberFrozen = member?.frozen ?? false
    const currentBalance = Number(member?.balance_due ?? 0)
    opensPeriod = currentBalance <= 0

    const planId = payment.plan_id || member?.plan_id || null
    let planPriceUsd = 0
    if (planId) {
      const { data: plan } = await supabase
        .from("plans")
        .select("price")
        .eq("id", planId)
        .single()
      planPriceUsd = Number(plan?.price ?? 0)
    }

    const remaining = opensPeriod ? planPriceUsd : currentBalance

    if (payment.method === "Solvencia sin ingreso") {
      // Salda el periodo completo sin entrar a fondo.
      newBalance = 0
      isInstallment = false
    } else {
      const abonoUsd = toUsd(Number(payment.amount), payment.method, payment.payment_rate)
      // Guarda de "pago completo": el monto debe cubrir el total restante del periodo.
      if (options?.enforceFullPayment && abonoUsd < remaining - 0.01) {
        throw new Error("El pago completo no cubre el total del periodo.")
      }
      const appliedUsd = Math.min(abonoUsd, remaining)
      newBalance = Math.max(0, remaining - appliedUsd)
      isInstallment = opensPeriod ? newBalance > 0 : true
    }
  }

  // --- Insertar el pago con la marca de abono ---
  const { data, error } = await supabase
    .from("payments")
    .insert({ ...payment, is_installment: isInstallment })
    .select()
    .single()

  if (error) throw error

  // --- Actualizar el miembro ---
  if (payment.member_id) {
    if (opensPeriod) {
      // Abre periodo: avanza la fecha de corte y activa (respetando congelado).
      const updates: TablesUpdate<"members"> = {
        balance_due: newBalance,
        updated_at: new Date().toISOString(),
      }
      if (payment.due_date) {
        updates.payment_date = payment.due_date
        updates.status = memberFrozen ? "frozen" : "active"
      }
      await supabase.from("members").update(updates).eq("id", payment.member_id)
    } else {
      // Continúa periodo: solo reduce el saldo, no toca la fecha de corte.
      await supabase
        .from("members")
        .update({ balance_due: newBalance, updated_at: new Date().toISOString() })
        .eq("id", payment.member_id)
    }
  }

  // Agregar al fondo correspondiente si el pago está pagado (monto real, sin doble conteo)
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
    details: {
      amount: payment.amount,
      method: payment.method,
      is_installment: isInstallment,
      balance_due: newBalance,
    },
  })

  revalidatePath("/dashboard/payments")
  revalidatePath("/dashboard/users")
  revalidatePath("/dashboard")
  return data
}

export async function updatePayment(id: string, payment: TablesUpdate<"payments">) {
  const supabase = await createClient()

  // Estado previo del pago para reajustar el saldo si era un abono y cambió el monto.
  const { data: prev } = await supabase
    .from("payments")
    .select("amount, method, payment_rate, is_installment, member_id, plan_id")
    .eq("id", id)
    .single()

  const { data, error } = await supabase
    .from("payments")
    .update({ ...payment, updated_at: new Date().toISOString() })
    .eq("id", id)
    .select()
    .single()

  if (error) throw error

  if (prev?.is_installment && prev.member_id) {
    const oldUsd = toUsd(Number(prev.amount), prev.method, prev.payment_rate)
    const newUsd = toUsd(Number(data.amount), data.method, data.payment_rate)
    const delta = oldUsd - newUsd // abono más chico => sube el saldo

    const { data: member } = await supabase
      .from("members")
      .select("balance_due, plan_id")
      .eq("id", prev.member_id)
      .single()

    const planId = data.plan_id || prev.plan_id || member?.plan_id || null
    let planPriceUsd = Number.POSITIVE_INFINITY
    if (planId) {
      const { data: plan } = await supabase
        .from("plans")
        .select("price")
        .eq("id", planId)
        .single()
      planPriceUsd = Number(plan?.price ?? Number.POSITIVE_INFINITY)
    }

    const adjusted = Math.min(
      planPriceUsd,
      Math.max(0, Number(member?.balance_due ?? 0) + delta),
    )
    await supabase
      .from("members")
      .update({ balance_due: adjusted, updated_at: new Date().toISOString() })
      .eq("id", prev.member_id)
  }

  revalidatePath("/dashboard/payments")
  revalidatePath("/dashboard/users")
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

  // Obtener el pago antes de eliminarlo para restar del fondo y restaurar saldo
  const { data: payment } = await supabase
    .from("payments")
    .select("method, amount, status, member_id, payment_rate, is_installment, plan_id, members(name)")
    .eq("id", id)
    .single()

  const { error } = await supabase.from("payments").delete().eq("id", id)
  if (error) throw error

  // Restar del fondo si el pago estaba pagado
  if (payment?.status === "paid" && payment.method && payment.amount) {
    await subtractFromFund(payment.method, payment.amount)
  }

  // Restaurar el saldo del miembro si el pago era un abono parcial
  if (payment?.is_installment && payment.member_id) {
    const abonoUsd = toUsd(Number(payment.amount), payment.method, payment.payment_rate)

    const { data: member } = await supabase
      .from("members")
      .select("balance_due, plan_id")
      .eq("id", payment.member_id)
      .single()

    const planId = payment.plan_id || member?.plan_id || null
    let planPriceUsd = Number.POSITIVE_INFINITY
    if (planId) {
      const { data: plan } = await supabase
        .from("plans")
        .select("price")
        .eq("id", planId)
        .single()
      planPriceUsd = Number(plan?.price ?? Number.POSITIVE_INFINITY)
    }

    const restored = Math.min(planPriceUsd, Number(member?.balance_due ?? 0) + abonoUsd)
    await supabase
      .from("members")
      .update({ balance_due: restored, updated_at: new Date().toISOString() })
      .eq("id", payment.member_id)
  }

  await logActivity({
    action: "payment_deleted",
    entityType: "payment",
    entityId: id,
    entityName: (payment as { members?: { name?: string } } | null)?.members?.name,
    details: { amount: payment?.amount },
  })

  revalidatePath("/dashboard/payments")
  revalidatePath("/dashboard/users")
  revalidatePath("/dashboard")
}
