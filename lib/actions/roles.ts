"use server"

import { createClient } from "@/utils/supabase/server"
import { createAdminClient } from "@/utils/supabase/admin"
import { revalidatePath } from "next/cache"
import type { TablesInsert, TablesUpdate } from "@/types/database"

export async function getRoles() {
  const supabase = await createClient()
  const { data, error } = await supabase.from("roles").select("*").order("name")

  if (error) throw error
  return data
}

export async function createRole(role: TablesInsert<"roles">) {
  const hasPermission = await checkRolePermission("roles.create")
  if (!hasPermission) throw new Error("No tienes permisos para crear roles")

  const supabase = await createClient()
  const { data, error } = await supabase.from("roles").insert(role).select().single()

  if (error) throw error
  revalidatePath("/dashboard/roles")
  return data
}

export async function updateRole(id: string, role: TablesUpdate<"roles">) {
  const hasPermission = await checkRolePermission("roles.edit")
  if (!hasPermission) throw new Error("No tienes permisos para editar roles")

  const supabase = await createClient()
  const { data, error } = await supabase
    .from("roles")
    .update({ ...role, updated_at: new Date().toISOString() })
    .eq("id", id)
    .select()
    .single()

  if (error) throw error
  revalidatePath("/dashboard/roles")
  return data
}

export async function deleteRole(id: string) {
  const hasPermission = await checkRolePermission("roles.delete")
  if (!hasPermission) throw new Error("No tienes permisos para eliminar roles")

  const supabase = await createClient()
  const { error } = await supabase.from("roles").delete().eq("id", id)

  if (error) throw error
  revalidatePath("/dashboard/roles")
}

// Función auxiliar para verificar permisos
async function checkRolePermission(requiredPermission: string): Promise<boolean> {
  const { permissions, isAdmin } = await getCurrentAdminPermissions()
  if (isAdmin) return true
  return permissions.includes(requiredPermission)
}

export async function getAdmins() {
  const supabase = await createClient()
  
  // Obtener IDs de roles Admin y Super Admin
  const { data: adminRoles } = await supabase
    .from("roles")
    .select("id")
    .in("name", ["Admin", "Super Admin"])

  const adminRoleIds = adminRoles?.map((r) => r.id) || []

  // Filtrar solo usuarios con roles Admin o Super Admin
  const { data, error } = await supabase
    .from("admins")
    .select("*, roles(name)")
    .in("role_id", adminRoleIds)
    .order("name")

  if (error) throw error
  return data
}

// Obtener todos los usuarios del sistema (para la pestaña Usuarios)
export async function getAllAdmins() {
  const supabase = await createClient()
  const { data, error } = await supabase
    .from("admins")
    .select("*, roles(name)")
    .order("name")

  if (error) throw error
  return data
}

export async function createAdmin(admin: TablesInsert<"admins">) {
  const hasPermission = await checkRolePermission("roles.create")
  if (!hasPermission) throw new Error("No tienes permisos para crear administradores")

  const supabase = await createClient()
  const { data, error } = await supabase.from("admins").insert(admin).select().single()

  if (error) throw error
  revalidatePath("/dashboard/roles")
  return data
}

export async function updateAdmin(id: string, admin: TablesUpdate<"admins">) {
  const hasPermission = await checkRolePermission("roles.edit")
  if (!hasPermission) throw new Error("No tienes permisos para editar administradores")

  const supabase = await createClient()
  const { data, error } = await supabase
    .from("admins")
    .update({ ...admin, updated_at: new Date().toISOString() })
    .eq("id", id)
    .select()
    .single()

  if (error) throw error
  revalidatePath("/dashboard/roles")
  return data
}

export async function deleteAdmin(id: string) {
  const hasPermission = await checkRolePermission("roles.delete")
  if (!hasPermission) throw new Error("No tienes permisos para eliminar administradores")

  const supabase = await createClient()
  const { error } = await supabase.from("admins").delete().eq("id", id)

  if (error) throw error
  revalidatePath("/dashboard/roles")
}

export async function getAuthUsers() {
  const supabase = await createClient()
  const adminClient = createAdminClient()

  // Obtener admins existentes para excluirlos
  const { data: existingAdmins } = await supabase
    .from("admins")
    .select("email, auth_user_id")

  const existingEmails = new Set(existingAdmins?.map((a) => a.email) || [])
  const existingAuthIds = new Set(existingAdmins?.map((a) => a.auth_user_id).filter(Boolean) || [])

  // Obtener usuarios de auth con service_role
  const { data: { users } } = await adminClient.auth.admin.listUsers()

  if (!users) return []

  // Filtrar usuarios que ya son admins
  return users
    .filter((user) => !existingEmails.has(user.email) && !existingAuthIds.has(user.id))
    .map((user) => ({
      id: user.id,
      email: user.email || "",
      name: user.user_metadata?.name || user.email?.split("@")[0] || "Usuario",
    }))
}

export async function getAllAuthUsers() {
  const adminClient = createAdminClient()

  // Obtener todos los usuarios de auth con service_role
  const { data: { users } } = await adminClient.auth.admin.listUsers()

  if (!users) return []

  return users.map((user) => ({
    id: user.id,
    email: user.email || "",
    created_at: user.created_at,
    last_sign_in_at: user.last_sign_in_at,
    email_confirmed_at: user.email_confirmed_at,
  }))
}

export async function getCurrentAdminPermissions() {
  const supabase = await createClient()

  // Obtener el usuario autenticado
  const { data: { user } } = await supabase.auth.getUser()

  if (!user) {
    return { permissions: [], isAdmin: false }
  }

  // Buscar el admin por auth_user_id o email
  const { data: admin } = await supabase
    .from("admins")
    .select("*, roles(permissions, name)")
    .or(`auth_user_id.eq.${user.id},email.eq.${user.email}`)
    .single()

  // Verificar si hay algún admin en el sistema
  const { count } = await supabase
    .from("admins")
    .select("*", { count: "exact", head: true })

  // Si no hay admins en el sistema, el primer usuario es super admin
  if (!admin && count === 0) {
    return { permissions: [], isAdmin: true, isFirstUser: true }
  }

  // Si no es admin y hay otros admins, no tiene permisos
  if (!admin) {
    return { permissions: [], isAdmin: false }
  }

  // Si el rol es "Super Admin", tiene todos los permisos
  const isSuperAdmin = admin.roles?.name === "Super Admin"

  return {
    permissions: admin.roles?.permissions || [],
    isAdmin: isSuperAdmin,
    adminId: admin.id,
    roleName: admin.roles?.name,
  }
}

export async function sendInvitation(email: string, name?: string) {
  const hasPermission = await checkRolePermission("roles.create")
  if (!hasPermission) throw new Error("No tienes permisos para enviar invitaciones")

  const supabase = await createClient()
  const adminClient = createAdminClient()

  // Buscar el rol "Basica" para asignarlo por defecto
  const { data: basicRole } = await supabase
    .from("roles")
    .select("id")
    .eq("name", "Basica")
    .single()

  if (!basicRole) {
    throw new Error("No se encontró el rol 'Basica'. Créalo primero.")
  }

  // Enviar invitación por email
  const { data: inviteData, error: inviteError } = await adminClient.auth.admin.inviteUserByEmail(email, {
    redirectTo: `${process.env.NEXT_PUBLIC_SITE_URL || "http://localhost:3000"}/auth/confirm?next=/reset-password`,
  })

  if (inviteError) {
    console.error("Error sending invitation:", inviteError)
    throw new Error(inviteError.message)
  }

  // Crear el registro de admin con rol "Basica"
  const { error: adminError } = await supabase.from("admins").insert({
    name: name || email.split("@")[0],
    email: email,
    auth_user_id: inviteData.user.id,
    role_id: basicRole.id,
    status: "active",
  })

  if (adminError) {
    console.error("Error creating admin:", adminError)
    // No lanzamos error porque la invitación ya se envió
  }

  revalidatePath("/dashboard/roles")
  return inviteData
}

export async function deleteUser(authUserId: string) {
  const hasPermission = await checkRolePermission("roles.delete")
  if (!hasPermission) throw new Error("No tienes permisos para eliminar usuarios")

  const supabase = await createClient()
  const adminClient = createAdminClient()

  // Eliminar registro de admin si existe
  await supabase.from("admins").delete().eq("auth_user_id", authUserId)

  // Eliminar usuario de auth
  const { error } = await adminClient.auth.admin.deleteUser(authUserId)

  if (error) {
    console.error("Error deleting user:", error)
    throw new Error(error.message)
  }

  revalidatePath("/dashboard/roles")
}


