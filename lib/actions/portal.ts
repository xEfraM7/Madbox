"use server"

import { createClient } from "@/utils/supabase/server"
import { revalidatePath } from "next/cache"
import { v2 as cloudinary } from "cloudinary"

cloudinary.config({
  cloud_name: process.env.CLOUDINARY_CLOUD_NAME,
  api_key: process.env.CLOUDINARY_API_KEY,
  api_secret: process.env.CLOUDINARY_API_SECRET,
})

async function getCurrentMember() {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) throw new Error("No autenticado")

  const { data: member, error } = await supabase
    .from("members")
    .select("*, plans(*)")
    .eq("auth_user_id", user.id)
    .single()

  if (error || !member) throw new Error("Miembro no encontrado")
  return { member, user, supabase }
}

export async function getMyProfile() {
  const { member } = await getCurrentMember()
  return member
}

export async function updateMyProfile(data: {
  name?: string
  phone?: string
  email?: string
}) {
  const { member, user, supabase } = await getCurrentMember()

  const allowed = {
    ...(data.name !== undefined && { name: data.name }),
    ...(data.phone !== undefined && { phone: data.phone }),
    ...(data.email !== undefined && { email: data.email }),
    updated_at: new Date().toISOString(),
  }

  const { error } = await supabase
    .from("members")
    .update(allowed)
    .eq("id", member.id)

  if (error) throw error

  // Si cambió el email, actualizar en auth también (Supabase envía verificación)
  if (data.email && data.email !== user.email) {
    await supabase.auth.updateUser({ email: data.email })
  }

  revalidatePath("/portal/perfil")
  revalidatePath("/portal")
}

export async function getMyPayments() {
  const { member, supabase } = await getCurrentMember()

  const { data, error } = await supabase
    .from("payments")
    .select("*, plans(name)")
    .eq("member_id", member.id)
    .order("payment_date", { ascending: false })

  if (error) throw error
  return data
}

export async function getMyEnrolledClasses() {
  const { member, supabase } = await getCurrentMember()

  const { data, error } = await supabase
    .from("special_class_payments")
    .select("*, special_classes(*)")
    .eq("member_id", member.id)
    .order("payment_date", { ascending: false })

  if (error) throw error
  return data
}

export async function getActiveSpecialClasses() {
  const supabase = await createClient()
  const { data, error } = await supabase
    .from("special_classes")
    .select("*")
    .order("schedule", { ascending: true })

  if (error) throw error
  return data
}

export async function updateAvatar(url: string) {
  const { member, supabase } = await getCurrentMember()

  const { error } = await supabase
    .from("members")
    .update({ avatar_url: url, updated_at: new Date().toISOString() })
    .eq("id", member.id)

  if (error) throw error
  revalidatePath("/portal/perfil")
  revalidatePath("/portal")
}

export async function uploadAvatarToCloudinary(formData: FormData): Promise<string> {
  const { member } = await getCurrentMember()

  const file = formData.get("avatar") as File
  if (!file || file.size === 0) throw new Error("No se seleccionó imagen")
  if (file.size > 10 * 1024 * 1024) throw new Error("La imagen no puede superar 10MB")

  const allowedTypes = ["image/jpeg", "image/png", "image/webp"]
  if (!allowedTypes.includes(file.type)) {
    throw new Error("Formato no permitido. Usa JPG, PNG o WebP")
  }

  const bytes = await file.arrayBuffer()
  const buffer = Buffer.from(bytes)
  const dataUrl = `data:${file.type};base64,${buffer.toString("base64")}`

  const result = await cloudinary.uploader.upload(dataUrl, {
    folder: "madbox/avatars",
    public_id: member.id,
    overwrite: true,
    transformation: [{ width: 400, height: 400, crop: "fill", gravity: "face" }],
  })

  return result.secure_url
}

export async function clearMustChangePassword() {
  const { member, supabase } = await getCurrentMember()

  await supabase
    .from("members")
    .update({ must_change_password: false, updated_at: new Date().toISOString() })
    .eq("id", member.id)

  // Actualizar user_metadata para que middleware lo lea sin query
  await supabase.auth.updateUser({
    data: { must_change_password: false },
  })
}
