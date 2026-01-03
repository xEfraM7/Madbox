"use server"

import { createClient } from "@/utils/supabase/server"

export async function getDashboardStats(monthOffset: number = 0) {
  const supabase = await createClient()

  const now = new Date()
  const targetMonth = new Date(now.getFullYear(), now.getMonth() + monthOffset, 1)
  const startOfMonth = targetMonth.toISOString().split("T")[0]
  const endOfMonth = new Date(targetMonth.getFullYear(), targetMonth.getMonth() + 1, 0).toISOString().split("T")[0]
  
  const lastMonth = new Date(targetMonth.getFullYear(), targetMonth.getMonth() - 1, 1)
  const startOfLastMonth = lastMonth.toISOString().split("T")[0]
  const endOfLastMonth = new Date(lastMonth.getFullYear(), lastMonth.getMonth() + 1, 0).toISOString().split("T")[0]

  const [
    membersResult,
    lastMonthMembersResult,
    paymentsResult,
    lastMonthPaymentsResult,
    plansResult,
    specialClassesResult,
  ] = await Promise.all([
    supabase.from("members").select("id, status"),
    supabase.from("members").select("id").lte("created_at", endOfLastMonth),
    supabase
      .from("payments")
      .select("amount, status, method")
      .gte("payment_date", startOfMonth)
      .lte("payment_date", endOfMonth),
    supabase
      .from("payments")
      .select("amount, status, method")
      .gte("payment_date", startOfLastMonth)
      .lte("payment_date", endOfLastMonth),
    supabase.from("plans").select("id").eq("active", true),
    supabase.from("special_classes").select("id, enrolled, capacity"),
  ])

  const members = membersResult.data || []
  const lastMonthMembers = lastMonthMembersResult.data || []
  const payments = paymentsResult.data || []
  const lastMonthPayments = lastMonthPaymentsResult.data || []
  const specialClasses = specialClassesResult.data || []

  const activeMembers = members.filter((m) => m.status === "active").length
  const totalMembers = members.length
  const lastMonthTotal = lastMonthMembers.length || 1
  const membersGrowth = Math.round(((totalMembers - lastMonthTotal) / lastMonthTotal) * 100)

  const bsMethods = ["Pago Movil", "Efectivo bs", "Transferencia BS"]
  const usdtMethods = ["USDT"]
  const usdCashMethods = ["Efectivo", "Transferencia"]
  
  const paidPayments = payments.filter((p: any) => p.status === "paid")
  const monthlyRevenueByType = {
    bs: paidPayments.filter((p: any) => bsMethods.includes(p.method)).reduce((sum: number, p: any) => sum + Number(p.amount), 0),
    usdCash: paidPayments.filter((p: any) => usdCashMethods.includes(p.method)).reduce((sum: number, p: any) => sum + Number(p.amount), 0),
    usdt: paidPayments.filter((p: any) => usdtMethods.includes(p.method)).reduce((sum: number, p: any) => sum + Number(p.amount), 0),
  }
  
  const monthlyRevenue = paidPayments.reduce((sum: number, p: any) => sum + Number(p.amount), 0)
  const lastMonthRevenue = lastMonthPayments.filter((p) => p.status === "paid").reduce((sum, p) => sum + Number(p.amount), 0) || 1
  const revenueGrowth = Math.round(((monthlyRevenue - lastMonthRevenue) / lastMonthRevenue) * 100)

  const activePlans = plansResult.data?.length || 0
  const renewalRate = totalMembers > 0 ? Math.round((activeMembers / totalMembers) * 100) : 0
  const totalEnrolled = specialClasses.reduce((sum, c) => sum + (c.enrolled || 0), 0)
  const totalCapacity = specialClasses.reduce((sum, c) => sum + c.capacity, 0)

  return {
    activeMembers, totalMembers, membersGrowth, monthlyRevenue, monthlyRevenueByType, revenueGrowth,
    activePlans, renewalRate, specialClasses: specialClasses.length, totalEnrolled, totalCapacity,
  }
}

export async function getRecentActivity() {
  const supabase = await createClient()

  const { data: activities } = await supabase
    .from("activity_log")
    .select("*")
    .order("created_at", { ascending: false })
    .limit(10)

  if (!activities || activities.length === 0) return []

  return activities.map((activity: any) => ({
    user: activity.admin_name || "Sistema",
    action: formatActivityAction(activity),
    time: formatTimeAgo(new Date(activity.created_at)),
    type: getActivityType(activity.entity_type),
  }))
}

function formatActivityAction(activity: any): string {
  const { action, entity_name, details } = activity
  
  const formatAmount = (amount: number, method?: string) => {
    if (!amount) return ""
    const num = Number(amount)
    const formatted = num.toLocaleString("es-ES", { minimumFractionDigits: 2, maximumFractionDigits: 2 })
    const bsMethods = ["Pago Movil", "Efectivo bs", "Transferencia BS"]
    if (method && bsMethods.includes(method)) return "Bs. " + formatted
    if (method === "USDT") return formatted + " USDT"
    if (method === "Efectivo" || method === "Transferencia") return "$" + formatted
    return formatted
  }

  switch (action) {
    case "payment_registered": {
      const amt = formatAmount(details?.amount, details?.method)
      const mtd = details?.method ? " (" + details.method + ")" : ""
      return "Pago de " + (entity_name || "cliente") + ": " + amt + mtd
    }
    case "payment_deleted": return "Elimino pago de " + (entity_name || "cliente")
    case "member_created": return "Nuevo miembro: " + entity_name
    case "member_updated": return "Actualizo: " + entity_name
    case "member_deleted": return "Elimino miembro: " + entity_name
    case "class_created": return "Nueva clase: " + entity_name
    case "class_deleted": return "Elimino clase: " + entity_name
    case "class_payment_registered": {
      const amt = formatAmount(details?.amount, details?.method)
      const mtd = details?.method ? " (" + details.method + ")" : ""
      return "Pago clase " + (entity_name || "") + ": " + amt + mtd
    }
    case "class_payment_deleted": return "Elimino pago de clase"
    case "rate_updated": {
      const rate = Number(details?.rate || 0).toLocaleString("es-ES", { minimumFractionDigits: 2 })
      return "Tasa " + entity_name + ": Bs. " + rate
    }
    case "month_closed": return "Cerro mes: " + (details?.period || "")
    case "monthly_closing_created": {
      const period = entity_name || details?.period || ""
      const [year, month] = period.split("-")
      const monthNames = ["Enero", "Febrero", "Marzo", "Abril", "Mayo", "Junio", "Julio", "Agosto", "Septiembre", "Octubre", "Noviembre", "Diciembre"]
      const monthName = month ? monthNames[parseInt(month) - 1] : ""
      const totalUsd = details?.total_revenue_usd ? "$" + Number(details.total_revenue_usd).toFixed(2) : ""
      return "Cierre de " + monthName + " " + year + (totalUsd ? " - " + totalUsd : "")
    }
    case "funds_reset": {
      const period = entity_name || details?.period || ""
      const [year, month] = period.split("-")
      const monthNames = ["Enero", "Febrero", "Marzo", "Abril", "Mayo", "Junio", "Julio", "Agosto", "Septiembre", "Octubre", "Noviembre", "Diciembre"]
      const monthName = month ? monthNames[parseInt(month) - 1] : ""
      return "Fondos reiniciados - " + monthName + " " + year
    }
    default: return action + ": " + (entity_name || "")
  }
}

function getActivityType(entityType: string): string {
  switch (entityType) {
    case "payment": case "special_class_payment": return "payment"
    case "member": return "member"
    case "special_class": return "class"
    default: return "other"
  }
}

export async function getUpcomingPayments() {
  const supabase = await createClient()

  const { data } = await supabase
    .from("members")
    .select("id, name, payment_date, plans(name)")
    .eq("status", "active")
    .not("payment_date", "is", null)
    .order("payment_date", { ascending: true })
    .limit(5)

  if (!data) return []

  return data.map((m: any) => {
    const paymentDate = new Date(m.payment_date)
    const today = new Date()
    const diffTime = paymentDate.getTime() - today.getTime()
    const diffDays = Math.ceil(diffTime / (1000 * 60 * 60 * 24))

    return { id: m.id, name: m.name, plan: m.plans?.name || "Sin plan", days: diffDays, dueDate: m.payment_date }
  })
}

export async function getMonthlyRevenueChart() {
  const supabase = await createClient()
  const now = new Date()
  const results = []

  const { data: ratesData } = await supabase
    .from("exchange_rates")
    .select("type, rate")

  const rates = ratesData || []
  const bcvRate = Number(rates.find(r => r.type === "BCV")?.rate) || 1

  for (let i = 5; i >= 0; i--) {
    const date = new Date(now.getFullYear(), now.getMonth() - i, 1)
    const monthName = date.toLocaleDateString("es-ES", { month: "short" })
    const startDate = date.toISOString().split("T")[0]
    const endDate = new Date(date.getFullYear(), date.getMonth() + 1, 0).toISOString().split("T")[0]

    const { data: payments } = await supabase
      .from("payments")
      .select("amount, method, status")
      .eq("status", "paid")
      .gte("payment_date", startDate)
      .lte("payment_date", endDate)

    const { data: classPayments } = await supabase
      .from("special_class_payments")
      .select("amount, method, status")
      .eq("status", "paid")
      .gte("payment_date", startDate)
      .lte("payment_date", endDate)

    let bsTotal = 0
    let usdCashTotal = 0
    let usdtTotal = 0

    const allPayments = [...(payments || []), ...(classPayments || [])]

    allPayments.forEach((p: any) => {
      const amount = Number(p.amount) || 0
      if (["Pago Movil", "Efectivo bs", "Transferencia BS"].includes(p.method)) {
        bsTotal += amount
      } else if (p.method === "Efectivo") {
        usdCashTotal += amount
      } else if (["USDT", "Transferencia"].includes(p.method)) {
        usdtTotal += amount
      }
    })

    const totalInUsd = (bsTotal / bcvRate) + usdCashTotal + usdtTotal
    results.push({ month: monthName, revenue: Math.round(totalInUsd * 100) / 100 })
  }

  return results
}

function formatTimeAgo(date: Date): string {
  const seconds = Math.floor((Date.now() - date.getTime()) / 1000)
  if (seconds < 0) return "Proximamente"
  if (seconds < 60) return "Hace unos segundos"
  if (seconds < 3600) return "Hace " + Math.floor(seconds / 60) + " min"
  if (seconds < 86400) return "Hace " + Math.floor(seconds / 3600) + " horas"
  return "Hace " + Math.floor(seconds / 86400) + " dias"
}
