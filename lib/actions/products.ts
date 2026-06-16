"use server"

import { createClient } from "@/utils/supabase/server"
import { revalidatePath } from "next/cache"
import { v2 as cloudinary } from "cloudinary"
import type { TablesInsert, TablesUpdate } from "@/types/database"
import { getCurrentAdminPermissions } from "@/lib/actions/roles"
import { logActivity } from "@/lib/actions/activity"

cloudinary.config({
  cloud_name: process.env.CLOUDINARY_CLOUD_NAME,
  api_key: process.env.CLOUDINARY_API_KEY,
  api_secret: process.env.CLOUDINARY_API_SECRET,
})

async function assertPermission(...required: string[]) {
  const { permissions, isAdmin } = await getCurrentAdminPermissions()
  if (isAdmin) return
  if (!required.some((p) => permissions.includes(p))) {
    throw new Error("No tienes permiso para esta acción")
  }
}

function revalidateTienda() {
  revalidatePath("/dashboard/tienda")
  revalidatePath("/portal/tienda")
}

// ---------- Categorías ----------

export async function getCategories() {
  const supabase = await createClient()
  const { data, error } = await supabase
    .from("product_categories")
    .select("*")
    .order("sort_order", { ascending: true })
    .order("name", { ascending: true })
  if (error) throw error
  return data
}

export async function getActiveCategories() {
  const supabase = await createClient()
  const { data, error } = await supabase
    .from("product_categories")
    .select("*")
    .eq("active", true)
    .order("sort_order", { ascending: true })
    .order("name", { ascending: true })
  if (error) throw error
  return data
}

export async function createCategory(input: TablesInsert<"product_categories">) {
  await assertPermission("products.create")
  const supabase = await createClient()
  const { data, error } = await supabase
    .from("product_categories")
    .insert(input)
    .select()
    .single()
  if (error) throw error
  await logActivity({
    action: "product_category_created",
    entityType: "product_category",
    entityId: data.id,
    entityName: data.name,
  })
  revalidateTienda()
  return data
}

export async function updateCategory(id: string, input: TablesUpdate<"product_categories">) {
  await assertPermission("products.edit")
  const supabase = await createClient()
  const { data, error } = await supabase
    .from("product_categories")
    .update({ ...input, updated_at: new Date().toISOString() })
    .eq("id", id)
    .select()
    .single()
  if (error) throw error
  await logActivity({
    action: "product_category_updated",
    entityType: "product_category",
    entityId: data.id,
    entityName: data.name,
  })
  revalidateTienda()
  return data
}

export async function deleteCategory(id: string) {
  await assertPermission("products.delete")
  const supabase = await createClient()
  const { data: cat } = await supabase
    .from("product_categories")
    .select("name")
    .eq("id", id)
    .single()
  const { error } = await supabase.from("product_categories").delete().eq("id", id)
  if (error) throw error
  await logActivity({
    action: "product_category_deleted",
    entityType: "product_category",
    entityId: id,
    entityName: cat?.name ?? undefined,
  })
  revalidateTienda()
}

// ---------- Productos ----------

export async function getProducts(filters?: { categoryId?: string; search?: string }) {
  const supabase = await createClient()
  let query = supabase
    .from("products")
    .select("*, product_categories(id, name)")
    .order("sort_order", { ascending: true })
    .order("created_at", { ascending: false })
  if (filters?.categoryId) query = query.eq("category_id", filters.categoryId)
  if (filters?.search) query = query.ilike("name", `%${filters.search}%`)
  const { data, error } = await query
  if (error) throw error
  return data
}

export async function getStoreProducts() {
  const supabase = await createClient()
  const { data, error } = await supabase
    .from("products")
    .select("*, product_categories(id, name)")
    .eq("active", true)
    .order("featured", { ascending: false })
    .order("sort_order", { ascending: true })
    .order("created_at", { ascending: false })
  if (error) throw error
  return data
}

export async function createProduct(input: TablesInsert<"products">) {
  await assertPermission("products.create")
  const supabase = await createClient()
  const { data, error } = await supabase.from("products").insert(input).select().single()
  if (error) throw error
  await logActivity({
    action: "product_created",
    entityType: "product",
    entityId: data.id,
    entityName: data.name,
  })
  revalidateTienda()
  return data
}

export async function updateProduct(id: string, input: TablesUpdate<"products">) {
  await assertPermission("products.edit")
  const supabase = await createClient()
  const { data, error } = await supabase
    .from("products")
    .update({ ...input, updated_at: new Date().toISOString() })
    .eq("id", id)
    .select()
    .single()
  if (error) throw error
  await logActivity({
    action: "product_updated",
    entityType: "product",
    entityId: data.id,
    entityName: data.name,
  })
  revalidateTienda()
  return data
}

export async function deleteProduct(id: string) {
  await assertPermission("products.delete")
  const supabase = await createClient()
  const { data: prod } = await supabase.from("products").select("name").eq("id", id).single()
  const { error } = await supabase.from("products").delete().eq("id", id)
  if (error) throw error
  await logActivity({
    action: "product_deleted",
    entityType: "product",
    entityId: id,
    entityName: prod?.name ?? undefined,
  })
  revalidateTienda()
}

// ---------- Imágenes (Cloudinary) ----------

export async function uploadProductImage(formData: FormData): Promise<string> {
  await assertPermission("products.create", "products.edit")

  const file = formData.get("image") as File
  if (!file || file.size === 0) throw new Error("No se seleccionó imagen")
  if (file.size > 30 * 1024 * 1024) throw new Error("La imagen no puede superar 30MB")

  const allowedTypes = ["image/jpeg", "image/png", "image/webp"]
  if (!allowedTypes.includes(file.type)) {
    throw new Error("Formato no permitido. Usa JPG, PNG o WebP")
  }

  const bytes = await file.arrayBuffer()
  const buffer = Buffer.from(bytes)
  const dataUrl = `data:${file.type};base64,${buffer.toString("base64")}`

  const result = await cloudinary.uploader.upload(dataUrl, {
    folder: "madbox/products",
    transformation: [{ width: 800, height: 800, crop: "limit" }],
  })

  return result.secure_url
}
