# Tienda de productos (Market) — Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Añadir un catálogo de productos del gimnasio gestionable por el admin (`/dashboard/tienda`) y visible para los clientes en el portal (`/portal/tienda`), con contacto por WhatsApp.

**Architecture:** Server Actions sobre Supabase (RLS con `is_admin()`) como única vía a datos; dos tablas nuevas (`products`, `product_categories`) + columna `whatsapp` en `gym_settings`. UI con shadcn/ui + TanStack Query, formularios RHF, imágenes en Cloudinary. Sigue el patrón existente `plans` (acciones finas, `revalidatePath`, `logActivity`, guardas de permisos).

**Tech Stack:** Next.js 16 (App Router, Server Actions), React 19, TypeScript strict, Supabase, TanStack Query 5, shadcn/ui (Radix), React Hook Form 7 + Zod 3, Cloudinary, lucide-react, SweetAlert2, Sonner.

**Spec:** `docs/superpowers/specs/2026-06-16-tienda-productos-design.md`

---

## Notas de ejecución (importantes)

- **Verificación en este proyecto:** no hay test runner. Cada tarea se verifica con
  `npx tsc --noEmit` (tipos), `npm run lint` (ESLint) y, donde aplique, prueba manual en
  `npm run dev`. La verificación final usa `npm run build`.
- **Commits:** por regla del proyecto (`CLAUDE.md`), **no hacer `git commit` sin que el
  usuario lo pida**. Los pasos "Commit" quedan documentados pero se ejecutan solo con
  autorización explícita. Agrupa los cambios de cada tarea para commitear cuando se
  autorice.
- **Tipos generados:** `types/database.ts` no se edita a mano. Tras la migración se
  regenera (Supabase MCP `generate_typescript_types` o `npx supabase gen types typescript`).
- Idioma de UI, logs y mensajes: **español**.

---

## File Structure

**Nuevos**
- `supabase/migrations/20260616120000_tienda_productos.sql` — esquema + RLS.
- `lib/actions/products.ts` — Server Actions (productos, categorías, imágenes).
- `app/dashboard/tienda/page.tsx` — página fina admin.
- `components/section-components/tienda/TiendaMainComponent.tsx` — admin (sub-tabs).
- `components/section-components/tienda/index.ts` — re-export.
- `components/section-components/tienda/modals/product-form-modal.tsx` — form producto + uploader.
- `components/section-components/tienda/modals/category-form-modal.tsx` — form categoría.
- `app/portal/tienda/page.tsx` — página fina portal.
- `components/section-components/portal/tienda/PortalTiendaMainComponent.tsx` — storefront.
- `components/section-components/portal/tienda/ProductCard.tsx` — tarjeta de producto.

**Modificados**
- `types/database.ts` — regenerado.
- `lib/actions/activity.ts` — nuevas `ActivityAction` / `EntityType`.
- `components/section-components/roles/RolesMainComponent.tsx` — grupo `products` en `permissionGroups`.
- `components/section-components/settings/SettingsMainComponent.tsx` — campo WhatsApp.
- `components/shared/dashboard-layout.tsx` — entrada de nav admin.
- `app/portal/layout.tsx` — entrada de nav portal.
- `CLAUDE.md` — lista de permisos.

---

## Task 1: Migración SQL (tablas, columna WhatsApp, RLS)

**Files:**
- Create: `supabase/migrations/20260616120000_tienda_productos.sql`

- [ ] **Step 1: Escribir la migración**

```sql
-- Tienda de productos: catálogo gestionable por admin, visible en el portal.

-- 1. Categorías de productos
CREATE TABLE IF NOT EXISTS product_categories (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  name text NOT NULL,
  sort_order int NOT NULL DEFAULT 0,
  active boolean NOT NULL DEFAULT true,
  created_at timestamptz DEFAULT now(),
  updated_at timestamptz DEFAULT now()
);

-- 2. Productos
CREATE TABLE IF NOT EXISTS products (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  name text NOT NULL,
  description text,
  price numeric NOT NULL DEFAULT 0 CHECK (price >= 0),
  category_id uuid REFERENCES product_categories(id) ON DELETE SET NULL,
  images text[] NOT NULL DEFAULT '{}',
  in_stock boolean NOT NULL DEFAULT true,
  featured boolean NOT NULL DEFAULT false,
  active boolean NOT NULL DEFAULT true,
  sort_order int NOT NULL DEFAULT 0,
  created_at timestamptz DEFAULT now(),
  updated_at timestamptz DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_products_category_id ON products(category_id);
CREATE INDEX IF NOT EXISTS idx_products_active ON products(active);

-- 3. WhatsApp del gimnasio (contacto único para la tienda)
ALTER TABLE gym_settings ADD COLUMN IF NOT EXISTS whatsapp text;

-- 4. RLS (mismo patrón que routine_schedules: lectura authenticated, escritura admins)
ALTER TABLE product_categories ENABLE ROW LEVEL SECURITY;
ALTER TABLE products ENABLE ROW LEVEL SECURITY;

CREATE POLICY "auth read product_categories" ON product_categories
  FOR SELECT TO authenticated USING (true);
CREATE POLICY "admins write product_categories" ON product_categories
  FOR ALL TO authenticated USING (is_admin()) WITH CHECK (is_admin());

CREATE POLICY "auth read products" ON products
  FOR SELECT TO authenticated USING (true);
CREATE POLICY "admins write products" ON products
  FOR ALL TO authenticated USING (is_admin()) WITH CHECK (is_admin());
```

- [ ] **Step 2: Aplicar la migración**

Aplicar con Supabase MCP `apply_migration` (name: `tienda_productos`, query = contenido del
archivo) **o** `npx supabase db push` si se trabaja con CLI local. Verificar que no hay
error de que `is_admin()` no existe (ya está creada en migraciones previas).

- [ ] **Step 3: Verificar las tablas**

Con Supabase MCP `list_tables` confirmar que existen `products` y `product_categories` con
RLS habilitado, y que `gym_settings` tiene la columna `whatsapp`.

- [ ] **Step 4: Regenerar tipos**

Regenerar `types/database.ts` (Supabase MCP `generate_typescript_types`, o
`npx supabase gen types typescript --project-id <ref> > types/database.ts`).
Confirmar que aparecen `products`, `product_categories` y `gym_settings.whatsapp`.

- [ ] **Step 5: Verificar tipos**

Run: `npx tsc --noEmit`
Expected: sin errores nuevos.

- [ ] **Step 6: Commit** (solo si el usuario lo autoriza)

```bash
git add supabase/migrations/20260616120000_tienda_productos.sql types/database.ts
git commit -m "feat(tienda): migración de productos, categorías y WhatsApp + RLS"
```

---

## Task 2: Ampliar tipos de actividad (`activity.ts`)

**Files:**
- Modify: `lib/actions/activity.ts:6-28`

- [ ] **Step 1: Añadir acciones de producto al union `ActivityAction`**

En `lib/actions/activity.ts`, dentro de `export type ActivityAction =`, añadir una línea
antes del cierre del union (después de `| "wod_logged" | "wod_deleted"`):

```ts
  | "product_created" | "product_updated" | "product_deleted"
  | "product_category_created" | "product_category_updated" | "product_category_deleted"
```

- [ ] **Step 2: Añadir entidades al union `EntityType`**

Dentro de `export type EntityType =`, añadir antes del cierre (después de `| "wod_log"`):

```ts
  | "product" | "product_category"
```

- [ ] **Step 3: Verificar tipos**

Run: `npx tsc --noEmit`
Expected: sin errores.

- [ ] **Step 4: Commit** (solo si el usuario lo autoriza)

```bash
git add lib/actions/activity.ts
git commit -m "feat(tienda): tipos de actividad para productos y categorías"
```

---

## Task 3: Server Actions (`lib/actions/products.ts`)

**Files:**
- Create: `lib/actions/products.ts`

- [ ] **Step 1: Crear el archivo completo de acciones**

```ts
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
```

- [ ] **Step 2: Verificar tipos**

Run: `npx tsc --noEmit`
Expected: sin errores (requiere que Task 1 haya regenerado `types/database.ts`).

- [ ] **Step 3: Lint**

Run: `npm run lint`
Expected: sin errores nuevos en `lib/actions/products.ts`.

- [ ] **Step 4: Commit** (solo si el usuario lo autoriza)

```bash
git add lib/actions/products.ts
git commit -m "feat(tienda): server actions de productos, categorías e imágenes"
```

---

## Task 4: Permisos `products.*`

**Files:**
- Modify: `components/section-components/roles/RolesMainComponent.tsx` (constante `permissionGroups`)
- Modify: `CLAUDE.md` (lista de permisos)

- [ ] **Step 1: Añadir el grupo `products` a `permissionGroups`**

En `RolesMainComponent.tsx`, dentro del array `permissionGroups` (antes del `]` de cierre
del array, junto a los otros grupos), añadir:

```ts
  {
    id: "products",
    label: "Tienda",
    permissions: [
      { id: "products.view", label: "Ver tienda", description: "Ver productos y categorías" },
      { id: "products.create", label: "Crear productos", description: "Crear productos y categorías" },
      { id: "products.edit", label: "Editar productos", description: "Modificar productos y categorías" },
      { id: "products.delete", label: "Eliminar productos", description: "Eliminar productos y categorías" },
    ]
  },
```

- [ ] **Step 2: Documentar los permisos en `CLAUDE.md`**

En `CLAUDE.md`, en la línea de "Permisos disponibles" (sección 4. Permisos), añadir al final
de la lista: `, \`products.{view,create,edit,delete}\``.

- [ ] **Step 3: Verificar tipos**

Run: `npx tsc --noEmit`
Expected: sin errores.

- [ ] **Step 4: Commit** (solo si el usuario lo autoriza)

```bash
git add components/section-components/roles/RolesMainComponent.tsx CLAUDE.md
git commit -m "feat(tienda): permisos products.* en roles"
```

---

## Task 5: Campo WhatsApp en Configuración

**Files:**
- Modify: `components/section-components/settings/SettingsMainComponent.tsx`

- [ ] **Step 1: Añadir `whatsapp` a la interfaz `GymInfoForm`**

En `SettingsMainComponent.tsx`, en `interface GymInfoForm` (línea ~20), añadir el campo:

```ts
interface GymInfoForm {
  name: string
  email: string
  phone: string
  whatsapp: string
  address: string
}
```

- [ ] **Step 2: Incluir `whatsapp` en defaultValues y reset**

En `useForm<GymInfoForm>({ defaultValues: {...} })` añadir `whatsapp: ""`:

```ts
  const { register, handleSubmit, reset } = useForm<GymInfoForm>({
    defaultValues: { name: "", email: "", phone: "", whatsapp: "", address: "" }
  })
```

Y en el `useEffect` que hace `reset({...})` añadir la línea:

```ts
      reset({
        name: settings.name || "",
        email: settings.email || "",
        phone: settings.phone || "",
        whatsapp: settings.whatsapp || "",
        address: settings.address || ""
      })
```

- [ ] **Step 3: Añadir el input WhatsApp al formulario**

Dentro del `<div className="grid gap-4 grid-cols-1 sm:grid-cols-2">`, después del bloque de
"Teléfono" (línea ~178) y antes de "Dirección", añadir:

```tsx
                    <div className="grid gap-2">
                      <Label htmlFor="whatsapp">WhatsApp (tienda)</Label>
                      <Input id="whatsapp" placeholder="+58412XXXXXXX" {...register("whatsapp")} />
                      <p className="text-xs text-muted-foreground">Número usado en el botón &quot;Pedir por WhatsApp&quot; de la tienda. Formato internacional.</p>
                    </div>
```

- [ ] **Step 4: Verificar tipos y prueba manual**

Run: `npx tsc --noEmit`
Expected: sin errores.

Manual (`npm run dev`): en `/dashboard/settings` → tab General, guardar un número y recargar;
debe persistir.

- [ ] **Step 5: Commit** (solo si el usuario lo autoriza)

```bash
git add components/section-components/settings/SettingsMainComponent.tsx
git commit -m "feat(tienda): campo WhatsApp en configuración del gimnasio"
```

---

## Task 6: Navegación admin + página `/dashboard/tienda`

**Files:**
- Modify: `components/shared/dashboard-layout.tsx:13` y `:22-32`
- Create: `app/dashboard/tienda/page.tsx`

- [ ] **Step 1: Importar el icono `ShoppingBag`**

En `dashboard-layout.tsx`, en el import de `lucide-react` (línea 13), añadir `ShoppingBag`:

```ts
import { Home, Users, Shield, CreditCard, DollarSign, Calendar, CalendarCheck, CalendarClock, Settings, LogOut, Menu, X, ChevronDown, ShoppingBag } from "lucide-react"
```

- [ ] **Step 2: Añadir la entrada de navegación**

En el array `navigation` (línea ~22), añadir tras "Clases Especiales":

```ts
  { name: "Tienda", href: "/dashboard/tienda", icon: ShoppingBag, permissions: ["products.view"] },
```

- [ ] **Step 3: Crear la página fina**

Create `app/dashboard/tienda/page.tsx`:

```tsx
import { TiendaMainComponent } from "@/components/section-components/tienda"

export default function TiendaPage() {
  return <TiendaMainComponent />
}
```

> Nota: este archivo no compila hasta crear `TiendaMainComponent` (Task 7). Se verifica al
> final de Task 7.

- [ ] **Step 4: Commit** (solo si el usuario lo autoriza, junto con Task 7)

---

## Task 7: Admin — `TiendaMainComponent` (tab Productos) + `product-form-modal`

**Files:**
- Create: `components/section-components/tienda/TiendaMainComponent.tsx`
- Create: `components/section-components/tienda/index.ts`
- Create: `components/section-components/tienda/modals/product-form-modal.tsx`

- [ ] **Step 1: Crear el `index.ts`**

```ts
export { TiendaMainComponent } from "./TiendaMainComponent"
```

- [ ] **Step 2: Crear `product-form-modal.tsx` (form + uploader multi-imagen)**

```tsx
"use client"

import { useEffect, useState } from "react"
import { useForm } from "react-hook-form"
import { useMutation, useQueryClient, useQuery } from "@tanstack/react-query"
import { showToast } from "@/lib/sweetalert"
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle, DialogFooter } from "@/components/ui/dialog"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { Textarea } from "@/components/ui/textarea"
import { Switch } from "@/components/ui/switch"
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select"
import { Loader2, Upload, X, Star } from "lucide-react"
import { createProduct, updateProduct, uploadProductImage, getActiveCategories } from "@/lib/actions/products"

interface ProductFormModalProps {
  open: boolean
  onOpenChange: (open: boolean) => void
  product?: any
}

interface FormData {
  name: string
  description: string
  price: string
  category_id: string
  in_stock: boolean
  featured: boolean
  active: boolean
}

const NO_CATEGORY = "none"

export function ProductFormModal({ open, onOpenChange, product }: ProductFormModalProps) {
  const queryClient = useQueryClient()
  const [images, setImages] = useState<string[]>([])
  const [uploading, setUploading] = useState(false)

  const { register, handleSubmit, setValue, watch, reset, formState: { errors } } = useForm<FormData>({
    defaultValues: { name: "", description: "", price: "", category_id: NO_CATEGORY, in_stock: true, featured: false, active: true }
  })

  const inStock = watch("in_stock")
  const featured = watch("featured")
  const active = watch("active")
  const categoryId = watch("category_id")

  const { data: categories = [] } = useQuery({
    queryKey: ["product-categories"],
    queryFn: getActiveCategories,
  })

  useEffect(() => {
    if (open) {
      if (product) {
        reset({
          name: product.name || "",
          description: product.description || "",
          price: product.price?.toString() || "",
          category_id: product.category_id || NO_CATEGORY,
          in_stock: product.in_stock ?? true,
          featured: product.featured ?? false,
          active: product.active ?? true,
        })
        setImages(product.images || [])
      } else {
        reset({ name: "", description: "", price: "", category_id: NO_CATEGORY, in_stock: true, featured: false, active: true })
        setImages([])
      }
    }
  }, [product, open, reset])

  const handleFileChange = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const files = e.target.files
    if (!files || files.length === 0) return
    setUploading(true)
    try {
      const uploaded: string[] = []
      for (const file of Array.from(files)) {
        const fd = new FormData()
        fd.append("image", file)
        const url = await uploadProductImage(fd)
        uploaded.push(url)
      }
      setImages((prev) => [...prev, ...uploaded])
    } catch (err) {
      showToast.error("Error al subir imagen", err instanceof Error ? err.message : "Inténtalo de nuevo")
    } finally {
      setUploading(false)
      e.target.value = ""
    }
  }

  const removeImage = (url: string) => setImages((prev) => prev.filter((u) => u !== url))
  const makePrimary = (url: string) => setImages((prev) => [url, ...prev.filter((u) => u !== url)])

  const createMutation = useMutation({
    mutationFn: (data: any) => createProduct(data),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["products"] })
      showToast.success("Producto creado", "El producto ha sido creado correctamente.")
      onOpenChange(false)
    },
    onError: () => showToast.error("Error", "No se pudo crear el producto."),
  })

  const updateMutation = useMutation({
    mutationFn: (data: any) => updateProduct(product.id, data),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["products"] })
      showToast.success("Producto actualizado", "Los cambios han sido guardados.")
      onOpenChange(false)
    },
    onError: () => showToast.error("Error", "No se pudo actualizar el producto."),
  })

  const onSubmit = (data: FormData) => {
    const payload = {
      name: data.name,
      description: data.description || null,
      price: parseFloat(data.price),
      category_id: data.category_id === NO_CATEGORY ? null : data.category_id,
      images,
      in_stock: data.in_stock,
      featured: data.featured,
      active: data.active,
    }
    if (product) updateMutation.mutate(payload)
    else createMutation.mutate(payload)
  }

  const isLoading = createMutation.isPending || updateMutation.isPending

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-[560px] max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle>{product ? "Editar producto" : "Nuevo producto"}</DialogTitle>
          <DialogDescription>{product ? "Modifica los detalles del producto" : "Agrega un producto al catálogo"}</DialogDescription>
        </DialogHeader>
        <form onSubmit={handleSubmit(onSubmit)}>
          <div className="grid gap-4 py-4">
            <div className="grid gap-2">
              <Label htmlFor="name">Nombre</Label>
              <Input id="name" {...register("name", { required: "El nombre es requerido" })} placeholder="Ej: Proteína Whey 2lb" />
              {errors.name && <p className="text-sm text-destructive">{errors.name.message}</p>}
            </div>

            <div className="grid gap-4 grid-cols-2">
              <div className="grid gap-2">
                <Label htmlFor="price">Precio (USD)</Label>
                <Input id="price" type="number" step="0.01" {...register("price", { required: "El precio es requerido", min: { value: 0, message: "Debe ser positivo" } })} placeholder="32.00" />
                {errors.price && <p className="text-sm text-destructive">{errors.price.message}</p>}
              </div>
              <div className="grid gap-2">
                <Label htmlFor="category">Categoría</Label>
                <Select value={categoryId} onValueChange={(v) => setValue("category_id", v)}>
                  <SelectTrigger id="category"><SelectValue placeholder="Sin categoría" /></SelectTrigger>
                  <SelectContent>
                    <SelectItem value={NO_CATEGORY}>Sin categoría</SelectItem>
                    {categories.map((c: any) => (
                      <SelectItem key={c.id} value={c.id}>{c.name}</SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
            </div>

            <div className="grid gap-2">
              <Label htmlFor="description">Descripción</Label>
              <Textarea id="description" {...register("description")} placeholder="Detalles del producto…" rows={3} />
            </div>

            <div className="grid gap-2">
              <Label>Imágenes</Label>
              <div className="flex flex-wrap gap-2">
                {images.map((url, i) => (
                  <div key={url} className="relative h-20 w-20 rounded-md overflow-hidden border border-border group">
                    {/* eslint-disable-next-line @next/next/no-img-element */}
                    <img src={url} alt={`Imagen ${i + 1}`} className="h-full w-full object-cover" />
                    {i === 0 && (
                      <span className="absolute top-0 left-0 bg-primary/90 text-primary-foreground text-[9px] px-1 rounded-br">Principal</span>
                    )}
                    <div className="absolute inset-0 bg-black/50 opacity-0 group-hover:opacity-100 transition-opacity flex items-center justify-center gap-1">
                      {i !== 0 && (
                        <button type="button" onClick={() => makePrimary(url)} title="Hacer principal" className="p-1 text-white hover:text-primary">
                          <Star className="h-4 w-4" />
                        </button>
                      )}
                      <button type="button" onClick={() => removeImage(url)} title="Eliminar" className="p-1 text-white hover:text-destructive">
                        <X className="h-4 w-4" />
                      </button>
                    </div>
                  </div>
                ))}
                <label className="h-20 w-20 rounded-md border border-dashed border-border flex flex-col items-center justify-center cursor-pointer hover:bg-muted/50 text-muted-foreground">
                  {uploading ? <Loader2 className="h-5 w-5 animate-spin" /> : <Upload className="h-5 w-5" />}
                  <span className="text-[10px] mt-1">{uploading ? "Subiendo" : "Subir"}</span>
                  <input type="file" accept="image/jpeg,image/png,image/webp" multiple className="hidden" onChange={handleFileChange} disabled={uploading} />
                </label>
              </div>
            </div>

            <div className="flex items-center justify-between">
              <Label htmlFor="in_stock">Disponible</Label>
              <Switch id="in_stock" checked={inStock} onCheckedChange={(c) => setValue("in_stock", c)} />
            </div>
            <div className="flex items-center justify-between">
              <Label htmlFor="featured">Destacado</Label>
              <Switch id="featured" checked={featured} onCheckedChange={(c) => setValue("featured", c)} />
            </div>
            <div className="flex items-center justify-between">
              <Label htmlFor="active">Visible en el portal</Label>
              <Switch id="active" checked={active} onCheckedChange={(c) => setValue("active", c)} />
            </div>
          </div>
          <DialogFooter>
            <Button type="button" variant="outline" onClick={() => onOpenChange(false)} disabled={isLoading}>Cancelar</Button>
            <Button type="submit" disabled={isLoading || uploading}>
              {isLoading ? <><Loader2 className="mr-2 h-4 w-4 animate-spin" />Guardando...</> : product ? "Guardar cambios" : "Crear producto"}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  )
}
```

- [ ] **Step 3: Crear `TiendaMainComponent.tsx` (tab Productos; el tab Categorías se rellena en Task 8)**

```tsx
"use client"

import { useState } from "react"
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query"
import { showToast } from "@/lib/sweetalert"
import { DashboardLayout } from "@/components/shared/dashboard-layout"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Badge } from "@/components/ui/badge"
import { Card, CardContent } from "@/components/ui/card"
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs"
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select"
import { DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuTrigger } from "@/components/ui/dropdown-menu"
import { ConfirmDialog } from "@/components/ui/confirm-dialog"
import { Plus, MoreVertical, Edit, Trash2, Loader2, Star, PackageX, ShoppingBag, Search } from "lucide-react"
import { usePermissions } from "@/lib/hooks/use-permissions"
import { getExchangeRates } from "@/lib/actions/funds"
import { getProducts, deleteProduct, getCategories } from "@/lib/actions/products"
import { ProductFormModal } from "./modals/product-form-modal"
import { CategoryFormModal } from "./modals/category-form-modal"
import { CategoriesPanel } from "./CategoriesPanel"

const ALL = "all"

export function TiendaMainComponent() {
  const queryClient = useQueryClient()
  const { hasPermission, isAdmin } = usePermissions()
  const canCreate = isAdmin || hasPermission("products.create")
  const canEdit = isAdmin || hasPermission("products.edit")
  const canDelete = isAdmin || hasPermission("products.delete")

  const [search, setSearch] = useState("")
  const [categoryFilter, setCategoryFilter] = useState(ALL)
  const [productModalOpen, setProductModalOpen] = useState(false)
  const [selectedProduct, setSelectedProduct] = useState<any>(null)
  const [deleteOpen, setDeleteOpen] = useState(false)
  const [productToDelete, setProductToDelete] = useState<any>(null)
  const [categoryModalOpen, setCategoryModalOpen] = useState(false)
  const [selectedCategory, setSelectedCategory] = useState<any>(null)

  const { data: products = [], isLoading } = useQuery({
    queryKey: ["products"],
    queryFn: () => getProducts(),
  })

  const { data: categories = [] } = useQuery({
    queryKey: ["product-categories"],
    queryFn: getCategories,
  })

  const { data: exchangeRates = [] } = useQuery({
    queryKey: ["exchange-rates"],
    queryFn: getExchangeRates,
  })
  const bcvRate = exchangeRates.find((r: any) => r.type === "BCV")?.rate || 0

  const deleteMutation = useMutation({
    mutationFn: (id: string) => deleteProduct(id),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["products"] })
      showToast.success("Producto eliminado", `${productToDelete?.name} ha sido eliminado.`)
      setDeleteOpen(false)
      setProductToDelete(null)
    },
    onError: () => showToast.error("Error", "No se pudo eliminar el producto."),
  })

  const filtered = products.filter((p: any) => {
    const matchesSearch = p.name.toLowerCase().includes(search.toLowerCase())
    const matchesCategory = categoryFilter === ALL || p.category_id === categoryFilter
    return matchesSearch && matchesCategory
  })

  return (
    <DashboardLayout>
      <div className="space-y-6">
        <div className="flex items-center gap-3">
          <ShoppingBag className="h-7 w-7 text-primary" />
          <div>
            <h1 className="text-3xl font-bold tracking-tight">Tienda</h1>
            <p className="text-muted-foreground mt-1">Gestiona los productos del catálogo</p>
          </div>
        </div>

        <Tabs defaultValue="products" className="space-y-6">
          <TabsList>
            <TabsTrigger value="products">Productos</TabsTrigger>
            <TabsTrigger value="categories">Categorías</TabsTrigger>
          </TabsList>

          <TabsContent value="products" className="space-y-4">
            <div className="flex flex-col sm:flex-row gap-3 sm:items-center sm:justify-between">
              <div className="flex flex-1 gap-2">
                <div className="relative flex-1 max-w-xs">
                  <Search className="absolute left-2.5 top-2.5 h-4 w-4 text-muted-foreground" />
                  <Input value={search} onChange={(e) => setSearch(e.target.value)} placeholder="Buscar producto…" className="pl-8" />
                </div>
                <Select value={categoryFilter} onValueChange={setCategoryFilter}>
                  <SelectTrigger className="w-[170px]"><SelectValue /></SelectTrigger>
                  <SelectContent>
                    <SelectItem value={ALL}>Todas las categorías</SelectItem>
                    {categories.map((c: any) => (
                      <SelectItem key={c.id} value={c.id}>{c.name}</SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
              {canCreate && (
                <Button onClick={() => { setSelectedProduct(null); setProductModalOpen(true) }}>
                  <Plus className="mr-2 h-4 w-4" />Nuevo producto
                </Button>
              )}
            </div>

            {isLoading ? (
              <div className="flex justify-center py-12"><Loader2 className="h-8 w-8 animate-spin text-muted-foreground" /></div>
            ) : filtered.length === 0 ? (
              <div className="text-center py-12 text-muted-foreground">
                <ShoppingBag className="h-10 w-10 mx-auto mb-3 opacity-40" />
                <p>No hay productos que coincidan.</p>
              </div>
            ) : (
              <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
                {filtered.map((product: any) => (
                  <Card key={product.id} className="overflow-hidden">
                    <div className="relative aspect-video bg-muted">
                      {product.images?.[0] ? (
                        // eslint-disable-next-line @next/next/no-img-element
                        <img src={product.images[0]} alt={product.name} className="h-full w-full object-cover" />
                      ) : (
                        <div className="h-full w-full flex items-center justify-center text-muted-foreground"><ShoppingBag className="h-8 w-8 opacity-40" /></div>
                      )}
                      <div className="absolute top-2 left-2 flex gap-1">
                        {product.featured && <Badge className="bg-primary text-primary-foreground gap-1"><Star className="h-3 w-3" />Destacado</Badge>}
                        {!product.in_stock && <Badge variant="secondary" className="gap-1"><PackageX className="h-3 w-3" />Agotado</Badge>}
                        {!product.active && <Badge variant="outline">Inactivo</Badge>}
                      </div>
                    </div>
                    <CardContent className="p-4">
                      <div className="flex items-start justify-between gap-2">
                        <div className="min-w-0">
                          <h3 className="font-semibold truncate">{product.name}</h3>
                          <p className="text-xs text-muted-foreground">{product.product_categories?.name || "Sin categoría"}</p>
                        </div>
                        {(canEdit || canDelete) && (
                          <DropdownMenu>
                            <DropdownMenuTrigger asChild><Button variant="ghost" size="icon" className="h-8 w-8 shrink-0"><MoreVertical className="h-4 w-4" /></Button></DropdownMenuTrigger>
                            <DropdownMenuContent align="end">
                              {canEdit && <DropdownMenuItem onClick={() => { setSelectedProduct(product); setProductModalOpen(true) }}><Edit className="mr-2 h-4 w-4" />Editar</DropdownMenuItem>}
                              {canDelete && <DropdownMenuItem onClick={() => { setProductToDelete(product); setDeleteOpen(true) }} className="text-destructive"><Trash2 className="mr-2 h-4 w-4" />Eliminar</DropdownMenuItem>}
                            </DropdownMenuContent>
                          </DropdownMenu>
                        )}
                      </div>
                      <div className="mt-2 flex items-baseline gap-2">
                        <span className="text-lg font-bold text-green-500">${Number(product.price).toFixed(2)}</span>
                        {bcvRate > 0 && <span className="text-xs text-blue-400">≈ Bs {(Number(product.price) * bcvRate).toLocaleString("es-VE", { maximumFractionDigits: 0 })}</span>}
                      </div>
                    </CardContent>
                  </Card>
                ))}
              </div>
            )}
          </TabsContent>

          <TabsContent value="categories">
            <CategoriesPanel
              categories={categories}
              canCreate={canCreate}
              canEdit={canEdit}
              canDelete={canDelete}
              onCreate={() => { setSelectedCategory(null); setCategoryModalOpen(true) }}
              onEdit={(cat) => { setSelectedCategory(cat); setCategoryModalOpen(true) }}
            />
          </TabsContent>
        </Tabs>
      </div>

      <ProductFormModal open={productModalOpen} onOpenChange={setProductModalOpen} product={selectedProduct} />
      <CategoryFormModal open={categoryModalOpen} onOpenChange={setCategoryModalOpen} category={selectedCategory} />
      <ConfirmDialog
        open={deleteOpen}
        onOpenChange={setDeleteOpen}
        title="¿Eliminar producto?"
        description={`Se eliminará "${productToDelete?.name}". Esta acción no se puede deshacer.`}
        confirmText="Eliminar"
        variant="danger"
        onConfirm={() => productToDelete && deleteMutation.mutate(productToDelete.id)}
        isLoading={deleteMutation.isPending}
      />
    </DashboardLayout>
  )
}
```

> **Firma de `ConfirmDialog` (verificada):** props `open`, `onOpenChange`, `title`,
> `description`, `confirmText?`, `cancelText?`, `variant?: "danger" | "warning" | "info" |
> "success"`, `onConfirm`, `isLoading?`. Usar `variant="danger"` e `isLoading` (no
> `"destructive"` ni `loading`).

- [ ] **Step 4: Verificar tipos y lint**

Run: `npx tsc --noEmit` (fallará por `./CategoriesPanel` hasta Task 8 — ver nota).
Para verificar Task 7 de forma aislada, completar Task 8 (CategoriesPanel + category modal)
y luego correr la verificación conjunta.

- [ ] **Step 5: Commit** (solo si el usuario lo autoriza, junto con Tasks 6 y 8)

---

## Task 8: Admin — `CategoriesPanel` + `category-form-modal`

**Files:**
- Create: `components/section-components/tienda/CategoriesPanel.tsx`
- Create: `components/section-components/tienda/modals/category-form-modal.tsx`

- [ ] **Step 1: Crear `category-form-modal.tsx`**

```tsx
"use client"

import { useEffect } from "react"
import { useForm } from "react-hook-form"
import { useMutation, useQueryClient } from "@tanstack/react-query"
import { showToast } from "@/lib/sweetalert"
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle, DialogFooter } from "@/components/ui/dialog"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { Switch } from "@/components/ui/switch"
import { Loader2 } from "lucide-react"
import { createCategory, updateCategory } from "@/lib/actions/products"

interface CategoryFormModalProps {
  open: boolean
  onOpenChange: (open: boolean) => void
  category?: any
}

interface FormData {
  name: string
  sort_order: string
  active: boolean
}

export function CategoryFormModal({ open, onOpenChange, category }: CategoryFormModalProps) {
  const queryClient = useQueryClient()
  const { register, handleSubmit, setValue, watch, reset, formState: { errors } } = useForm<FormData>({
    defaultValues: { name: "", sort_order: "0", active: true }
  })
  const active = watch("active")

  useEffect(() => {
    if (open) {
      if (category) {
        reset({ name: category.name || "", sort_order: category.sort_order?.toString() || "0", active: category.active ?? true })
      } else {
        reset({ name: "", sort_order: "0", active: true })
      }
    }
  }, [category, open, reset])

  const createMutation = useMutation({
    mutationFn: (data: any) => createCategory(data),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["product-categories"] })
      showToast.success("Categoría creada", "La categoría ha sido creada.")
      onOpenChange(false)
    },
    onError: () => showToast.error("Error", "No se pudo crear la categoría."),
  })

  const updateMutation = useMutation({
    mutationFn: (data: any) => updateCategory(category.id, data),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["product-categories"] })
      showToast.success("Categoría actualizada", "Los cambios han sido guardados.")
      onOpenChange(false)
    },
    onError: () => showToast.error("Error", "No se pudo actualizar la categoría."),
  })

  const onSubmit = (data: FormData) => {
    const payload = { name: data.name, sort_order: parseInt(data.sort_order, 10) || 0, active: data.active }
    if (category) updateMutation.mutate(payload)
    else createMutation.mutate(payload)
  }

  const isLoading = createMutation.isPending || updateMutation.isPending

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-[420px]">
        <DialogHeader>
          <DialogTitle>{category ? "Editar categoría" : "Nueva categoría"}</DialogTitle>
          <DialogDescription>{category ? "Modifica la categoría" : "Crea una categoría de productos"}</DialogDescription>
        </DialogHeader>
        <form onSubmit={handleSubmit(onSubmit)}>
          <div className="grid gap-4 py-4">
            <div className="grid gap-2">
              <Label htmlFor="cat-name">Nombre</Label>
              <Input id="cat-name" {...register("name", { required: "El nombre es requerido" })} placeholder="Ej: Suplementos" />
              {errors.name && <p className="text-sm text-destructive">{errors.name.message}</p>}
            </div>
            <div className="grid gap-2">
              <Label htmlFor="cat-order">Orden</Label>
              <Input id="cat-order" type="number" {...register("sort_order")} placeholder="0" />
            </div>
            <div className="flex items-center justify-between">
              <Label htmlFor="cat-active">Activa</Label>
              <Switch id="cat-active" checked={active} onCheckedChange={(c) => setValue("active", c)} />
            </div>
          </div>
          <DialogFooter>
            <Button type="button" variant="outline" onClick={() => onOpenChange(false)} disabled={isLoading}>Cancelar</Button>
            <Button type="submit" disabled={isLoading}>
              {isLoading ? <><Loader2 className="mr-2 h-4 w-4 animate-spin" />Guardando...</> : category ? "Guardar cambios" : "Crear categoría"}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  )
}
```

- [ ] **Step 2: Crear `CategoriesPanel.tsx`**

```tsx
"use client"

import { useState } from "react"
import { useMutation, useQueryClient } from "@tanstack/react-query"
import { showToast } from "@/lib/sweetalert"
import { Button } from "@/components/ui/button"
import { Badge } from "@/components/ui/badge"
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table"
import { ConfirmDialog } from "@/components/ui/confirm-dialog"
import { Plus, Edit, Trash2, Tag } from "lucide-react"
import { deleteCategory } from "@/lib/actions/products"

interface CategoriesPanelProps {
  categories: any[]
  canCreate: boolean
  canEdit: boolean
  canDelete: boolean
  onCreate: () => void
  onEdit: (category: any) => void
}

export function CategoriesPanel({ categories, canCreate, canEdit, canDelete, onCreate, onEdit }: CategoriesPanelProps) {
  const queryClient = useQueryClient()
  const [deleteOpen, setDeleteOpen] = useState(false)
  const [toDelete, setToDelete] = useState<any>(null)

  const deleteMutation = useMutation({
    mutationFn: (id: string) => deleteCategory(id),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["product-categories"] })
      queryClient.invalidateQueries({ queryKey: ["products"] })
      showToast.success("Categoría eliminada", `${toDelete?.name} ha sido eliminada.`)
      setDeleteOpen(false)
      setToDelete(null)
    },
    onError: () => showToast.error("Error", "No se pudo eliminar la categoría."),
  })

  return (
    <div className="space-y-4">
      <div className="flex justify-end">
        {canCreate && <Button onClick={onCreate}><Plus className="mr-2 h-4 w-4" />Nueva categoría</Button>}
      </div>
      {categories.length === 0 ? (
        <div className="text-center py-12 text-muted-foreground">
          <Tag className="h-10 w-10 mx-auto mb-3 opacity-40" />
          <p>Aún no hay categorías.</p>
        </div>
      ) : (
        <div className="rounded-lg border border-border">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Nombre</TableHead>
                <TableHead className="w-24">Orden</TableHead>
                <TableHead className="w-28">Estado</TableHead>
                <TableHead className="w-24 text-right">Acciones</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {categories.map((cat) => (
                <TableRow key={cat.id}>
                  <TableCell className="font-medium">{cat.name}</TableCell>
                  <TableCell>{cat.sort_order}</TableCell>
                  <TableCell>{cat.active ? <Badge variant="secondary">Activa</Badge> : <Badge variant="outline">Inactiva</Badge>}</TableCell>
                  <TableCell className="text-right">
                    <div className="flex justify-end gap-1">
                      {canEdit && <Button variant="ghost" size="icon" className="h-8 w-8" onClick={() => onEdit(cat)}><Edit className="h-4 w-4" /></Button>}
                      {canDelete && <Button variant="ghost" size="icon" className="h-8 w-8 text-destructive" onClick={() => { setToDelete(cat); setDeleteOpen(true) }}><Trash2 className="h-4 w-4" /></Button>}
                    </div>
                  </TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        </div>
      )}

      <ConfirmDialog
        open={deleteOpen}
        onOpenChange={setDeleteOpen}
        title="¿Eliminar categoría?"
        description={`Se eliminará "${toDelete?.name}". Los productos en esta categoría quedarán sin categoría.`}
        confirmText="Eliminar"
        variant="danger"
        onConfirm={() => toDelete && deleteMutation.mutate(toDelete.id)}
        isLoading={deleteMutation.isPending}
      />
    </div>
  )
}
```

- [ ] **Step 3: Verificar tipos y lint (Tasks 6+7+8 juntas)**

Run: `npx tsc --noEmit`
Expected: sin errores.
Run: `npm run lint`
Expected: sin errores nuevos en `components/section-components/tienda/**`.

- [ ] **Step 4: Prueba manual del admin**

`npm run dev` → con un usuario admin ir a `/dashboard/tienda`:
1. Crear una categoría (tab Categorías).
2. Crear un producto con imagen, precio, categoría, destacado.
3. Verificar badges (Destacado / Agotado / Inactivo) y precio USD + Bs.
4. Editar y eliminar producto y categoría.

- [ ] **Step 5: Commit** (solo si el usuario lo autoriza)

```bash
git add app/dashboard/tienda components/section-components/tienda components/shared/dashboard-layout.tsx
git commit -m "feat(tienda): sección admin con productos y categorías"
```

---

## Task 9: Portal — nav, página, storefront y ProductCard

**Files:**
- Modify: `app/portal/layout.tsx:9` y `:17-23`
- Create: `app/portal/tienda/page.tsx`
- Create: `components/section-components/portal/tienda/PortalTiendaMainComponent.tsx`
- Create: `components/section-components/portal/tienda/ProductCard.tsx`

- [ ] **Step 1: Añadir el tab "Tienda" a la nav del portal**

En `app/portal/layout.tsx`, en el import de `lucide-react` (línea 9), añadir `ShoppingBag`:

```ts
import { Home, Calendar, User, LogOut, Menu, X, Compass, Dumbbell, ShoppingBag } from "lucide-react"
```

En el array `nav` (línea ~17), añadir la entrada "Tienda" después de "Comunidad":

```ts
  { name: "Tienda", href: "/portal/tienda", icon: ShoppingBag, match: (p: string) => p.startsWith("/portal/tienda") },
```

- [ ] **Step 2: Crear la página fina**

Create `app/portal/tienda/page.tsx`:

```tsx
import { PortalTiendaMainComponent } from "@/components/section-components/portal/tienda/PortalTiendaMainComponent"

export default function PortalTiendaPage() {
  return <PortalTiendaMainComponent />
}
```

- [ ] **Step 3: Crear `ProductCard.tsx`**

```tsx
"use client"

import { useState } from "react"
import Image from "next/image"
import { Card, CardContent } from "@/components/ui/card"
import { Button } from "@/components/ui/button"
import { Badge } from "@/components/ui/badge"
import { ShoppingBag, MessageCircle, Star } from "lucide-react"
import { cn } from "@/lib/utils"

interface ProductCardProps {
  product: any
  bcvRate: number
  whatsapp: string | null
}

export function ProductCard({ product, bcvRate, whatsapp }: ProductCardProps) {
  const [imgError, setImgError] = useState(false)
  const price = Number(product.price)
  const bs = bcvRate > 0 ? price * bcvRate : null
  const mainImage = product.images?.[0]
  const available = product.in_stock

  const waLink = whatsapp
    ? `https://wa.me/${whatsapp.replace(/[^0-9]/g, "")}?text=${encodeURIComponent(`Hola, me interesa: ${product.name} ($${price.toFixed(2)})`)}`
    : null

  return (
    <Card className={cn("overflow-hidden flex flex-col", !available && "opacity-70")}>
      <div className="relative aspect-square bg-muted">
        {mainImage && !imgError ? (
          <Image src={mainImage} alt={product.name} fill sizes="(max-width: 640px) 50vw, 33vw" className="object-cover" onError={() => setImgError(true)} />
        ) : (
          <div className="h-full w-full flex items-center justify-center text-muted-foreground"><ShoppingBag className="h-10 w-10 opacity-40" /></div>
        )}
        <div className="absolute top-2 left-2 flex flex-col gap-1">
          {product.featured && <Badge className="bg-primary text-primary-foreground gap-1 w-fit"><Star className="h-3 w-3" />Destacado</Badge>}
          {!available && <Badge variant="secondary" className="w-fit">Agotado</Badge>}
        </div>
      </div>
      <CardContent className="p-3 flex flex-col flex-1">
        <p className="text-[11px] uppercase tracking-wide text-muted-foreground">{product.product_categories?.name || "Producto"}</p>
        <h3 className="font-semibold leading-tight line-clamp-2 mt-0.5">{product.name}</h3>
        {product.description && <p className="text-xs text-muted-foreground line-clamp-2 mt-1">{product.description}</p>}
        <div className="mt-2 flex items-baseline gap-2">
          <span className="text-lg font-bold text-green-500">${price.toFixed(2)}</span>
          {bs !== null && <span className="text-xs text-blue-400">≈ Bs {bs.toLocaleString("es-VE", { maximumFractionDigits: 0 })}</span>}
        </div>
        <div className="mt-3 pt-1">
          {available && waLink ? (
            <Button asChild className="w-full gap-2 bg-green-600 hover:bg-green-700 text-white">
              <a href={waLink} target="_blank" rel="noopener noreferrer"><MessageCircle className="h-4 w-4" />Pedir por WhatsApp</a>
            </Button>
          ) : (
            <Button className="w-full" variant="secondary" disabled>{available ? "Contacto no disponible" : "Agotado"}</Button>
          )}
        </div>
      </CardContent>
    </Card>
  )
}
```

- [ ] **Step 4: Crear `PortalTiendaMainComponent.tsx`**

```tsx
"use client"

import { useState } from "react"
import { useQuery } from "@tanstack/react-query"
import { cn } from "@/lib/utils"
import { ShoppingBag } from "lucide-react"
import { getStoreProducts, getActiveCategories } from "@/lib/actions/products"
import { getExchangeRates } from "@/lib/actions/funds"
import { getGymSettings } from "@/lib/actions/settings"
import { ProductCard } from "./ProductCard"

const ALL = "all"

export function PortalTiendaMainComponent() {
  const [category, setCategory] = useState(ALL)

  const { data: products = [], isLoading } = useQuery({
    queryKey: ["store-products"],
    queryFn: getStoreProducts,
  })
  const { data: categories = [] } = useQuery({
    queryKey: ["store-categories"],
    queryFn: getActiveCategories,
  })
  const { data: exchangeRates = [] } = useQuery({
    queryKey: ["exchange-rates"],
    queryFn: getExchangeRates,
  })
  const { data: settings } = useQuery({
    queryKey: ["gym-settings"],
    queryFn: getGymSettings,
  })

  const bcvRate = exchangeRates.find((r: any) => r.type === "BCV")?.rate || 0
  const whatsapp = settings?.whatsapp || null

  const filtered = category === ALL ? products : products.filter((p: any) => p.category_id === category)

  return (
    <div className="space-y-5">
      <div className="flex items-center gap-3">
        <ShoppingBag className="h-6 w-6 text-primary" />
        <div>
          <h1 className="text-2xl font-bold tracking-tight">Tienda</h1>
          <p className="text-sm text-muted-foreground">Productos disponibles en el gimnasio</p>
        </div>
      </div>

      {categories.length > 0 && (
        <div className="flex gap-2 overflow-x-auto pb-1 -mx-1 px-1 scrollbar-none">
          <CategoryChip label="Todos" active={category === ALL} onClick={() => setCategory(ALL)} />
          {categories.map((c: any) => (
            <CategoryChip key={c.id} label={c.name} active={category === c.id} onClick={() => setCategory(c.id)} />
          ))}
        </div>
      )}

      {isLoading ? (
        <div className="grid grid-cols-2 lg:grid-cols-3 gap-3">
          {Array.from({ length: 6 }).map((_, i) => (
            <div key={i} className="rounded-xl border border-border overflow-hidden animate-pulse">
              <div className="aspect-square bg-muted" />
              <div className="p-3 space-y-2">
                <div className="h-3 bg-muted rounded w-2/3" />
                <div className="h-4 bg-muted rounded w-1/3" />
                <div className="h-9 bg-muted rounded" />
              </div>
            </div>
          ))}
        </div>
      ) : filtered.length === 0 ? (
        <div className="text-center py-16 text-muted-foreground">
          <ShoppingBag className="h-12 w-12 mx-auto mb-3 opacity-40" />
          <p className="font-medium">Aún no hay productos disponibles</p>
          <p className="text-sm">Vuelve pronto.</p>
        </div>
      ) : (
        <div className="grid grid-cols-2 lg:grid-cols-3 gap-3">
          {filtered.map((product: any) => (
            <ProductCard key={product.id} product={product} bcvRate={bcvRate} whatsapp={whatsapp} />
          ))}
        </div>
      )}
    </div>
  )
}

function CategoryChip({ label, active, onClick }: { label: string; active: boolean; onClick: () => void }) {
  return (
    <button
      onClick={onClick}
      className={cn(
        "shrink-0 rounded-full px-4 py-1.5 text-sm font-medium border transition-colors",
        active ? "bg-primary text-primary-foreground border-primary" : "bg-card text-muted-foreground border-border hover:text-foreground"
      )}
    >
      {label}
    </button>
  )
}
```

- [ ] **Step 5: Configurar el dominio de Cloudinary en `next.config` (si aún no está)**

Verificar `next.config.ts`/`next.config.mjs`: el componente `Image` requiere
`res.cloudinary.com` en `images.remotePatterns`. Como los avatares del portal ya usan
Cloudinary, probablemente ya está configurado. Si no, añadir:

```ts
images: { remotePatterns: [{ protocol: "https", hostname: "res.cloudinary.com" }] }
```

- [ ] **Step 6: Verificar tipos y lint**

Run: `npx tsc --noEmit`
Expected: sin errores.
Run: `npm run lint`
Expected: sin errores nuevos.

- [ ] **Step 7: Prueba manual del portal**

`npm run dev` → con un usuario cliente (miembro) ir a `/portal/tienda`:
1. Ver el tab "Tienda" en header (desktop) y bottom nav (móvil, 6 items legibles).
2. Filtrar por categoría.
3. Producto disponible → "Pedir por WhatsApp" abre `wa.me` con el mensaje prellenado.
4. Producto agotado → botón deshabilitado "Agotado".
5. Sin WhatsApp configurado → botón "Contacto no disponible".

- [ ] **Step 8: Commit** (solo si el usuario lo autoriza)

```bash
git add app/portal/tienda app/portal/layout.tsx components/section-components/portal/tienda
git commit -m "feat(tienda): storefront del portal con tarjetas y WhatsApp"
```

---

## Task 10: Verificación final

**Files:** ninguno (solo verificación)

- [ ] **Step 1: Type-check completo**

Run: `npx tsc --noEmit`
Expected: sin errores.

- [ ] **Step 2: Lint**

Run: `npm run lint`
Expected: sin errores nuevos.

- [ ] **Step 3: Build de producción**

Run: `npm run build`
Expected: build exitoso, sin errores de tipos ni de rutas.

- [ ] **Step 4: Verificación funcional end-to-end (`npm run dev`)**

1. **Permisos:** un rol sin `products.*` no ve el tab "Tienda" en el admin; con
   `products.view` lo ve pero sin botones de crear/editar/eliminar.
2. **CRUD admin:** crear categoría → crear producto con varias imágenes → marcar destacado
   y agotado → editar → eliminar. Revisar que aparece en el registro de actividad.
3. **Portal:** el producto activo aparece; el inactivo no; el destacado va primero; el
   agotado muestra badge y botón deshabilitado.
4. **WhatsApp:** configurar el número en `/dashboard/settings` y comprobar el CTA.
5. **Conversión Bs:** con tasa BCV configurada, se muestra "≈ Bs"; sin tasa, solo USD.

- [ ] **Step 5: Commit final** (solo si el usuario lo autoriza)

```bash
git add -A
git commit -m "feat(tienda): catálogo de productos completo (admin + portal)"
```

---

## Self-Review (cobertura del spec)

- §3 Modelo de datos → Task 1 (tablas, índices, `whatsapp`, RLS). ✓
- §4 Server actions (productos/categorías/imágenes, revalidate, logActivity, permisos) → Task 3. ✓
- §5 Permisos `products.*` + guarda server/client + CLAUDE.md → Tasks 3, 4, 7, 8. ✓
- §6 Logging (ActivityAction/EntityType) → Task 2. ✓
- §7 Admin (nav, página, sub-tabs Productos/Categorías, modales, badges, precio Bs) → Tasks 6, 7, 8. ✓
- §8 Portal (nav, página, storefront, ProductCard, WhatsApp CTA, chips, Bs, estados) → Task 9. ✓
- §9 Diseño (modo oscuro, paleta, next/image, skeletons, iconos) → Tasks 7, 9. ✓
- §3 `gym_settings.whatsapp` editable en Configuración → Task 5. ✓
- §12 Riesgos (WhatsApp nulo, tasa 0, 6 items nav) → manejados en Task 9 (fallbacks) y Task 9 Step 7. ✓

Detalle del spec §8 sobre el **detalle de producto en Sheet/Dialog** se marca como opcional
y se difiere al pulido de UI con frontend-design/ui-ux-pro-max; no bloquea el catálogo. Se
documenta como mejora pendiente, no como gap funcional.
