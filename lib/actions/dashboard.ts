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
    // Filtrar pagos por payment_date (fecha del pago) en el mes actual
    supabase
      .from("payments")
      .select("amount, status, method")
      .gte("payment_date", startOfMonth)
      .lte("payment_date", endOfMonth),
    // Filtrar pagos del mes anterior
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

  // Calcular ingresos del mes desglosados por tipo de moneda
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
  switch (action) {
    case "payment_registered": return `Registró pago de ${entity_name || "cliente"} por $${details?.amount || 0}`
    case "payment_deleted": return `Eliminó pago de ${entity_name || "cliente"}`
    case "member_created": return `Registró miembro: ${entity_name}`
    case "member_updated": return `Actualizó miembro: ${entity_name}`
    case "member_deleted": return `Eliminó miembro: ${entity_name}`
    case "class_created": return `Creó clase: ${entity_name}`
    case "class_deleted": return `Eliminó clase: ${entity_name}`
    case "class_payment_registered": return `Pago de clase: ${entity_name}`
    case "class_payment_deleted": return `Eliminó pago de clase`
    case "rate_updated": return `Actualizó tasa ${entity_name} a ${details?.rate}`
    default: return `${action}: ${entity_name || ""}`
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
  const months = []
  const now = new Date()

  for (let i = 5; i >= 0; i--) {
    const date = new Date(now.getFullYear(), now.getMonth() - i, 1)
    const startDate = date.toISOString().split("T")[0]
    const endDate = new Date(date.getFullYear(), date.getMonth() + 1, 0).toISOString().split("T")[0]
    
    months.push({
      month: date.toLocaleDateString("es-ES", { month: "short" }),
      start: startDate,
      end: endDate,
    })
  }

  const results = await Promise.all(
    months.map(async (m) => {
      const { data } = await supabase
        .from("payments")
        .select("amount")
        .eq("status", "paid")
        .gte("payment_date", m.start)
        .lte("payment_date", m.end)

      const total = data?.reduce((sum, p) => sum + Number(p.amount), 0) || 0
      return { month: m.month, revenue: total }
    })
  )

  return results
}

function formatTimeAgo(date: Date): string {
  const seconds = Math.floor((Date.now() - date.getTime()) / 1000)
  if (seconds < 0) return "Próximamente"
  if (seconds < 60) return "Hace unos segundos"
  if (seconds < 3600) return `Hace ${Math.floor(seconds / 60)} min`
  if (seconds < 86400) return `Hace ${Math.floor(seconds / 3600)} horas`
  return `Hace ${Math.floor(seconds / 86400)} días`
}
