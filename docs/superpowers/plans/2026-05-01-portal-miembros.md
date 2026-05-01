# Portal de Miembros — Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Construir un portal en `/portal/*` donde los miembros del gimnasio pueden autenticarse, ver su membresía, historial de pagos, catálogo de clases y gestionar su perfil con foto.

**Architecture:** Árbol de rutas `/portal/*` separado del dashboard de admins. Rol almacenado en `app_metadata.role` de Supabase Auth para routing en middleware sin queries adicionales. La tabla `members` recibe `auth_user_id`, `avatar_url` y `must_change_password`. Cloudinary maneja el upload de avatares server-side.

**Tech Stack:** Next.js 16 App Router, Supabase Auth (service_role para crear usuarios), Cloudinary v2 SDK, TanStack Query 5, React Hook Form 7 + Zod 3, Tailwind CSS 4, shadcn/ui, Sonner

**⚠️ Pre-requisito:** Tener listos `CLOUDINARY_CLOUD_NAME`, `CLOUDINARY_API_KEY`, `CLOUDINARY_API_SECRET` antes de las tareas de perfil/avatar.

---

## Mapa de archivos

### Nuevos
| Archivo | Responsabilidad |
|---|---|
| `app/portal/layout.tsx` | Layout del portal: header, nav 4 items, banner de estado |
| `app/portal/page.tsx` | Página inicio → PortalHomeMainComponent |
| `app/portal/cambiar-contrasena/page.tsx` | Cambio obligatorio de contraseña |
| `app/portal/clases/page.tsx` | Catálogo de clases especiales |
| `app/portal/pagos/page.tsx` | Historial de pagos |
| `app/portal/perfil/page.tsx` | Edición de perfil + avatar |
| `components/section-components/portal/home/PortalHomeMainComponent.tsx` | Estado membresía, plan, vencimiento |
| `components/section-components/portal/change-password/ChangePasswordMainComponent.tsx` | Form cambio contraseña |
| `components/section-components/portal/clases/PortalClasesMainComponent.tsx` | Cards de clases |
| `components/section-components/portal/pagos/PortalPagosMainComponent.tsx` | Tabla historial pagos |
| `components/section-components/portal/perfil/PortalPerfilMainComponent.tsx` | Form perfil + uploader |
| `lib/actions/portal.ts` | Server Actions exclusivas del portal |
| `lib/actions/migration.ts` | Script one-shot de migración |

### Modificados
| Archivo | Cambio |
|---|---|
| `middleware.ts` | Routing por `app_metadata.role` + gate `must_change_password` |
| `lib/actions/auth.ts` | Constante `DEFAULT_MEMBER_PASSWORD`, `signIn` redirige por rol |
| `lib/actions/members.ts` | `createMember` crea auth.users; `deleteMember` la elimina |
| `components/section-components/settings/SettingsMainComponent.tsx` | Botón "Migrar miembros al portal" |
| `types/database.ts` | Regenerar tras migración SQL |

---

## Task 1: SQL Migration en Supabase

**Files:**
- Ejecutar en: Supabase Dashboard → SQL Editor

- [ ] **Step 1: Abrir Supabase Dashboard**

Ir a tu proyecto en supabase.com → SQL Editor → New query.

- [ ] **Step 2: Ejecutar la migración**

```sql
-- Nuevas columnas en members
ALTER TABLE members
  ADD COLUMN IF NOT EXISTS auth_user_id  uuid REFERENCES auth.users(id) ON DELETE SET NULL,
  ADD COLUMN IF NOT EXISTS avatar_url    text,
  ADD COLUMN IF NOT EXISTS must_change_password boolean NOT NULL DEFAULT true;

-- Índice único para auth_user_id (permite NULL múltiples)
CREATE UNIQUE INDEX IF NOT EXISTS members_auth_user_id_idx
  ON members(auth_user_id)
  WHERE auth_user_id IS NOT NULL;

-- Índice único de email case-insensitive
CREATE UNIQUE INDEX IF NOT EXISTS members_email_lower_idx
  ON members(lower(email));

-- RLS: miembro lee su propia fila
CREATE POLICY "member_select_own" ON members
  FOR SELECT USING (auth_user_id = auth.uid());

-- RLS: miembro actualiza su propia fila
CREATE POLICY "member_update_own" ON members
  FOR UPDATE USING (auth_user_id = auth.uid());

-- RLS: miembro lee sus propios payments
CREATE POLICY "member_select_own_payments" ON payments
  FOR SELECT USING (
    member_id = (SELECT id FROM members WHERE auth_user_id = auth.uid())
  );

-- RLS: miembro lee sus propios special_class_payments
CREATE POLICY "member_select_own_class_payments" ON special_class_payments
  FOR SELECT USING (
    member_id = (SELECT id FROM members WHERE auth_user_id = auth.uid())
  );

-- RLS: cualquier usuario autenticado puede leer special_classes (catálogo)
CREATE POLICY "authenticated_select_special_classes" ON special_classes
  FOR SELECT TO authenticated USING (true);

-- RLS: cualquier usuario autenticado puede leer plans (catálogo)
CREATE POLICY "authenticated_select_plans" ON plans
  FOR SELECT TO authenticated USING (true);
```

- [ ] **Step 3: Verificar**

Ejecutar en SQL Editor:
```sql
SELECT column_name, data_type, is_nullable
FROM information_schema.columns
WHERE table_name = 'members'
  AND column_name IN ('auth_user_id', 'avatar_url', 'must_change_password');
```

Esperado: 3 filas con los nuevos campos.

- [ ] **Step 4: Regenerar types**

En terminal del proyecto:
```bash
npx supabase gen types typescript --project-id <TU_PROJECT_ID> --schema public > types/database.ts
```

El `project-id` está en la URL de tu dashboard: `https://supabase.com/dashboard/project/<project-id>`.

Si no tienes la CLI de Supabase: `npm install -g supabase` primero.

---

## Task 2: Instalar Cloudinary + variables de entorno

**Files:**
- Modify: `package.json`
- Modify: `.env`

- [ ] **Step 1: Instalar paquete**

```bash
npm install cloudinary
```

- [ ] **Step 2: Agregar variables al .env**

Abrir `.env` y agregar al final:
```
CLOUDINARY_CLOUD_NAME=tu_cloud_name
CLOUDINARY_API_KEY=tu_api_key
CLOUDINARY_API_SECRET=tu_api_secret
```

Reemplazar con tus credenciales reales de [cloudinary.com](https://cloudinary.com) → Settings → API Keys.

- [ ] **Step 3: Verificar que TypeScript puede importar cloudinary**

```bash
npx tsc --noEmit
```

Si hay error de tipos de cloudinary: `npm install --save-dev @types/node` (ya debería estar).

---

## Task 3: Constante de contraseña + signIn por rol

**Files:**
- Modify: `lib/actions/auth.ts`

- [ ] **Step 1: Agregar la constante y actualizar signIn**

Abrir `lib/actions/auth.ts`. Reemplazar el archivo completo con:

```typescript
"use server"

import { createClient } from "@/utils/supabase/server"
import { redirect } from "next/navigation"

export const DEFAULT_MEMBER_PASSWORD = "Madbox2026"

export async function signIn(email: string, password: string) {
  const supabase = await createClient()

  const { error } = await supabase.auth.signInWithPassword({ email, password })
  if (error) return { error: error.message }

  const { data: { user } } = await supabase.auth.getUser()
  const role = user?.app_metadata?.role

  if (role === "member") {
    redirect("/portal")
  } else {
    redirect("/dashboard")
  }
}

export async function signOut() {
  const supabase = await createClient()
  await supabase.auth.signOut()
  redirect("/login")
}

export async function getUser() {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  return user
}

export async function getAdmin() {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return null

  const { data: admin } = await supabase
    .from("admins")
    .select("*, roles(*)")
    .eq("auth_user_id", user.id)
    .single()

  return admin
}

export async function resetPassword(email: string) {
  const supabase = await createClient()
  const { error } = await supabase.auth.resetPasswordForEmail(email, {
    redirectTo: `${process.env.NEXT_PUBLIC_SITE_URL || "http://localhost:3000"}/auth/confirm?next=/reset-password`,
  })
  if (error) return { error: error.message }
  return { success: true }
}

export async function updatePassword(newPassword: string) {
  const supabase = await createClient()
  const { error } = await supabase.auth.updateUser({ password: newPassword })
  if (error) return { error: error.message }
  return { success: true }
}
```

- [ ] **Step 2: Verificar tipos**

```bash
npx tsc --noEmit
```

Esperado: sin errores relacionados con auth.ts.

---

## Task 4: Actualizar middleware.ts

**Files:**
- Modify: `middleware.ts`

- [ ] **Step 1: Reemplazar middleware.ts**

```typescript
import { createServerClient } from "@supabase/ssr"
import { type NextRequest, NextResponse } from "next/server"
import type { User } from "@supabase/supabase-js"
import type { SupabaseClient } from "@supabase/supabase-js"

async function getUserRole(
  user: User,
  supabase: SupabaseClient
): Promise<"admin" | "member" | null> {
  const role = user.app_metadata?.role as string | undefined
  if (role === "admin") return "admin"
  if (role === "member") return "member"

  // Fallback para admins existentes sin app_metadata.role
  const { data: admin } = await supabase
    .from("admins")
    .select("id")
    .eq("auth_user_id", user.id)
    .maybeSingle()

  if (admin) return "admin"
  return null
}

export async function middleware(request: NextRequest) {
  let supabaseResponse = NextResponse.next({ request })

  const supabase = createServerClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
    {
      cookies: {
        getAll() {
          return request.cookies.getAll()
        },
        setAll(cookiesToSet: { name: string; value: string; options?: Record<string, unknown> }[]) {
          cookiesToSet.forEach(({ name, value }) => request.cookies.set(name, value))
          supabaseResponse = NextResponse.next({ request })
          cookiesToSet.forEach(({ name, value, options }) =>
            supabaseResponse.cookies.set(name, value, options)
          )
        },
      },
    }
  )

  const { data: { user } } = await supabase.auth.getUser()
  const { pathname } = request.nextUrl

  const isPublicRoute =
    ["/", "/login", "/forgot-password", "/reset-password"].includes(pathname) ||
    pathname.startsWith("/auth/")

  // Usuario no autenticado intenta acceder a rutas protegidas
  if (!user) {
    if (pathname.startsWith("/dashboard") || pathname.startsWith("/portal")) {
      return NextResponse.redirect(new URL("/login", request.url))
    }
    return supabaseResponse
  }

  // Usuario autenticado en rutas de auth → redirigir a su área
  if (pathname === "/login" || pathname === "/forgot-password") {
    const role = await getUserRole(user, supabase)
    const dest = role === "member" ? "/portal" : "/dashboard"
    return NextResponse.redirect(new URL(dest, request.url))
  }

  // Protección de rutas por rol
  if (pathname.startsWith("/dashboard")) {
    const role = await getUserRole(user, supabase)
    if (role === "member") {
      return NextResponse.redirect(new URL("/portal", request.url))
    }
  }

  if (pathname.startsWith("/portal")) {
    const role = await getUserRole(user, supabase)
    if (role !== "member") {
      return NextResponse.redirect(new URL("/dashboard", request.url))
    }
    // Gate de cambio de contraseña obligatorio
    if (
      pathname !== "/portal/cambiar-contrasena" &&
      user.user_metadata?.must_change_password === true
    ) {
      return NextResponse.redirect(new URL("/portal/cambiar-contrasena", request.url))
    }
  }

  return supabaseResponse
}

export const config = {
  matcher: [
    "/((?!_next/static|_next/image|favicon.ico|.*\\.(?:svg|png|jpg|jpeg|gif|webp)$).*)",
  ],
}
```

- [ ] **Step 2: Verificar tipos**

```bash
npx tsc --noEmit
```

Esperado: sin errores en middleware.ts.

---

## Task 5: Integrar auth.users en createMember y deleteMember

**Files:**
- Modify: `lib/actions/members.ts`

- [ ] **Step 1: Agregar imports y actualizar createMember**

Abrir `lib/actions/members.ts`. Agregar estos imports al inicio (después de los existentes):

```typescript
import { createAdminClient } from "@/utils/supabase/admin"
import { DEFAULT_MEMBER_PASSWORD } from "./auth"
```

Reemplazar la función `createMember` completa:

```typescript
export async function createMember(member: TablesInsert<"members">) {
  const supabase = await createClient()
  const { data, error } = await supabase
    .from("members")
    .insert(member)
    .select()
    .single()

  if (error) throw error

  // Crear cuenta de auth para el nuevo miembro
  const adminClient = createAdminClient()
  const { data: authData, error: authError } = await adminClient.auth.admin.createUser({
    email: data.email,
    password: DEFAULT_MEMBER_PASSWORD,
    app_metadata: { role: "member" },
    user_metadata: { must_change_password: true },
    email_confirm: true,
  })

  if (!authError && authData.user) {
    await adminClient
      .from("members")
      .update({ auth_user_id: authData.user.id })
      .eq("id", data.id)
  } else if (authError) {
    console.warn(`No se pudo crear cuenta auth para ${data.email}: ${authError.message}`)
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
```

- [ ] **Step 2: Actualizar deleteMember**

Reemplazar la función `deleteMember` completa:

```typescript
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
```

- [ ] **Step 3: Verificar tipos**

```bash
npx tsc --noEmit
```

Esperado: sin errores en members.ts.

---

## Task 6: Crear lib/actions/portal.ts

**Files:**
- Create: `lib/actions/portal.ts`

- [ ] **Step 1: Crear el archivo con todas las Server Actions del portal**

```typescript
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
  if (file.size > 2 * 1024 * 1024) throw new Error("La imagen no puede superar 2MB")

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
```

- [ ] **Step 2: Verificar tipos**

```bash
npx tsc --noEmit
```

Esperado: sin errores en portal.ts.

---

## Task 7: Crear lib/actions/migration.ts

**Files:**
- Create: `lib/actions/migration.ts`

- [ ] **Step 1: Crear archivo de migración**

```typescript
"use server"

import { createAdminClient } from "@/utils/supabase/admin"
import { getCurrentAdminPermissions } from "./roles"
import { DEFAULT_MEMBER_PASSWORD } from "./auth"

export async function migrateMembersToPortal(): Promise<{
  success: number
  failed: number
  errors: string[]
}> {
  const { isAdmin } = await getCurrentAdminPermissions()
  if (!isAdmin) throw new Error("Solo Super Admin puede ejecutar esta migración")

  const adminClient = createAdminClient()

  // Obtener miembros sin cuenta de auth
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

  // Obtener todos los admins con auth_user_id
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
```

- [ ] **Step 2: Verificar tipos**

```bash
npx tsc --noEmit
```

Esperado: sin errores en migration.ts.

---

## Task 8: Portal layout

**Files:**
- Create: `app/portal/layout.tsx`

- [ ] **Step 1: Crear el layout**

```typescript
"use client"

import type React from "react"
import { useState } from "react"
import Link from "next/link"
import { usePathname } from "next/navigation"
import { useQuery } from "@tanstack/react-query"
import { Home, Calendar, CreditCard, User, LogOut, Menu, X } from "lucide-react"
import { Button } from "@/components/ui/button"
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar"
import { cn } from "@/lib/utils"
import { signOut } from "@/lib/actions/auth"
import { getMyProfile } from "@/lib/actions/portal"

const nav = [
  { name: "Inicio", href: "/portal", icon: Home },
  { name: "Clases", href: "/portal/clases", icon: Calendar },
  { name: "Pagos", href: "/portal/pagos", icon: CreditCard },
  { name: "Perfil", href: "/portal/perfil", icon: User },
]

export default function PortalLayout({ children }: { children: React.ReactNode }) {
  const pathname = usePathname()
  const [mobileMenuOpen, setMobileMenuOpen] = useState(false)

  const { data: profile } = useQuery({
    queryKey: ["my-profile"],
    queryFn: getMyProfile,
    staleTime: 5 * 60 * 1000,
  })

  const initials = profile?.name
    ? profile.name.split(" ").map((n: string) => n[0]).join("").slice(0, 2).toUpperCase()
    : "?"

  const statusBanner =
    pathname !== "/portal/cambiar-contrasena" && profile?.status === "expired"
      ? { msg: "Tu membresía venció. Habla con el gimnasio para renovar.", color: "bg-red-900/80 border-red-700 text-red-100" }
      : pathname !== "/portal/cambiar-contrasena" && profile?.status === "frozen"
      ? { msg: "Tu cuenta está congelada temporalmente.", color: "bg-blue-900/80 border-blue-700 text-blue-100" }
      : null

  return (
    <div className="min-h-screen bg-background flex flex-col">
      {/* Header */}
      <header className="sticky top-0 z-40 border-b border-border bg-background/95 backdrop-blur">
        <div className="flex h-14 items-center justify-between px-4">
          <span className="font-bold text-primary text-xl tracking-tight">Madbox</span>

          {/* Desktop nav */}
          <nav className="hidden md:flex items-center gap-1">
            {nav.map((item) => {
              const Icon = item.icon
              const active = pathname === item.href
              return (
                <Link key={item.href} href={item.href}>
                  <Button
                    variant="ghost"
                    size="sm"
                    className={cn("gap-2", active && "bg-primary/10 text-primary")}
                  >
                    <Icon className="h-4 w-4" />
                    {item.name}
                  </Button>
                </Link>
              )
            })}
          </nav>

          {/* User section */}
          <div className="flex items-center gap-2">
            <div className="hidden md:flex items-center gap-2">
              <Avatar className="h-8 w-8">
                <AvatarImage src={profile?.avatar_url ?? undefined} />
                <AvatarFallback className="bg-primary/20 text-primary text-xs font-bold">
                  {initials}
                </AvatarFallback>
              </Avatar>
              <span className="text-sm font-medium text-muted-foreground hidden lg:block">
                {profile?.name}
              </span>
            </div>
            <Button
              variant="ghost"
              size="icon"
              className="text-muted-foreground hover:text-foreground"
              onClick={() => signOut()}
            >
              <LogOut className="h-4 w-4" />
            </Button>
            {/* Mobile menu toggle */}
            <Button
              variant="ghost"
              size="icon"
              className="md:hidden"
              onClick={() => setMobileMenuOpen(!mobileMenuOpen)}
            >
              {mobileMenuOpen ? <X className="h-5 w-5" /> : <Menu className="h-5 w-5" />}
            </Button>
          </div>
        </div>

        {/* Mobile menu */}
        {mobileMenuOpen && (
          <div className="md:hidden border-t border-border bg-background px-4 py-2 flex flex-col gap-1">
            {nav.map((item) => {
              const Icon = item.icon
              const active = pathname === item.href
              return (
                <Link key={item.href} href={item.href} onClick={() => setMobileMenuOpen(false)}>
                  <Button
                    variant="ghost"
                    className={cn("w-full justify-start gap-2", active && "bg-primary/10 text-primary")}
                  >
                    <Icon className="h-4 w-4" />
                    {item.name}
                  </Button>
                </Link>
              )
            })}
          </div>
        )}
      </header>

      {/* Status banner */}
      {statusBanner && (
        <div className={cn("border-b px-4 py-2 text-sm text-center font-medium", statusBanner.color)}>
          {statusBanner.msg}
        </div>
      )}

      {/* Content */}
      <main className="flex-1 container mx-auto max-w-3xl px-4 py-6">
        {children}
      </main>

      {/* Bottom nav (mobile) */}
      <nav className="md:hidden fixed bottom-0 left-0 right-0 z-40 border-t border-border bg-background/95 backdrop-blur">
        <div className="flex">
          {nav.map((item) => {
            const Icon = item.icon
            const active = pathname === item.href
            return (
              <Link key={item.href} href={item.href} className="flex-1">
                <div className={cn(
                  "flex flex-col items-center gap-1 py-2 text-xs font-medium transition-colors",
                  active ? "text-primary" : "text-muted-foreground"
                )}>
                  <Icon className="h-5 w-5" />
                  {item.name}
                </div>
              </Link>
            )
          })}
        </div>
      </nav>

      {/* Spacer for bottom nav on mobile */}
      <div className="md:hidden h-16" />
    </div>
  )
}
```

- [ ] **Step 2: Crear páginas vacías para compilación**

Crear `app/portal/page.tsx`:
```typescript
export default function PortalPage() {
  return <div>Portal Inicio</div>
}
```

Crear `app/portal/cambiar-contrasena/page.tsx`:
```typescript
export default function CambiarContrasenaPage() {
  return <div>Cambiar contraseña</div>
}
```

Crear `app/portal/clases/page.tsx`:
```typescript
export default function ClasesPage() {
  return <div>Clases</div>
}
```

Crear `app/portal/pagos/page.tsx`:
```typescript
export default function PagosPage() {
  return <div>Pagos</div>
}
```

Crear `app/portal/perfil/page.tsx`:
```typescript
export default function PerfilPage() {
  return <div>Perfil</div>
}
```

- [ ] **Step 3: Verificar que compila y el servidor levanta**

```bash
npm run dev
```

Navegar a `http://localhost:3000/portal` — debe redirigir a `/login` si no hay sesión.

---

## Task 9: ChangePasswordMainComponent

**Files:**
- Create: `components/section-components/portal/change-password/ChangePasswordMainComponent.tsx`
- Create: `components/section-components/portal/change-password/index.ts`
- Modify: `app/portal/cambiar-contrasena/page.tsx`

- [ ] **Step 1: Crear el componente**

```typescript
"use client"

import { useForm } from "react-hook-form"
import { zodResolver } from "@hookform/resolvers/zod"
import { z } from "zod"
import { useMutation } from "@tanstack/react-query"
import { useRouter } from "next/navigation"
import { toast } from "sonner"
import { KeyRound, Loader2 } from "lucide-react"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import { updatePassword } from "@/lib/actions/auth"
import { clearMustChangePassword } from "@/lib/actions/portal"

const schema = z.object({
  password: z.string().min(8, "Mínimo 8 caracteres"),
  confirm: z.string(),
}).refine((d) => d.password === d.confirm, {
  message: "Las contraseñas no coinciden",
  path: ["confirm"],
})

type FormData = z.infer<typeof schema>

export default function ChangePasswordMainComponent() {
  const router = useRouter()
  const { register, handleSubmit, formState: { errors } } = useForm<FormData>({
    resolver: zodResolver(schema),
  })

  const mutation = useMutation({
    mutationFn: async (data: FormData) => {
      const result = await updatePassword(data.password)
      if (result?.error) throw new Error(result.error)
      await clearMustChangePassword()
    },
    onSuccess: () => {
      toast.success("Contraseña actualizada")
      router.push("/portal")
    },
    onError: (err) => {
      toast.error(err instanceof Error ? err.message : "Error al cambiar contraseña")
    },
  })

  return (
    <div className="flex min-h-[60vh] items-center justify-center">
      <Card className="w-full max-w-md">
        <CardHeader className="text-center">
          <div className="mx-auto mb-2 flex h-12 w-12 items-center justify-center rounded-full bg-primary/10">
            <KeyRound className="h-6 w-6 text-primary" />
          </div>
          <CardTitle>Cambia tu contraseña</CardTitle>
          <CardDescription>
            Es tu primer ingreso. Debes establecer una contraseña personal.
          </CardDescription>
        </CardHeader>
        <CardContent>
          <form onSubmit={handleSubmit((d) => mutation.mutate(d))} className="space-y-4">
            <div className="space-y-1">
              <Label htmlFor="password">Nueva contraseña</Label>
              <Input
                id="password"
                type="password"
                placeholder="Mínimo 8 caracteres"
                {...register("password")}
              />
              {errors.password && (
                <p className="text-xs text-destructive">{errors.password.message}</p>
              )}
            </div>
            <div className="space-y-1">
              <Label htmlFor="confirm">Confirmar contraseña</Label>
              <Input
                id="confirm"
                type="password"
                placeholder="Repite la contraseña"
                {...register("confirm")}
              />
              {errors.confirm && (
                <p className="text-xs text-destructive">{errors.confirm.message}</p>
              )}
            </div>
            <Button type="submit" className="w-full" disabled={mutation.isPending}>
              {mutation.isPending && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
              Guardar contraseña
            </Button>
          </form>
        </CardContent>
      </Card>
    </div>
  )
}
```

- [ ] **Step 2: Crear index.ts**

```typescript
export { default } from "./ChangePasswordMainComponent"
```

- [ ] **Step 3: Actualizar page.tsx**

Reemplazar `app/portal/cambiar-contrasena/page.tsx`:
```typescript
import ChangePasswordMainComponent from "@/components/section-components/portal/change-password"

export default function CambiarContrasenaPage() {
  return <ChangePasswordMainComponent />
}
```

- [ ] **Step 4: Verificar tipos**

```bash
npx tsc --noEmit
```

---

## Task 10: PortalHomeMainComponent

**Files:**
- Create: `components/section-components/portal/home/PortalHomeMainComponent.tsx`
- Create: `components/section-components/portal/home/index.ts`
- Modify: `app/portal/page.tsx`

- [ ] **Step 1: Crear el componente**

```typescript
"use client"

import { useQuery } from "@tanstack/react-query"
import { format, differenceInDays } from "date-fns"
import { es } from "date-fns/locale"
import { Shield, CalendarDays, Star, Loader2, AlertTriangle } from "lucide-react"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { Badge } from "@/components/ui/badge"
import { cn } from "@/lib/utils"
import { getMyProfile } from "@/lib/actions/portal"

const statusConfig = {
  active:  { label: "Activo",     color: "bg-green-900/50 text-green-400 border-green-700" },
  expired: { label: "Vencido",    color: "bg-red-900/50 text-red-400 border-red-700" },
  frozen:  { label: "Congelado",  color: "bg-blue-900/50 text-blue-400 border-blue-700" },
}

export default function PortalHomeMainComponent() {
  const { data: profile, isLoading } = useQuery({
    queryKey: ["my-profile"],
    queryFn: getMyProfile,
    staleTime: 5 * 60 * 1000,
  })

  if (isLoading) {
    return (
      <div className="flex justify-center py-20">
        <Loader2 className="h-8 w-8 animate-spin text-muted-foreground" />
      </div>
    )
  }

  if (!profile) return null

  const status = (profile.status ?? "expired") as keyof typeof statusConfig
  const cfg = statusConfig[status] ?? statusConfig.expired

  const paymentDate = profile.payment_date
    ? new Date(profile.payment_date + "T00:00:00")
    : null

  const daysLeft = paymentDate ? differenceInDays(paymentDate, new Date()) : null
  const plan = profile.plans as { name: string; features: string[] | null; price: number } | null

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-bold">Hola, {profile.name?.split(" ")[0]} 👋</h1>
        <p className="text-muted-foreground text-sm mt-1">Este es el estado de tu membresía</p>
      </div>

      {/* Status card */}
      <Card className={cn("border", cfg.color.includes("red") ? "border-red-800" : cfg.color.includes("blue") ? "border-blue-800" : "border-green-800")}>
        <CardContent className="pt-6">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-3">
              <Shield className="h-8 w-8 text-muted-foreground" />
              <div>
                <p className="text-sm text-muted-foreground">Estado</p>
                <Badge className={cn("mt-1 border", cfg.color)}>{cfg.label}</Badge>
              </div>
            </div>
            {paymentDate && (
              <div className="text-right">
                <p className="text-sm text-muted-foreground">Vencimiento</p>
                <p className="font-semibold">
                  {format(paymentDate, "d MMM yyyy", { locale: es })}
                </p>
                {daysLeft !== null && daysLeft >= 0 && (
                  <p className="text-xs text-muted-foreground">{daysLeft} días restantes</p>
                )}
                {daysLeft !== null && daysLeft < 0 && (
                  <p className="text-xs text-red-400 flex items-center gap-1">
                    <AlertTriangle className="h-3 w-3" />
                    Vencido hace {Math.abs(daysLeft)} días
                  </p>
                )}
              </div>
            )}
          </div>
        </CardContent>
      </Card>

      {/* Plan card */}
      {plan && (
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2 text-base">
              <Star className="h-4 w-4 text-primary" />
              {plan.name}
            </CardTitle>
          </CardHeader>
          <CardContent className="space-y-3">
            {plan.features && plan.features.length > 0 && (
              <ul className="space-y-1">
                {plan.features.map((f: string, i: number) => (
                  <li key={i} className="flex items-center gap-2 text-sm text-muted-foreground">
                    <span className="h-1.5 w-1.5 rounded-full bg-primary shrink-0" />
                    {f}
                  </li>
                ))}
              </ul>
            )}
          </CardContent>
        </Card>
      )}

      {/* Start date */}
      {profile.start_date && (
        <Card>
          <CardContent className="pt-6 flex items-center gap-3">
            <CalendarDays className="h-5 w-5 text-muted-foreground" />
            <div>
              <p className="text-sm text-muted-foreground">Miembro desde</p>
              <p className="font-medium">
                {format(new Date(profile.start_date + "T00:00:00"), "d 'de' MMMM yyyy", { locale: es })}
              </p>
            </div>
          </CardContent>
        </Card>
      )}
    </div>
  )
}
```

- [ ] **Step 2: Crear index.ts**

```typescript
export { default } from "./PortalHomeMainComponent"
```

- [ ] **Step 3: Actualizar page.tsx**

```typescript
import PortalHomeMainComponent from "@/components/section-components/portal/home"

export default function PortalPage() {
  return <PortalHomeMainComponent />
}
```

- [ ] **Step 4: Verificar tipos**

```bash
npx tsc --noEmit
```

---

## Task 11: PortalClasesMainComponent

**Files:**
- Create: `components/section-components/portal/clases/PortalClasesMainComponent.tsx`
- Create: `components/section-components/portal/clases/index.ts`
- Modify: `app/portal/clases/page.tsx`

- [ ] **Step 1: Crear el componente**

```typescript
"use client"

import { useQuery } from "@tanstack/react-query"
import { Users, Clock, DollarSign, Loader2, CheckCircle2 } from "lucide-react"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { Badge } from "@/components/ui/badge"
import { cn } from "@/lib/utils"
import { getActiveSpecialClasses, getMyEnrolledClasses } from "@/lib/actions/portal"

export default function PortalClasesMainComponent() {
  const { data: classes = [], isLoading: loadingClasses } = useQuery({
    queryKey: ["portal-special-classes"],
    queryFn: getActiveSpecialClasses,
    staleTime: 5 * 60 * 1000,
  })

  const { data: enrolled = [], isLoading: loadingEnrolled } = useQuery({
    queryKey: ["my-enrolled-classes"],
    queryFn: getMyEnrolledClasses,
    staleTime: 5 * 60 * 1000,
  })

  const enrolledClassIds = new Set(
    enrolled.map((e: any) => e.class_id).filter(Boolean)
  )

  if (loadingClasses || loadingEnrolled) {
    return (
      <div className="flex justify-center py-20">
        <Loader2 className="h-8 w-8 animate-spin text-muted-foreground" />
      </div>
    )
  }

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-bold">Clases Especiales</h1>
        <p className="text-muted-foreground text-sm mt-1">
          Clases disponibles en el gimnasio
        </p>
      </div>

      {classes.length === 0 && (
        <p className="text-muted-foreground text-center py-10">
          No hay clases disponibles por el momento.
        </p>
      )}

      <div className="grid gap-4">
        {classes.map((cls: any) => {
          const isEnrolled = enrolledClassIds.has(cls.id)
          const spotsLeft = cls.capacity - (cls.enrolled ?? 0)

          return (
            <Card key={cls.id} className={cn(isEnrolled && "border-primary/40")}>
              <CardHeader className="pb-2">
                <div className="flex items-start justify-between gap-2">
                  <CardTitle className="text-base">{cls.name}</CardTitle>
                  {isEnrolled && (
                    <Badge className="bg-primary/20 text-primary border-primary/40 shrink-0 gap-1">
                      <CheckCircle2 className="h-3 w-3" />
                      Inscrito
                    </Badge>
                  )}
                </div>
                <p className="text-sm text-muted-foreground">{cls.instructor}</p>
              </CardHeader>
              <CardContent className="space-y-2">
                <div className="flex flex-wrap gap-4 text-sm text-muted-foreground">
                  <span className="flex items-center gap-1">
                    <Clock className="h-4 w-4" />
                    {cls.schedule}
                  </span>
                  <span className="flex items-center gap-1">
                    <DollarSign className="h-4 w-4" />
                    ${cls.price}
                  </span>
                  <span className="flex items-center gap-1">
                    <Users className="h-4 w-4" />
                    {spotsLeft > 0 ? `${spotsLeft} cupos disponibles` : "Sin cupos"}
                  </span>
                </div>
              </CardContent>
            </Card>
          )
        })}
      </div>
    </div>
  )
}
```

- [ ] **Step 2: Crear index.ts**

```typescript
export { default } from "./PortalClasesMainComponent"
```

- [ ] **Step 3: Actualizar page.tsx**

```typescript
import PortalClasesMainComponent from "@/components/section-components/portal/clases"

export default function ClasesPage() {
  return <PortalClasesMainComponent />
}
```

---

## Task 12: PortalPagosMainComponent

**Files:**
- Create: `components/section-components/portal/pagos/PortalPagosMainComponent.tsx`
- Create: `components/section-components/portal/pagos/index.ts`
- Modify: `app/portal/pagos/page.tsx`

- [ ] **Step 1: Crear el componente**

```typescript
"use client"

import { useQuery } from "@tanstack/react-query"
import { format } from "date-fns"
import { es } from "date-fns/locale"
import { CreditCard, Loader2 } from "lucide-react"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { Badge } from "@/components/ui/badge"
import { getMyPayments } from "@/lib/actions/portal"

// Los valores de method en la DB son strings como "Pago Móvil", "USDT", etc.
// Se muestra directamente con fallback.

export default function PortalPagosMainComponent() {
  const { data: payments = [], isLoading } = useQuery({
    queryKey: ["my-payments"],
    queryFn: getMyPayments,
    staleTime: 5 * 60 * 1000,
  })

  if (isLoading) {
    return (
      <div className="flex justify-center py-20">
        <Loader2 className="h-8 w-8 animate-spin text-muted-foreground" />
      </div>
    )
  }

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-bold">Mis Pagos</h1>
        <p className="text-muted-foreground text-sm mt-1">Historial de pagos de membresía</p>
      </div>

      {payments.length === 0 && (
        <p className="text-muted-foreground text-center py-10">No tienes pagos registrados.</p>
      )}

      <div className="space-y-3">
        {payments.map((payment: any) => (
          <Card key={payment.id}>
            <CardContent className="pt-4 pb-4">
              <div className="flex items-start justify-between gap-2">
                <div className="flex items-center gap-3">
                  <div className="flex h-10 w-10 items-center justify-center rounded-full bg-green-900/30">
                    <CreditCard className="h-5 w-5 text-green-400" />
                  </div>
                  <div>
                    <p className="font-medium text-sm">
                      {payment.plans?.name ?? "Plan"}
                    </p>
                    <p className="text-xs text-muted-foreground">
                      {payment.payment_date
                        ? format(new Date(payment.payment_date + "T00:00:00"), "d MMM yyyy", { locale: es })
                        : "—"}
                    </p>
                    {payment.reference && (
                      <p className="text-xs text-muted-foreground">Ref: {payment.reference}</p>
                    )}
                  </div>
                </div>
                <div className="text-right shrink-0">
                  <p className="font-semibold text-green-400">
                    {payment.amount?.toLocaleString("es-VE")}
                  </p>
                  <Badge variant="outline" className="text-xs mt-1">
                    {methodLabel[payment.method ?? ""] ?? payment.method ?? "—"}
                  </Badge>
                </div>
              </div>
            </CardContent>
          </Card>
        ))}
      </div>
    </div>
  )
}
```

- [ ] **Step 2: Crear index.ts**

```typescript
export { default } from "./PortalPagosMainComponent"
```

- [ ] **Step 3: Actualizar page.tsx**

```typescript
import PortalPagosMainComponent from "@/components/section-components/portal/pagos"

export default function PagosPage() {
  return <PortalPagosMainComponent />
}
```

---

## Task 13: PortalPerfilMainComponent

**Files:**
- Create: `components/section-components/portal/perfil/PortalPerfilMainComponent.tsx`
- Create: `components/section-components/portal/perfil/index.ts`
- Modify: `app/portal/perfil/page.tsx`

- [ ] **Step 1: Crear el componente**

```typescript
"use client"

import { useRef, useState } from "react"
import { useForm } from "react-hook-form"
import { zodResolver } from "@hookform/resolvers/zod"
import { z } from "zod"
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query"
import { useRouter } from "next/navigation"
import { toast } from "sonner"
import { Camera, Loader2, Save, KeyRound } from "lucide-react"
import Link from "next/link"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar"
import { getMyProfile, updateMyProfile, uploadAvatarToCloudinary, updateAvatar } from "@/lib/actions/portal"

const schema = z.object({
  name: z.string().min(2, "Mínimo 2 caracteres"),
  phone: z.string().optional(),
  email: z.string().email("Email inválido"),
})
type FormData = z.infer<typeof schema>

export default function PortalPerfilMainComponent() {
  const queryClient = useQueryClient()
  const fileRef = useRef<HTMLInputElement>(null)
  const [avatarPreview, setAvatarPreview] = useState<string | null>(null)
  const [uploadingAvatar, setUploadingAvatar] = useState(false)

  const { data: profile, isLoading } = useQuery({
    queryKey: ["my-profile"],
    queryFn: getMyProfile,
    staleTime: 5 * 60 * 1000,
  })

  const { register, handleSubmit, formState: { errors }, reset } = useForm<FormData>({
    resolver: zodResolver(schema),
    values: {
      name: profile?.name ?? "",
      phone: profile?.phone ?? "",
      email: profile?.email ?? "",
    },
  })

  const updateMutation = useMutation({
    mutationFn: updateMyProfile,
    onSuccess: () => {
      toast.success("Perfil actualizado")
      queryClient.invalidateQueries({ queryKey: ["my-profile"] })
    },
    onError: (err) => {
      toast.error(err instanceof Error ? err.message : "Error al actualizar")
    },
  })

  const handleAvatarChange = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0]
    if (!file) return

    if (file.size > 2 * 1024 * 1024) {
      toast.error("La imagen no puede superar 2MB")
      return
    }

    // Preview local
    const reader = new FileReader()
    reader.onload = (ev) => setAvatarPreview(ev.target?.result as string)
    reader.readAsDataURL(file)

    // Upload a Cloudinary
    setUploadingAvatar(true)
    try {
      const fd = new FormData()
      fd.append("avatar", file)
      const url = await uploadAvatarToCloudinary(fd)
      await updateAvatar(url)
      queryClient.invalidateQueries({ queryKey: ["my-profile"] })
      toast.success("Foto de perfil actualizada")
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Error al subir imagen")
      setAvatarPreview(null)
    } finally {
      setUploadingAvatar(false)
    }
  }

  if (isLoading) {
    return (
      <div className="flex justify-center py-20">
        <Loader2 className="h-8 w-8 animate-spin text-muted-foreground" />
      </div>
    )
  }

  const initials = profile?.name
    ? profile.name.split(" ").map((n: string) => n[0]).join("").slice(0, 2).toUpperCase()
    : "?"

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-bold">Mi Perfil</h1>
        <p className="text-muted-foreground text-sm mt-1">Edita tus datos personales</p>
      </div>

      {/* Avatar */}
      <Card>
        <CardContent className="pt-6 flex flex-col items-center gap-4">
          <div className="relative">
            <Avatar className="h-24 w-24">
              <AvatarImage src={avatarPreview ?? profile?.avatar_url ?? undefined} />
              <AvatarFallback className="bg-primary/20 text-primary text-xl font-bold">
                {initials}
              </AvatarFallback>
            </Avatar>
            <button
              type="button"
              onClick={() => fileRef.current?.click()}
              disabled={uploadingAvatar}
              className="absolute bottom-0 right-0 flex h-8 w-8 items-center justify-center rounded-full bg-primary text-primary-foreground shadow-md hover:bg-primary/90 disabled:opacity-50"
            >
              {uploadingAvatar
                ? <Loader2 className="h-4 w-4 animate-spin" />
                : <Camera className="h-4 w-4" />
              }
            </button>
          </div>
          <input
            ref={fileRef}
            type="file"
            accept="image/jpeg,image/png,image/webp"
            className="hidden"
            onChange={handleAvatarChange}
          />
          <p className="text-xs text-muted-foreground">JPG, PNG o WebP · Máx 2MB</p>
        </CardContent>
      </Card>

      {/* Data form */}
      <Card>
        <CardHeader>
          <CardTitle className="text-base">Datos personales</CardTitle>
        </CardHeader>
        <CardContent>
          <form
            onSubmit={handleSubmit((d) => updateMutation.mutate(d))}
            className="space-y-4"
          >
            <div className="space-y-1">
              <Label htmlFor="name">Nombre completo</Label>
              <Input id="name" {...register("name")} />
              {errors.name && <p className="text-xs text-destructive">{errors.name.message}</p>}
            </div>
            <div className="space-y-1">
              <Label htmlFor="phone">Teléfono</Label>
              <Input id="phone" type="tel" {...register("phone")} />
            </div>
            <div className="space-y-1">
              <Label htmlFor="email">Email</Label>
              <Input id="email" type="email" {...register("email")} />
              {errors.email && <p className="text-xs text-destructive">{errors.email.message}</p>}
              <p className="text-xs text-muted-foreground">
                Si cambias el email recibirás un correo de verificación.
              </p>
            </div>
            <Button type="submit" className="w-full" disabled={updateMutation.isPending}>
              {updateMutation.isPending && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
              <Save className="mr-2 h-4 w-4" />
              Guardar cambios
            </Button>
          </form>
        </CardContent>
      </Card>

      {/* Change password */}
      <Card>
        <CardContent className="pt-6">
          <Link href="/portal/cambiar-contrasena">
            <Button variant="outline" className="w-full gap-2">
              <KeyRound className="h-4 w-4" />
              Cambiar contraseña
            </Button>
          </Link>
        </CardContent>
      </Card>
    </div>
  )
}
```

- [ ] **Step 2: Crear index.ts**

```typescript
export { default } from "./PortalPerfilMainComponent"
```

- [ ] **Step 3: Actualizar page.tsx**

```typescript
import PortalPerfilMainComponent from "@/components/section-components/portal/perfil"

export default function PerfilPage() {
  return <PortalPerfilMainComponent />
}
```

- [ ] **Step 4: Verificar tipos**

```bash
npx tsc --noEmit
```

---

## Task 14: Botón de migración en Settings

**Files:**
- Modify: `components/section-components/settings/SettingsMainComponent.tsx`

- [ ] **Step 1: Agregar imports**

Al inicio de `SettingsMainComponent.tsx`, agregar:
```typescript
import { Users, AlertTriangle } from "lucide-react"
import { migrateMembersToPortal, migrateAdminMetadata } from "@/lib/actions/migration"
```

(El import de `Loader2` ya existe. Agregar `Users` y `AlertTriangle` a los que ya hay de lucide.)

- [ ] **Step 2: Agregar un tab nuevo "Portal" en el componente**

Dentro del componente, agregar estado para la migración:
```typescript
const [migrating, setMigrating] = useState(false)
const [migrateResult, setMigrateResult] = useState<{
  success: number; failed: number; errors: string[]
} | null>(null)
```

Agregar función handler:
```typescript
const handleMigration = async () => {
  const confirm = await Swal.fire({
    title: "¿Migrar miembros al portal?",
    html: "Se creará una cuenta de acceso para cada miembro que aún no tenga una.<br/>Contraseña inicial: <b>Madbox2026</b>",
    icon: "warning",
    showCancelButton: true,
    confirmButtonText: "Sí, migrar",
    cancelButtonText: "Cancelar",
    background: "#0a0a0a",
    color: "#fff",
  })
  if (!confirm.isConfirmed) return

  setMigrating(true)
  try {
    // Primero actualizar metadata de admins existentes
    await migrateAdminMetadata()
    // Luego crear cuentas para miembros
    const result = await migrateMembersToPortal()
    setMigrateResult(result)
    toast.success(`Migración completada: ${result.success} exitosos, ${result.failed} fallidos`)
  } catch (err) {
    toast.error(err instanceof Error ? err.message : "Error en la migración")
  } finally {
    setMigrating(false)
  }
}
```

> **Nota:** `Swal` ya debe estar importado en el componente. Si no, agrega `import Swal from "sweetalert2"`.

Dentro del `<Tabs>`, añadir un nuevo `TabsTrigger` y `TabsContent` para Portal:

```tsx
// En TabsList añadir:
<TabsTrigger value="portal">
  <Users className="mr-2 h-4 w-4" />
  Portal
</TabsTrigger>

// Nuevo TabsContent:
<TabsContent value="portal" className="space-y-6">
  <Card>
    <CardHeader>
      <CardTitle>Migración de miembros al portal</CardTitle>
      <CardDescription>
        Crea cuentas de acceso para todos los miembros registrados que aún no tienen una.
        La contraseña inicial será <strong>Madbox2026</strong>.
      </CardDescription>
    </CardHeader>
    <CardContent className="space-y-4">
      <Button
        onClick={handleMigration}
        disabled={migrating}
        className="gap-2"
      >
        {migrating ? (
          <Loader2 className="h-4 w-4 animate-spin" />
        ) : (
          <Users className="h-4 w-4" />
        )}
        {migrating ? "Migrando..." : "Migrar miembros al portal"}
      </Button>

      {migrateResult && (
        <div className="rounded-lg border border-border p-4 space-y-2 text-sm">
          <p className="text-green-400 font-medium">✓ {migrateResult.success} cuentas creadas</p>
          {migrateResult.failed > 0 && (
            <>
              <p className="text-red-400 font-medium">✗ {migrateResult.failed} fallidos</p>
              <ul className="text-muted-foreground space-y-1 pl-2">
                {migrateResult.errors.map((e, i) => (
                  <li key={i} className="flex items-start gap-1">
                    <AlertTriangle className="h-3 w-3 mt-0.5 shrink-0" />
                    {e}
                  </li>
                ))}
              </ul>
            </>
          )}
        </div>
      )}
    </CardContent>
  </Card>
</TabsContent>
```

- [ ] **Step 3: Verificar tipos**

```bash
npx tsc --noEmit
```

---

## Task 15: Prueba end-to-end del flujo completo

- [ ] **Step 1: Iniciar el servidor**

```bash
npm run dev
```

- [ ] **Step 2: Probar flujo de migración**

1. Login como Super Admin.
2. Ir a `/dashboard/settings` → tab "Portal".
3. Click "Migrar miembros al portal" → confirmar.
4. Verificar que el resultado muestra miembros creados.
5. En Supabase Dashboard → Authentication → Users: deben aparecer los nuevos usuarios con `app_metadata.role = "member"`.

- [ ] **Step 3: Probar login de miembro**

1. Logout del admin.
2. Login con el email de un miembro migrado y contraseña `Madbox2026`.
3. Debe redirigir a `/portal/cambiar-contrasena`.
4. Cambiar contraseña → debe redirigir a `/portal`.
5. Verificar que aparecen: estado membresía, plan, fecha de vencimiento.

- [ ] **Step 4: Probar secciones del portal**

- Navegar a `/portal/clases` → ver cards de clases.
- Navegar a `/portal/pagos` → ver historial de pagos.
- Navegar a `/portal/perfil` → editar nombre/teléfono → guardar → ver toast éxito.

- [ ] **Step 5: Probar upload de avatar**

1. En `/portal/perfil`, click en el ícono de cámara.
2. Seleccionar imagen JPG/PNG menor a 2MB.
3. Verificar preview local inmediato.
4. Verificar que después del upload, el avatar se actualiza en header.

- [ ] **Step 6: Probar guardas del middleware**

1. Como miembro autenticado, intentar acceder a `http://localhost:3000/dashboard` → debe redirigir a `/portal`.
2. Como admin autenticado, intentar `http://localhost:3000/portal` → debe redirigir a `/dashboard`.

- [ ] **Step 7: Probar creación de miembro nuevo**

1. Login como admin → `/dashboard/users` → crear nuevo miembro.
2. En Supabase → Authentication: debe aparecer la nueva cuenta con `role: member`.
3. Login con ese miembro y contraseña `Madbox2026` → flujo de cambio de contraseña.

- [ ] **Step 8: Build de producción**

```bash
npm run build
```

Esperado: build exitoso sin errores de TypeScript.

---

## Resumen de variables de entorno requeridas

Asegurarse de que `.env` tenga:
```
NEXT_PUBLIC_SUPABASE_URL=...         # ya existe
NEXT_PUBLIC_SUPABASE_ANON_KEY=...    # ya existe
SUPABASE_SERVICE_ROLE_KEY=...        # ya existe
NEXT_PUBLIC_SITE_URL=...             # ya existe
CLOUDINARY_CLOUD_NAME=...            # NUEVO
CLOUDINARY_API_KEY=...               # NUEVO
CLOUDINARY_API_SECRET=...            # NUEVO
```
