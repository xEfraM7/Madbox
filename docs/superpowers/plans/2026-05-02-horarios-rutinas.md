# Horarios y Rutinas — Plan de Implementación

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Mover los horarios del gym de Settings a una sección propia del dashboard y agregar gestión de rutinas (Markdown) asignables por día y por plan, visibles en el portal del miembro como "Rutina de hoy".

**Architecture:** Dos tablas nuevas (`routines` library + `routine_assignments` con `unique(plan_id, day_of_week)`), nueva ruta `/dashboard/horarios` con grilla semanal de 7 columnas, y server actions en `lib/actions/routines.ts`. La pestaña "Horarios" se elimina de Settings. En el portal se renderiza una tarjeta `TodayRoutineCard` que consulta la rutina del día según el plan del miembro autenticado.

**Tech Stack:** Next.js 16 (App Router, Server Actions), React 19, TypeScript estricto, Supabase (Postgres + RLS), TanStack Query 5, shadcn/ui, React Hook Form + Zod, `react-markdown` (nueva), Tailwind CSS 4, Sonner, SweetAlert2, lucide-react.

**Spec:** [docs/superpowers/specs/2026-05-02-horarios-rutinas-design.md](../specs/2026-05-02-horarios-rutinas-design.md)

**Convenciones del proyecto (recordatorio):**
- Server actions con `"use server"` arriba; UI nunca toca Supabase desde el cliente.
- `revalidatePath` y `logActivity` después de cada mutación.
- Errores de Supabase con `throw error`.
- TanStack Query para state del servidor en cliente; invalidar queries en `onSuccess`.
- Permisos: server-side con `getCurrentAdminPermissions()`, client-side con `usePermissions()`.
- Idioma español en UI, mensajes y nombres de acciones de log.
- Modo oscuro fijo. Yellow primary sobre fondo negro.
- No tests automatizados — verificación con `npm run lint` + browser manual.
- Solo commiteamos código que compila (`npm run build`/`tsc`) sin errores.

---

### Task 1: Migración de DB — tablas `routines` y `routine_assignments`

**Files:**
- Create: `supabase/migrations/20260502120000_routines_setup.sql`
- Modify: `types/database.ts` (regenerado, no se edita a mano)

- [ ] **Step 1: Crear el archivo de migración**

Crear `supabase/migrations/20260502120000_routines_setup.sql` con este contenido:

```sql
-- Rutinas y asignaciones por (plan, día de semana)

-- 1. Tabla routines: biblioteca de rutinas reutilizables
CREATE TABLE IF NOT EXISTS public.routines (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  name text NOT NULL,
  content text NOT NULL DEFAULT '',
  created_at timestamptz DEFAULT now(),
  updated_at timestamptz DEFAULT now()
);

-- 2. Tabla routine_assignments: una rutina por (plan, día)
CREATE TABLE IF NOT EXISTS public.routine_assignments (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  plan_id uuid NOT NULL REFERENCES public.plans(id) ON DELETE CASCADE,
  routine_id uuid NOT NULL REFERENCES public.routines(id) ON DELETE CASCADE,
  day_of_week text NOT NULL CHECK (day_of_week IN
    ('Lunes','Martes','Miércoles','Jueves','Viernes','Sábado','Domingo')),
  created_at timestamptz DEFAULT now(),
  updated_at timestamptz DEFAULT now(),
  UNIQUE (plan_id, day_of_week)
);

CREATE INDEX IF NOT EXISTS routine_assignments_plan_id_idx ON public.routine_assignments(plan_id);
CREATE INDEX IF NOT EXISTS routine_assignments_routine_id_idx ON public.routine_assignments(routine_id);
CREATE INDEX IF NOT EXISTS routine_assignments_day_idx ON public.routine_assignments(day_of_week);

-- 3. RLS: routines
ALTER TABLE public.routines ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "routines_select_authenticated" ON public.routines;
CREATE POLICY "routines_select_authenticated" ON public.routines
  FOR SELECT TO authenticated
  USING (true);

DROP POLICY IF EXISTS "routines_admin_write" ON public.routines;
CREATE POLICY "routines_admin_write" ON public.routines
  FOR ALL TO authenticated
  USING (EXISTS (SELECT 1 FROM public.admins WHERE auth_user_id = auth.uid()))
  WITH CHECK (EXISTS (SELECT 1 FROM public.admins WHERE auth_user_id = auth.uid()));

-- 4. RLS: routine_assignments
ALTER TABLE public.routine_assignments ENABLE ROW LEVEL SECURITY;

-- Admins ven todas; miembros solo las de su plan
DROP POLICY IF EXISTS "routine_assignments_select" ON public.routine_assignments;
CREATE POLICY "routine_assignments_select" ON public.routine_assignments
  FOR SELECT TO authenticated
  USING (
    EXISTS (SELECT 1 FROM public.admins WHERE auth_user_id = auth.uid())
    OR plan_id IN (SELECT plan_id FROM public.members WHERE auth_user_id = auth.uid())
  );

DROP POLICY IF EXISTS "routine_assignments_admin_write" ON public.routine_assignments;
CREATE POLICY "routine_assignments_admin_write" ON public.routine_assignments
  FOR ALL TO authenticated
  USING (EXISTS (SELECT 1 FROM public.admins WHERE auth_user_id = auth.uid()))
  WITH CHECK (EXISTS (SELECT 1 FROM public.admins WHERE auth_user_id = auth.uid()));
```

- [ ] **Step 2: Aplicar la migración con MCP**

Ejecutar la herramienta `mcp__supabase__apply_migration` con:
- `name`: `routines_setup`
- `query`: el SQL completo del Step 1

Verificar que retorna sin error. Si hay un error de policy duplicada o tabla, revisar que el nombre exacto esté en los `DROP POLICY IF EXISTS`.

- [ ] **Step 3: Regenerar types/database.ts**

Ejecutar `mcp__supabase__generate_typescript_types`. Tomar el resultado y sobreescribir `types/database.ts` completo.

Verificar que aparecen las nuevas tablas:

```bash
# PowerShell
Select-String -Path "types\database.ts" -Pattern "routines|routine_assignments"
```

Esperado: matches en ambos nombres.

- [ ] **Step 4: Verificar build**

Run: `npm run lint`
Expected: sin errores nuevos.

Run (opcional, lento): `npm run build`
Expected: build exitoso.

- [ ] **Step 5: Commit**

```bash
git add supabase/migrations/20260502120000_routines_setup.sql types/database.ts
git commit -m "feat(migrations): agregar tablas routines y routine_assignments

Co-Authored-By: Claude Opus 4.7 <noreply@anthropic.com>"
```

---

### Task 2: Permisos `schedule.{view,edit,delete}`

**Files:**
- Modify: `components/section-components/roles/RolesMainComponent.tsx` (añadir grupo `schedule` a `permissionGroups`)
- Modify: `CLAUDE.md` (lista de permisos disponibles)

- [ ] **Step 1: Añadir grupo `schedule` a `permissionGroups`**

En `components/section-components/roles/RolesMainComponent.tsx`, dentro del array `permissionGroups`, agregar antes del grupo `roles` (entre `closings` y `roles`):

```ts
  {
    id: "schedule",
    label: "Horarios y Rutinas",
    permissions: [
      { id: "schedule.view", label: "Ver horarios y rutinas", description: "Ver la sección Horarios y Rutinas" },
      { id: "schedule.edit", label: "Editar horarios y rutinas", description: "Editar horarios del gym, rutinas y asignaciones" },
      { id: "schedule.delete", label: "Eliminar rutinas", description: "Borrar rutinas y desasignar" },
    ]
  },
```

- [ ] **Step 2: Actualizar lista de permisos en CLAUDE.md**

En `CLAUDE.md`, en la sección "Permisos disponibles", reemplazar la línea actual:

```
- Permisos disponibles: `dashboard.view`, `users.{view,edit,delete}`, `plans.{view,edit,delete}`, `payments.{view,edit,delete}`, `classes.{view,edit,delete}`, `roles.{view,create,edit,delete}`, `settings.{view,edit}`, `closings.{view,edit,delete}`.
```

por:

```
- Permisos disponibles: `dashboard.view`, `users.{view,edit,delete}`, `plans.{view,edit,delete}`, `payments.{view,edit,delete}`, `classes.{view,edit,delete}`, `roles.{view,create,edit,delete}`, `settings.{view,edit}`, `closings.{view,edit,delete}`, `schedule.{view,edit,delete}`.
```

- [ ] **Step 3: Verificar lint**

Run: `npm run lint`
Expected: sin errores nuevos.

- [ ] **Step 4: Commit**

```bash
git add components/section-components/roles/RolesMainComponent.tsx CLAUDE.md
git commit -m "feat(roles): agregar permisos schedule.{view,edit,delete}

Co-Authored-By: Claude Opus 4.7 <noreply@anthropic.com>"
```

---

### Task 3: Server actions — biblioteca de rutinas (CRUD)

**Files:**
- Create: `lib/actions/routines.ts`
- Modify: `lib/actions/activity.ts` (extender `ActivityAction` y `EntityType`)

- [ ] **Step 1: Extender tipos de activity log**

En `lib/actions/activity.ts`, dentro del tipo `ActivityAction`, agregar al final de la unión (antes del cierre):

```ts
  | "routine_created" | "routine_updated" | "routine_deleted"
  | "routine_assigned" | "routine_unassigned"
  | "schedule_updated"
```

Y dentro de `EntityType`, agregar:

```ts
  | "routine" | "routine_assignment" | "gym_schedule"
```

El tipo final debe quedar:

```ts
export type ActivityAction =
  | "create" | "update" | "delete"
  | "payment_registered" | "payment_deleted"
  | "member_created" | "member_updated" | "member_deleted"
  | "plan_created" | "plan_updated" | "plan_deleted"
  | "class_created" | "class_updated" | "class_deleted"
  | "class_payment_registered" | "class_payment_deleted"
  | "rate_updated" | "role_updated" | "invitation_sent"
  | "monthly_closing_created" | "funds_reset"
  | "routine_created" | "routine_updated" | "routine_deleted"
  | "routine_assigned" | "routine_unassigned"
  | "schedule_updated"

export type EntityType =
  | "payment" | "member" | "plan" | "special_class"
  | "special_class_payment" | "exchange_rate" | "role" | "admin"
  | "monthly_closing" | "fund"
  | "routine" | "routine_assignment" | "gym_schedule"
```

- [ ] **Step 2: Crear `lib/actions/routines.ts` con CRUD de la biblioteca**

Crear el archivo con este contenido inicial (las asignaciones se añaden en la próxima task):

```ts
"use server"

import { createClient } from "@/utils/supabase/server"
import { revalidatePath } from "next/cache"
import type { TablesInsert, TablesUpdate } from "@/types/database"
import { getCurrentAdminPermissions } from "./roles"
import { logActivity } from "./activity"

async function checkPermission(required: string): Promise<boolean> {
  const { permissions, isAdmin } = await getCurrentAdminPermissions()
  if (isAdmin) return true
  return permissions.includes(required)
}

// ─── Biblioteca de rutinas ──────────────────────────────────

export async function getRoutines() {
  const supabase = await createClient()
  const { data, error } = await supabase
    .from("routines")
    .select("*, routine_assignments(count)")
    .order("name", { ascending: true })

  if (error) throw error
  return data
}

export async function getRoutine(id: string) {
  const supabase = await createClient()
  const { data, error } = await supabase
    .from("routines")
    .select("*, routine_assignments(id, plan_id, day_of_week)")
    .eq("id", id)
    .single()

  if (error) throw error
  return data
}

export async function createRoutine(routine: TablesInsert<"routines">) {
  if (!(await checkPermission("schedule.edit"))) {
    throw new Error("No tienes permisos para crear rutinas")
  }

  const supabase = await createClient()
  const { data, error } = await supabase
    .from("routines")
    .insert(routine)
    .select()
    .single()

  if (error) throw error

  await logActivity({
    action: "routine_created",
    entityType: "routine",
    entityId: data.id,
    entityName: data.name,
  })

  revalidatePath("/dashboard/horarios")
  return data
}

export async function updateRoutine(id: string, routine: TablesUpdate<"routines">) {
  if (!(await checkPermission("schedule.edit"))) {
    throw new Error("No tienes permisos para editar rutinas")
  }

  const supabase = await createClient()
  const { data, error } = await supabase
    .from("routines")
    .update({ ...routine, updated_at: new Date().toISOString() })
    .eq("id", id)
    .select()
    .single()

  if (error) throw error

  await logActivity({
    action: "routine_updated",
    entityType: "routine",
    entityId: data.id,
    entityName: data.name,
  })

  revalidatePath("/dashboard/horarios")
  revalidatePath("/portal")
  return data
}

export async function deleteRoutine(id: string) {
  if (!(await checkPermission("schedule.delete"))) {
    throw new Error("No tienes permisos para eliminar rutinas")
  }

  const supabase = await createClient()

  const { data: routine } = await supabase
    .from("routines")
    .select("name")
    .eq("id", id)
    .single()

  const { error } = await supabase.from("routines").delete().eq("id", id)
  if (error) throw error

  await logActivity({
    action: "routine_deleted",
    entityType: "routine",
    entityId: id,
    entityName: routine?.name ?? "(sin nombre)",
  })

  revalidatePath("/dashboard/horarios")
  revalidatePath("/portal")
}
```

- [ ] **Step 3: Verificar tipos**

Abrir `lib/actions/routines.ts` en el editor; no debe haber errores rojos. Si los hay (típicamente porque `Tables<"routines">` no existe), revisar que la regeneración de tipos en Task 1 fue correcta.

Run: `npm run lint`
Expected: sin errores nuevos.

- [ ] **Step 4: Commit**

```bash
git add lib/actions/routines.ts lib/actions/activity.ts
git commit -m "feat(routines): server actions CRUD para biblioteca de rutinas

Co-Authored-By: Claude Opus 4.7 <noreply@anthropic.com>"
```

---

### Task 4: Server actions — asignaciones de rutinas

**Files:**
- Modify: `lib/actions/routines.ts` (añadir funciones de asignaciones al final)

- [ ] **Step 1: Añadir helpers de asignación al final de `lib/actions/routines.ts`**

Agregar al final del archivo, después de `deleteRoutine`:

```ts
// ─── Asignaciones (plan + día → rutina) ──────────────────────

export async function getRoutineAssignments() {
  const supabase = await createClient()
  const { data, error } = await supabase
    .from("routine_assignments")
    .select("id, plan_id, day_of_week, routine_id, routines (id, name, content)")

  if (error) throw error
  return data
}

interface UpsertAssignmentInput {
  plan_id: string
  day_of_week: string
  routine_id: string
}

export async function upsertRoutineAssignment(input: UpsertAssignmentInput) {
  if (!(await checkPermission("schedule.edit"))) {
    throw new Error("No tienes permisos para asignar rutinas")
  }

  const supabase = await createClient()

  const { data, error } = await supabase
    .from("routine_assignments")
    .upsert(
      {
        plan_id: input.plan_id,
        day_of_week: input.day_of_week,
        routine_id: input.routine_id,
        updated_at: new Date().toISOString(),
      },
      { onConflict: "plan_id,day_of_week" }
    )
    .select("*, routines(name), plans(name)")
    .single()

  if (error) throw error

  await logActivity({
    action: "routine_assigned",
    entityType: "routine_assignment",
    entityId: data.id,
    entityName: `${(data as any).plans?.name ?? "Plan"} · ${input.day_of_week} → ${(data as any).routines?.name ?? "Rutina"}`,
  })

  revalidatePath("/dashboard/horarios")
  revalidatePath("/portal")
  return data
}

interface DeleteAssignmentInput {
  plan_id: string
  day_of_week: string
}

export async function deleteRoutineAssignment(input: DeleteAssignmentInput) {
  if (!(await checkPermission("schedule.delete"))) {
    throw new Error("No tienes permisos para desasignar rutinas")
  }

  const supabase = await createClient()

  const { data: existing } = await supabase
    .from("routine_assignments")
    .select("id, plans(name), routines(name)")
    .eq("plan_id", input.plan_id)
    .eq("day_of_week", input.day_of_week)
    .maybeSingle()

  const { error } = await supabase
    .from("routine_assignments")
    .delete()
    .eq("plan_id", input.plan_id)
    .eq("day_of_week", input.day_of_week)

  if (error) throw error

  if (existing) {
    await logActivity({
      action: "routine_unassigned",
      entityType: "routine_assignment",
      entityId: existing.id,
      entityName: `${(existing as any).plans?.name ?? "Plan"} · ${input.day_of_week} ✕ ${(existing as any).routines?.name ?? "Rutina"}`,
    })
  }

  revalidatePath("/dashboard/horarios")
  revalidatePath("/portal")
}
```

- [ ] **Step 2: Verificar lint**

Run: `npm run lint`
Expected: sin errores nuevos.

- [ ] **Step 3: Commit**

```bash
git add lib/actions/routines.ts
git commit -m "feat(routines): server actions de asignaciones (plan x día)

Co-Authored-By: Claude Opus 4.7 <noreply@anthropic.com>"
```

---

### Task 5: Server action `getTodayRoutineForMember` (portal)

**Files:**
- Modify: `lib/actions/routines.ts` (añadir función al final)

- [ ] **Step 1: Añadir helper de "rutina de hoy" para el miembro autenticado**

Agregar al final de `lib/actions/routines.ts`:

```ts
// ─── Portal del miembro ──────────────────────────────────────

const DAY_MAP: Record<string, string> = {
  monday: "Lunes",
  tuesday: "Martes",
  wednesday: "Miércoles",
  thursday: "Jueves",
  friday: "Viernes",
  saturday: "Sábado",
  sunday: "Domingo",
}

function getTodayLabel(): string {
  // Calculado server-side en zona horaria de Venezuela
  const formatter = new Intl.DateTimeFormat("en-US", {
    timeZone: "America/Caracas",
    weekday: "long",
  })
  const englishDay = formatter.format(new Date()).toLowerCase()
  return DAY_MAP[englishDay] ?? "Lunes"
}

export async function getTodayRoutineForMember() {
  const supabase = await createClient()

  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return null

  const { data: member } = await supabase
    .from("members")
    .select("plan_id, plans(name)")
    .eq("auth_user_id", user.id)
    .maybeSingle()

  if (!member?.plan_id) return null

  const today = getTodayLabel()

  const { data, error } = await supabase
    .from("routine_assignments")
    .select("day_of_week, routines (id, name, content)")
    .eq("plan_id", member.plan_id)
    .eq("day_of_week", today)
    .maybeSingle()

  if (error) throw error
  if (!data?.routines) return { day_of_week: today, plan_name: (member as any).plans?.name ?? null, routine: null }

  return {
    day_of_week: today,
    plan_name: (member as any).plans?.name ?? null,
    routine: data.routines as { id: string; name: string; content: string },
  }
}
```

- [ ] **Step 2: Verificar lint**

Run: `npm run lint`
Expected: sin errores nuevos.

- [ ] **Step 3: Commit**

```bash
git add lib/actions/routines.ts
git commit -m "feat(routines): server action getTodayRoutineForMember para portal

Co-Authored-By: Claude Opus 4.7 <noreply@anthropic.com>"
```

---

### Task 6: Instalar `react-markdown`

**Files:**
- Modify: `package.json`, `package-lock.json` (vía npm)

- [ ] **Step 1: Instalar la dependencia**

Run:

```bash
npm install react-markdown
```

Expected: instalación exitosa, una sola entrada nueva en `package.json`.

- [ ] **Step 2: Verificar versión compatible con React 19**

Abrir `package.json` y confirmar que `react-markdown` está bajo `dependencies` con versión `^9.x` o superior (las versiones modernas son ESM y compatibles con React 19).

- [ ] **Step 3: Commit**

```bash
git add package.json package-lock.json
git commit -m "chore: agregar react-markdown para render de rutinas

Co-Authored-By: Claude Opus 4.7 <noreply@anthropic.com>"
```

---

### Task 7: Crear ruta `/dashboard/horarios` y skeleton del componente principal

**Files:**
- Create: `app/dashboard/horarios/page.tsx`
- Create: `components/section-components/horarios/HorariosMainComponent.tsx`
- Create: `components/section-components/horarios/index.ts`

- [ ] **Step 1: Crear la ruta**

Crear `app/dashboard/horarios/page.tsx`:

```tsx
import HorariosMainComponent from "@/components/section-components/horarios/HorariosMainComponent"

export default function HorariosPage() {
  return <HorariosMainComponent />
}
```

- [ ] **Step 2: Crear el index de la sección**

Crear `components/section-components/horarios/index.ts`:

```ts
export { default as HorariosMainComponent } from "./HorariosMainComponent"
```

- [ ] **Step 3: Crear el skeleton de `HorariosMainComponent`**

Crear `components/section-components/horarios/HorariosMainComponent.tsx`:

```tsx
"use client"

import { useState } from "react"
import { useQuery } from "@tanstack/react-query"
import { DashboardLayout } from "@/components/shared/dashboard-layout"
import { Button } from "@/components/ui/button"
import { Loader2, Library } from "lucide-react"
import { getGymSchedule } from "@/lib/actions/settings"
import { getRoutines, getRoutineAssignments } from "@/lib/actions/routines"
import { getPlans } from "@/lib/actions/plans"

export default function HorariosMainComponent() {
  const [libraryOpen, setLibraryOpen] = useState(false)

  const { data: schedule = [], isLoading: loadingSchedule } = useQuery({
    queryKey: ["gym-schedule"],
    queryFn: getGymSchedule,
  })

  const { data: plans = [], isLoading: loadingPlans } = useQuery({
    queryKey: ["plans"],
    queryFn: getPlans,
  })

  const { data: routines = [], isLoading: loadingRoutines } = useQuery({
    queryKey: ["routines"],
    queryFn: getRoutines,
  })

  const { data: assignments = [], isLoading: loadingAssignments } = useQuery({
    queryKey: ["routine-assignments"],
    queryFn: getRoutineAssignments,
  })

  const isLoading = loadingSchedule || loadingPlans || loadingRoutines || loadingAssignments

  if (isLoading) {
    return (
      <DashboardLayout>
        <div className="flex items-center justify-center py-12">
          <Loader2 className="h-8 w-8 animate-spin text-muted-foreground" />
        </div>
      </DashboardLayout>
    )
  }

  const activePlans = plans.filter((p: any) => p.active !== false)

  return (
    <DashboardLayout>
      <div className="space-y-6">
        <div className="flex items-start justify-between gap-4 flex-wrap">
          <div>
            <h1 className="text-3xl font-bold tracking-tight text-balance">Horarios y Rutinas</h1>
            <p className="text-muted-foreground mt-2">
              Define el horario del gym y las rutinas por día y plan
            </p>
          </div>
          <Button onClick={() => setLibraryOpen(true)} className="gap-2">
            <Library className="h-4 w-4" />
            Biblioteca de Rutinas
          </Button>
        </div>

        {/* WeekGrid se monta en Task 15 */}
        <div className="text-sm text-muted-foreground border border-dashed rounded-lg p-8 text-center">
          Schedule: {schedule.length} días · Planes activos: {activePlans.length} · Rutinas: {routines.length} · Asignaciones: {assignments.length}
        </div>
      </div>
    </DashboardLayout>
  )
}
```

- [ ] **Step 4: Verificar lint**

Run: `npm run lint`
Expected: sin errores nuevos. Warnings sobre `any` aceptables en este punto (los limpiamos en tareas posteriores conforme tipamos).

- [ ] **Step 5: Probar la ruta en el navegador**

Run: `npm run dev` (en background si es posible).
Visitar: `http://localhost:3000/dashboard/horarios` (autenticado).
Expected: ver el header "Horarios y Rutinas" + el placeholder con los counts.

- [ ] **Step 6: Commit**

```bash
git add app/dashboard/horarios/page.tsx components/section-components/horarios/index.ts components/section-components/horarios/HorariosMainComponent.tsx
git commit -m "feat(horarios): ruta /dashboard/horarios y skeleton de la sección

Co-Authored-By: Claude Opus 4.7 <noreply@anthropic.com>"
```

---

### Task 8: Modal de crear/editar rutina (con preview Markdown)

**Files:**
- Create: `components/section-components/horarios/modals/routine-form-modal.tsx`

- [ ] **Step 1: Crear el modal de formulario**

Crear `components/section-components/horarios/modals/routine-form-modal.tsx`:

```tsx
"use client"

import { useEffect } from "react"
import { useForm } from "react-hook-form"
import { useMutation, useQueryClient } from "@tanstack/react-query"
import ReactMarkdown from "react-markdown"
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { Textarea } from "@/components/ui/textarea"
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs"
import { Loader2, Save } from "lucide-react"
import { showToast } from "@/lib/sweetalert"
import { createRoutine, updateRoutine } from "@/lib/actions/routines"

interface FormData {
  name: string
  content: string
}

interface RoutineFormModalProps {
  open: boolean
  onOpenChange: (open: boolean) => void
  routine?: { id: string; name: string; content: string } | null
}

export function RoutineFormModal({ open, onOpenChange, routine }: RoutineFormModalProps) {
  const queryClient = useQueryClient()
  const isEdit = !!routine

  const { register, handleSubmit, watch, reset, formState: { errors } } = useForm<FormData>({
    defaultValues: { name: "", content: "" },
  })

  const contentValue = watch("content")

  useEffect(() => {
    if (open) {
      reset({
        name: routine?.name ?? "",
        content: routine?.content ?? "",
      })
    }
  }, [open, routine, reset])

  const mutation = useMutation({
    mutationFn: async (data: FormData) => {
      if (isEdit && routine) {
        return updateRoutine(routine.id, { name: data.name.trim(), content: data.content })
      }
      return createRoutine({ name: data.name.trim(), content: data.content })
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["routines"] })
      queryClient.invalidateQueries({ queryKey: ["routine-assignments"] })
      showToast.success(isEdit ? "Rutina actualizada" : "Rutina creada", "Los cambios se guardaron correctamente.")
      onOpenChange(false)
    },
    onError: (e: Error) => {
      showToast.error("Error", e.message ?? "No se pudo guardar la rutina.")
    },
  })

  const onSubmit = (data: FormData) => {
    if (!data.name.trim()) {
      showToast.error("Falta el nombre", "La rutina necesita un nombre.")
      return
    }
    mutation.mutate(data)
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-2xl">
        <DialogHeader>
          <DialogTitle>{isEdit ? "Editar rutina" : "Nueva rutina"}</DialogTitle>
          <DialogDescription>
            Usa Markdown para dar formato (encabezados con #, listas con - o *, negritas con **).
          </DialogDescription>
        </DialogHeader>

        <form onSubmit={handleSubmit(onSubmit)} className="space-y-4">
          <div className="grid gap-2">
            <Label htmlFor="name">Nombre</Label>
            <Input
              id="name"
              placeholder="Ej: Metabólico Lunes A"
              {...register("name", { required: true })}
            />
            {errors.name && <p className="text-xs text-destructive">El nombre es requerido</p>}
          </div>

          <Tabs defaultValue="edit" className="w-full">
            <TabsList>
              <TabsTrigger value="edit">Editar</TabsTrigger>
              <TabsTrigger value="preview">Vista previa</TabsTrigger>
            </TabsList>
            <TabsContent value="edit">
              <Textarea
                id="content"
                rows={14}
                placeholder={`Metabólico condition\n\nAmrap 7'\n- 10 dead lift 100 kg\n- 6 bar muscle up\n\nRest 2'\n...`}
                className="font-mono text-sm"
                {...register("content")}
              />
            </TabsContent>
            <TabsContent value="preview">
              <div className="prose prose-invert prose-sm max-w-none border rounded-md p-4 min-h-[280px] bg-muted/30">
                {contentValue?.trim() ? (
                  <ReactMarkdown>{contentValue}</ReactMarkdown>
                ) : (
                  <p className="text-muted-foreground text-sm m-0">Sin contenido aún.</p>
                )}
              </div>
            </TabsContent>
          </Tabs>

          <DialogFooter>
            <Button type="button" variant="ghost" onClick={() => onOpenChange(false)}>
              Cancelar
            </Button>
            <Button type="submit" disabled={mutation.isPending} className="gap-2">
              {mutation.isPending ? (
                <><Loader2 className="h-4 w-4 animate-spin" /> Guardando...</>
              ) : (
                <><Save className="h-4 w-4" /> {isEdit ? "Guardar cambios" : "Crear rutina"}</>
              )}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  )
}
```

- [ ] **Step 2: Verificar lint**

Run: `npm run lint`
Expected: sin errores nuevos. Si la regla `@tailwindcss/no-custom-classname` o similar marca `prose`, ignorar (es parte del plugin de typography que existe en Tailwind v4).

- [ ] **Step 3: Commit**

```bash
git add components/section-components/horarios/modals/routine-form-modal.tsx
git commit -m "feat(horarios): modal de crear/editar rutina con preview markdown

Co-Authored-By: Claude Opus 4.7 <noreply@anthropic.com>"
```

---

### Task 9: Modal de preview de rutina (read-only)

**Files:**
- Create: `components/section-components/horarios/modals/routine-preview-modal.tsx`

- [ ] **Step 1: Crear el modal de preview**

Crear `components/section-components/horarios/modals/routine-preview-modal.tsx`:

```tsx
"use client"

import ReactMarkdown from "react-markdown"
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle } from "@/components/ui/dialog"

interface RoutinePreviewModalProps {
  open: boolean
  onOpenChange: (open: boolean) => void
  routine: { name: string; content: string } | null
  context?: string
}

export function RoutinePreviewModal({ open, onOpenChange, routine, context }: RoutinePreviewModalProps) {
  if (!routine) return null

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-2xl">
        <DialogHeader>
          <DialogTitle>{routine.name}</DialogTitle>
          {context && <DialogDescription>{context}</DialogDescription>}
        </DialogHeader>

        <div className="prose prose-invert prose-sm max-w-none border rounded-md p-4 min-h-[200px] bg-muted/30">
          {routine.content?.trim() ? (
            <ReactMarkdown>{routine.content}</ReactMarkdown>
          ) : (
            <p className="text-muted-foreground text-sm m-0">Esta rutina aún no tiene contenido.</p>
          )}
        </div>
      </DialogContent>
    </Dialog>
  )
}
```

- [ ] **Step 2: Verificar lint**

Run: `npm run lint`
Expected: sin errores nuevos.

- [ ] **Step 3: Commit**

```bash
git add components/section-components/horarios/modals/routine-preview-modal.tsx
git commit -m "feat(horarios): modal de preview de rutina (solo lectura)

Co-Authored-By: Claude Opus 4.7 <noreply@anthropic.com>"
```

---

### Task 10: Modal "Biblioteca de Rutinas"

**Files:**
- Create: `components/section-components/horarios/modals/routine-library-modal.tsx`

- [ ] **Step 1: Crear el modal de biblioteca**

Crear `components/section-components/horarios/modals/routine-library-modal.tsx`:

```tsx
"use client"

import { useMemo, useState } from "react"
import { useMutation, useQueryClient } from "@tanstack/react-query"
import Swal from "sweetalert2"
import { showToast } from "@/lib/sweetalert"
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle } from "@/components/ui/dialog"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Plus, Edit, Trash2, Eye, Copy, BookOpen } from "lucide-react"
import { createRoutine, deleteRoutine } from "@/lib/actions/routines"
import { usePermissions } from "@/lib/hooks/use-permissions"
import { RoutineFormModal } from "./routine-form-modal"
import { RoutinePreviewModal } from "./routine-preview-modal"

interface RoutineLibraryModalProps {
  open: boolean
  onOpenChange: (open: boolean) => void
  routines: Array<{
    id: string
    name: string
    content: string
    routine_assignments: Array<{ count: number }> | { count: number }[]
  }>
}

export function RoutineLibraryModal({ open, onOpenChange, routines }: RoutineLibraryModalProps) {
  const queryClient = useQueryClient()
  const { hasPermission } = usePermissions()
  const canEdit = hasPermission("schedule.edit")
  const canDelete = hasPermission("schedule.delete")

  const [search, setSearch] = useState("")
  const [formOpen, setFormOpen] = useState(false)
  const [editing, setEditing] = useState<{ id: string; name: string; content: string } | null>(null)
  const [previewOpen, setPreviewOpen] = useState(false)
  const [previewing, setPreviewing] = useState<{ name: string; content: string } | null>(null)

  const filtered = useMemo(() => {
    if (!search.trim()) return routines
    const q = search.toLowerCase()
    return routines.filter(r => r.name.toLowerCase().includes(q))
  }, [routines, search])

  const duplicateMutation = useMutation({
    mutationFn: (r: { name: string; content: string }) =>
      createRoutine({ name: `${r.name} (copia)`, content: r.content }),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["routines"] })
      showToast.success("Rutina duplicada", "Se creó una copia.")
    },
    onError: (e: Error) => showToast.error("Error", e.message),
  })

  const deleteMutation = useMutation({
    mutationFn: (id: string) => deleteRoutine(id),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["routines"] })
      queryClient.invalidateQueries({ queryKey: ["routine-assignments"] })
      showToast.success("Rutina eliminada", "Se eliminó y se quitaron sus asignaciones.")
    },
    onError: (e: Error) => showToast.error("Error", e.message),
  })

  const handleDelete = async (r: { id: string; name: string; routine_assignments: any }) => {
    const usage = Array.isArray(r.routine_assignments)
      ? r.routine_assignments[0]?.count ?? 0
      : 0
    const confirm = await Swal.fire({
      title: "¿Eliminar rutina?",
      html: usage > 0
        ? `<b>${r.name}</b> está asignada en ${usage} día(s). Se eliminará junto con sus asignaciones.`
        : `Eliminar <b>${r.name}</b> permanentemente.`,
      icon: "warning",
      showCancelButton: true,
      confirmButtonText: "Sí, eliminar",
      cancelButtonText: "Cancelar",
      background: "#0a0a0a",
      color: "#fff",
    })
    if (confirm.isConfirmed) deleteMutation.mutate(r.id)
  }

  return (
    <>
      <Dialog open={open} onOpenChange={onOpenChange}>
        <DialogContent className="max-w-2xl">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <BookOpen className="h-5 w-5 text-primary" />
              Biblioteca de Rutinas
            </DialogTitle>
            <DialogDescription>
              Crea, edita y reutiliza rutinas. Una misma rutina puede asignarse a varios planes y días.
            </DialogDescription>
          </DialogHeader>

          <div className="flex items-center gap-2">
            <Input
              placeholder="Buscar rutina..."
              value={search}
              onChange={(e) => setSearch(e.target.value)}
            />
            {canEdit && (
              <Button
                onClick={() => { setEditing(null); setFormOpen(true) }}
                className="gap-2 shrink-0"
              >
                <Plus className="h-4 w-4" /> Nueva
              </Button>
            )}
          </div>

          <div className="max-h-[55vh] overflow-y-auto space-y-2 pr-1">
            {filtered.length === 0 ? (
              <p className="text-sm text-muted-foreground text-center py-8">
                {routines.length === 0 ? "Aún no hay rutinas. Crea la primera." : "Sin resultados."}
              </p>
            ) : (
              filtered.map((r) => {
                const usage = Array.isArray(r.routine_assignments)
                  ? r.routine_assignments[0]?.count ?? 0
                  : 0
                return (
                  <div
                    key={r.id}
                    className="flex items-center gap-2 p-3 border rounded-lg hover:bg-muted/30 transition-colors"
                  >
                    <div className="flex-1 min-w-0">
                      <p className="font-medium truncate">{r.name}</p>
                      <p className="text-xs text-muted-foreground">
                        {usage === 0 ? "Sin asignar" : `${usage} asignación(es)`}
                      </p>
                    </div>
                    <Button
                      size="icon"
                      variant="ghost"
                      onClick={() => { setPreviewing(r); setPreviewOpen(true) }}
                      title="Ver rutina"
                    >
                      <Eye className="h-4 w-4" />
                    </Button>
                    {canEdit && (
                      <Button
                        size="icon"
                        variant="ghost"
                        onClick={() => duplicateMutation.mutate(r)}
                        title="Duplicar"
                      >
                        <Copy className="h-4 w-4" />
                      </Button>
                    )}
                    {canEdit && (
                      <Button
                        size="icon"
                        variant="ghost"
                        onClick={() => { setEditing(r); setFormOpen(true) }}
                        title="Editar"
                      >
                        <Edit className="h-4 w-4" />
                      </Button>
                    )}
                    {canDelete && (
                      <Button
                        size="icon"
                        variant="ghost"
                        onClick={() => handleDelete(r)}
                        title="Eliminar"
                      >
                        <Trash2 className="h-4 w-4 text-destructive" />
                      </Button>
                    )}
                  </div>
                )
              })
            )}
          </div>
        </DialogContent>
      </Dialog>

      <RoutineFormModal
        open={formOpen}
        onOpenChange={setFormOpen}
        routine={editing}
      />
      <RoutinePreviewModal
        open={previewOpen}
        onOpenChange={setPreviewOpen}
        routine={previewing}
      />
    </>
  )
}
```

- [ ] **Step 2: Wire en el componente principal**

En `components/section-components/horarios/HorariosMainComponent.tsx`, importar y montar el modal. Reemplazar el bloque del placeholder por:

```tsx
import { RoutineLibraryModal } from "./modals/routine-library-modal"
```

(añadir al tope con los otros imports) y al final del JSX, antes de cerrar `</DashboardLayout>`, añadir:

```tsx
        <RoutineLibraryModal
          open={libraryOpen}
          onOpenChange={setLibraryOpen}
          routines={routines as any}
        />
```

- [ ] **Step 3: Probar en navegador**

Visitar `/dashboard/horarios`. Click en "Biblioteca de Rutinas" → debe abrir el modal vacío. Click "Nueva" → modal de form con campos. Crear una rutina con nombre "Test" y contenido `# Prueba\n\n- 10 burpees`. Guardar → debe aparecer en la lista. Probar Eye, Copy, Edit, Trash2.

- [ ] **Step 4: Commit**

```bash
git add components/section-components/horarios/modals/routine-library-modal.tsx components/section-components/horarios/HorariosMainComponent.tsx
git commit -m "feat(horarios): biblioteca de rutinas con CRUD y duplicar

Co-Authored-By: Claude Opus 4.7 <noreply@anthropic.com>"
```

---

### Task 11: Modal de asignación de rutina a una celda

**Files:**
- Create: `components/section-components/horarios/modals/routine-assign-modal.tsx`

- [ ] **Step 1: Crear el modal de asignación**

Crear `components/section-components/horarios/modals/routine-assign-modal.tsx`:

```tsx
"use client"

import { useState, useEffect } from "react"
import { useMutation, useQueryClient } from "@tanstack/react-query"
import { showToast } from "@/lib/sweetalert"
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog"
import { Button } from "@/components/ui/button"
import { Label } from "@/components/ui/label"
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select"
import { Loader2, Save, Trash2 } from "lucide-react"
import { upsertRoutineAssignment, deleteRoutineAssignment } from "@/lib/actions/routines"
import { usePermissions } from "@/lib/hooks/use-permissions"

interface RoutineAssignModalProps {
  open: boolean
  onOpenChange: (open: boolean) => void
  planId: string
  planName: string
  dayOfWeek: string
  currentRoutineId: string | null
  routines: Array<{ id: string; name: string }>
}

export function RoutineAssignModal({
  open, onOpenChange, planId, planName, dayOfWeek, currentRoutineId, routines,
}: RoutineAssignModalProps) {
  const queryClient = useQueryClient()
  const { hasPermission } = usePermissions()
  const canDelete = hasPermission("schedule.delete")

  const [selectedId, setSelectedId] = useState<string>(currentRoutineId ?? "")

  useEffect(() => {
    if (open) setSelectedId(currentRoutineId ?? "")
  }, [open, currentRoutineId])

  const upsertMutation = useMutation({
    mutationFn: (routine_id: string) =>
      upsertRoutineAssignment({ plan_id: planId, day_of_week: dayOfWeek, routine_id }),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["routine-assignments"] })
      queryClient.invalidateQueries({ queryKey: ["routines"] })
      showToast.success("Rutina asignada", `${planName} · ${dayOfWeek} actualizado.`)
      onOpenChange(false)
    },
    onError: (e: Error) => showToast.error("Error", e.message),
  })

  const deleteMutation = useMutation({
    mutationFn: () =>
      deleteRoutineAssignment({ plan_id: planId, day_of_week: dayOfWeek }),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["routine-assignments"] })
      queryClient.invalidateQueries({ queryKey: ["routines"] })
      showToast.success("Rutina quitada", `${planName} · ${dayOfWeek} sin asignar.`)
      onOpenChange(false)
    },
    onError: (e: Error) => showToast.error("Error", e.message),
  })

  const handleSave = () => {
    if (!selectedId) {
      showToast.error("Selecciona una rutina", "Elige una rutina o pulsa Quitar.")
      return
    }
    upsertMutation.mutate(selectedId)
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>Asignar rutina</DialogTitle>
          <DialogDescription>
            {planName} · {dayOfWeek}
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-4">
          <div className="grid gap-2">
            <Label>Rutina</Label>
            <Select value={selectedId} onValueChange={setSelectedId}>
              <SelectTrigger>
                <SelectValue placeholder={routines.length === 0 ? "No hay rutinas en la biblioteca" : "Selecciona una rutina"} />
              </SelectTrigger>
              <SelectContent>
                {routines.map((r) => (
                  <SelectItem key={r.id} value={r.id}>{r.name}</SelectItem>
                ))}
              </SelectContent>
            </Select>
            {routines.length === 0 && (
              <p className="text-xs text-muted-foreground">
                Crea una rutina primero desde la Biblioteca.
              </p>
            )}
          </div>
        </div>

        <DialogFooter className="gap-2 flex-wrap">
          {currentRoutineId && canDelete && (
            <Button
              variant="ghost"
              onClick={() => deleteMutation.mutate()}
              disabled={deleteMutation.isPending}
              className="gap-2 mr-auto text-destructive hover:text-destructive"
            >
              {deleteMutation.isPending ? <Loader2 className="h-4 w-4 animate-spin" /> : <Trash2 className="h-4 w-4" />}
              Quitar asignación
            </Button>
          )}
          <Button variant="ghost" onClick={() => onOpenChange(false)}>Cancelar</Button>
          <Button onClick={handleSave} disabled={upsertMutation.isPending} className="gap-2">
            {upsertMutation.isPending ? <Loader2 className="h-4 w-4 animate-spin" /> : <Save className="h-4 w-4" />}
            Guardar
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  )
}
```

- [ ] **Step 2: Verificar lint**

Run: `npm run lint`
Expected: sin errores nuevos.

- [ ] **Step 3: Commit**

```bash
git add components/section-components/horarios/modals/routine-assign-modal.tsx
git commit -m "feat(horarios): modal de asignación de rutina a celda

Co-Authored-By: Claude Opus 4.7 <noreply@anthropic.com>"
```

---

### Task 12: Componente `ScheduleInline` (apertura/cierre + cerrado)

**Files:**
- Create: `components/section-components/horarios/ScheduleInline.tsx`

- [ ] **Step 1: Crear el componente**

Crear `components/section-components/horarios/ScheduleInline.tsx`:

```tsx
"use client"

import { useEffect, useState } from "react"
import { useMutation, useQueryClient } from "@tanstack/react-query"
import { Input } from "@/components/ui/input"
import { Switch } from "@/components/ui/switch"
import { Label } from "@/components/ui/label"
import { showToast } from "@/lib/sweetalert"
import { updateGymSchedule } from "@/lib/actions/settings"
import { usePermissions } from "@/lib/hooks/use-permissions"

interface ScheduleInlineProps {
  id: string
  open_time: string | null
  close_time: string | null
}

function isClosed(open: string | null, close: string | null) {
  if (!open || !close) return false
  return open === close
}

function toShort(t: string | null): string {
  if (!t) return ""
  return t.slice(0, 5)
}

export function ScheduleInline({ id, open_time, close_time }: ScheduleInlineProps) {
  const queryClient = useQueryClient()
  const { hasPermission } = usePermissions()
  const canEdit = hasPermission("schedule.edit")

  const [openVal, setOpenVal] = useState(toShort(open_time))
  const [closeVal, setCloseVal] = useState(toShort(close_time))
  const [closed, setClosed] = useState(isClosed(open_time, close_time))

  useEffect(() => {
    setOpenVal(toShort(open_time))
    setCloseVal(toShort(close_time))
    setClosed(isClosed(open_time, close_time))
  }, [open_time, close_time])

  const mutation = useMutation({
    mutationFn: (data: { open_time: string; close_time: string }) => updateGymSchedule(id, data),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["gym-schedule"] })
      showToast.success("Horario actualizado", "Los cambios se guardaron.")
    },
    onError: () => showToast.error("Error", "No se pudo actualizar el horario."),
  })

  const persist = (open: string, close: string) => {
    if (!open || !close) return
    mutation.mutate({ open_time: `${open}:00`, close_time: `${close}:00` })
  }

  const handleToggleClosed = (next: boolean) => {
    setClosed(next)
    if (next) {
      mutation.mutate({ open_time: "00:00:00", close_time: "00:00:00" })
      setOpenVal("00:00")
      setCloseVal("00:00")
    } else {
      // limpiar inputs; no se persiste hasta que el usuario complete ambos
      setOpenVal("")
      setCloseVal("")
    }
  }

  if (!canEdit) {
    if (closed) return <p className="text-xs text-muted-foreground">Cerrado</p>
    return (
      <p className="text-xs text-muted-foreground">
        {openVal || "—"} → {closeVal || "—"}
      </p>
    )
  }

  return (
    <div className="space-y-1.5">
      <div className="flex items-center gap-1.5">
        <Switch checked={closed} onCheckedChange={handleToggleClosed} id={`closed-${id}`} />
        <Label htmlFor={`closed-${id}`} className="text-xs">Cerrado</Label>
      </div>
      {!closed && (
        <div className="flex items-center gap-1">
          <Input
            type="time"
            value={openVal}
            onChange={(e) => setOpenVal(e.target.value)}
            onBlur={(e) => persist(e.target.value, closeVal)}
            className="scheme-dark h-8 px-1.5 text-xs"
            disabled={mutation.isPending}
          />
          <span className="text-xs text-muted-foreground">→</span>
          <Input
            type="time"
            value={closeVal}
            onChange={(e) => setCloseVal(e.target.value)}
            onBlur={(e) => persist(openVal, e.target.value)}
            className="scheme-dark h-8 px-1.5 text-xs"
            disabled={mutation.isPending}
          />
        </div>
      )}
    </div>
  )
}
```

- [ ] **Step 2: Verificar lint**

Run: `npm run lint`
Expected: sin errores nuevos.

- [ ] **Step 3: Commit**

```bash
git add components/section-components/horarios/ScheduleInline.tsx
git commit -m "feat(horarios): componente ScheduleInline (horarios + cerrado)

Co-Authored-By: Claude Opus 4.7 <noreply@anthropic.com>"
```

---

### Task 13: Componente `RoutineCard`

**Files:**
- Create: `components/section-components/horarios/RoutineCard.tsx`

- [ ] **Step 1: Crear el componente**

Crear `components/section-components/horarios/RoutineCard.tsx`:

```tsx
"use client"

import { useState } from "react"
import { Button } from "@/components/ui/button"
import { Plus, Edit, Eye } from "lucide-react"
import { cn } from "@/lib/utils"
import { RoutineAssignModal } from "./modals/routine-assign-modal"
import { RoutinePreviewModal } from "./modals/routine-preview-modal"
import { usePermissions } from "@/lib/hooks/use-permissions"

interface RoutineCardProps {
  planId: string
  planName: string
  dayOfWeek: string
  routine: { id: string; name: string; content: string } | null
  routinesLibrary: Array<{ id: string; name: string }>
  highlight?: boolean
}

export function RoutineCard({ planId, planName, dayOfWeek, routine, routinesLibrary, highlight }: RoutineCardProps) {
  const { hasPermission } = usePermissions()
  const canEdit = hasPermission("schedule.edit")

  const [assignOpen, setAssignOpen] = useState(false)
  const [previewOpen, setPreviewOpen] = useState(false)

  return (
    <>
      <div
        className={cn(
          "group rounded-md border p-2 text-xs transition-colors",
          routine ? "bg-muted/30 hover:bg-muted/50" : "bg-background hover:bg-muted/20 border-dashed",
          highlight && "ring-1 ring-primary/40"
        )}
      >
        {routine ? (
          <div className="flex items-start gap-1">
            <button
              type="button"
              onClick={() => setPreviewOpen(true)}
              className="flex-1 min-w-0 text-left hover:underline"
              title="Ver rutina"
            >
              <p className="font-medium truncate">{routine.name}</p>
            </button>
            {canEdit ? (
              <Button
                size="icon"
                variant="ghost"
                onClick={() => setAssignOpen(true)}
                className="h-6 w-6 shrink-0 opacity-60 group-hover:opacity-100"
                title="Cambiar asignación"
              >
                <Edit className="h-3 w-3" />
              </Button>
            ) : (
              <Eye className="h-3 w-3 mt-1 text-muted-foreground" />
            )}
          </div>
        ) : canEdit ? (
          <Button
            variant="ghost"
            size="sm"
            onClick={() => setAssignOpen(true)}
            className="h-7 w-full justify-start gap-1 text-muted-foreground hover:text-foreground"
          >
            <Plus className="h-3 w-3" /> Asignar
          </Button>
        ) : (
          <p className="text-muted-foreground text-center py-1">—</p>
        )}
      </div>

      <RoutineAssignModal
        open={assignOpen}
        onOpenChange={setAssignOpen}
        planId={planId}
        planName={planName}
        dayOfWeek={dayOfWeek}
        currentRoutineId={routine?.id ?? null}
        routines={routinesLibrary}
      />

      <RoutinePreviewModal
        open={previewOpen}
        onOpenChange={setPreviewOpen}
        routine={routine}
        context={`${planName} · ${dayOfWeek}`}
      />
    </>
  )
}
```

- [ ] **Step 2: Verificar lint**

Run: `npm run lint`
Expected: sin errores nuevos.

- [ ] **Step 3: Commit**

```bash
git add components/section-components/horarios/RoutineCard.tsx
git commit -m "feat(horarios): componente RoutineCard (celda plan x día)

Co-Authored-By: Claude Opus 4.7 <noreply@anthropic.com>"
```

---

### Task 14: Componente `DayColumn`

**Files:**
- Create: `components/section-components/horarios/DayColumn.tsx`

- [ ] **Step 1: Crear el componente**

Crear `components/section-components/horarios/DayColumn.tsx`:

```tsx
"use client"

import { Badge } from "@/components/ui/badge"
import { cn } from "@/lib/utils"
import { ScheduleInline } from "./ScheduleInline"
import { RoutineCard } from "./RoutineCard"

interface DayColumnProps {
  scheduleRow: {
    id: string
    day_of_week: string
    open_time: string | null
    close_time: string | null
  }
  plans: Array<{ id: string; name: string }>
  routinesLibrary: Array<{ id: string; name: string }>
  assignmentsByPlan: Record<string, { id: string; name: string; content: string }>
  isToday: boolean
}

export function DayColumn({ scheduleRow, plans, routinesLibrary, assignmentsByPlan, isToday }: DayColumnProps) {
  return (
    <div
      className={cn(
        "flex flex-col rounded-lg border bg-card p-3 gap-3 min-w-0",
        isToday && "border-primary/60 ring-2 ring-primary/30"
      )}
    >
      <div className="space-y-1">
        <div className="flex items-center justify-between gap-2">
          <h3 className="text-sm font-semibold uppercase tracking-wide">{scheduleRow.day_of_week}</h3>
          {isToday && <Badge className="bg-primary text-primary-foreground text-[10px] px-1.5 py-0">HOY</Badge>}
        </div>
        <ScheduleInline
          id={scheduleRow.id}
          open_time={scheduleRow.open_time}
          close_time={scheduleRow.close_time}
        />
      </div>

      <div className="border-t -mx-3" />

      <div className="space-y-2">
        {plans.length === 0 ? (
          <p className="text-xs text-muted-foreground italic">Sin planes activos</p>
        ) : (
          plans.map((plan) => (
            <div key={plan.id} className="space-y-1">
              <p className="text-[10px] font-medium uppercase text-muted-foreground tracking-wide truncate">{plan.name}</p>
              <RoutineCard
                planId={plan.id}
                planName={plan.name}
                dayOfWeek={scheduleRow.day_of_week}
                routine={assignmentsByPlan[plan.id] ?? null}
                routinesLibrary={routinesLibrary}
                highlight={isToday}
              />
            </div>
          ))
        )}
      </div>
    </div>
  )
}
```

- [ ] **Step 2: Verificar lint**

Run: `npm run lint`
Expected: sin errores nuevos.

- [ ] **Step 3: Commit**

```bash
git add components/section-components/horarios/DayColumn.tsx
git commit -m "feat(horarios): componente DayColumn (header + horario + cards)

Co-Authored-By: Claude Opus 4.7 <noreply@anthropic.com>"
```

---

### Task 15: Componente `WeekGrid` + integración en `HorariosMainComponent`

**Files:**
- Create: `components/section-components/horarios/WeekGrid.tsx`
- Modify: `components/section-components/horarios/HorariosMainComponent.tsx`

- [ ] **Step 1: Crear `WeekGrid`**

Crear `components/section-components/horarios/WeekGrid.tsx`:

```tsx
"use client"

import { useMemo } from "react"
import { DayColumn } from "./DayColumn"

const DAY_ORDER = ["Lunes", "Martes", "Miércoles", "Jueves", "Viernes", "Sábado", "Domingo"]

const DAY_MAP: Record<string, string> = {
  monday: "Lunes",
  tuesday: "Martes",
  wednesday: "Miércoles",
  thursday: "Jueves",
  friday: "Viernes",
  saturday: "Sábado",
  sunday: "Domingo",
}

function getTodayLabel(): string {
  const formatter = new Intl.DateTimeFormat("en-US", {
    timeZone: "America/Caracas",
    weekday: "long",
  })
  return DAY_MAP[formatter.format(new Date()).toLowerCase()] ?? "Lunes"
}

interface ScheduleRow {
  id: string
  day_of_week: string
  open_time: string | null
  close_time: string | null
}

interface AssignmentRow {
  id: string
  plan_id: string
  day_of_week: string
  routine_id: string
  routines: { id: string; name: string; content: string } | null
}

interface WeekGridProps {
  schedule: ScheduleRow[]
  plans: Array<{ id: string; name: string }>
  routines: Array<{ id: string; name: string }>
  assignments: AssignmentRow[]
}

export function WeekGrid({ schedule, plans, routines, assignments }: WeekGridProps) {
  const today = useMemo(getTodayLabel, [])

  const sortedSchedule = useMemo(
    () => [...schedule].sort((a, b) => DAY_ORDER.indexOf(a.day_of_week) - DAY_ORDER.indexOf(b.day_of_week)),
    [schedule],
  )

  const assignmentIndex = useMemo(() => {
    const idx: Record<string, Record<string, { id: string; name: string; content: string }>> = {}
    for (const a of assignments) {
      if (!a.routines) continue
      idx[a.day_of_week] ??= {}
      idx[a.day_of_week][a.plan_id] = a.routines
    }
    return idx
  }, [assignments])

  return (
    <div className="grid gap-3 grid-cols-1 sm:grid-cols-2 lg:grid-cols-7">
      {sortedSchedule.map((row) => (
        <DayColumn
          key={row.id}
          scheduleRow={row}
          plans={plans}
          routinesLibrary={routines}
          assignmentsByPlan={assignmentIndex[row.day_of_week] ?? {}}
          isToday={row.day_of_week === today}
        />
      ))}
    </div>
  )
}
```

- [ ] **Step 2: Reemplazar el placeholder en `HorariosMainComponent`**

Editar `components/section-components/horarios/HorariosMainComponent.tsx`. Importar `WeekGrid`:

```tsx
import { WeekGrid } from "./WeekGrid"
```

Reemplazar el bloque del placeholder:

```tsx
        <div className="text-sm text-muted-foreground border border-dashed rounded-lg p-8 text-center">
          Schedule: {schedule.length} días · Planes activos: {activePlans.length} · Rutinas: {routines.length} · Asignaciones: {assignments.length}
        </div>
```

por:

```tsx
        {activePlans.length === 0 ? (
          <div className="border border-dashed rounded-lg p-8 text-center space-y-2">
            <p className="text-sm font-medium">No hay planes activos</p>
            <p className="text-xs text-muted-foreground">
              Crea o activa un plan en{" "}
              <a href="/dashboard/plans" className="text-primary hover:underline">/dashboard/plans</a>{" "}
              antes de asignar rutinas.
            </p>
          </div>
        ) : (
          <WeekGrid
            schedule={schedule as any}
            plans={activePlans.map((p: any) => ({ id: p.id, name: p.name }))}
            routines={routines.map((r: any) => ({ id: r.id, name: r.name }))}
            assignments={assignments as any}
          />
        )}
```

- [ ] **Step 3: Probar en navegador**

`npm run dev`. Visitar `/dashboard/horarios`.

Casos a verificar:
- Las 7 columnas se ven con el día y horario.
- El día de hoy tiene borde amarillo + badge "HOY".
- Si hay >0 planes activos: aparece una fila por plan en cada columna con "Asignar".
- Click en "Asignar" → modal funciona, asigna y aparece en la celda.
- Click en una rutina asignada → preview.
- Click en el ícono ✎ → cambiar/quitar asignación.
- Toggle "Cerrado" → guarda 00:00 y muestra "Cerrado".
- Cambiar horarios → toast de éxito al hacer blur.

- [ ] **Step 4: Commit**

```bash
git add components/section-components/horarios/WeekGrid.tsx components/section-components/horarios/HorariosMainComponent.tsx
git commit -m "feat(horarios): grilla semanal y wiring del componente principal

Co-Authored-By: Claude Opus 4.7 <noreply@anthropic.com>"
```

---

### Task 16: Estados loading/empty/errors finales (sección admin)

**Files:**
- Modify: `components/section-components/horarios/HorariosMainComponent.tsx`

- [ ] **Step 1: Reemplazar el `<Loader2>` central por skeletons de columna**

En `HorariosMainComponent.tsx`, importar `Skeleton`:

```tsx
import { Skeleton } from "@/components/ui/skeleton"
```

Reemplazar el bloque actual:

```tsx
  if (isLoading) {
    return (
      <DashboardLayout>
        <div className="flex items-center justify-center py-12">
          <Loader2 className="h-8 w-8 animate-spin text-muted-foreground" />
        </div>
      </DashboardLayout>
    )
  }
```

por:

```tsx
  if (isLoading) {
    return (
      <DashboardLayout>
        <div className="space-y-6">
          <div>
            <Skeleton className="h-8 w-64" />
            <Skeleton className="h-4 w-96 mt-2" />
          </div>
          <div className="grid gap-3 grid-cols-1 sm:grid-cols-2 lg:grid-cols-7">
            {Array.from({ length: 7 }).map((_, i) => (
              <Skeleton key={i} className="h-64 rounded-lg" />
            ))}
          </div>
        </div>
      </DashboardLayout>
    )
  }
```

- [ ] **Step 2: Quitar el import de `Loader2`** si ya no se usa en el archivo:

Si `Loader2` no se usa en otro lugar de este archivo, removerlo del import. Si sí se usa, dejarlo.

- [ ] **Step 3: Verificar en navegador**

Recargar `/dashboard/horarios`. En la primera carga (o con throttling de red en DevTools) deberían verse los skeletons gris claro en lugar del spinner.

- [ ] **Step 4: Commit**

```bash
git add components/section-components/horarios/HorariosMainComponent.tsx
git commit -m "feat(horarios): skeletons en lugar de spinner durante carga

Co-Authored-By: Claude Opus 4.7 <noreply@anthropic.com>"
```

---

### Task 17: Sidebar — agregar "Horarios" + remover tab de Settings

**Files:**
- Modify: `components/shared/dashboard-layout.tsx`
- Modify: `components/section-components/settings/SettingsMainComponent.tsx`

- [ ] **Step 1: Importar nuevo icono y añadir item al sidebar**

En `components/shared/dashboard-layout.tsx`, modificar el import de `lucide-react` para incluir `CalendarClock`:

```tsx
import { Home, Users, Shield, CreditCard, DollarSign, Calendar, CalendarCheck, CalendarClock, Settings, LogOut, Menu, X, ChevronDown } from "lucide-react"
```

Y dentro del array `navigation`, añadir el item entre "Cierres" y "Configuración":

```tsx
const navigation = [
  { name: "Inicio", href: "/dashboard", icon: Home, permissions: ["dashboard.view"] },
  { name: "Clientes", href: "/dashboard/users", icon: Users, permissions: ["users.view"] },
  { name: "Roles y Permisos", href: "/dashboard/roles", icon: Shield, permissions: ["roles.view", "roles.edit"] },
  { name: "Planes", href: "/dashboard/plans", icon: CreditCard, permissions: ["plans.view"] },
  { name: "Pagos", href: "/dashboard/payments", icon: DollarSign, permissions: ["payments.view"] },
  { name: "Clases Especiales", href: "/dashboard/classes", icon: Calendar, permissions: ["classes.view"] },
  { name: "Cierres", href: "/dashboard/closings", icon: CalendarCheck, permissions: ["closings.view"] },
  { name: "Horarios", href: "/dashboard/horarios", icon: CalendarClock, permissions: ["schedule.view"] },
  { name: "Configuración", href: "/dashboard/settings", icon: Settings, permissions: ["settings.view"] },
]
```

- [ ] **Step 2: Quitar la pestaña "Horarios" de Settings**

En `components/section-components/settings/SettingsMainComponent.tsx`:

1. Quitar el import de `Calendar` si ya no se usa en otro lugar del archivo:
   ```tsx
   import { Save, Building2, Calendar, Loader2, KeyRound, Users, AlertTriangle } from "lucide-react"
   ```
   pasa a:
   ```tsx
   import { Save, Building2, Loader2, KeyRound, Users, AlertTriangle } from "lucide-react"
   ```

2. Quitar los imports de schedule:
   ```tsx
   import { getGymSettings, updateGymSettings, getGymSchedule, updateGymSchedule } from "@/lib/actions/settings"
   ```
   pasa a:
   ```tsx
   import { getGymSettings, updateGymSettings } from "@/lib/actions/settings"
   ```

3. Quitar la constante `dayOrder` (al tope del archivo).

4. Quitar el `useQuery({ queryKey: ["gym-schedule"], ... })` y la variable `sortedSchedule`.

5. Quitar el `updateScheduleMutation` y la función `handleScheduleChange`.

6. En el guard de loading, quitar la referencia a `loadingSchedule`:
   ```tsx
   if (loadingSettings || loadingSchedule) {
   ```
   pasa a:
   ```tsx
   if (loadingSettings) {
   ```

7. En el `<TabsList>`, quitar el `<TabsTrigger value="schedule">`:
   ```tsx
   <TabsList>
     <TabsTrigger value="general">General</TabsTrigger>
     <TabsTrigger value="schedule">Horarios</TabsTrigger>
     <TabsTrigger value="account">Cuenta</TabsTrigger>
     <TabsTrigger value="portal">Portal</TabsTrigger>
   </TabsList>
   ```
   pasa a:
   ```tsx
   <TabsList>
     <TabsTrigger value="general">General</TabsTrigger>
     <TabsTrigger value="account">Cuenta</TabsTrigger>
     <TabsTrigger value="portal">Portal</TabsTrigger>
   </TabsList>
   ```

8. Eliminar todo el bloque `<TabsContent value="schedule">...</TabsContent>` (desde la línea con `<TabsContent value="schedule">` hasta su `</TabsContent>` correspondiente, inclusive el Card de "Horarios del Gimnasio").

- [ ] **Step 3: Verificar lint y build**

Run: `npm run lint`
Expected: sin errores nuevos.

Run: `npm run build`
Expected: build exitoso.

- [ ] **Step 4: Probar en navegador**

`npm run dev`.
- Sidebar debe tener nuevo item "Horarios" entre "Cierres" y "Configuración".
- `/dashboard/settings` solo muestra tabs General / Cuenta / Portal.
- `/dashboard/horarios` sigue funcionando correctamente.

- [ ] **Step 5: Commit**

```bash
git add components/shared/dashboard-layout.tsx components/section-components/settings/SettingsMainComponent.tsx
git commit -m "feat(horarios): mover horarios al sidebar y limpiar tab de Settings

Co-Authored-By: Claude Opus 4.7 <noreply@anthropic.com>"
```

---

### Task 18: Portal — `TodayRoutineCard`

**Files:**
- Create: `components/section-components/portal/home/TodayRoutineCard.tsx`
- Modify: `components/section-components/portal/home/PortalHomeMainComponent.tsx`

- [ ] **Step 1: Crear `TodayRoutineCard`**

Crear `components/section-components/portal/home/TodayRoutineCard.tsx`:

```tsx
"use client"

import { useQuery } from "@tanstack/react-query"
import ReactMarkdown from "react-markdown"
import { CalendarDays, Loader2 } from "lucide-react"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { getTodayRoutineForMember } from "@/lib/actions/routines"

export function TodayRoutineCard() {
  const { data, isLoading } = useQuery({
    queryKey: ["portal-today-routine"],
    queryFn: getTodayRoutineForMember,
    staleTime: 5 * 60 * 1000,
  })

  if (isLoading) {
    return (
      <Card>
        <CardContent className="py-8 flex items-center justify-center">
          <Loader2 className="h-5 w-5 animate-spin text-muted-foreground" />
        </CardContent>
      </Card>
    )
  }

  if (!data) return null // sin plan asignado

  return (
    <Card>
      <CardHeader>
        <div className="flex items-center gap-3">
          <CalendarDays className="h-5 w-5 text-primary" />
          <div className="min-w-0">
            <CardTitle className="text-base">Rutina de hoy · {data.day_of_week}</CardTitle>
            {data.plan_name && (
              <p className="text-xs text-muted-foreground mt-0.5 truncate">
                {data.plan_name}{data.routine ? ` · ${data.routine.name}` : ""}
              </p>
            )}
          </div>
        </div>
      </CardHeader>
      <CardContent>
        {data.routine ? (
          <div className="prose prose-invert prose-sm max-w-none">
            <ReactMarkdown>{data.routine.content || "_Sin contenido._"}</ReactMarkdown>
          </div>
        ) : (
          <p className="text-sm text-muted-foreground">
            Tu coach aún no asignó la rutina de hoy.
          </p>
        )}
      </CardContent>
    </Card>
  )
}
```

- [ ] **Step 2: Montarla en `PortalHomeMainComponent`**

En `components/section-components/portal/home/PortalHomeMainComponent.tsx`, importar:

```tsx
import { TodayRoutineCard } from "./TodayRoutineCard"
```

Y dentro del JSX, añadir `<TodayRoutineCard />` después de la "Status card" y antes de cualquier otra sección. Por ejemplo, justo antes del cierre del `<div className="space-y-6">`.

Si te encuentras con un return temprano `if (!profile) return null` y `<div className="space-y-6">` envolvente, agregarla así:

```tsx
      {/* Status card existente */}
      ...

      <TodayRoutineCard />

      {/* resto del contenido existente, si lo hay */}
```

(Es decir: la posición exacta es después de la status card. Si hay más cards, ponerla justo después de la card de estado y antes del resto.)

- [ ] **Step 3: Verificar lint y probar**

Run: `npm run lint`
Expected: sin errores.

Run: `npm run dev`. Loguearse como un miembro (no admin) con un plan asignado y una rutina asignada para hoy. Visitar `/portal`.

Casos:
- Miembro con rutina hoy: card muestra el contenido en Markdown bonito.
- Miembro con plan pero sin rutina hoy: card muestra "Tu coach aún no asignó la rutina de hoy".
- Miembro sin plan: card no aparece.

- [ ] **Step 4: Commit**

```bash
git add components/section-components/portal/home/TodayRoutineCard.tsx components/section-components/portal/home/PortalHomeMainComponent.tsx
git commit -m "feat(portal): tarjeta TodayRoutineCard en home del miembro

Co-Authored-By: Claude Opus 4.7 <noreply@anthropic.com>"
```

---

### Task 19: Verificación manual end-to-end

**Files:** ninguno; solo testing.

- [ ] **Step 1: Build limpio**

Run: `npm run build`
Expected: build sin errores ni warnings nuevos.

- [ ] **Step 2: Recorrer el checklist del spec**

Con `npm run dev` activo, ejecutar uno por uno:

- [ ] Migración aplicada y types regenerados.
- [ ] Crear rutina desde la Biblioteca → aparece en la lista.
- [ ] Asignar la rutina a (Plan X, Lunes) en la grilla.
- [ ] Asignar la misma rutina a (Plan Y, Martes) — confirma reuso (no se duplica el record en `routines`, solo en `routine_assignments`).
- [ ] Editar el contenido de la rutina → el cambio se ve reflejado en ambas asignaciones (al recargar o invalidar).
- [ ] Borrar la rutina (con asignaciones) → SweetAlert advierte usage; al confirmar se borra y las asignaciones desaparecen (cascade).
- [ ] Editar horario apertura/cierre desde la nueva sección → toast de éxito.
- [ ] Toggle "Cerrado" → guarda 00:00/00:00 y muestra "Cerrado". Reabrir → inputs vacíos esperando entrada.
- [ ] La pestaña "Horarios" ya no aparece en `/dashboard/settings`.
- [ ] Login como miembro al portal → ver `TodayRoutineCard` con la rutina del día.
- [ ] Día sin rutina asignada en el portal → mensaje suave "Tu coach aún no asignó la rutina de hoy".
- [ ] Crear un rol con `schedule.view` pero sin `schedule.edit`/`delete`. Asignarlo a un admin de prueba. Verificar que ve la sección en solo-lectura (botones ocultos / disabled).
- [ ] Crear un rol sin `schedule.view`. Asignarlo. Verificar que el item "Horarios" no aparece en su sidebar y `/dashboard/horarios` no se carga (redirect o vacío).
- [ ] Móvil (DevTools responsive ~375px): la grilla colapsa a stack vertical, hoy resaltado.

- [ ] **Step 3: Activity log**

Visitar `/dashboard` (Inicio). En la sección de actividad reciente, confirmar que las acciones recientes registran:
- "Creó rutina"
- "Editó rutina"
- "Asignó rutina"
- "Quitó rutina"
- "Borró rutina"
- "Actualizó horario"

(Los labels visibles dependen de cómo `activity-log` mapea las acciones; lo importante es que aparezcan registros nuevos cada vez que mutas algo.)

- [ ] **Step 4: Commit final (si quedan cambios)**

Si todos los tests pasan y no hay cambios pendientes, esta task se cierra sin commit. Si en el camino se hicieron ajustes:

```bash
git add -A
git commit -m "chore: ajustes finales de Horarios y Rutinas tras QA manual

Co-Authored-By: Claude Opus 4.7 <noreply@anthropic.com>"
```

---

## Self-review

### Spec coverage

| Sección spec | Task que la cubre |
|---|---|
| Modelo de datos (`routines` + `routine_assignments` + indices) | Task 1 |
| RLS policies | Task 1 |
| Server actions biblioteca | Task 3 |
| Server actions asignaciones | Task 4 |
| Server action portal `getTodayRoutineForMember` | Task 5 |
| Permisos `schedule.{view,edit,delete}` (UI roles) | Task 2 |
| Permisos en CLAUDE.md | Task 2 |
| Server-side permission checks | Task 3, 4 |
| Client-side permission checks | Tasks 10, 11, 12, 13 (vía `usePermissions`) |
| Ruta `/dashboard/horarios` | Task 7 |
| Sidebar nav | Task 17 |
| Cleanup de Settings | Task 17 |
| HorariosMainComponent | Tasks 7, 15, 16 |
| WeekGrid | Task 15 |
| DayColumn | Task 14 |
| ScheduleInline | Task 12 |
| RoutineCard | Task 13 |
| Modal form (con preview Markdown) | Task 8 |
| Modal preview | Task 9 |
| Modal asignación | Task 11 |
| Modal/biblioteca | Task 10 |
| Móvil responsive | Tasks 14, 15 (CSS grid `sm:grid-cols-2 lg:grid-cols-7`) |
| Skeletons / empty / errors | Tasks 15, 16 |
| Portal `TodayRoutineCard` | Task 18 |
| `react-markdown` dep | Task 6 |
| Activity log con `routine_*` actions | Task 3 (extender tipos), 4, 5, 12 (vía `updateGymSchedule` ya existente) |
| Checklist QA | Task 19 |

Una omisión: el spec menciona `logActivity` en las mutaciones de `gym_schedule`, pero `lib/actions/settings.ts` no llama a `logActivity` actualmente. **Decisión:** dejar `gym_schedule` sin log para no expandir scope; si el usuario lo pide después se agrega.

### Type / signature consistency

- `getRoutines`: devuelve `routines + routine_assignments(count)` — usado en `RoutineLibraryModal` con `r.routine_assignments` array.
- `getRoutineAssignments`: devuelve filas con `routines (...)` joined — `WeekGrid` indexa por `[day_of_week][plan_id]`. ✓
- `getTodayRoutineForMember`: devuelve `{ day_of_week, plan_name, routine } | null` — consumido por `TodayRoutineCard`. ✓
- `upsertRoutineAssignment` / `deleteRoutineAssignment`: parámetros consistentes (`plan_id`, `day_of_week`, `routine_id`). ✓
- Permisos: `schedule.view` / `schedule.edit` / `schedule.delete` usados consistentemente en server actions y client checks. ✓

### Placeholder scan

Sin TBD/TODO. Cada step tiene comandos exactos o código completo. Único bloque "según corresponda" es en Task 18 Step 2 sobre dónde insertar `<TodayRoutineCard />`, donde di guía clara basada en la estructura actual del archivo.

---

## Plan complete and saved to `docs/superpowers/plans/2026-05-02-horarios-rutinas.md`

Two execution options:

**1. Subagent-Driven (recommended)** — fresh subagent per task with two-stage review between tasks. Best for keeping context tight on a 19-task plan.

**2. Inline Execution** — execute tasks in this session using executing-plans, with checkpoints for review.

Which approach?
