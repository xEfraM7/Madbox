# Planificación de rutinas — Plan de implementación

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Reemplazar `/dashboard/horarios` (modelo por día de semana) por `/dashboard/rutinas`: planificación de rutinas por fecha exacta, multi-plan, con wizard de 3 pasos. Eliminar `gym_schedule` y desactivar registro de WOD logs por ahora.

**Architecture:**
- Postgres: nuevas tablas `routine_schedules` (id, date, name, content_md) + `routine_schedule_plans` (M2M con `plans`). Eliminar `routines`, `routine_assignments`, `gym_schedule`. Truncar `wod_logs` y redirigir su FK.
- Next.js App Router: server actions en `lib/actions/routines.ts` siguen siendo la única vía a la DB. UI admin con modal-wizard de 3 pasos (fecha → planes → markdown). UI portal: card de hoy en home + ruta `/portal/rutinas` con calendario navegable.
- Permisos `schedule.*` se renombran a `routines.*` en código y en `roles.permissions[]`.

**Tech Stack:** Next.js 16 + React 19 + TypeScript 5, Supabase (`@supabase/ssr`), TanStack Query 5, shadcn/ui (Radix), React Hook Form 7 + Zod 3, `react-markdown` (ya instalado), `react-day-picker` (ya instalado), `sonner`, `sweetalert2`, `date-fns`, `lucide-react`.

**Pre-requisitos antes de empezar:**
- Working tree limpio antes de iniciar (commit o descartar `lib/actions/roles.ts` y `utils/supabase/admin.ts` modificados que aparecen en `git status`).
- Acceso al proyecto Supabase (vía MCP `mcp__supabase__*`) para aplicar migración y regenerar types.
- Servidor de desarrollo local funcional (`npm run dev`).

**Convenciones del proyecto:**
- No hay tests automatizados. La verificación de cada tarea es: type check (`npx tsc --noEmit`) + lint (`npm run lint`) + verificación manual en `npm run dev` cuando aplica.
- Idioma de UI/comentarios/commits: español.
- Cada server action que muta debe llamar `revalidatePath` y `logActivity` cuando aplique.
- Los modales viven en `components/section-components/<seccion>/modals/`.

---

## Fase A — Base de datos y types

### Task A1: Crear archivo de migración SQL

**Files:**
- Create: `supabase/migrations/20260504120000_rutinas_planificacion.sql`

> **Nota sobre el timestamp:** si ya existe una migración con timestamp posterior en `supabase/migrations/`, ajustar el prefijo para que sea cronológicamente posterior (ej: usar la hora actual UTC). El nombre exacto no importa siempre que ordene después de las migraciones existentes.

- [ ] **A1.1: Crear el archivo con el contenido completo**

```sql
-- Reemplaza el modelo de horarios/rutinas semanales por planificación por fecha.
-- 1. Limpiar wod_logs antes del DROP por FK
TRUNCATE TABLE wod_logs CASCADE;

-- 2. Drop modelo viejo
DROP TABLE IF EXISTS routine_assignments CASCADE;
DROP TABLE IF EXISTS routines CASCADE;
DROP TABLE IF EXISTS gym_schedule CASCADE;

-- 3. Tablas nuevas
CREATE TABLE routine_schedules (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  date date NOT NULL,
  name text,
  content text NOT NULL DEFAULT '',
  created_at timestamptz DEFAULT now(),
  updated_at timestamptz DEFAULT now()
);
CREATE INDEX idx_routine_schedules_date ON routine_schedules(date);

CREATE TABLE routine_schedule_plans (
  schedule_id uuid REFERENCES routine_schedules(id) ON DELETE CASCADE,
  plan_id uuid REFERENCES plans(id) ON DELETE CASCADE,
  PRIMARY KEY (schedule_id, plan_id)
);
CREATE INDEX idx_rsp_plan ON routine_schedule_plans(plan_id);

-- 4. Re-vincular wod_logs al nuevo modelo (vacía por TRUNCATE)
ALTER TABLE wod_logs
  DROP CONSTRAINT IF EXISTS wod_logs_routine_id_fkey,
  ADD CONSTRAINT wod_logs_routine_id_fkey
    FOREIGN KEY (routine_id) REFERENCES routine_schedules(id) ON DELETE CASCADE;

-- 5. Renombrar permisos en roles existentes
UPDATE roles
SET permissions = ARRAY(
  SELECT CASE
    WHEN p = 'schedule.view'   THEN 'routines.view'
    WHEN p = 'schedule.edit'   THEN 'routines.edit'
    WHEN p = 'schedule.delete' THEN 'routines.delete'
    ELSE p
  END
  FROM unnest(permissions) AS p
);

-- 6. RLS
ALTER TABLE routine_schedules ENABLE ROW LEVEL SECURITY;
ALTER TABLE routine_schedule_plans ENABLE ROW LEVEL SECURITY;

CREATE POLICY "auth read routine_schedules"
  ON routine_schedules FOR SELECT TO authenticated USING (true);
CREATE POLICY "auth read routine_schedule_plans"
  ON routine_schedule_plans FOR SELECT TO authenticated USING (true);
```

- [ ] **A1.2: Commit**

```bash
git add supabase/migrations/20260504120000_rutinas_planificacion.sql
git commit -m "feat(migracion): tablas routine_schedules y routine_schedule_plans, drop gym_schedule"
```

---

### Task A2: Aplicar migración en Supabase

- [ ] **A2.1: Aplicar la migración con MCP**

Usar la herramienta `mcp__supabase__apply_migration` con:
- `name`: `rutinas_planificacion`
- `query`: contenido completo del archivo `.sql` creado en A1

Si el MCP da error por costos, ejecutar `mcp__supabase__confirm_cost` antes y reintentar.

- [ ] **A2.2: Verificar la aplicación**

Usar `mcp__supabase__list_tables` y comprobar que aparecen `routine_schedules` y `routine_schedule_plans`, y que NO aparecen `routines`, `routine_assignments` ni `gym_schedule`.

---

### Task A3: Regenerar `types/database.ts`

**Files:**
- Modify: `types/database.ts` (regenerado completo)

- [ ] **A3.1: Generar tipos desde Supabase**

Usar `mcp__supabase__generate_typescript_types` y reemplazar el contenido completo de `types/database.ts` con el output.

- [ ] **A3.2: Verificar type check**

```bash
npx tsc --noEmit
```

Esperado: errores de compilación porque hay código (acciones, componentes) que aún referencia `routines` y `routine_assignments`. **Es esperado** — los iremos arreglando en las siguientes tareas. Tomar nota de los archivos que fallan para tener un mapa.

- [ ] **A3.3: Commit**

```bash
git add types/database.ts
git commit -m "chore(types): regenerar types/database.ts tras migracion de rutinas"
```

---

## Fase B — Server actions y permisos

### Task B1: Reescribir `lib/actions/routines.ts`

**Files:**
- Modify (rewrite): `lib/actions/routines.ts`

- [ ] **B1.1: Reemplazar el contenido completo del archivo**

```ts
"use server"

import { createClient } from "@/utils/supabase/server"
import { revalidatePath } from "next/cache"
import { getCurrentAdminPermissions } from "./roles"
import { logActivity } from "./activity"
import { todayCaracasISO } from "@/lib/constants/wod-score"

// ─── Tipos ───────────────────────────────────────────────────

export interface RoutineSchedule {
  id: string
  date: string // YYYY-MM-DD
  name: string | null
  content: string
  created_at: string | null
  updated_at: string | null
  plans: Array<{ id: string; name: string }>
}

export interface CreateRoutineScheduleInput {
  date: string
  name?: string | null
  content: string
  plan_ids: string[]
  replace_conflicts?: boolean
}

export interface UpdateRoutineScheduleInput {
  date?: string
  name?: string | null
  content?: string
  plan_ids?: string[]
  replace_conflicts?: boolean
}

// ─── Helpers ─────────────────────────────────────────────────

async function checkPermission(required: string): Promise<boolean> {
  const { permissions, isAdmin } = await getCurrentAdminPermissions()
  if (isAdmin) return true
  return permissions.includes(required)
}

async function findConflictingPlans(
  date: string,
  planIds: string[],
  excludeScheduleId?: string,
): Promise<string[]> {
  if (planIds.length === 0) return []
  const supabase = await createClient()

  let query = supabase
    .from("routine_schedule_plans")
    .select("plan_id, schedule_id, routine_schedules!inner(date)")
    .in("plan_id", planIds)
    .eq("routine_schedules.date", date)

  if (excludeScheduleId) {
    query = query.neq("schedule_id", excludeScheduleId)
  }

  const { data, error } = await query
  if (error) throw error
  return Array.from(new Set((data ?? []).map((r: any) => r.plan_id)))
}

function shapeRoutineSchedule(row: any): RoutineSchedule {
  const plansArr = (row.routine_schedule_plans ?? []).map((rsp: any) => ({
    id: rsp.plans?.id ?? rsp.plan_id,
    name: rsp.plans?.name ?? "",
  }))
  return {
    id: row.id,
    date: row.date,
    name: row.name ?? null,
    content: row.content ?? "",
    created_at: row.created_at ?? null,
    updated_at: row.updated_at ?? null,
    plans: plansArr,
  }
}

// ─── Lectura ─────────────────────────────────────────────────

export async function getRoutineSchedules(filters?: {
  from?: string
  to?: string
}): Promise<RoutineSchedule[]> {
  const supabase = await createClient()
  let query = supabase
    .from("routine_schedules")
    .select(
      "id, date, name, content, created_at, updated_at, routine_schedule_plans(plan_id, plans(id, name))",
    )
    .order("date", { ascending: true })

  if (filters?.from) query = query.gte("date", filters.from)
  if (filters?.to) query = query.lte("date", filters.to)

  const { data, error } = await query
  if (error) throw error
  return (data ?? []).map(shapeRoutineSchedule)
}

export async function getRoutineSchedule(id: string): Promise<RoutineSchedule | null> {
  const supabase = await createClient()
  const { data, error } = await supabase
    .from("routine_schedules")
    .select(
      "id, date, name, content, created_at, updated_at, routine_schedule_plans(plan_id, plans(id, name))",
    )
    .eq("id", id)
    .maybeSingle()

  if (error) throw error
  return data ? shapeRoutineSchedule(data) : null
}

export async function checkRoutineConflicts(input: {
  date: string
  plan_ids: string[]
  exclude_id?: string
}): Promise<string[]> {
  if (!(await checkPermission("routines.view"))) {
    throw new Error("No tienes permisos para ver rutinas")
  }
  return findConflictingPlans(input.date, input.plan_ids, input.exclude_id)
}

// ─── Escritura ───────────────────────────────────────────────

export async function createRoutineSchedule(
  input: CreateRoutineScheduleInput,
): Promise<RoutineSchedule> {
  if (!(await checkPermission("routines.edit"))) {
    throw new Error("No tienes permisos para programar rutinas")
  }

  if (!input.plan_ids?.length) {
    throw new Error("Selecciona al menos un plan")
  }
  if (!input.content?.trim()) {
    throw new Error("El contenido de la rutina es requerido")
  }
  if (input.date < todayCaracasISO()) {
    throw new Error("No se permiten fechas pasadas")
  }

  const supabase = await createClient()

  const conflictPlanIds = await findConflictingPlans(input.date, input.plan_ids)
  if (conflictPlanIds.length > 0 && !input.replace_conflicts) {
    const err: any = new Error("Hay rutinas en conflicto")
    err.code = "CONFLICT"
    err.planIds = conflictPlanIds
    throw err
  }

  if (conflictPlanIds.length > 0 && input.replace_conflicts) {
    const { data: conflictRows, error: cErr } = await supabase
      .from("routine_schedule_plans")
      .select("schedule_id, routine_schedules!inner(date)")
      .in("plan_id", conflictPlanIds)
      .eq("routine_schedules.date", input.date)
    if (cErr) throw cErr
    const scheduleIds = Array.from(new Set((conflictRows ?? []).map((r: any) => r.schedule_id)))
    if (scheduleIds.length > 0) {
      const { error: dErr } = await supabase
        .from("routine_schedules")
        .delete()
        .in("id", scheduleIds)
      if (dErr) throw dErr
    }
  }

  const { data: inserted, error: iErr } = await supabase
    .from("routine_schedules")
    .insert({
      date: input.date,
      name: input.name?.trim() || null,
      content: input.content,
    })
    .select("id")
    .single()
  if (iErr) throw iErr

  const linkRows = input.plan_ids.map((pid) => ({
    schedule_id: inserted.id,
    plan_id: pid,
  }))
  const { error: lErr } = await supabase.from("routine_schedule_plans").insert(linkRows)
  if (lErr) {
    // rollback manual
    await supabase.from("routine_schedules").delete().eq("id", inserted.id)
    throw lErr
  }

  await logActivity({
    action: "routine_scheduled",
    entityType: "routine_schedule",
    entityId: inserted.id,
    entityName: `${input.name?.trim() || "Rutina"} · ${input.date}`,
  })

  revalidatePath("/dashboard/rutinas")
  revalidatePath("/portal")
  revalidatePath("/portal/rutinas")

  const final = await getRoutineSchedule(inserted.id)
  if (!final) throw new Error("Error al recuperar rutina creada")
  return final
}

export async function updateRoutineSchedule(
  id: string,
  input: UpdateRoutineScheduleInput,
): Promise<RoutineSchedule> {
  if (!(await checkPermission("routines.edit"))) {
    throw new Error("No tienes permisos para editar rutinas")
  }

  const current = await getRoutineSchedule(id)
  if (!current) throw new Error("Rutina no encontrada")

  const newDate = input.date ?? current.date
  const newPlanIds = input.plan_ids ?? current.plans.map((p) => p.id)

  if (input.content !== undefined && !input.content.trim()) {
    throw new Error("El contenido de la rutina es requerido")
  }
  if (newPlanIds.length === 0) {
    throw new Error("Selecciona al menos un plan")
  }

  const supabase = await createClient()

  const conflictPlanIds = await findConflictingPlans(newDate, newPlanIds, id)
  if (conflictPlanIds.length > 0 && !input.replace_conflicts) {
    const err: any = new Error("Hay rutinas en conflicto")
    err.code = "CONFLICT"
    err.planIds = conflictPlanIds
    throw err
  }

  if (conflictPlanIds.length > 0 && input.replace_conflicts) {
    const { data: conflictRows, error: cErr } = await supabase
      .from("routine_schedule_plans")
      .select("schedule_id, routine_schedules!inner(date)")
      .in("plan_id", conflictPlanIds)
      .eq("routine_schedules.date", newDate)
      .neq("schedule_id", id)
    if (cErr) throw cErr
    const scheduleIds = Array.from(new Set((conflictRows ?? []).map((r: any) => r.schedule_id)))
    if (scheduleIds.length > 0) {
      const { error: dErr } = await supabase
        .from("routine_schedules")
        .delete()
        .in("id", scheduleIds)
      if (dErr) throw dErr
    }
  }

  const updatePayload: Record<string, any> = { updated_at: new Date().toISOString() }
  if (input.date !== undefined) updatePayload.date = input.date
  if (input.name !== undefined) updatePayload.name = input.name?.trim() || null
  if (input.content !== undefined) updatePayload.content = input.content

  const { error: uErr } = await supabase
    .from("routine_schedules")
    .update(updatePayload)
    .eq("id", id)
  if (uErr) throw uErr

  if (input.plan_ids !== undefined) {
    const { error: dErr } = await supabase
      .from("routine_schedule_plans")
      .delete()
      .eq("schedule_id", id)
    if (dErr) throw dErr

    const linkRows = newPlanIds.map((pid) => ({ schedule_id: id, plan_id: pid }))
    const { error: lErr } = await supabase.from("routine_schedule_plans").insert(linkRows)
    if (lErr) throw lErr
  }

  await logActivity({
    action: "routine_schedule_updated",
    entityType: "routine_schedule",
    entityId: id,
    entityName: `${updatePayload.name ?? current.name ?? "Rutina"} · ${newDate}`,
  })

  revalidatePath("/dashboard/rutinas")
  revalidatePath("/portal")
  revalidatePath("/portal/rutinas")

  const final = await getRoutineSchedule(id)
  if (!final) throw new Error("Error al recuperar rutina actualizada")
  return final
}

export async function deleteRoutineSchedule(id: string): Promise<void> {
  if (!(await checkPermission("routines.delete"))) {
    throw new Error("No tienes permisos para eliminar rutinas")
  }

  const current = await getRoutineSchedule(id)
  if (!current) return

  const supabase = await createClient()
  const { error } = await supabase.from("routine_schedules").delete().eq("id", id)
  if (error) throw error

  await logActivity({
    action: "routine_schedule_deleted",
    entityType: "routine_schedule",
    entityId: id,
    entityName: `${current.name ?? "Rutina"} · ${current.date}`,
  })

  revalidatePath("/dashboard/rutinas")
  revalidatePath("/portal")
  revalidatePath("/portal/rutinas")
}

// ─── Portal del miembro ──────────────────────────────────────

export async function getRoutineForMemberOnDate(
  date: string,
): Promise<RoutineSchedule | null> {
  const supabase = await createClient()
  const {
    data: { user },
  } = await supabase.auth.getUser()
  if (!user) return null

  const { data: member } = await supabase
    .from("members")
    .select("plan_id")
    .eq("auth_user_id", user.id)
    .maybeSingle()
  if (!member?.plan_id) return null

  const { data, error } = await supabase
    .from("routine_schedule_plans")
    .select(
      "schedule_id, routine_schedules!inner(id, date, name, content, created_at, updated_at, routine_schedule_plans(plan_id, plans(id, name)))",
    )
    .eq("plan_id", member.plan_id)
    .eq("routine_schedules.date", date)
    .maybeSingle()

  if (error) throw error
  if (!data?.routine_schedules) return null

  const rs = Array.isArray(data.routine_schedules)
    ? data.routine_schedules[0]
    : data.routine_schedules
  return rs ? shapeRoutineSchedule(rs) : null
}

export async function getMemberRoutineDatesInRange(
  from: string,
  to: string,
): Promise<string[]> {
  const supabase = await createClient()
  const {
    data: { user },
  } = await supabase.auth.getUser()
  if (!user) return []

  const { data: member } = await supabase
    .from("members")
    .select("plan_id")
    .eq("auth_user_id", user.id)
    .maybeSingle()
  if (!member?.plan_id) return []

  const { data, error } = await supabase
    .from("routine_schedule_plans")
    .select("routine_schedules!inner(date)")
    .eq("plan_id", member.plan_id)
    .gte("routine_schedules.date", from)
    .lte("routine_schedules.date", to)

  if (error) throw error
  const dates = (data ?? []).map((row: any) => {
    const rs = Array.isArray(row.routine_schedules)
      ? row.routine_schedules[0]
      : row.routine_schedules
    return rs?.date as string
  })
  return Array.from(new Set(dates.filter(Boolean)))
}
```

- [ ] **B1.2: Type check del archivo aislado**

```bash
npx tsc --noEmit
```

Solo deberían quedar errores fuera de `lib/actions/routines.ts` (en componentes y otras acciones que aún hacen referencia al modelo viejo). Los iremos arreglando en las siguientes tareas.

- [ ] **B1.3: Commit**

```bash
git add lib/actions/routines.ts
git commit -m "feat(rutinas): server actions para planificacion por fecha"
```

---

### Task B2: Actualizar `lib/actions/activity.ts`

El union type de `entityType` referencia `"routine"`, `"routine_assignment"` y `"gym_schedule"` que ya no existen. Hay que actualizarlo.

**Files:**
- Modify: `lib/actions/activity.ts:25` (la unión de `entityType`)

- [ ] **B2.1: Leer el archivo y localizar el union type**

```bash
# Inspecciona el bloque alrededor de la línea 25
```

Lee `lib/actions/activity.ts` y encuentra la unión actual: `"routine" | "routine_assignment" | "gym_schedule"`.

- [ ] **B2.2: Reemplazar la unión**

Sustituir las entradas viejas por la nueva:
- Quitar: `"routine"`, `"routine_assignment"`, `"gym_schedule"`
- Añadir: `"routine_schedule"`

Ejemplo del Edit (los nombres exactos de los demás items pueden variar — preservar todo lo que no sea las tres claves a remover):

```ts
// antes
| "routine" | "routine_assignment" | "gym_schedule"
// después
| "routine_schedule"
```

- [ ] **B2.3: Type check**

```bash
npx tsc --noEmit
```

- [ ] **B2.4: Commit**

```bash
git add lib/actions/activity.ts
git commit -m "chore(activity): actualizar entityType union para rutinas"
```

---

### Task B3: Limpiar `lib/actions/settings.ts`

Eliminar `getGymSchedule` y `updateGymSchedule` (la tabla ya no existe).

**Files:**
- Modify: `lib/actions/settings.ts`

- [ ] **B3.1: Leer el archivo y eliminar las funciones**

Eliminar las funciones `getGymSchedule` y `updateGymSchedule` completas (alrededor de líneas 29 y 40 según el grep anterior). No tocar el resto del archivo.

- [ ] **B3.2: Buscar referencias para verificar que nada externo aún las usa**

```bash
# usar Grep
```

Pattern: `getGymSchedule|updateGymSchedule`. Si aparecen referencias fuera de `lib/actions/settings.ts`, esas referencias se removerán en las tareas siguientes (E1, E4) que limpian componentes consumidores.

- [ ] **B3.3: Commit**

```bash
git add lib/actions/settings.ts
git commit -m "chore(settings): remover acciones de gym_schedule"
```

---

### Task B4: Deshabilitar registro de WOD en `lib/actions/wod-logs.ts`

Las funciones de escritura deben lanzar "Registro de WOD deshabilitado". Las de lectura devuelven listas/null vacías para no romper componentes que aún las llaman durante la transición.

**Files:**
- Modify (rewrite): `lib/actions/wod-logs.ts`

- [ ] **B4.1: Reemplazar contenido completo**

```ts
"use server"

import { createClient } from "@/utils/supabase/server"
import { type ScoreType } from "@/lib/constants/wod-score"

const DISABLED = "Registro de WOD deshabilitado mientras se migra el modelo de rutinas"

// ─── Tipos (preservados para no romper consumidores) ──────────

export interface WodLog {
  id: string
  member_id: string
  routine_id: string
  routine_name: string
  date: string
  score_type: ScoreType
  score_seconds: number | null
  score_rounds: number | null
  score_reps: number | null
  score_kg: number | null
  rx: boolean
  notes: string | null
  created_at: string
}

export interface UpsertWodLogInput {
  routine_id: string
  date: string
  score_type: ScoreType
  score_seconds?: number | null
  score_rounds?: number | null
  score_reps?: number | null
  score_kg?: number | null
  rx: boolean
  notes?: string | null
}

export interface PlanRoutineForDay {
  day_of_week: string
  routine: { id: string; name: string; content: string; blocks: unknown } | null
}

export interface WodLeaderboardEntry {
  member_id: string
  name: string
  avatar_url: string | null
  score_type: ScoreType
  score_seconds: number | null
  score_rounds: number | null
  score_reps: number | null
  score_kg: number | null
  rx: boolean
  rankable: number
  position: number
}

export interface WodLeaderboardResult {
  routine: { id: string; name: string; content: string; blocks: unknown } | null
  entries: WodLeaderboardEntry[]
}

// ─── Lectura: devuelven vacío para no romper consumidores ────

export async function getMyPlanRoutines(): Promise<PlanRoutineForDay[]> {
  return []
}

export async function getTodayWodLog(): Promise<WodLog | null> {
  return null
}

export async function getMyWodHistory(_limit = 50, _offset = 0): Promise<WodLog[]> {
  return []
}

export async function getTodayLeaderboard(): Promise<WodLeaderboardResult> {
  return { routine: null, entries: [] }
}

export async function getMemberRecentWods(
  _memberId: string,
  _limit = 5,
): Promise<WodLog[]> {
  return []
}

// ─── Escritura: deshabilitada ─────────────────────────────────

export async function upsertWodLog(_input: UpsertWodLogInput): Promise<WodLog> {
  throw new Error(DISABLED)
}

export async function deleteWodLog(_id: string): Promise<void> {
  throw new Error(DISABLED)
}
```

- [ ] **B4.2: Type check**

```bash
npx tsc --noEmit
```

Algunos warnings de "unused vars" pueden aparecer — son intencionales para preservar la firma. ESLint puede señalarlos; si bloquea el lint, prefijar con `_` ya cubre la convención.

- [ ] **B4.3: Commit**

```bash
git add lib/actions/wod-logs.ts
git commit -m "feat(wod): deshabilitar registro de WOD durante migracion de rutinas"
```

---

### Task B5: Actualizar `lib/hooks/use-permissions.ts` (si tiene listas hardcodeadas)

El hook actual no tiene strings hardcodeados de permisos (los recibe del backend), así que **no requiere cambios**.

- [ ] **B5.1: Verificar que no haya strings `schedule.*` en el hook**

```bash
# usar Grep
```

Pattern: `schedule\.` en `lib/hooks/use-permissions.ts`. Esperado: 0 matches.

Si hay matches, eliminar/renombrar acordemente. Si no, saltar al siguiente task.

---

## Fase C — UI Admin: nueva sección `/dashboard/rutinas`

### Task C1: Crear estructura de archivos vacíos

**Files:**
- Create: `app/dashboard/rutinas/page.tsx`
- Create: `components/section-components/rutinas/index.ts`
- Create: `components/section-components/rutinas/RutinasMainComponent.tsx`
- Create: `components/section-components/rutinas/RoutinesList.tsx`
- Create: `components/section-components/rutinas/RoutineDayGroup.tsx`
- Create: `components/section-components/rutinas/RoutineCard.tsx`
- Create: `components/section-components/rutinas/modals/routine-wizard-modal.tsx`
- Create: `components/section-components/rutinas/modals/routine-preview-modal.tsx`

> Esto se llena con los stubs mínimos primero para que el árbol compile, y las tareas siguientes los implementan en detalle. Si prefieres llenar todo en orden lineal, salta C1 y empieza con C2 implementando los archivos completos directamente.

- [ ] **C1.1: `app/dashboard/rutinas/page.tsx`**

```tsx
import RutinasMainComponent from "@/components/section-components/rutinas/RutinasMainComponent"

export default function RutinasPage() {
  return <RutinasMainComponent />
}
```

- [ ] **C1.2: `components/section-components/rutinas/index.ts`**

```ts
export { default } from "./RutinasMainComponent"
```

---

### Task C2: `RoutineCard` — tarjeta individual de rutina

**Files:**
- Modify: `components/section-components/rutinas/RoutineCard.tsx`

- [ ] **C2.1: Implementar el componente**

```tsx
"use client"

import { useState } from "react"
import { useMutation, useQueryClient } from "@tanstack/react-query"
import { Button } from "@/components/ui/button"
import { Badge } from "@/components/ui/badge"
import { Eye, Pencil, Trash2 } from "lucide-react"
import { toast } from "sonner"
import Swal from "sweetalert2"
import { usePermissions } from "@/lib/hooks/use-permissions"
import { deleteRoutineSchedule, type RoutineSchedule } from "@/lib/actions/routines"
import { RoutinePreviewModal } from "./modals/routine-preview-modal"
import { RoutineWizardModal } from "./modals/routine-wizard-modal"

interface Props {
  routine: RoutineSchedule
}

function shortPreview(md: string, max = 120): string {
  const stripped = md
    .replace(/`{1,3}[^`]*`{1,3}/g, "")
    .replace(/[#>*_~\-]/g, " ")
    .replace(/\n+/g, " ")
    .replace(/\s+/g, " ")
    .trim()
  return stripped.length > max ? stripped.slice(0, max) + "…" : stripped
}

export function RoutineCard({ routine }: Props) {
  const { hasPermission } = usePermissions()
  const canEdit = hasPermission("routines.edit")
  const canDelete = hasPermission("routines.delete")

  const [previewOpen, setPreviewOpen] = useState(false)
  const [editOpen, setEditOpen] = useState(false)
  const queryClient = useQueryClient()

  const deleteMut = useMutation({
    mutationFn: () => deleteRoutineSchedule(routine.id),
    onSuccess: () => {
      toast.success("Rutina eliminada")
      queryClient.invalidateQueries({ queryKey: ["routine-schedules"] })
    },
    onError: (e: Error) => toast.error(e.message ?? "Error al eliminar"),
  })

  const handleDelete = async () => {
    const result = await Swal.fire({
      title: "¿Eliminar rutina?",
      text: `${routine.name ?? "Rutina"} · ${routine.date}`,
      icon: "warning",
      showCancelButton: true,
      confirmButtonColor: "#dc2626",
      cancelButtonColor: "#374151",
      confirmButtonText: "Sí, eliminar",
      cancelButtonText: "Cancelar",
      background: "#0a0a0a",
      color: "#fff",
    })
    if (result.isConfirmed) deleteMut.mutate()
  }

  return (
    <>
      <div className="rounded-lg border bg-card p-4 hover:bg-muted/30 transition-colors">
        <div className="flex items-start justify-between gap-3">
          <div className="min-w-0 flex-1 space-y-2">
            <h4 className="font-semibold truncate">
              {routine.name?.trim() || <span className="text-muted-foreground italic">Rutina sin nombre</span>}
            </h4>
            <div className="flex flex-wrap gap-1.5">
              {routine.plans.map((p) => (
                <Badge key={p.id} variant="secondary" className="text-xs">
                  {p.name}
                </Badge>
              ))}
            </div>
            <p className="text-sm text-muted-foreground line-clamp-2">
              {shortPreview(routine.content) || <span className="italic">Sin contenido</span>}
            </p>
          </div>
          <div className="flex flex-col gap-1 shrink-0">
            <Button size="icon" variant="ghost" onClick={() => setPreviewOpen(true)} title="Ver rutina">
              <Eye className="h-4 w-4" />
            </Button>
            {canEdit && (
              <Button size="icon" variant="ghost" onClick={() => setEditOpen(true)} title="Editar">
                <Pencil className="h-4 w-4" />
              </Button>
            )}
            {canDelete && (
              <Button
                size="icon"
                variant="ghost"
                onClick={handleDelete}
                disabled={deleteMut.isPending}
                title="Eliminar"
                className="text-destructive hover:text-destructive"
              >
                <Trash2 className="h-4 w-4" />
              </Button>
            )}
          </div>
        </div>
      </div>

      <RoutinePreviewModal open={previewOpen} onOpenChange={setPreviewOpen} routine={routine} />
      <RoutineWizardModal
        open={editOpen}
        onOpenChange={setEditOpen}
        mode="edit"
        routine={routine}
      />
    </>
  )
}
```

- [ ] **C2.2: Type check (los modales aún son stubs y faltarán; es esperado)**

```bash
npx tsc --noEmit
```

Si los stubs de modales no aceptan props todavía, no hay problema — se implementan en C5/C6.

---

### Task C3: `RoutineDayGroup` — agrupador por fecha

**Files:**
- Modify: `components/section-components/rutinas/RoutineDayGroup.tsx`

- [ ] **C3.1: Implementar**

```tsx
"use client"

import { format, isToday, parseISO } from "date-fns"
import { es } from "date-fns/locale"
import { Badge } from "@/components/ui/badge"
import { RoutineCard } from "./RoutineCard"
import type { RoutineSchedule } from "@/lib/actions/routines"

interface Props {
  date: string // YYYY-MM-DD
  routines: RoutineSchedule[]
}

export function RoutineDayGroup({ date, routines }: Props) {
  const d = parseISO(date + "T00:00:00")
  const label = format(d, "EEEE, d 'de' MMMM 'de' yyyy", { locale: es })
  const labelCapitalized = label.charAt(0).toUpperCase() + label.slice(1)

  return (
    <section className="space-y-3">
      <div className="flex items-baseline gap-2 border-b pb-2">
        <h3 className="text-base font-semibold">{labelCapitalized}</h3>
        {isToday(d) && (
          <Badge variant="default" className="text-xs">
            Hoy
          </Badge>
        )}
      </div>
      <div className="space-y-2">
        {routines.map((r) => (
          <RoutineCard key={r.id} routine={r} />
        ))}
      </div>
    </section>
  )
}
```

---

### Task C4: `RoutinesList` — lista cronológica agrupada

**Files:**
- Modify: `components/section-components/rutinas/RoutinesList.tsx`

- [ ] **C4.1: Implementar**

```tsx
"use client"

import { useMemo } from "react"
import { CalendarDays } from "lucide-react"
import type { RoutineSchedule } from "@/lib/actions/routines"
import { RoutineDayGroup } from "./RoutineDayGroup"

interface Props {
  routines: RoutineSchedule[]
}

export function RoutinesList({ routines }: Props) {
  const grouped = useMemo(() => {
    const map = new Map<string, RoutineSchedule[]>()
    for (const r of routines) {
      if (!map.has(r.date)) map.set(r.date, [])
      map.get(r.date)!.push(r)
    }
    return Array.from(map.entries()).sort(([a], [b]) => a.localeCompare(b))
  }, [routines])

  if (grouped.length === 0) {
    return (
      <div className="border border-dashed rounded-lg p-10 text-center space-y-3">
        <CalendarDays className="h-10 w-10 mx-auto text-muted-foreground" />
        <div className="space-y-1">
          <p className="text-sm font-medium">No hay rutinas programadas</p>
          <p className="text-xs text-muted-foreground">
            Pulsa <strong>+ Crear rutina</strong> para programar la primera.
          </p>
        </div>
      </div>
    )
  }

  return (
    <div className="space-y-6">
      {grouped.map(([date, items]) => (
        <RoutineDayGroup key={date} date={date} routines={items} />
      ))}
    </div>
  )
}
```

---

### Task C5: `routine-preview-modal` — modal de solo lectura

**Files:**
- Modify: `components/section-components/rutinas/modals/routine-preview-modal.tsx`

- [ ] **C5.1: Implementar**

```tsx
"use client"

import ReactMarkdown from "react-markdown"
import remarkGfm from "remark-gfm"
import { format, parseISO } from "date-fns"
import { es } from "date-fns/locale"
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog"
import { Badge } from "@/components/ui/badge"
import type { RoutineSchedule } from "@/lib/actions/routines"

interface Props {
  open: boolean
  onOpenChange: (v: boolean) => void
  routine: RoutineSchedule | null
}

export function RoutinePreviewModal({ open, onOpenChange, routine }: Props) {
  if (!routine) return null

  const dateLabel = format(parseISO(routine.date + "T00:00:00"), "EEEE, d 'de' MMMM 'de' yyyy", {
    locale: es,
  })
  const dateLabelCap = dateLabel.charAt(0).toUpperCase() + dateLabel.slice(1)

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-2xl max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle>{routine.name?.trim() || "Rutina sin nombre"}</DialogTitle>
          <DialogDescription>{dateLabelCap}</DialogDescription>
        </DialogHeader>
        <div className="flex flex-wrap gap-1.5">
          {routine.plans.map((p) => (
            <Badge key={p.id} variant="secondary" className="text-xs">
              {p.name}
            </Badge>
          ))}
        </div>
        <article className="prose prose-invert prose-sm max-w-none">
          <ReactMarkdown remarkPlugins={[remarkGfm]}>{routine.content}</ReactMarkdown>
        </article>
      </DialogContent>
    </Dialog>
  )
}
```

> **Nota:** `remark-gfm` puede no estar instalado. Si el import falla, instalarlo con `npm install remark-gfm` y ajustar el commit.

- [ ] **C5.2: Verificar dependencias**

```bash
npm ls remark-gfm 2>&1 | head -5
```

Si no está, instalar:

```bash
npm install remark-gfm
```

- [ ] **C5.3: Commit incremental**

```bash
git add components/section-components/rutinas/RoutineCard.tsx components/section-components/rutinas/RoutineDayGroup.tsx components/section-components/rutinas/RoutinesList.tsx components/section-components/rutinas/modals/routine-preview-modal.tsx package.json package-lock.json
git commit -m "feat(rutinas): tarjeta, agrupador, lista y modal de preview"
```

---

### Task C6: `routine-wizard-modal` — modal con stepper de 3 pasos

Este es el componente más grande. Va a ser un modal reutilizable que cubre `create` y `edit`.

**Files:**
- Modify: `components/section-components/rutinas/modals/routine-wizard-modal.tsx`

- [ ] **C6.1: Implementar el modal completo**

```tsx
"use client"

import { useEffect, useMemo, useState } from "react"
import { useForm } from "react-hook-form"
import { zodResolver } from "@hookform/resolvers/zod"
import { z } from "zod"
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query"
import { format, parseISO } from "date-fns"
import { es } from "date-fns/locale"
import ReactMarkdown from "react-markdown"
import remarkGfm from "remark-gfm"
import { toast } from "sonner"
import { AlertTriangle, Check, ChevronLeft, ChevronRight, Eye, Pencil } from "lucide-react"

import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { Checkbox } from "@/components/ui/checkbox"
import { Calendar } from "@/components/ui/calendar"
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs"
import { Skeleton } from "@/components/ui/skeleton"
import { cn } from "@/lib/utils"
import { getPlans } from "@/lib/actions/plans"
import {
  checkRoutineConflicts,
  createRoutineSchedule,
  updateRoutineSchedule,
  type RoutineSchedule,
} from "@/lib/actions/routines"

// ─── Zod schema ──────────────────────────────────────────────

const schema = z.object({
  date: z.string().min(1, "Selecciona una fecha"),
  plan_ids: z.array(z.string().uuid()).min(1, "Selecciona al menos un plan"),
  name: z.string().max(100, "Máx. 100 caracteres").optional(),
  content: z.string().min(1, "El contenido es requerido"),
})
type FormValues = z.infer<typeof schema>

// ─── Tipos / Props ───────────────────────────────────────────

type Mode = "create" | "edit"

interface Props {
  open: boolean
  onOpenChange: (v: boolean) => void
  mode: Mode
  routine?: RoutineSchedule
}

// ─── Componente ──────────────────────────────────────────────

export function RoutineWizardModal({ open, onOpenChange, mode, routine }: Props) {
  const queryClient = useQueryClient()
  const [step, setStep] = useState<1 | 2 | 3>(1)
  const [conflictPlanIds, setConflictPlanIds] = useState<string[]>([])
  const [allowReplace, setAllowReplace] = useState(false)

  const todayISO = useMemo(() => {
    const fmt = new Intl.DateTimeFormat("en-CA", {
      timeZone: "America/Caracas",
      year: "numeric",
      month: "2-digit",
      day: "2-digit",
    })
    return fmt.format(new Date())
  }, [])

  const form = useForm<FormValues>({
    resolver: zodResolver(schema),
    defaultValues: {
      date: routine?.date ?? todayISO,
      plan_ids: routine?.plans.map((p) => p.id) ?? [],
      name: routine?.name ?? "",
      content: routine?.content ?? "",
    },
  })

  useEffect(() => {
    if (open) {
      form.reset({
        date: routine?.date ?? todayISO,
        plan_ids: routine?.plans.map((p) => p.id) ?? [],
        name: routine?.name ?? "",
        content: routine?.content ?? "",
      })
      setStep(1)
      setConflictPlanIds([])
      setAllowReplace(false)
    }
  }, [open, routine, todayISO, form])

  const { data: plans = [], isLoading: plansLoading } = useQuery({
    queryKey: ["plans"],
    queryFn: getPlans,
  })
  const activePlans = plans.filter((p: any) => p.active !== false)

  const date = form.watch("date")
  const planIds = form.watch("plan_ids")
  const name = form.watch("name")
  const content = form.watch("content")

  // ─── Validar conflictos antes de pasar de paso 2 a 3 ──────

  const checkConflictsMut = useMutation({
    mutationFn: (vars: { date: string; plan_ids: string[]; exclude_id?: string }) =>
      checkRoutineConflicts(vars),
    onSuccess: (conflicts) => {
      setConflictPlanIds(conflicts)
      if (conflicts.length === 0) {
        setAllowReplace(false)
        setStep(3)
      }
    },
    onError: (e: Error) => toast.error(e.message ?? "Error al validar"),
  })

  const handleNextFromPlans = () => {
    setConflictPlanIds([])
    setAllowReplace(false)
    checkConflictsMut.mutate({
      date,
      plan_ids: planIds,
      exclude_id: mode === "edit" ? routine?.id : undefined,
    })
  }

  const handleConfirmReplace = () => {
    setAllowReplace(true)
    setStep(3)
  }

  // ─── Submit ────────────────────────────────────────────────

  const submitMut = useMutation({
    mutationFn: async (values: FormValues) => {
      if (mode === "create") {
        return createRoutineSchedule({
          date: values.date,
          name: values.name?.trim() || null,
          content: values.content,
          plan_ids: values.plan_ids,
          replace_conflicts: allowReplace,
        })
      } else {
        if (!routine) throw new Error("Rutina no encontrada")
        return updateRoutineSchedule(routine.id, {
          date: values.date,
          name: values.name?.trim() || null,
          content: values.content,
          plan_ids: values.plan_ids,
          replace_conflicts: allowReplace,
        })
      }
    },
    onSuccess: () => {
      toast.success(mode === "create" ? "Rutina programada" : "Rutina actualizada")
      queryClient.invalidateQueries({ queryKey: ["routine-schedules"] })
      onOpenChange(false)
    },
    onError: (e: any) => {
      if (e?.code === "CONFLICT" && Array.isArray(e?.planIds)) {
        setConflictPlanIds(e.planIds)
        setAllowReplace(false)
        setStep(2)
        toast.error("Hay rutinas en conflicto para esa fecha")
      } else {
        toast.error(e?.message ?? "Error al guardar")
      }
    },
  })

  const onSubmit = form.handleSubmit((values) => submitMut.mutate(values))

  // ─── UI helpers ────────────────────────────────────────────

  const stepValid =
    (step === 1 && !!date && (mode === "edit" || date >= todayISO)) ||
    (step === 2 && planIds.length > 0) ||
    (step === 3 && content.trim().length > 0)

  const titleByMode = mode === "create" ? "Programar nueva rutina" : "Editar rutina"

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-2xl max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle>{titleByMode}</DialogTitle>
          <DialogDescription>
            Paso {step} de 3 — {step === 1 ? "Fecha" : step === 2 ? "Planes" : "Contenido"}
          </DialogDescription>
        </DialogHeader>

        {/* Stepper visual */}
        <div className="flex items-center gap-2 px-1 py-2">
          {[1, 2, 3].map((s) => (
            <div key={s} className="flex items-center gap-2 flex-1">
              <div
                className={cn(
                  "h-8 w-8 rounded-full border flex items-center justify-center text-sm font-medium",
                  step === s
                    ? "border-primary bg-primary text-primary-foreground"
                    : step > s
                      ? "border-primary bg-primary/20 text-primary"
                      : "border-muted text-muted-foreground",
                )}
              >
                {step > s ? <Check className="h-4 w-4" /> : s}
              </div>
              {s < 3 && (
                <div className={cn("h-px flex-1", step > s ? "bg-primary" : "bg-muted")} />
              )}
            </div>
          ))}
        </div>

        {/* Paso 1 — Fecha */}
        {step === 1 && (
          <div className="space-y-3">
            <Label>Fecha de la rutina</Label>
            <div className="rounded-lg border p-3 flex justify-center">
              <Calendar
                mode="single"
                locale={es}
                selected={date ? parseISO(date + "T00:00:00") : undefined}
                onSelect={(d) => {
                  if (!d) return
                  const fmt = new Intl.DateTimeFormat("en-CA", {
                    timeZone: "America/Caracas",
                    year: "numeric",
                    month: "2-digit",
                    day: "2-digit",
                  })
                  form.setValue("date", fmt.format(d), { shouldValidate: true })
                }}
                disabled={(d) => {
                  if (mode === "edit") return false
                  const fmt = new Intl.DateTimeFormat("en-CA", {
                    timeZone: "America/Caracas",
                    year: "numeric",
                    month: "2-digit",
                    day: "2-digit",
                  })
                  return fmt.format(d) < todayISO
                }}
              />
            </div>
            {date && (
              <p className="text-sm text-muted-foreground">
                {(() => {
                  const label = format(parseISO(date + "T00:00:00"), "EEEE, d 'de' MMMM 'de' yyyy", {
                    locale: es,
                  })
                  return label.charAt(0).toUpperCase() + label.slice(1)
                })()}
              </p>
            )}
          </div>
        )}

        {/* Paso 2 — Planes */}
        {step === 2 && (
          <div className="space-y-3">
            <Label>Planes a los que aplica esta rutina</Label>
            {plansLoading ? (
              <div className="space-y-2">
                <Skeleton className="h-10 w-full" />
                <Skeleton className="h-10 w-full" />
                <Skeleton className="h-10 w-full" />
              </div>
            ) : activePlans.length === 0 ? (
              <p className="text-sm text-muted-foreground">No hay planes activos.</p>
            ) : (
              <ul className="space-y-2">
                {activePlans.map((p: any) => {
                  const checked = planIds.includes(p.id)
                  const conflicted = conflictPlanIds.includes(p.id)
                  return (
                    <li
                      key={p.id}
                      className={cn(
                        "flex items-center gap-3 rounded-lg border p-3",
                        conflicted && "border-amber-500/50 bg-amber-500/5",
                      )}
                    >
                      <Checkbox
                        id={`plan-${p.id}`}
                        checked={checked}
                        onCheckedChange={(v) => {
                          const next = v
                            ? [...planIds, p.id]
                            : planIds.filter((x) => x !== p.id)
                          form.setValue("plan_ids", next, { shouldValidate: true })
                          setConflictPlanIds([])
                          setAllowReplace(false)
                        }}
                      />
                      <Label htmlFor={`plan-${p.id}`} className="flex-1 cursor-pointer font-normal">
                        {p.name}
                      </Label>
                      {conflicted && (
                        <span className="text-xs text-amber-600 dark:text-amber-400">
                          Ya tiene rutina ese día
                        </span>
                      )}
                    </li>
                  )
                })}
              </ul>
            )}

            {conflictPlanIds.length > 0 && (
              <div className="rounded-lg border border-amber-500/40 bg-amber-500/10 p-3 space-y-2">
                <div className="flex items-start gap-2">
                  <AlertTriangle className="h-4 w-4 text-amber-500 mt-0.5 shrink-0" />
                  <div className="text-sm space-y-1">
                    <p className="font-medium">Conflicto detectado</p>
                    <p className="text-muted-foreground">
                      Los planes marcados ya tienen rutina programada para esa fecha.
                      Si continúas se reemplazará la rutina existente.
                    </p>
                  </div>
                </div>
                <div className="flex gap-2 pt-1">
                  <Button size="sm" variant="destructive" onClick={handleConfirmReplace}>
                    Reemplazar y continuar
                  </Button>
                  <Button size="sm" variant="outline" onClick={() => setConflictPlanIds([])}>
                    Cambiar selección
                  </Button>
                </div>
              </div>
            )}
          </div>
        )}

        {/* Paso 3 — Contenido */}
        {step === 3 && (
          <div className="space-y-4">
            <div className="space-y-2">
              <Label htmlFor="routine-name">Nombre (opcional)</Label>
              <Input
                id="routine-name"
                placeholder="Ej: Push Day, AMRAP 20…"
                value={name ?? ""}
                onChange={(e) => form.setValue("name", e.target.value)}
                maxLength={100}
              />
            </div>

            <div className="space-y-2">
              <Label>Contenido (Markdown)</Label>
              <Tabs defaultValue="edit">
                <TabsList>
                  <TabsTrigger value="edit" className="gap-1.5">
                    <Pencil className="h-3.5 w-3.5" /> Editar
                  </TabsTrigger>
                  <TabsTrigger value="preview" className="gap-1.5">
                    <Eye className="h-3.5 w-3.5" /> Vista previa
                  </TabsTrigger>
                </TabsList>
                <TabsContent value="edit" className="mt-2">
                  <textarea
                    rows={16}
                    placeholder="# AMRAP 20\n- 10 push-ups\n- 15 air squats\n- 20 sit-ups"
                    value={content ?? ""}
                    onChange={(e) => form.setValue("content", e.target.value, { shouldValidate: true })}
                    className="w-full rounded-md border bg-background px-3 py-2 text-sm font-mono focus:outline-none focus:ring-2 focus:ring-ring resize-y"
                  />
                </TabsContent>
                <TabsContent value="preview" className="mt-2">
                  <article className="prose prose-invert prose-sm max-w-none rounded-md border bg-background p-4 min-h-[16rem]">
                    {content?.trim() ? (
                      <ReactMarkdown remarkPlugins={[remarkGfm]}>{content}</ReactMarkdown>
                    ) : (
                      <p className="text-muted-foreground italic">Vacío</p>
                    )}
                  </article>
                </TabsContent>
              </Tabs>
              {form.formState.errors.content && (
                <p className="text-xs text-destructive">{form.formState.errors.content.message}</p>
              )}
            </div>
          </div>
        )}

        <DialogFooter className="gap-2">
          {step > 1 && (
            <Button variant="ghost" onClick={() => setStep((s) => (s === 3 ? 2 : 1))}>
              <ChevronLeft className="h-4 w-4 mr-1" /> Atrás
            </Button>
          )}
          {step === 1 && (
            <Button onClick={() => setStep(2)} disabled={!stepValid}>
              Siguiente <ChevronRight className="h-4 w-4 ml-1" />
            </Button>
          )}
          {step === 2 && conflictPlanIds.length === 0 && (
            <Button
              onClick={handleNextFromPlans}
              disabled={!stepValid || checkConflictsMut.isPending}
            >
              {checkConflictsMut.isPending ? "Validando…" : "Siguiente"}
              <ChevronRight className="h-4 w-4 ml-1" />
            </Button>
          )}
          {step === 3 && (
            <Button onClick={onSubmit} disabled={!stepValid || submitMut.isPending}>
              {submitMut.isPending ? "Guardando…" : mode === "create" ? "Crear rutina" : "Guardar cambios"}
            </Button>
          )}
        </DialogFooter>
      </DialogContent>
    </Dialog>
  )
}
```

- [ ] **C6.2: Type check**

```bash
npx tsc --noEmit
```

- [ ] **C6.3: Commit**

```bash
git add components/section-components/rutinas/modals/routine-wizard-modal.tsx
git commit -m "feat(rutinas): wizard modal de 3 pasos para crear y editar rutinas"
```

---

### Task C7: `RutinasMainComponent` — orquestador de la sección admin

**Files:**
- Modify: `components/section-components/rutinas/RutinasMainComponent.tsx`

- [ ] **C7.1: Implementar**

```tsx
"use client"

import { useMemo, useState } from "react"
import { useQuery } from "@tanstack/react-query"
import { Plus } from "lucide-react"
import { format, addDays } from "date-fns"
import { DashboardLayout } from "@/components/shared/dashboard-layout"
import { Button } from "@/components/ui/button"
import { Skeleton } from "@/components/ui/skeleton"
import { usePermissions } from "@/lib/hooks/use-permissions"
import { getRoutineSchedules } from "@/lib/actions/routines"
import { RoutinesList } from "./RoutinesList"
import { RoutineWizardModal } from "./modals/routine-wizard-modal"

export default function RutinasMainComponent() {
  const { hasPermission } = usePermissions()
  const canEdit = hasPermission("routines.edit")

  const [createOpen, setCreateOpen] = useState(false)

  const range = useMemo(() => {
    const today = new Date()
    return {
      from: format(today, "yyyy-MM-dd"),
      to: format(addDays(today, 60), "yyyy-MM-dd"),
    }
  }, [])

  const { data: routines = [], isLoading } = useQuery({
    queryKey: ["routine-schedules", range],
    queryFn: () => getRoutineSchedules(range),
  })

  return (
    <DashboardLayout>
      <div className="space-y-5 sm:space-y-6">
        <div className="flex items-start justify-between gap-3 flex-wrap">
          <div className="min-w-0">
            <h1 className="text-2xl sm:text-3xl font-bold tracking-tight">Rutinas</h1>
            <p className="text-muted-foreground text-sm sm:text-base mt-1.5">
              Programa rutinas por fecha y plan.
            </p>
          </div>
          {canEdit && (
            <Button onClick={() => setCreateOpen(true)} className="gap-2 w-full sm:w-auto">
              <Plus className="h-4 w-4" /> Crear rutina
            </Button>
          )}
        </div>

        {isLoading ? (
          <div className="space-y-4">
            <Skeleton className="h-7 w-64" />
            <Skeleton className="h-24 w-full rounded-lg" />
            <Skeleton className="h-24 w-full rounded-lg" />
          </div>
        ) : (
          <RoutinesList routines={routines} />
        )}
      </div>

      <RoutineWizardModal
        open={createOpen}
        onOpenChange={setCreateOpen}
        mode="create"
      />
    </DashboardLayout>
  )
}
```

- [ ] **C7.2: Type check + lint**

```bash
npx tsc --noEmit && npm run lint
```

- [ ] **C7.3: Commit**

```bash
git add app/dashboard/rutinas/page.tsx components/section-components/rutinas/RutinasMainComponent.tsx components/section-components/rutinas/index.ts
git commit -m "feat(rutinas): pagina principal y main component admin"
```

---

## Fase D — UI Portal del miembro

### Task D1: Reescribir `TodayRoutineCard` (portal home)

**Files:**
- Modify (rewrite): `components/section-components/portal/home/TodayRoutineCard.tsx`

- [ ] **D1.1: Inspeccionar el archivo actual**

```bash
# Read tool
```

Comprender qué exporta y cómo lo importa `app/portal/page.tsx`. Mantener el mismo nombre de export y firma.

- [ ] **D1.2: Reemplazar contenido completo**

```tsx
"use client"

import Link from "next/link"
import { useQuery } from "@tanstack/react-query"
import ReactMarkdown from "react-markdown"
import remarkGfm from "remark-gfm"
import { format, parseISO } from "date-fns"
import { es } from "date-fns/locale"
import { ArrowRight, CalendarDays } from "lucide-react"
import { Button } from "@/components/ui/button"
import { Skeleton } from "@/components/ui/skeleton"
import { getRoutineForMemberOnDate } from "@/lib/actions/routines"

function todayCaracasISO(): string {
  const fmt = new Intl.DateTimeFormat("en-CA", {
    timeZone: "America/Caracas",
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
  })
  return fmt.format(new Date())
}

export function TodayRoutineCard() {
  const today = todayCaracasISO()

  const { data: routine, isLoading } = useQuery({
    queryKey: ["my-routine", today],
    queryFn: () => getRoutineForMemberOnDate(today),
  })

  const dateLabel = (() => {
    const lbl = format(parseISO(today + "T00:00:00"), "EEEE, d 'de' MMMM", { locale: es })
    return lbl.charAt(0).toUpperCase() + lbl.slice(1)
  })()

  return (
    <div className="rounded-xl border bg-card p-4 sm:p-5 space-y-3">
      <div className="flex items-baseline justify-between gap-3">
        <div>
          <p className="text-xs uppercase tracking-wide text-muted-foreground">Tu rutina de hoy</p>
          <h3 className="text-lg font-semibold mt-0.5">{dateLabel}</h3>
        </div>
        <Link href="/portal/rutinas">
          <Button variant="ghost" size="sm" className="gap-1">
            <CalendarDays className="h-4 w-4" /> Ver todas
          </Button>
        </Link>
      </div>

      {isLoading ? (
        <Skeleton className="h-24 w-full" />
      ) : routine ? (
        <div className="space-y-2">
          {routine.name && <p className="font-medium">{routine.name}</p>}
          <article className="prose prose-invert prose-sm max-w-none">
            <ReactMarkdown remarkPlugins={[remarkGfm]}>{routine.content}</ReactMarkdown>
          </article>
        </div>
      ) : (
        <div className="rounded-lg border border-dashed p-4 text-center">
          <p className="text-sm text-muted-foreground">
            Sin rutina programada para hoy.
          </p>
          <Link href="/portal/rutinas" className="inline-flex items-center gap-1 mt-2 text-sm text-primary hover:underline">
            Ver próximas rutinas <ArrowRight className="h-3.5 w-3.5" />
          </Link>
        </div>
      )}
    </div>
  )
}
```

- [ ] **D1.3: Type check**

```bash
npx tsc --noEmit
```

- [ ] **D1.4: Commit**

```bash
git add components/section-components/portal/home/TodayRoutineCard.tsx
git commit -m "feat(portal): TodayRoutineCard usa nuevo modelo por fecha"
```

---

### Task D2: Crear sección `/portal/rutinas`

**Files:**
- Create: `app/portal/rutinas/page.tsx`
- Create: `components/section-components/portal/rutinas/index.ts`
- Create: `components/section-components/portal/rutinas/PortalRutinasMainComponent.tsx`
- Create: `components/section-components/portal/rutinas/RutinaCalendar.tsx`
- Create: `components/section-components/portal/rutinas/RutinaViewer.tsx`

- [ ] **D2.1: `app/portal/rutinas/page.tsx`**

```tsx
import PortalRutinasMainComponent from "@/components/section-components/portal/rutinas/PortalRutinasMainComponent"

export default function PortalRutinasPage() {
  return <PortalRutinasMainComponent />
}
```

- [ ] **D2.2: `components/section-components/portal/rutinas/index.ts`**

```ts
export { default } from "./PortalRutinasMainComponent"
```

- [ ] **D2.3: `RutinaViewer.tsx`**

```tsx
"use client"

import ReactMarkdown from "react-markdown"
import remarkGfm from "remark-gfm"
import { format, parseISO } from "date-fns"
import { es } from "date-fns/locale"
import { Skeleton } from "@/components/ui/skeleton"
import { Badge } from "@/components/ui/badge"
import type { RoutineSchedule } from "@/lib/actions/routines"

interface Props {
  date: string
  routine: RoutineSchedule | null
  isLoading: boolean
}

export function RutinaViewer({ date, routine, isLoading }: Props) {
  const label = (() => {
    const l = format(parseISO(date + "T00:00:00"), "EEEE, d 'de' MMMM 'de' yyyy", { locale: es })
    return l.charAt(0).toUpperCase() + l.slice(1)
  })()

  return (
    <div className="rounded-xl border bg-card p-4 sm:p-6 space-y-4 min-h-[24rem]">
      <div>
        <p className="text-xs uppercase tracking-wide text-muted-foreground">Rutina del día</p>
        <h2 className="text-xl font-semibold mt-1">{label}</h2>
      </div>

      {isLoading ? (
        <div className="space-y-2">
          <Skeleton className="h-6 w-48" />
          <Skeleton className="h-4 w-full" />
          <Skeleton className="h-4 w-3/4" />
          <Skeleton className="h-4 w-5/6" />
        </div>
      ) : routine ? (
        <div className="space-y-3">
          {routine.name && (
            <div className="flex items-center gap-2 flex-wrap">
              <Badge variant="secondary">{routine.name}</Badge>
            </div>
          )}
          <article className="prose prose-invert prose-sm sm:prose-base max-w-none">
            <ReactMarkdown remarkPlugins={[remarkGfm]}>{routine.content}</ReactMarkdown>
          </article>
        </div>
      ) : (
        <div className="rounded-lg border border-dashed p-6 text-center">
          <p className="text-sm text-muted-foreground">No hay rutina programada para esta fecha.</p>
        </div>
      )}
    </div>
  )
}
```

- [ ] **D2.4: `RutinaCalendar.tsx`**

```tsx
"use client"

import { useMemo } from "react"
import { format, parseISO } from "date-fns"
import { es } from "date-fns/locale"
import { Calendar } from "@/components/ui/calendar"

interface Props {
  selectedDate: string
  onSelectDate: (date: string) => void
  routineDates: string[]
  onMonthChange?: (month: Date) => void
}

export function RutinaCalendar({ selectedDate, onSelectDate, routineDates, onMonthChange }: Props) {
  const selected = useMemo(() => parseISO(selectedDate + "T00:00:00"), [selectedDate])
  const markers = useMemo(
    () => routineDates.map((d) => parseISO(d + "T00:00:00")),
    [routineDates],
  )

  return (
    <div className="rounded-xl border bg-card p-3">
      <Calendar
        mode="single"
        locale={es}
        selected={selected}
        onSelect={(d) => {
          if (!d) return
          onSelectDate(format(d, "yyyy-MM-dd"))
        }}
        onMonthChange={onMonthChange}
        modifiers={{ hasRoutine: markers }}
        modifiersClassNames={{
          hasRoutine: "relative after:content-[''] after:absolute after:bottom-1 after:left-1/2 after:-translate-x-1/2 after:h-1 after:w-1 after:rounded-full after:bg-primary",
        }}
      />
    </div>
  )
}
```

- [ ] **D2.5: `PortalRutinasMainComponent.tsx`**

```tsx
"use client"

import { useMemo, useState } from "react"
import { useQuery } from "@tanstack/react-query"
import { startOfMonth, endOfMonth, addMonths, subMonths, format } from "date-fns"
import { getMemberRoutineDatesInRange, getRoutineForMemberOnDate } from "@/lib/actions/routines"
import { RutinaCalendar } from "./RutinaCalendar"
import { RutinaViewer } from "./RutinaViewer"

function todayCaracasISO(): string {
  const fmt = new Intl.DateTimeFormat("en-CA", {
    timeZone: "America/Caracas",
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
  })
  return fmt.format(new Date())
}

export default function PortalRutinasMainComponent() {
  const [selectedDate, setSelectedDate] = useState<string>(todayCaracasISO())
  const [visibleMonth, setVisibleMonth] = useState<Date>(new Date())

  const range = useMemo(() => {
    const from = format(startOfMonth(subMonths(visibleMonth, 1)), "yyyy-MM-dd")
    const to = format(endOfMonth(addMonths(visibleMonth, 1)), "yyyy-MM-dd")
    return { from, to }
  }, [visibleMonth])

  const { data: routineDates = [] } = useQuery({
    queryKey: ["member-routine-dates", range],
    queryFn: () => getMemberRoutineDatesInRange(range.from, range.to),
  })

  const { data: routine, isLoading } = useQuery({
    queryKey: ["member-routine", selectedDate],
    queryFn: () => getRoutineForMemberOnDate(selectedDate),
  })

  return (
    <div className="space-y-4">
      <div>
        <h1 className="text-2xl font-bold tracking-tight">Mis rutinas</h1>
        <p className="text-sm text-muted-foreground mt-1">
          Selecciona una fecha para ver la rutina programada.
        </p>
      </div>

      <div className="grid gap-4 md:grid-cols-[360px_1fr]">
        <RutinaCalendar
          selectedDate={selectedDate}
          onSelectDate={setSelectedDate}
          routineDates={routineDates}
          onMonthChange={setVisibleMonth}
        />
        <RutinaViewer date={selectedDate} routine={routine ?? null} isLoading={isLoading} />
      </div>
    </div>
  )
}
```

- [ ] **D2.6: Type check + lint**

```bash
npx tsc --noEmit && npm run lint
```

- [ ] **D2.7: Commit**

```bash
git add app/portal/rutinas components/section-components/portal/rutinas
git commit -m "feat(portal): seccion rutinas con calendario y viewer"
```

---

### Task D3: Añadir item "Rutinas" al sidebar del portal

**Files:**
- Modify: `app/portal/layout.tsx`

- [ ] **D3.1: Editar el array `nav`**

Reemplazar el array `nav` (línea ~14) para añadir `Rutinas` entre `Inicio` y `Descubrir`. También añadir el import del icono.

```tsx
// Antes (imports):
import { Home, Calendar, CreditCard, User, LogOut, Menu, X, Compass, Flame } from "lucide-react"

// Después (imports):
import { Home, Calendar, CalendarDays, CreditCard, User, LogOut, Menu, X, Compass, Flame } from "lucide-react"
```

```tsx
// Antes (nav array):
const nav = [
  { name: "Inicio", href: "/portal", icon: Home },
  { name: "Descubrir", href: "/portal/descubrir", icon: Compass },
  { name: "WOD", href: "/portal/wod", icon: Flame },
  { name: "Clases", href: "/portal/clases", icon: Calendar },
  { name: "Pagos", href: "/portal/pagos", icon: CreditCard },
  { name: "Perfil", href: "/portal/perfil", icon: User },
]

// Después:
const nav = [
  { name: "Inicio", href: "/portal", icon: Home },
  { name: "Rutinas", href: "/portal/rutinas", icon: CalendarDays },
  { name: "Descubrir", href: "/portal/descubrir", icon: Compass },
  { name: "WOD", href: "/portal/wod", icon: Flame },
  { name: "Clases", href: "/portal/clases", icon: Calendar },
  { name: "Pagos", href: "/portal/pagos", icon: CreditCard },
  { name: "Perfil", href: "/portal/perfil", icon: User },
]
```

- [ ] **D3.2: Type check**

```bash
npx tsc --noEmit
```

- [ ] **D3.3: Commit**

```bash
git add app/portal/layout.tsx
git commit -m "feat(portal): item Rutinas en navegacion"
```

---

### Task D4: Marcar `/portal/wod` como en construcción

**Files:**
- Modify: `components/section-components/portal/wod/PortalWodMainComponent.tsx`

- [ ] **D4.1: Inspeccionar y reemplazar el componente con un placeholder**

Reemplazar todo el contenido del componente con:

```tsx
"use client"

import { Construction } from "lucide-react"

export default function PortalWodMainComponent() {
  return (
    <div className="space-y-4">
      <div>
        <h1 className="text-2xl font-bold tracking-tight">WOD</h1>
        <p className="text-sm text-muted-foreground mt-1">
          Registro de WODs y leaderboard.
        </p>
      </div>
      <div className="rounded-xl border border-dashed p-10 text-center space-y-3">
        <Construction className="h-10 w-10 mx-auto text-muted-foreground" />
        <div className="space-y-1">
          <p className="text-sm font-medium">Sección en construcción</p>
          <p className="text-xs text-muted-foreground">
            Estamos migrando el modelo de rutinas. El registro de WODs volverá pronto.
          </p>
        </div>
      </div>
    </div>
  )
}
```

> **Nota:** El nombre real del export y la firma deben coincidir con el archivo original. Si el archivo actual usa `export function` o `export default`, ajustar acordemente. Verificar abriendo el archivo antes de reemplazar.

- [ ] **D4.2: Verificar que `app/portal/wod/page.tsx` siga importando correctamente**

```bash
# Read tool
```

Si el import del componente cambió de nombre por accidente, ajustar.

- [ ] **D4.3: Type check + lint**

```bash
npx tsc --noEmit && npm run lint
```

- [ ] **D4.4: Commit**

```bash
git add components/section-components/portal/wod/PortalWodMainComponent.tsx
git commit -m "chore(portal): marcar /portal/wod como en construccion"
```

---

## Fase E — Limpieza, navegación, redirects y docs

### Task E1: Eliminar la sección admin antigua `/dashboard/horarios`

**Files:**
- Delete: `app/dashboard/horarios/`
- Delete: `components/section-components/horarios/`
- Note: existe también `app/dashboard/clases/` y `app/dashboard/classes/` — **NO tocar**, son otra sección.

- [ ] **E1.1: Eliminar carpetas**

```bash
rm -rf app/dashboard/horarios components/section-components/horarios
```

- [ ] **E1.2: Type check**

```bash
npx tsc --noEmit
```

Esperado: no debería quedar ningún error referenciando `horarios`. Si los hay, identificar el archivo y removerlo.

- [ ] **E1.3: Commit**

```bash
git add -A
git commit -m "chore(rutinas): eliminar seccion horarios antigua"
```

---

### Task E2: Actualizar sidebar del admin (`dashboard-layout.tsx`)

**Files:**
- Modify: `components/shared/dashboard-layout.tsx`

- [ ] **E2.1: Cambiar el item de navegación**

Línea ~30 del archivo. Editar:

```tsx
// Antes:
{ name: "Horarios", href: "/dashboard/horarios", icon: CalendarClock, permissions: ["schedule.view"] },

// Después:
{ name: "Rutinas", href: "/dashboard/rutinas", icon: CalendarClock, permissions: ["routines.view"] },
```

(El icono `CalendarClock` se mantiene para no tocar imports. Si prefieres uno distinto, `CalendarDays` también está disponible.)

- [ ] **E2.2: Type check**

```bash
npx tsc --noEmit
```

- [ ] **E2.3: Commit**

```bash
git add components/shared/dashboard-layout.tsx
git commit -m "feat(rutinas): renombrar item de sidebar admin a Rutinas"
```

---

### Task E3: Actualizar lista de permisos en `RolesMainComponent.tsx`

**Files:**
- Modify: `components/section-components/roles/RolesMainComponent.tsx`

- [ ] **E3.1: Renombrar las tres entradas**

Líneas 75-77. Editar:

```tsx
// Antes:
{ id: "schedule.view", label: "Ver horarios y rutinas", description: "Ver la sección Horarios y Rutinas" },
{ id: "schedule.edit", label: "Editar horarios y rutinas", description: "Editar horarios del gym, rutinas y asignaciones" },
{ id: "schedule.delete", label: "Eliminar rutinas", description: "Borrar rutinas y desasignar" },

// Después:
{ id: "routines.view", label: "Ver rutinas", description: "Ver la sección Rutinas" },
{ id: "routines.edit", label: "Crear y editar rutinas", description: "Programar rutinas por fecha y plan" },
{ id: "routines.delete", label: "Eliminar rutinas", description: "Borrar rutinas programadas" },
```

- [ ] **E3.2: Type check**

```bash
npx tsc --noEmit
```

- [ ] **E3.3: Commit**

```bash
git add components/section-components/roles/RolesMainComponent.tsx
git commit -m "feat(roles): renombrar permisos schedule a routines"
```

---

### Task E4: Redirect `/dashboard/horarios` → `/dashboard/rutinas`

**Files:**
- Modify: `next.config.ts`

- [ ] **E4.1: Reemplazar contenido**

```ts
import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  async redirects() {
    return [
      {
        source: "/dashboard/horarios",
        destination: "/dashboard/rutinas",
        permanent: true,
      },
    ];
  },
};

export default nextConfig;
```

- [ ] **E4.2: Verificar que el dev server arranca sin errores**

```bash
npm run dev
```

Levanta el server, espera el "Ready", y matas el proceso (Ctrl+C). Solo verificación de arranque.

- [ ] **E4.3: Commit**

```bash
git add next.config.ts
git commit -m "chore(rutinas): redirect 308 de /dashboard/horarios a /dashboard/rutinas"
```

---

### Task E5: Actualizar `CLAUDE.md`

**Files:**
- Modify: `CLAUDE.md`

- [ ] **E5.1: Modificar la lista de permisos**

En la sección "Permisos" (alrededor de líneas que listan los permisos disponibles), reemplazar:

```
schedule.{view,edit,delete}
```

por:

```
routines.{view,edit,delete}
```

- [ ] **E5.2: Modificar la sección "Modelo de datos"**

Quitar las filas:
- `gym_schedule | Horarios por day_of_week`
- (cualquier mención a `routines` y `routine_assignments` que aparezca)

Añadir:
- `routine_schedules` | Una rutina por fecha (markdown). FK a `plans` vía `routine_schedule_plans` |
- `routine_schedule_plans` | Tabla puente: una rutina puede aplicar a varios planes |

- [ ] **E5.3: Commit**

```bash
git add CLAUDE.md
git commit -m "docs(claude): actualizar permisos y modelo de rutinas"
```

---

## Fase F — Verificación final

### Task F1: Build + lint completo

- [ ] **F1.1: Ejecutar build**

```bash
npm run build
```

Esperado: build exitoso sin errores. Si fallara por restos del modelo viejo, identificar el archivo y arreglar la referencia.

- [ ] **F1.2: Ejecutar lint**

```bash
npm run lint
```

Esperado: lint clean. Warnings menores son aceptables si son consistentes con el resto del proyecto.

---

### Task F2: Pruebas manuales en navegador

Levantar `npm run dev` y verificar el flujo end-to-end. Marcar cada caso conforme se valida:

- [ ] **F2.1: Admin crea rutina con fecha hoy y 1 plan**

Iniciar sesión como admin. Ir a `/dashboard/rutinas`. Click "Crear rutina". Paso 1: seleccionar fecha de hoy. Paso 2: marcar 1 plan. Paso 3: escribir nombre y contenido markdown. Crear.

Esperado:
- Toast "Rutina programada".
- La rutina aparece en la lista, agrupada bajo "Hoy".

- [ ] **F2.2: Admin crea rutina futura para 3 planes**

Repetir flujo con fecha +5 días y 3 planes seleccionados.

Esperado: rutina aparece bajo el día correcto con 3 chips de planes.

- [ ] **F2.3: Admin intenta segunda rutina mismo día con plan ya ocupado**

Crear otra rutina para hoy con un plan que ya tenga rutina (la del paso F2.1).

Esperado: en paso 2, alerta "Conflicto detectado", botones "Reemplazar y continuar" / "Cambiar selección". Probar "Reemplazar" → completa flujo, la rutina vieja del plan ese día desaparece.

- [ ] **F2.4: Editar rutina existente**

Click en lápiz de una rutina. Cambiar nombre y agregar un plan. Guardar.

Esperado: cambios reflejados, sin errores.

- [ ] **F2.5: Eliminar rutina**

Click en papelera. Confirmar SweetAlert.

Esperado: toast "Rutina eliminada", desaparece de la lista.

- [ ] **F2.6: Crear rutina con fecha pasada bloqueado**

En paso 1, intentar seleccionar fecha del día anterior.

Esperado: la fecha está deshabilitada en el calendario, no se puede seleccionar.

- [ ] **F2.7: Portal del miembro — vista de hoy**

Iniciar sesión como miembro de un plan que tenga rutina hoy. Ir a `/portal`.

Esperado: `TodayRoutineCard` muestra la rutina con markdown renderizado.

- [ ] **F2.8: Portal del miembro — calendario**

Ir a `/portal/rutinas`.

Esperado: calendario muestra puntos en fechas con rutina del plan del miembro. Click en una fecha → viewer muestra contenido. Click en fecha sin rutina → viewer muestra estado vacío.

- [ ] **F2.9: Permisos**

Iniciar sesión como rol con solo `routines.view`. Ir a `/dashboard/rutinas`.

Esperado: ve la lista pero no aparece el botón "Crear rutina" ni los botones de editar/eliminar en cada tarjeta.

- [ ] **F2.10: `/portal/wod` no rompe**

Ir a `/portal/wod` como miembro.

Esperado: muestra placeholder "Sección en construcción".

- [ ] **F2.11: Redirect funciona**

Navegar manualmente a `/dashboard/horarios` (URL vieja).

Esperado: redirect 308 a `/dashboard/rutinas`.

---

### Task F3: Push (opcional, solo si el usuario lo pide)

- [ ] **F3.1: Push del branch al remoto**

> No ejecutar sin confirmación explícita del usuario.

```bash
git push origin main
```

---

## Resumen de commits esperados

Al completar el plan deberías tener aproximadamente esta secuencia:

1. `feat(migracion): tablas routine_schedules y routine_schedule_plans, drop gym_schedule`
2. `chore(types): regenerar types/database.ts tras migracion de rutinas`
3. `feat(rutinas): server actions para planificacion por fecha`
4. `chore(activity): actualizar entityType union para rutinas`
5. `chore(settings): remover acciones de gym_schedule`
6. `feat(wod): deshabilitar registro de WOD durante migracion de rutinas`
7. `feat(rutinas): tarjeta, agrupador, lista y modal de preview`
8. `feat(rutinas): wizard modal de 3 pasos para crear y editar rutinas`
9. `feat(rutinas): pagina principal y main component admin`
10. `feat(portal): TodayRoutineCard usa nuevo modelo por fecha`
11. `feat(portal): seccion rutinas con calendario y viewer`
12. `feat(portal): item Rutinas en navegacion`
13. `chore(portal): marcar /portal/wod como en construccion`
14. `chore(rutinas): eliminar seccion horarios antigua`
15. `feat(rutinas): renombrar item de sidebar admin a Rutinas`
16. `feat(roles): renombrar permisos schedule a routines`
17. `chore(rutinas): redirect 308 de /dashboard/horarios a /dashboard/rutinas`
18. `docs(claude): actualizar permisos y modelo de rutinas`
