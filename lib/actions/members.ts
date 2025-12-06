"use server"

import { createClient } from "@/utils/supabase/server"
import { revalidatePath } from "next/cache"
import type { TablesInsert, TablesUpdate } from "@/types/database"
import { logActivity } from "./activity"

export async function getMembers() {
  const supabase = await createClient()
  
  // Primero actualizamos los estados basados en la fecha de pago
  await updateMemberStatuses()
  
  const { data, error } = await supabase
    .from("members")
    .select("*, plans(name)")
    .order("created_at", { ascending: false })

  if (error) throw error
  return data
}

// Actualiza automáticamente el estado de los miembros según su fecha de pago
async function updateMemberStatuses() {
  const supabase = await createClient()
  const today = new Date().toISOString().split("T")[0]
  
  // Marcar como vencidos: fecha de pago pasada y no congelados
  await supabase
    .from("members")
    .update({ status: "expired", updated_at: new Date().toISOString() })
    .lt("payment_date", today)
    .eq("frozen", false)
    .neq("status", "expired")
  
  // Marcar como activos: fecha de pago futura o igual a hoy y no congelados
  await supabase
    .from("members")
    .update({ status: "active", updated_at: new Date().toISOString() })
    .gte("payment_date", today)
    .eq("frozen", false)
    .neq("status", "active")
}

export async function getMember(id: string) {
  const supabase = await createClient()
  const { data, error } = await supabase
    .from("members")
    .select("*, plans(*)")
    .eq("id", id)
    .single()

  if (error) throw error
  return data
}

export async function createMember(member: TablesInsert<"members">) {
  const supabase = await createClient()
  const { data, error } = await supabase
    .from("members")
    .insert(member)
    .select()
    .single()

  if (error) throw error

  await logActivity({
    action: "member_created",
    entityType: "member",
    entityId: data.id,
    entityName: data.name,
  })

  revalidatePath("/dashboard/users")
  revalidatePath("/dashboard")
  return data
}

export async function updateMember(id: string, member: TablesUpdate<"members">) {
  const supabase = await createClient()
  const { data, error } = await supabase
    .from("members")
    .update({ ...member, updated_at: new Date().toISOString() })
    .eq("id", id)
    .select()
    .single()

  if (error) throw error

  await logActivity({
    action: "member_updated",
    entityType: "member",
    entityId: data.id,
    entityName: data.name,
  })

  revalidatePath("/dashboard/users")
  revalidatePath("/dashboard")
  return data
}

export async function deleteMember(id: string) {
  const supabase = await createClient()
  
  const { data: member } = await supabase
    .from("members")
    .select("name")
    .eq("id", id)
    .single()

  const { error } = await supabase.from("members").delete().eq("id", id)
  if (error) throw error

  await logActivity({
    action: "member_deleted",
    entityType: "member",
    entityId: id,
    entityName: member?.name,
  })

  revalidatePath("/dashboard/users")
  revalidatePath("/dashboard")
}

export async function toggleFreeze(id: string, frozen: boolean) {
  const supabase = await createClient()
  const { error } = await supabase
    .from("members")
    .update({ frozen, status: frozen ? "frozen" : "active", updated_at: new Date().toISOString() })
    .eq("id", id)

  if (error) throw error
  revalidatePath("/dashboard/users")
}

export async function updatePaymentDate(id: string, paymentDate: string) {
  const supabase = await createClient()
  const today = new Date().toISOString().split("T")[0]
  const newStatus = paymentDate >= today ? "active" : "expired"
  
  // Verificar si el miembro está congelado
  const { data: member } = await supabase.from("members").select("frozen").eq("id", id).single()
  
  const { error } = await supabase
    .from("members")
    .update({ 
      payment_date: paymentDate, 
      status: member?.frozen ? "frozen" : newStatus,
      updated_at: new Date().toISOString() 
    })
    .eq("id", id)

  if (error) throw error
  revalidatePath("/dashboard/users")
}
