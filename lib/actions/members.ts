"use server"

import { createClient } from "@/utils/supabase/server"
import { createAdminClient } from "@/utils/supabase/admin"
import { revalidatePath } from "next/cache"
import type { TablesInsert, TablesUpdate } from "@/types/database"
import { logActivity } from "./activity"
import { DEFAULT_MEMBER_PASSWORD } from "@/lib/constants"

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

  if (error) {
    if (error.code === "23505" && error.message.includes("members_email_key")) {
      throw new Error("Ya existe un cliente registrado con ese correo electrónico.")
    }
    throw error
  }

  const adminClient = createAdminClient()
  const { data: authData, error: authError } = await adminClient.auth.admin.createUser({
    email: data.email,
    password: DEFAULT_MEMBER_PASSWORD,
    app_metadata: { role: "member" },
    user_metadata: { must_change_password: true },
    email_confirm: true,
  })

  let authUserId: string | null = null
  if (!authError && authData.user) {
    authUserId = authData.user.id
  } else if (authError) {
    // Si el email ya existe en auth.users, vincular al usuario existente
    // en lugar de dejar al miembro sin auth_user_id (root cause de logins fallidos).
    const { data: existing } = await adminClient.auth.admin.listUsers()
    const match = existing?.users.find(
      (u) => u.email?.toLowerCase() === data.email.toLowerCase(),
    )
    if (match) {
      authUserId = match.id
    } else {
      console.warn(`No se pudo crear cuenta auth para ${data.email}: ${authError.message}`)
    }
  }

  if (authUserId) {
    await adminClient
      .from("members")
      .update({ auth_user_id: authUserId, must_change_password: true })
      .eq("id", data.id)
  }

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

  const { data: previous, error: prevError } = await supabase
    .from("members")
    .select("email, auth_user_id")
    .eq("id", id)
    .single()
  if (prevError) throw prevError

  const { data, error } = await supabase
    .from("members")
    .update({ ...member, updated_at: new Date().toISOString() })
    .eq("id", id)
    .select()
    .single()

  if (error) {
    if (error.code === "23505" && error.message.includes("members_email_key")) {
      throw new Error("Ya existe otro cliente registrado con ese correo electrónico.")
    }
    throw error
  }

  // Si cambió el email, sincronizar con auth.users para evitar que el miembro
  // pierda acceso al portal (su email actual debe existir en auth para iniciar sesión).
  const emailChanged =
    typeof member.email === "string" &&
    member.email.toLowerCase() !== previous.email.toLowerCase()
  if (emailChanged && previous.auth_user_id) {
    const adminClient = createAdminClient()
    const { error: authError } = await adminClient.auth.admin.updateUserById(
      previous.auth_user_id,
      { email: data.email, email_confirm: true },
    )
    if (authError) {
      console.warn(
        `Email actualizado en members pero no en auth para ${data.email}: ${authError.message}`,
      )
    }
  }

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
    .select("name, auth_user_id")
    .eq("id", id)
    .single()

  // Eliminar cuenta de auth si existe
  if (member?.auth_user_id) {
    const adminClient = createAdminClient()
    await adminClient.auth.admin.deleteUser(member.auth_user_id)
  }

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
