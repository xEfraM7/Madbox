"use server"

import { createClient } from "@/utils/supabase/server"
import { revalidatePath } from "next/cache"
import { v2 as cloudinary } from "cloudinary"
import { z } from "zod"

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

const profileUpdateSchema = z.object({
  name: z.string().min(2).max(100).optional(),
  phone: z.string().max(40).optional(),
  email: z.string().email().optional(),
  gender: z.enum(["male", "female"]).nullable().optional(),
  birth_date: z
    .string()
    .regex(/^\d{4}-\d{2}-\d{2}$/, "Fecha inválida")
    .nullable()
    .optional()
    .refine((v) => {
      if (!v) return true
      const d = new Date(v + "T00:00:00")
      const year = d.getFullYear()
      return year >= 1940 && d.getTime() <= Date.now()
    }, "Fecha fuera de rango"),
  weight_kg: z.number().min(30).max(250).nullable().optional(),
  height_cm: z.number().int().min(100).max(220).nullable().optional(),
  athlete_since: z
    .string()
    .regex(/^\d{4}-\d{2}-\d{2}$/, "Fecha inválida")
    .nullable()
    .optional()
    .refine((v) => {
      if (!v) return true
      const d = new Date(v + "T00:00:00")
      return d.getFullYear() >= 2010 && d.getTime() <= Date.now()
    }, "Fecha fuera de rango"),
  athlete_level: z.enum(["rx", "scaled", "beginner"]).nullable().optional(),
  quote: z
    .string()
    .max(120)
    .transform((s) => s.replace(/<[^>]*>/g, "").trim())
    .nullable()
    .optional(),
})

export type ProfileUpdateInput = z.infer<typeof profileUpdateSchema>

export async function updateMyProfile(data: ProfileUpdateInput) {
  const parsed = profileUpdateSchema.parse(data)
  const { member, user, supabase } = await getCurrentMember()

  const allowed: Record<string, unknown> = {
    updated_at: new Date().toISOString(),
  }
  if (parsed.name !== undefined) allowed.name = parsed.name
  if (parsed.phone !== undefined) allowed.phone = parsed.phone
  if (parsed.email !== undefined) allowed.email = parsed.email
  if (parsed.gender !== undefined) allowed.gender = parsed.gender
  if (parsed.birth_date !== undefined) allowed.birth_date = parsed.birth_date
  if (parsed.weight_kg !== undefined) allowed.weight_kg = parsed.weight_kg
  if (parsed.height_cm !== undefined) allowed.height_cm = parsed.height_cm
  if (parsed.athlete_since !== undefined) allowed.athlete_since = parsed.athlete_since
  if (parsed.athlete_level !== undefined) allowed.athlete_level = parsed.athlete_level
  if (parsed.quote !== undefined) allowed.quote = parsed.quote

  const { error } = await supabase
    .from("members")
    .update(allowed)
    .eq("id", member.id)

  if (error) throw error

  if (parsed.email && parsed.email !== user.email) {
    await supabase.auth.updateUser({ email: parsed.email })
  }

  revalidatePath("/portal/perfil")
  revalidatePath("/portal")
  revalidatePath("/portal/descubrir")
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
