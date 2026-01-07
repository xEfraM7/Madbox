"use server"

import { createClient } from "@/utils/supabase/server"
import { revalidatePath } from "next/cache"

// Tipos de métodos de pago y su fondo correspondiente
const PAYMENT_METHOD_TO_FUND: Record<string, string> = {
  "Pago Movil": "BS",
  "Efectivo bs": "BS",
  "Transferencia BS": "BS",
  "Transferencia": "USDT",
  "Efectivo": "USD_CASH",
  "USDT": "USDT",
}

export async function getExchangeRates() {
  const supabase = await createClient()
  const { data, error } = await supabase
    .from("exchange_rates")
    .select("*")
    .order("type")

  if (error) throw error
  return data
}

export async function updateExchangeRate(type: string, rate: number) {
  const supabase = await createClient()
  const { error } = await supabase
    .from("exchange_rates")
    .update({ rate, updated_at: new Date().toISOString() })
    .eq("type", type)

  if (error) throw error
  revalidatePath("/dashboard")
  revalidatePath("/dashboard/settings")
}

export async function getFunds() {
  const supabase = await createClient()
  const { data, error } = await supabase
    .from("funds")
    .select("*")
    .order("type")

  if (error) throw error
  return data
}

export async function getFundsWithConversion() {
  const supabase = await createClient()
  
  const [fundsResult, ratesResult, paymentsResult, classPaymentsResult] = await Promise.all([
    supabase.from("funds").select("*"),
    supabase.from("exchange_rates").select("*"),
    supabase.from("payments").select("amount, method, status").eq("status", "paid"),
    supabase.from("special_class_payments").select("amount, method, status").eq("status", "paid"),
  ])

  if (fundsResult.error) throw fundsResult.error
  if (ratesResult.error) throw ratesResult.error

  const rates = ratesResult.data || []
  const payments = paymentsResult.data || []
  const classPayments = classPaymentsResult.data || []

  const bcvRate = rates.find(r => r.type === "BCV")?.rate || 1
  const usdtRate = rates.find(r => r.type === "USDT")?.rate || 1
  const customRate = rates.find(r => r.type === "CUSTOM")?.rate || 1

  // Calcular totales de todos los pagos (membresías + clases especiales)
  let bsTotal = 0
  let usdCashTotal = 0
  let usdtTotal = 0

  const allPayments = [...payments, ...classPayments]
  allPayments.forEach((p) => {
    const amount = Number(p.amount)
    if (p.method === "Pago Movil" || p.method === "Efectivo bs" || p.method === "Transferencia BS") {
      bsTotal += amount
    } else if (p.method === "Efectivo") {
      usdCashTotal += amount
    } else if (p.method === "USDT" || p.method === "Transferencia") {
      usdtTotal += amount
    }
  })

  // Calcular totales en USD
  const bsInUsd = bsTotal / bcvRate
  const totalInUsd = bsInUsd + usdCashTotal + usdtTotal

  return {
    funds: {
      bs: { balance: bsTotal, inUsd: bsInUsd, rate: bcvRate },
      usdCash: { balance: usdCashTotal, rate: usdtRate },
      usdt: { balance: usdtTotal, rate: usdtRate },
    },
    rates: { bcv: bcvRate, usdt: usdtRate, cash: usdtRate, custom: customRate },
    totalInUsd,
  }
}

export async function getFundsWithConversionByMonth(monthOffset: number = 0) {
  const supabase = await createClient()

  const now = new Date()
  const targetMonth = new Date(now.getFullYear(), now.getMonth() + monthOffset, 1)
  const startOfMonth = targetMonth.toISOString().split("T")[0]
  const endOfMonth = new Date(targetMonth.getFullYear(), targetMonth.getMonth() + 1, 0).toISOString().split("T")[0]
  
  const [fundsResult, ratesResult, paymentsResult, classPaymentsResult] = await Promise.all([
    supabase.from("funds").select("*"),
    supabase.from("exchange_rates").select("*"),
    supabase
      .from("payments")
      .select("amount, method, status")
      .eq("status", "paid")
      .gte("payment_date", startOfMonth)
      .lte("payment_date", endOfMonth),
    supabase
      .from("special_class_payments")
      .select("amount, method, status")
      .eq("status", "paid")
      .gte("payment_date", startOfMonth)
      .lte("payment_date", endOfMonth),
  ])

  if (fundsResult.error) throw fundsResult.error
  if (ratesResult.error) throw ratesResult.error

  const rates = ratesResult.data || []
  const payments = paymentsResult.data || []
  const classPayments = classPaymentsResult.data || []

  const bcvRate = rates.find(r => r.type === "BCV")?.rate || 1
  const usdtRate = rates.find(r => r.type === "USDT")?.rate || 1
  const customRate = rates.find(r => r.type === "CUSTOM")?.rate || 1

  // Calcular totales de pagos del mes (membresías + clases especiales)
  let bsTotal = 0
  let usdCashTotal = 0
  let usdtTotal = 0

  const allPayments = [...payments, ...classPayments]
  allPayments.forEach((p) => {
    const amount = Number(p.amount)
    if (p.method === "Pago Movil" || p.method === "Efectivo bs" || p.method === "Transferencia BS") {
      bsTotal += amount
    } else if (p.method === "Efectivo") {
      usdCashTotal += amount
    } else if (p.method === "USDT" || p.method === "Transferencia") {
      usdtTotal += amount
    }
  })

  // Calcular totales en USD
  const bsInUsd = bsTotal / bcvRate
  const totalInUsd = bsInUsd + usdCashTotal + usdtTotal

  return {
    funds: {
      bs: { balance: bsTotal, inUsd: bsInUsd, rate: bcvRate },
      usdCash: { balance: usdCashTotal, rate: usdtRate },
      usdt: { balance: usdtTotal, rate: usdtRate },
    },
    rates: { bcv: bcvRate, usdt: usdtRate, cash: usdtRate, custom: customRate },
    totalInUsd,
  }
}

export async function addToFund(method: string, amount: number) {
  const fundType = PAYMENT_METHOD_TO_FUND[method]
  if (!fundType) return

  const supabase = await createClient()
  
  // Obtener el balance actual
  const { data: fund } = await supabase
    .from("funds")
    .select("balance")
    .eq("type", fundType)
    .single()

  const currentBalance = fund?.balance || 0
  const newBalance = currentBalance + amount

  // Actualizar el balance
  const { error } = await supabase
    .from("funds")
    .update({ balance: newBalance, updated_at: new Date().toISOString() })
    .eq("type", fundType)

  if (error) throw error
  revalidatePath("/dashboard")
}

export async function subtractFromFund(method: string, amount: number) {
  const fundType = PAYMENT_METHOD_TO_FUND[method]
  if (!fundType) return

  const supabase = await createClient()
  
  const { data: fund } = await supabase
    .from("funds")
    .select("balance")
    .eq("type", fundType)
    .single()

  const currentBalance = fund?.balance || 0
  const newBalance = Math.max(0, currentBalance - amount)

  const { error } = await supabase
    .from("funds")
    .update({ balance: newBalance, updated_at: new Date().toISOString() })
    .eq("type", fundType)

  if (error) throw error
  revalidatePath("/dashboard")
}

export async function resetFund(type: string) {
  const supabase = await createClient()
  
  const { error } = await supabase
    .from("funds")
    .update({ balance: 0, updated_at: new Date().toISOString() })
    .eq("type", type)

  if (error) throw error
  revalidatePath("/dashboard")
}

export async function withdrawFromFund(type: string, amount: number) {
  const supabase = await createClient()
  
  const { data: fund } = await supabase
    .from("funds")
    .select("balance")
    .eq("type", type)
    .single()

  const currentBalance = fund?.balance || 0
  if (amount > currentBalance) {
    throw new Error("Fondos insuficientes")
  }

  const newBalance = currentBalance - amount

  const { error } = await supabase
    .from("funds")
    .update({ balance: newBalance, updated_at: new Date().toISOString() })
    .eq("type", type)

  if (error) throw error
  revalidatePath("/dashboard")
}

// Obtener totales de pagos de membresías por método
export async function getPaymentsFundsSummary() {
  const supabase = await createClient()
  
  const { data: payments } = await supabase
    .from("payments")
    .select("amount, method, status")
    .eq("status", "paid")

  if (!payments) return { bs: 0, usdCash: 0, usdt: 0 }

  let bs = 0
  let usdCash = 0
  let usdt = 0

  payments.forEach((p) => {
    const amount = Number(p.amount)
    if (p.method === "Pago Movil" || p.method === "Efectivo bs" || p.method === "Transferencia BS") {
      bs += amount
    } else if (p.method === "Efectivo") {
      usdCash += amount
    } else if (p.method === "USDT" || p.method === "Transferencia") {
      usdt += amount
    }
  })

  return { bs, usdCash, usdt }
}

// Obtener totales de pagos del mes actual
export async function getPaymentsFundsSummaryByMonth(monthOffset: number = 0) {
  const supabase = await createClient()
  
  const now = new Date()
  const targetMonth = new Date(now.getFullYear(), now.getMonth() + monthOffset, 1)
  const startOfMonth = targetMonth.toISOString().split("T")[0]
  const endOfMonth = new Date(targetMonth.getFullYear(), targetMonth.getMonth() + 1, 0).toISOString().split("T")[0]

  const { data: payments } = await supabase
    .from("payments")
    .select("amount, method, status, payment_date")
    .eq("status", "paid")
    .gte("payment_date", startOfMonth)
    .lte("payment_date", endOfMonth)

  if (!payments) return { bs: 0, usdCash: 0, usdt: 0 }

  let bs = 0
  let usdCash = 0
  let usdt = 0

  payments.forEach((p) => {
    const amount = Number(p.amount)
    if (p.method === "Pago Movil" || p.method === "Efectivo bs" || p.method === "Transferencia BS") {
      bs += amount
    } else if (p.method === "Efectivo") {
      usdCash += amount
    } else if (p.method === "USDT" || p.method === "Transferencia") {
      usdt += amount
    }
  })

  return { bs, usdCash, usdt }
}

// Obtener totales de pagos de clases especiales por método
export async function getSpecialClassPaymentsFundsSummary() {
  const supabase = await createClient()
  
  const { data: payments } = await supabase
    .from("special_class_payments")
    .select("amount, method, status")
    .eq("status", "paid")

  if (!payments) return { bs: 0, usdCash: 0, usdt: 0 }

  let bs = 0
  let usdCash = 0
  let usdt = 0

  payments.forEach((p) => {
    const amount = Number(p.amount)
    if (p.method === "Pago Movil" || p.method === "Efectivo bs" || p.method === "Transferencia BS") {
      bs += amount
    } else if (p.method === "Efectivo") {
      usdCash += amount
    } else if (p.method === "USDT" || p.method === "Transferencia") {
      usdt += amount
    }
  })

  return { bs, usdCash, usdt }
}
