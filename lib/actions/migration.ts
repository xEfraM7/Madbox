"use server"

import { createAdminClient } from "@/utils/supabase/admin"
import { getCurrentAdminPermissions } from "./roles"
import { DEFAULT_MEMBER_PASSWORD } from "@/lib/constants"

export async function migrateMembersToPortal(): Promise<{
  success: number
  failed: number
  errors: string[]
}> {
  const { isAdmin } = await getCurrentAdminPermissions()
  if (!isAdmin) throw new Error("Solo Super Admin puede ejecutar esta migración")

  const adminClient = createAdminClient()

  const { data: members, error } = await adminClient
    .from("members")
    .select("id, email, name")
    .is("auth_user_id", null)

  if (error) throw error
  if (!members || members.length === 0) {
    return { success: 0, failed: 0, errors: [] }
  }

  let success = 0
  let failed = 0
  const errors: string[] = []

  for (const member of members) {
    const { data: authData, error: authError } = await adminClient.auth.admin.createUser({
      email: member.email,
      password: DEFAULT_MEMBER_PASSWORD,
      app_metadata: { role: "member" },
      user_metadata: { must_change_password: true },
      email_confirm: true,
    })

    if (authError || !authData.user) {
      failed++
      errors.push(`${member.email}: ${authError?.message ?? "Error desconocido"}`)
      continue
    }

    const { error: updateError } = await adminClient
      .from("members")
      .update({
        auth_user_id: authData.user.id,
        must_change_password: true,
        updated_at: new Date().toISOString(),
      })
      .eq("id", member.id)

    if (updateError) {
      failed++
      errors.push(`${member.email}: auth creado pero no vinculado - ${updateError.message}`)
    } else {
      success++
    }
  }

  return { success, failed, errors }
}

export async function migrateAdminMetadata(): Promise<{ updated: number }> {
  const { isAdmin } = await getCurrentAdminPermissions()
  if (!isAdmin) throw new Error("Solo Super Admin puede ejecutar esta migración")

  const adminClient = createAdminClient()

  const { data: admins, error } = await adminClient
    .from("admins")
    .select("auth_user_id")
    .not("auth_user_id", "is", null)

  if (error) throw error
  if (!admins) return { updated: 0 }

  let updated = 0
  for (const admin of admins) {
    if (!admin.auth_user_id) continue
    const { error: metaError } = await adminClient.auth.admin.updateUserById(
      admin.auth_user_id,
      { app_metadata: { role: "admin" } }
    )
    if (!metaError) updated++
  }

  return { updated }
}
