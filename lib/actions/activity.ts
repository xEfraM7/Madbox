"use server"

import { createClient } from "@/utils/supabase/server"
import { revalidatePath } from "next/cache"

export type ActivityAction =
  | "create" | "update" | "delete"
  | "payment_registered" | "payment_deleted"
  | "member_created" | "member_updated" | "member_deleted"
  | "plan_created" | "plan_updated" | "plan_deleted"
  | "class_created" | "class_updated" | "class_deleted"
  | "class_payment_registered" | "class_payment_deleted"
  | "rate_updated" | "role_updated" | "invitation_sent"
  | "monthly_closing_created" | "funds_reset"

export type EntityType =
  | "payment" | "member" | "plan" | "special_class"
  | "special_class_payment" | "exchange_rate" | "role" | "admin"
  | "monthly_closing" | "fund"

interface LogActivityParams {
  action: ActivityAction
  entityType: EntityType
  entityId?: string
  entityName?: string
  details?: Record<string, any>
}

export async function logActivity(params: LogActivityParams) {
  const supabase = await createClient()

  const { data: { user } } = await supabase.auth.getUser()

  let adminName = "Sistema"
  let adminId = null

  if (user) {
    const { data: admin } = await supabase
      .from("admins")
      .select("id, name")
      .eq("auth_user_id", user.id)
      .single()

    if (admin) {
      adminId = admin.id
      adminName = admin.name
    }
  }

  const { error } = await supabase.from("activity_log").insert({
    admin_id: adminId,
    admin_name: adminName,
    action: params.action,
    entity_type: params.entityType,
    entity_id: params.entityId,
    entity_name: params.entityName,
    details: params.details,
  })

  if (error) console.error("Error logging activity:", error)
  revalidatePath("/dashboard")
}

export async function getActivityLog(limit = 20, startDate?: string, endDate?: string) {
  const supabase = await createClient()

  let query = supabase
    .from("activity_log")
    .select("*")
    .order("created_at", { ascending: false })

  if (startDate) {
    query = query.gte("created_at", startDate)
  }

  if (endDate) {
    // Agregar un día al endDate para incluir todo el día
    const end = new Date(endDate)
    end.setDate(end.getDate() + 1)
    query = query.lt("created_at", end.toISOString())
  }

  query = query.limit(limit)

  const { data, error } = await query

  if (error) throw error
  return data
}
