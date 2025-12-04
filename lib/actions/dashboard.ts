"use server"

import { createClient } from "@/utils/supabase/server"

interface MemberStatus {
  status: string | null
}

interface PaymentData {
  amount: number
  status: string | null
}

interface PaymentWithRelations {
  created_at: string | null
  status: string | null
  members: { name: string } | null
}

interface UpcomingPayment {
  due_date: string
  members: { name: string } | null
  plans: { name: string } | null
}

export async function getDashboardStats() {
  const supabase = await createClient()

  const [membersResult, paymentsResult, plansResult] = await Promise.all([
    supabase.from("members").select("status"),
    supabase.from("payments").select("amount, status"),
    supabase.from("plans").select("id").eq("active", true),
  ])

  const members = (membersResult.data || []) as MemberStatus[]
  const payments = (paymentsResult.data || []) as PaymentData[]

  const activeMembers = members.filter((m) => m.status === "active").length
  const totalRevenue = payments.filter((p) => p.status === "paid").reduce((sum: number, p) => sum + p.amount, 0)
  const activePlans = plansResult.data?.length || 0

  const totalMembers = members.length || 1
  const renewalRate = Math.round((activeMembers / totalMembers) * 100)

  return { activeMembers, totalRevenue, activePlans, renewalRate }
}

export async function getRecentActivity() {
  const supabase = await createClient()

  const { data } = await supabase
    .from("payments")
    .select("created_at, status, members(name)")
    .order("created_at", { ascending: false })
    .limit(5)

  const payments = (data || []) as PaymentWithRelations[]

  return payments.map((p) => ({
    user: p.members?.name || "Usuario",
    action: p.status === "paid" ? "Pago de mensualidad" : "Pago pendiente",
    time: formatTimeAgo(new Date(p.created_at || "")),
  }))
}

export async function getUpcomingPayments() {
  const supabase = await createClient()

  const { data } = await supabase
    .from("payments")
    .select("due_date, members(name), plans(name)")
    .eq("status", "pending")
    .order("due_date", { ascending: true })
    .limit(4)

  const payments = (data || []) as UpcomingPayment[]

  return payments.map((p) => ({
    name: p.members?.name || "Usuario",
    plan: p.plans?.name || "Plan",
    days: Math.ceil((new Date(p.due_date).getTime() - Date.now()) / (1000 * 60 * 60 * 24)),
  }))
}

function formatTimeAgo(date: Date): string {
  const seconds = Math.floor((Date.now() - date.getTime()) / 1000)
  if (seconds < 60) return "Hace unos segundos"
  if (seconds < 3600) return `Hace ${Math.floor(seconds / 60)} minutos`
  if (seconds < 86400) return `Hace ${Math.floor(seconds / 3600)} horas`
  return `Hace ${Math.floor(seconds / 86400)} días`
}
