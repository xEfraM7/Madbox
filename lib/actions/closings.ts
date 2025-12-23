"use server"

import { createClient } from "@/utils/supabase/server"
import { revalidatePath } from "next/cache"
import type { MonthlyClosing, MonthlyClosingPreview } from "@/types/database"
import { logActivity } from "./activity"

/**
 * Get all monthly closings ordered by period descending
 * Requirements: 4.1
 */
export async function getMonthlyClosings(): Promise<MonthlyClosing[]> {
  const supabase = await createClient()
  
  const { data, error } = await supabase
    .from("monthly_closings")
    .select("*, admin:admins(name)")
    .order("period", { ascending: false })

  if (error) throw error
  
  return (data || []).map(row => ({
    id: row.id,
    period: row.period,
    membership_revenue_bs: row.membership_revenue_bs ?? 0,
    membership_revenue_usd_cash: row.membership_revenue_usd_cash ?? 0,
    membership_revenue_usdt: row.membership_revenue_usdt ?? 0,
    membership_payments_count: row.membership_payments_count ?? 0,
    class_revenue_bs: row.class_revenue_bs ?? 0,
    class_revenue_usd_cash: row.class_revenue_usd_cash ?? 0,
    class_revenue_usdt: row.class_revenue_usdt ?? 0,
    class_payments_count: row.class_payments_count ?? 0,
    total_revenue_usd: row.total_revenue_usd ?? 0,
    active_members: row.active_members ?? 0,
    new_members: row.new_members ?? 0,
    expired_members: row.expired_members ?? 0,
    frozen_members: row.frozen_members ?? 0,
    total_members: row.total_members ?? 0,
    retention_rate: row.retention_rate ?? 0,
    funds_bs: row.funds_bs ?? 0,
    funds_usd_cash: row.funds_usd_cash ?? 0,
    funds_usdt: row.funds_usdt ?? 0,
    funds_reset: row.funds_reset ?? false,
    rate_bcv: row.rate_bcv ?? 0,
    rate_usdt: row.rate_usdt ?? 0,
    rate_custom: row.rate_custom ?? 0,
    closed_by: row.closed_by,
    closed_at: row.closed_at ?? new Date().toISOString(),
    notes: row.notes,
    created_at: row.created_at ?? new Date().toISOString(),
    admin: row.admin as { name: string } | undefined
  }))
}

/**
 * Get a single monthly closing by ID
 * Requirements: 4.2, 4.3, 4.4, 4.5
 */
export async function getMonthlyClosing(id: string): Promise<MonthlyClosing | null> {
  const supabase = await createClient()
  
  const { data, error } = await supabase
    .from("monthly_closings")
    .select("*, admin:admins(name)")
    .eq("id", id)
    .single()

  if (error) {
    if (error.code === "PGRST116") return null // Not found
    throw error
  }
  
  if (!data) return null

  return {
    id: data.id,
    period: data.period,
    membership_revenue_bs: data.membership_revenue_bs ?? 0,
    membership_revenue_usd_cash: data.membership_revenue_usd_cash ?? 0,
    membership_revenue_usdt: data.membership_revenue_usdt ?? 0,
    membership_payments_count: data.membership_payments_count ?? 0,
    class_revenue_bs: data.class_revenue_bs ?? 0,
    class_revenue_usd_cash: data.class_revenue_usd_cash ?? 0,
    class_revenue_usdt: data.class_revenue_usdt ?? 0,
    class_payments_count: data.class_payments_count ?? 0,
    total_revenue_usd: data.total_revenue_usd ?? 0,
    active_members: data.active_members ?? 0,
    new_members: data.new_members ?? 0,
    expired_members: data.expired_members ?? 0,
    frozen_members: data.frozen_members ?? 0,
    total_members: data.total_members ?? 0,
    retention_rate: data.retention_rate ?? 0,
    funds_bs: data.funds_bs ?? 0,
    funds_usd_cash: data.funds_usd_cash ?? 0,
    funds_usdt: data.funds_usdt ?? 0,
    funds_reset: data.funds_reset ?? false,
    rate_bcv: data.rate_bcv ?? 0,
    rate_usdt: data.rate_usdt ?? 0,
    rate_custom: data.rate_custom ?? 0,
    closed_by: data.closed_by,
    closed_at: data.closed_at ?? new Date().toISOString(),
    notes: data.notes,
    created_at: data.created_at ?? new Date().toISOString(),
    admin: data.admin as { name: string } | undefined
  }
}


/**
 * Get preview of current month data (without closing)
 * Requirements: 4.1, 4.2, 4.3, 4.4, 4.5
 */
export async function getCurrentMonthPreview(): Promise<MonthlyClosingPreview> {
  const supabase = await createClient()
  
  // Get current period (YYYY-MM format)
  const now = new Date()
  const period = `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, "0")}`
  
  // Calculate date range for current month
  const startOfMonth = new Date(now.getFullYear(), now.getMonth(), 1)
  const endOfMonth = new Date(now.getFullYear(), now.getMonth() + 1, 0, 23, 59, 59)
  
  const startDate = startOfMonth.toISOString()
  const endDate = endOfMonth.toISOString()

  // Fetch all required data in parallel
  const [
    membershipPaymentsResult,
    classPaymentsResult,
    membersResult,
    fundsResult,
    ratesResult,
    newMembersResult
  ] = await Promise.all([
    // Membership payments for the period
    supabase
      .from("payments")
      .select("amount, method")
      .eq("status", "paid")
      .gte("payment_date", startDate)
      .lte("payment_date", endDate),
    
    // Class payments for the period
    supabase
      .from("special_class_payments")
      .select("amount, method")
      .eq("status", "paid")
      .gte("payment_date", startDate)
      .lte("payment_date", endDate),
    
    // All members for metrics
    supabase
      .from("members")
      .select("status, frozen"),
    
    // Current fund balances
    supabase
      .from("funds")
      .select("type, balance"),
    
    // Exchange rates
    supabase
      .from("exchange_rates")
      .select("type, rate"),
    
    // New members this month
    supabase
      .from("members")
      .select("id")
      .gte("created_at", startDate)
      .lte("created_at", endDate)
  ])

  // Calculate membership revenue by method
  const membershipPayments = membershipPaymentsResult.data || []
  const membershipRevenue = calculateRevenueByMethod(membershipPayments)

  // Calculate class revenue by method
  const classPayments = classPaymentsResult.data || []
  const classRevenue = calculateRevenueByMethod(classPayments)

  // Calculate member metrics
  const members = membersResult.data || []
  const totalMembers = members.length
  const activeMembers = members.filter(m => m.status === "active").length
  const expiredMembers = members.filter(m => m.status === "expired").length
  const frozenMembers = members.filter(m => m.frozen === true).length
  const newMembers = newMembersResult.data?.length || 0
  const retentionRate = totalMembers > 0 ? (activeMembers / totalMembers) * 100 : 0

  // Get fund balances
  const funds = fundsResult.data || []
  const fundsBs = funds.find(f => f.type === "BS")?.balance || 0
  const fundsUsdCash = funds.find(f => f.type === "USD_CASH")?.balance || 0
  const fundsUsdt = funds.find(f => f.type === "USDT")?.balance || 0

  // Get exchange rates
  const rates = ratesResult.data || []
  const rateBcv = rates.find(r => r.type === "BCV")?.rate || 1
  const rateUsdt = rates.find(r => r.type === "USDT")?.rate || 1
  const rateCustom = rates.find(r => r.type === "CUSTOM")?.rate || 1

  // Calculate total revenue in USD
  const totalBs = membershipRevenue.bs + classRevenue.bs
  const totalUsdCash = membershipRevenue.usd_cash + classRevenue.usd_cash
  const totalUsdt = membershipRevenue.usdt + classRevenue.usdt
  const totalRevenueUsd = (totalBs / rateBcv) + totalUsdCash + totalUsdt

  return {
    period,
    membership_revenue: {
      bs: membershipRevenue.bs,
      usd_cash: membershipRevenue.usd_cash,
      usdt: membershipRevenue.usdt,
      count: membershipPayments.length
    },
    class_revenue: {
      bs: classRevenue.bs,
      usd_cash: classRevenue.usd_cash,
      usdt: classRevenue.usdt,
      count: classPayments.length
    },
    total_revenue_usd: totalRevenueUsd,
    members: {
      active: activeMembers,
      new: newMembers,
      expired: expiredMembers,
      frozen: frozenMembers,
      total: totalMembers,
      retention: retentionRate
    },
    funds: {
      bs: fundsBs,
      usd_cash: fundsUsdCash,
      usdt: fundsUsdt
    },
    rates: {
      bcv: rateBcv,
      usdt: rateUsdt,
      custom: rateCustom
    }
  }
}

/**
 * Helper function to calculate revenue by payment method
 */
function calculateRevenueByMethod(payments: { amount: number; method: string | null }[]): {
  bs: number
  usd_cash: number
  usdt: number
} {
  let bs = 0
  let usd_cash = 0
  let usdt = 0

  payments.forEach(p => {
    const amount = Number(p.amount)
    if (p.method === "Pago Movil" || p.method === "Efectivo bs" || p.method === "Transferencia BS") {
      bs += amount
    } else if (p.method === "Efectivo") {
      usd_cash += amount
    } else if (p.method === "USDT" || p.method === "Transferencia") {
      usdt += amount
    }
  })

  return { bs, usd_cash, usdt }
}


/**
 * Create a new monthly closing
 * Requirements: 1.1, 1.2, 1.3, 1.4, 1.5, 1.6, 2.1, 2.2, 2.3, 2.4, 2.5, 3.1, 3.2, 3.3, 3.4
 */
export async function createMonthlyClosing(
  period: string,
  resetFunds: boolean,
  notes?: string
): Promise<MonthlyClosing> {
  const supabase = await createClient()

  // Validate period format (YYYY-MM)
  if (!/^\d{4}-\d{2}$/.test(period)) {
    throw new Error("Formato de período inválido. Use YYYY-MM")
  }

  // Check for duplicate period (Requirement 1.6)
  const { data: existing } = await supabase
    .from("monthly_closings")
    .select("id")
    .eq("period", period)
    .single()

  if (existing) {
    throw new Error(`Ya existe un cierre para el período ${period}`)
  }

  // Parse period to get date range
  const [year, month] = period.split("-").map(Number)
  const startOfMonth = new Date(year, month - 1, 1)
  const endOfMonth = new Date(year, month, 0, 23, 59, 59)
  
  const startDate = startOfMonth.toISOString()
  const endDate = endOfMonth.toISOString()

  // Fetch all required data in parallel
  const [
    membershipPaymentsResult,
    classPaymentsResult,
    membersResult,
    fundsResult,
    ratesResult,
    newMembersResult,
    currentUserResult
  ] = await Promise.all([
    // Membership payments for the period (Requirement 1.1)
    supabase
      .from("payments")
      .select("amount, method")
      .eq("status", "paid")
      .gte("payment_date", startDate)
      .lte("payment_date", endDate),
    
    // Class payments for the period (Requirement 1.2)
    supabase
      .from("special_class_payments")
      .select("amount, method")
      .eq("status", "paid")
      .gte("payment_date", startDate)
      .lte("payment_date", endDate),
    
    // All members for metrics (Requirements 2.1, 2.2, 2.3, 2.4)
    supabase
      .from("members")
      .select("status, frozen"),
    
    // Current fund balances (Requirement 3.1)
    supabase
      .from("funds")
      .select("type, balance"),
    
    // Exchange rates (Requirement 1.4)
    supabase
      .from("exchange_rates")
      .select("type, rate"),
    
    // New members this month (Requirement 2.2)
    supabase
      .from("members")
      .select("id")
      .gte("created_at", startDate)
      .lte("created_at", endDate),
    
    // Get current user for closed_by
    supabase.auth.getUser()
  ])

  // Calculate membership revenue by method (Requirement 1.3)
  const membershipPayments = membershipPaymentsResult.data || []
  const membershipRevenue = calculateRevenueByMethod(membershipPayments)

  // Calculate class revenue by method (Requirement 1.3)
  const classPayments = classPaymentsResult.data || []
  const classRevenue = calculateRevenueByMethod(classPayments)

  // Calculate member metrics (Requirements 2.1, 2.2, 2.3, 2.4)
  const members = membersResult.data || []
  const totalMembers = members.length
  const activeMembers = members.filter(m => m.status === "active").length
  const expiredMembers = members.filter(m => m.status === "expired").length
  const frozenMembers = members.filter(m => m.frozen === true).length
  const newMembers = newMembersResult.data?.length || 0
  
  // Calculate retention rate (Requirement 2.5)
  const retentionRate = totalMembers > 0 ? (activeMembers / totalMembers) * 100 : 0

  // Get fund balances (Requirement 3.1)
  const funds = fundsResult.data || []
  const fundsBs = funds.find(f => f.type === "BS")?.balance || 0
  const fundsUsdCash = funds.find(f => f.type === "USD_CASH")?.balance || 0
  const fundsUsdt = funds.find(f => f.type === "USDT")?.balance || 0

  // Get exchange rates (Requirement 1.4)
  const rates = ratesResult.data || []
  const rateBcv = rates.find(r => r.type === "BCV")?.rate || 1
  const rateUsdt = rates.find(r => r.type === "USDT")?.rate || 1
  const rateCustom = rates.find(r => r.type === "CUSTOM")?.rate || 1

  // Calculate total revenue in USD (Requirement 1.5)
  const totalBs = membershipRevenue.bs + classRevenue.bs
  const totalUsdCash = membershipRevenue.usd_cash + classRevenue.usd_cash
  const totalUsdt = membershipRevenue.usdt + classRevenue.usdt
  const totalRevenueUsd = (totalBs / rateBcv) + totalUsdCash + totalUsdt

  // Get admin ID for closed_by
  let closedBy: string | null = null
  if (currentUserResult.data?.user) {
    const { data: admin } = await supabase
      .from("admins")
      .select("id")
      .eq("auth_user_id", currentUserResult.data.user.id)
      .single()
    closedBy = admin?.id || null
  }

  // Create the monthly closing record
  const { data: closing, error } = await supabase
    .from("monthly_closings")
    .insert({
      period,
      membership_revenue_bs: membershipRevenue.bs,
      membership_revenue_usd_cash: membershipRevenue.usd_cash,
      membership_revenue_usdt: membershipRevenue.usdt,
      membership_payments_count: membershipPayments.length,
      class_revenue_bs: classRevenue.bs,
      class_revenue_usd_cash: classRevenue.usd_cash,
      class_revenue_usdt: classRevenue.usdt,
      class_payments_count: classPayments.length,
      total_revenue_usd: totalRevenueUsd,
      active_members: activeMembers,
      new_members: newMembers,
      expired_members: expiredMembers,
      frozen_members: frozenMembers,
      total_members: totalMembers,
      retention_rate: retentionRate,
      funds_bs: fundsBs,
      funds_usd_cash: fundsUsdCash,
      funds_usdt: fundsUsdt,
      funds_reset: resetFunds,
      rate_bcv: rateBcv,
      rate_usdt: rateUsdt,
      rate_custom: rateCustom,
      closed_by: closedBy,
      notes
    })
    .select("*, admin:admins(name)")
    .single()

  if (error) throw error

  // Reset funds if requested (Requirements 3.2, 3.3)
  if (resetFunds) {
    await supabase
      .from("funds")
      .update({ balance: 0, updated_at: new Date().toISOString() })
      .in("type", ["BS", "USD_CASH", "USDT"])

    // Log fund reset activity (Requirement 3.4)
    await logActivity({
      action: "funds_reset",
      entityType: "fund",
      entityId: closing.id,
      entityName: period,
      details: {
        previous_bs: fundsBs,
        previous_usd_cash: fundsUsdCash,
        previous_usdt: fundsUsdt
      }
    })
  }

  // Log closing activity
  await logActivity({
    action: "monthly_closing_created",
    entityType: "monthly_closing",
    entityId: closing.id,
    entityName: period,
    details: {
      total_revenue_usd: totalRevenueUsd,
      active_members: activeMembers,
      funds_reset: resetFunds
    }
  })

  revalidatePath("/dashboard/closings")
  revalidatePath("/dashboard")

  return {
    id: closing.id,
    period: closing.period,
    membership_revenue_bs: closing.membership_revenue_bs ?? 0,
    membership_revenue_usd_cash: closing.membership_revenue_usd_cash ?? 0,
    membership_revenue_usdt: closing.membership_revenue_usdt ?? 0,
    membership_payments_count: closing.membership_payments_count ?? 0,
    class_revenue_bs: closing.class_revenue_bs ?? 0,
    class_revenue_usd_cash: closing.class_revenue_usd_cash ?? 0,
    class_revenue_usdt: closing.class_revenue_usdt ?? 0,
    class_payments_count: closing.class_payments_count ?? 0,
    total_revenue_usd: closing.total_revenue_usd ?? 0,
    active_members: closing.active_members ?? 0,
    new_members: closing.new_members ?? 0,
    expired_members: closing.expired_members ?? 0,
    frozen_members: closing.frozen_members ?? 0,
    total_members: closing.total_members ?? 0,
    retention_rate: closing.retention_rate ?? 0,
    funds_bs: closing.funds_bs ?? 0,
    funds_usd_cash: closing.funds_usd_cash ?? 0,
    funds_usdt: closing.funds_usdt ?? 0,
    funds_reset: closing.funds_reset ?? false,
    rate_bcv: closing.rate_bcv ?? 0,
    rate_usdt: closing.rate_usdt ?? 0,
    rate_custom: closing.rate_custom ?? 0,
    closed_by: closing.closed_by,
    closed_at: closing.closed_at ?? new Date().toISOString(),
    notes: closing.notes,
    created_at: closing.created_at ?? new Date().toISOString(),
    admin: closing.admin as { name: string } | undefined
  }
}

/**
 * Export monthly closing data to a formatted string
 * Requirements: 6.1, 6.2
 */
export async function exportMonthlyClosing(id: string): Promise<string> {
  const closing = await getMonthlyClosing(id)
  
  if (!closing) {
    throw new Error("Cierre no encontrado")
  }

  const formatCurrency = (amount: number, currency: string) => {
    return `${currency} ${amount.toLocaleString("es-VE", { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`
  }

  const lines = [
    `CIERRE MENSUAL - ${closing.period}`,
    `Fecha de cierre: ${new Date(closing.closed_at).toLocaleString("es-VE")}`,
    `Cerrado por: ${closing.admin?.name || "Sistema"}`,
    "",
    "=== INGRESOS POR MEMBRESÍAS ===",
    `Bolívares: ${formatCurrency(closing.membership_revenue_bs, "Bs")}`,
    `USD Efectivo: ${formatCurrency(closing.membership_revenue_usd_cash, "$")}`,
    `USDT: ${formatCurrency(closing.membership_revenue_usdt, "USDT")}`,
    `Total pagos: ${closing.membership_payments_count}`,
    "",
    "=== INGRESOS POR CLASES ESPECIALES ===",
    `Bolívares: ${formatCurrency(closing.class_revenue_bs, "Bs")}`,
    `USD Efectivo: ${formatCurrency(closing.class_revenue_usd_cash, "$")}`,
    `USDT: ${formatCurrency(closing.class_revenue_usdt, "USDT")}`,
    `Total pagos: ${closing.class_payments_count}`,
    "",
    "=== TOTAL EN USD ===",
    `Total: ${formatCurrency(closing.total_revenue_usd, "$")}`,
    "",
    "=== MÉTRICAS DE MIEMBROS ===",
    `Miembros activos: ${closing.active_members}`,
    `Nuevos miembros: ${closing.new_members}`,
    `Miembros vencidos: ${closing.expired_members}`,
    `Miembros congelados: ${closing.frozen_members}`,
    `Total miembros: ${closing.total_members}`,
    `Tasa de retención: ${closing.retention_rate.toFixed(2)}%`,
    "",
    "=== FONDOS AL CIERRE ===",
    `Bolívares: ${formatCurrency(closing.funds_bs, "Bs")}`,
    `USD Efectivo: ${formatCurrency(closing.funds_usd_cash, "$")}`,
    `USDT: ${formatCurrency(closing.funds_usdt, "USDT")}`,
    `Fondos reseteados: ${closing.funds_reset ? "Sí" : "No"}`,
    "",
    "=== TASAS DE CAMBIO ===",
    `BCV: ${closing.rate_bcv.toFixed(2)} Bs/$`,
    `USDT: ${closing.rate_usdt.toFixed(2)} Bs/$`,
    `Personalizada: ${closing.rate_custom.toFixed(2)} Bs/$`,
  ]

  if (closing.notes) {
    lines.push("", "=== NOTAS ===", closing.notes)
  }

  return lines.join("\n")
}
