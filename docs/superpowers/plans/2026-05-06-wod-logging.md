# WOD Logging dinámico — Plan de implementación

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Habilitar el registro dinámico de WODs sobre el modelo `routine_schedules`. El admin define rutinas con bloques estructurados (warmup, strength, AMRAP, EMOM, RFT, etc.) en el wizard. El miembro registra su score por bloque registrable y ve un Top 10 segmentado por plan + género.

**Architecture:**
- Postgres: nueva columna `routine_schedules.blocks JSONB` y `wod_logs.block_id TEXT` con unique constraint `(member_id, routine_id, block_id)`. Sin tablas nuevas.
- Validación: Zod discriminated union espejo de las interfaces de `lib/constants/routine-blocks.ts`. Sirve a server actions y al wizard.
- Server actions: extender `lib/actions/routines.ts` para persistir bloques y reescribir `lib/actions/wod-logs.ts` (hoy stubbed) con CRUD del miembro + leaderboard.
- UI admin: paso 3 del wizard se reescribe como block builder dinámico (10 sub-editores por tipo).
- UI portal: `/portal/wod` se rehace con cards por bloque registrable, mini-leaderboard inline y sheet con Top 10.

**Tech Stack:** Next.js 16 + React 19 + TypeScript 5, Supabase (`@supabase/ssr`), TanStack Query 5, shadcn/ui (Radix), React Hook Form 7 + Zod 3, `sonner`, `lucide-react`, `date-fns`.

**Pre-requisitos antes de empezar:**
- Working tree limpio (commit/stash de cualquier cambio pendiente).
- Acceso al proyecto Supabase vía MCP `mcp__supabase__*` para aplicar migración y regenerar types.
- Servidor de desarrollo local funcional (`npm run dev`).
- Spec de referencia: `docs/superpowers/specs/2026-05-06-wod-logging-design.md`.

**Convenciones del proyecto:**
- No hay tests automatizados. Verificación de cada tarea = type check (`npx tsc --noEmit`) + lint (`npm run lint`) + verificación manual con `npm run dev` cuando toca UI/server action.
- Idioma de UI/comentarios/commits: español.
- Server actions mutativas llaman `revalidatePath` y `logActivity` cuando aplique.
- Estilos: dark mode fijo, paleta amarillo/dorado; iconos `lucide-react`; toasts `sonner`.
- Imports con alias `@/*`. Evitar `any`.

---

## Fase A — Base de datos, validación y types

### Task A1: Migración SQL — bloques y block_id

**Files:**
- Create: `supabase/migrations/20260506120000_wod_logging_blocks.sql`

> **Nota sobre el timestamp:** si en `supabase/migrations/` ya existe una con prefijo posterior a `20260506120000`, usar la hora actual UTC en formato `YYYYMMDDHHmmss` para que ordene cronológicamente.

- [ ] **A1.1: Crear el archivo con el SQL completo**

```sql
-- WOD logging dinámico: bloques estructurados en routine_schedules
-- y block_id en wod_logs para soportar múltiples scores por rutina.

-- 1. Bloques estructurados en routine_schedules
ALTER TABLE routine_schedules
  ADD COLUMN blocks jsonb NOT NULL DEFAULT '[]'::jsonb;

-- 2. block_id en wod_logs
ALTER TABLE wod_logs
  ADD COLUMN block_id text NOT NULL DEFAULT '';

-- 3. Reemplazar la unicidad (member, routine, date) por (member, routine, block)
ALTER TABLE wod_logs
  DROP CONSTRAINT IF EXISTS wod_logs_member_id_routine_id_date_key;
ALTER TABLE wod_logs
  DROP CONSTRAINT IF EXISTS wod_logs_member_routine_date_key;

ALTER TABLE wod_logs
  ADD CONSTRAINT wod_logs_member_routine_block_key
  UNIQUE (member_id, routine_id, block_id);

-- 4. Índice de soporte para leaderboard
CREATE INDEX IF NOT EXISTS idx_wod_logs_routine_block
  ON wod_logs(routine_id, block_id);
```

- [ ] **A1.2: Aplicar la migración vía MCP**

Llamar `mcp__supabase__apply_migration` con:
- `name: "wod_logging_blocks"`
- `query`: el contenido SQL completo del archivo creado.

Verificar que el resultado no contenga errores. Si falla por una constraint con nombre distinto, ejecutar primero `mcp__supabase__execute_sql` con `SELECT conname FROM pg_constraint WHERE conrelid = 'wod_logs'::regclass;` para ver el nombre real y ajustar el `DROP CONSTRAINT IF EXISTS`.

- [ ] **A1.3: Verificar la migración en la DB**

Llamar `mcp__supabase__execute_sql` con:

```sql
SELECT column_name, data_type, is_nullable, column_default
FROM information_schema.columns
WHERE table_name IN ('routine_schedules', 'wod_logs')
  AND column_name IN ('blocks', 'block_id')
ORDER BY table_name, column_name;
```

Esperado: 2 filas. `routine_schedules.blocks jsonb NOT NULL DEFAULT '[]'::jsonb` y `wod_logs.block_id text NOT NULL DEFAULT ''`.

- [ ] **A1.4: Commit**

```bash
git add supabase/migrations/20260506120000_wod_logging_blocks.sql
git commit -m "feat(wod): migración blocks JSONB y block_id en wod_logs"
```

---

### Task A2: Regenerar types/database.ts

**Files:**
- Modify: `types/database.ts` (regenerado entero por la herramienta)

- [ ] **A2.1: Llamar `mcp__supabase__generate_typescript_types`**

Tomar la salida y sobrescribir el contenido de `types/database.ts`.

- [ ] **A2.2: Verificar campos clave**

Confirmar con grep que el archivo nuevo contiene:

```
Grep "blocks: Json" types/database.ts → debe matchear en routine_schedules
Grep "block_id: string" types/database.ts → debe matchear en wod_logs
```

- [ ] **A2.3: Type-check**

```bash
npx tsc --noEmit
```

Es esperable que falle en `lib/actions/routines.ts` y/o `wod-logs.ts` por el campo `blocks` no manejado todavía. Los errores que importan en este punto son los de `types/database.ts` mismo (no debe haber). Anotar los errores en server actions para resolverlos en Tasks B, C.

- [ ] **A2.4: Commit**

```bash
git add types/database.ts
git commit -m "chore(types): regenerar database.ts con blocks y block_id"
```

---

### Task A3: Schema Zod de routine blocks

**Files:**
- Create: `lib/schemas/routine-blocks.ts`

- [ ] **A3.1: Crear el archivo con el discriminated union**

```ts
import { z } from "zod"

const baseBlock = z.object({
  id: z.string().min(1),
  order: z.number().int().min(0),
})

const movementsArray = z
  .array(z.string().min(1, "Cada movimiento debe tener texto"))
  .min(1, "Debe haber al menos un movimiento")

export const warmupBlockSchema = baseBlock.extend({
  type: z.literal("warmup"),
  text: z.string(),
})

export const cooldownBlockSchema = baseBlock.extend({
  type: z.literal("cooldown"),
  text: z.string(),
})

export const notesBlockSchema = baseBlock.extend({
  type: z.literal("notes"),
  text: z.string(),
})

export const strengthBlockSchema = baseBlock.extend({
  type: z.literal("strength"),
  exercise: z.string().min(1, "Ejercicio requerido"),
  sets: z.number().int().min(1).max(20),
  reps: z.string().min(1, "Reps requeridas"),
  weight: z.string().optional(),
  notes: z.string().optional(),
})

export const skillBlockSchema = baseBlock.extend({
  type: z.literal("skill"),
  exercises: z.array(z.string().min(1)).min(1, "Al menos un ejercicio"),
  notes: z.string().optional(),
})

export const amrapBlockSchema = baseBlock.extend({
  type: z.literal("amrap"),
  minutes: z.number().int().min(1).max(120),
  movements: movementsArray,
})

export const emomBlockSchema = baseBlock.extend({
  type: z.literal("emom"),
  minutes: z.number().int().min(1).max(120),
  movements: movementsArray,
  alternating: z.boolean(),
})

export const forTimeBlockSchema = baseBlock.extend({
  type: z.literal("for_time"),
  movements: movementsArray,
  time_cap_min: z.number().int().min(1).max(120).optional(),
})

export const forRepsBlockSchema = baseBlock.extend({
  type: z.literal("for_reps"),
  target_reps: z.number().int().min(1).max(99999),
  movements: movementsArray,
})

export const rftBlockSchema = baseBlock.extend({
  type: z.literal("rft"),
  rounds: z.number().int().min(1).max(50),
  movements: movementsArray,
})

export const routineBlockSchema = z.discriminatedUnion("type", [
  warmupBlockSchema,
  cooldownBlockSchema,
  notesBlockSchema,
  strengthBlockSchema,
  skillBlockSchema,
  amrapBlockSchema,
  emomBlockSchema,
  forTimeBlockSchema,
  forRepsBlockSchema,
  rftBlockSchema,
])

export const routineBlocksSchema = z
  .array(routineBlockSchema)
  .min(1, "La rutina debe tener al menos un bloque")
```

- [ ] **A3.2: Type-check**

```bash
npx tsc --noEmit
```

Esperado: el archivo no introduce nuevos errores.

- [ ] **A3.3: Commit**

```bash
git add lib/schemas/routine-blocks.ts
git commit -m "feat(rutinas): schema Zod para validar blocks de rutina"
```

---

## Fase B — Server actions: routines.ts

### Task B1: Extender RoutineSchedule e interfaces de input

**Files:**
- Modify: `lib/actions/routines.ts:11-35`

- [ ] **B1.1: Reemplazar las interfaces al tope del archivo**

Localizar el bloque que inicia con `// ─── Tipos ───` (alrededor de línea 9) y reemplazar las 3 interfaces por:

```ts
import type { RoutineBlock } from "@/lib/constants/routine-blocks"
import { parseBlocks } from "@/lib/constants/routine-blocks"
import { routineBlocksSchema } from "@/lib/schemas/routine-blocks"

export interface RoutineSchedule {
  id: string
  date: string // YYYY-MM-DD
  name: string | null
  content: string
  blocks: RoutineBlock[]
  created_at: string | null
  updated_at: string | null
  plans: Array<{ id: string; name: string }>
}

export interface CreateRoutineScheduleInput {
  date: string
  name?: string | null
  content?: string
  blocks: RoutineBlock[]
  plan_ids: string[]
  replace_conflicts?: boolean
}

export interface UpdateRoutineScheduleInput {
  date?: string
  name?: string | null
  content?: string
  blocks?: RoutineBlock[]
  plan_ids?: string[]
  replace_conflicts?: boolean
}
```

> El import de `parseBlocks` y `routineBlocksSchema` se usa en B2/B3.

- [ ] **B1.2: Type-check**

```bash
npx tsc --noEmit
```

Esperable: errores en `shapeRoutineSchedule`, `createRoutineSchedule`, `updateRoutineSchedule` porque el campo `blocks` no se setea aún. Se resuelven en B2/B3.

- [ ] **B1.3: No commitear todavía** — se commitea con B2 (cambios cohesivos).

---

### Task B2: Mapear blocks en lectura (shapeRoutineSchedule + select)

**Files:**
- Modify: `lib/actions/routines.ts:68-104` (shapeRoutineSchedule, getRoutineSchedules, getRoutineSchedule, getRoutineForMemberOnDate)

- [ ] **B2.1: Actualizar `shapeRoutineSchedule`**

Reemplazar la función completa:

```ts
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
    blocks: parseBlocks(row.blocks),
    created_at: row.created_at ?? null,
    updated_at: row.updated_at ?? null,
    plans: plansArr,
  }
}
```

- [ ] **B2.2: Agregar `blocks` al SELECT en las 3 queries de lectura**

Buscar las 3 ocurrencias del select (en `getRoutineSchedules`, `getRoutineSchedule`, `getRoutineForMemberOnDate`) y agregar `blocks` después de `content`. Ejemplo del primer cambio:

```ts
// antes
.select(
  "id, date, name, content, created_at, updated_at, routine_schedule_plans(plan_id, plans(id, name))",
)
// después
.select(
  "id, date, name, content, blocks, created_at, updated_at, routine_schedule_plans(plan_id, plans(id, name))",
)
```

Repetir el mismo cambio en `getRoutineSchedule` y `getRoutineForMemberOnDate`. En `getRoutineForMemberOnDate` el select está anidado dentro de `routine_schedule_plans!inner(...)` — agregar `blocks` allí también.

- [ ] **B2.3: Type-check**

```bash
npx tsc --noEmit
```

Errores remanentes esperados en las funciones de escritura — se resuelven en B3.

- [ ] **B2.4: No commitear todavía**

---

### Task B3: Validar y persistir blocks en create/update

**Files:**
- Modify: `lib/actions/routines.ts:133-300` (createRoutineSchedule, updateRoutineSchedule)

- [ ] **B3.1: Reemplazar `createRoutineSchedule` por la versión con blocks**

Localizar la función actual y sustituirla:

```ts
export async function createRoutineSchedule(
  input: CreateRoutineScheduleInput,
): Promise<RoutineSchedule> {
  if (!(await checkPermission("routines.edit"))) {
    throw new Error("No tienes permisos para programar rutinas")
  }

  if (!input.plan_ids?.length) {
    throw new Error("Selecciona al menos un plan")
  }

  // Validar blocks con Zod
  const parsedBlocks = routineBlocksSchema.safeParse(input.blocks)
  if (!parsedBlocks.success) {
    throw new Error(parsedBlocks.error.issues[0]?.message ?? "Bloques inválidos")
  }
  const blocks = parsedBlocks.data

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
      content: input.content ?? "",
      blocks: blocks as any,
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
  revalidatePath("/portal/wod")

  const final = await getRoutineSchedule(inserted.id)
  if (!final) throw new Error("Error al recuperar rutina creada")
  return final
}
```

> **Nota sobre `blocks: blocks as any`:** el tipo `Json` de Supabase no acepta directamente `RoutineBlock[]`; el cast es necesario y seguro porque ya validamos con Zod.

- [ ] **B3.2: Reemplazar `updateRoutineSchedule`**

```ts
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

  if (newPlanIds.length === 0) {
    throw new Error("Selecciona al menos un plan")
  }

  let validatedBlocks: typeof current.blocks | undefined
  if (input.blocks !== undefined) {
    const parsed = routineBlocksSchema.safeParse(input.blocks)
    if (!parsed.success) {
      throw new Error(parsed.error.issues[0]?.message ?? "Bloques inválidos")
    }
    validatedBlocks = parsed.data
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
  if (validatedBlocks !== undefined) updatePayload.blocks = validatedBlocks

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
  revalidatePath("/portal/wod")

  const final = await getRoutineSchedule(id)
  if (!final) throw new Error("Error al recuperar rutina actualizada")
  return final
}
```

- [ ] **B3.3: Type-check**

```bash
npx tsc --noEmit
```

Esperado: 0 errores en `lib/actions/routines.ts`. Pueden quedar en `wod-logs.ts` y en consumidores que se resuelven en fases siguientes.

- [ ] **B3.4: Commit**

```bash
git add lib/actions/routines.ts lib/schemas/routine-blocks.ts
git commit -m "feat(rutinas): persistir blocks JSONB validados con Zod en server actions"
```

---

## Fase C — Server actions: wod-logs.ts

### Task C1: Reescribir tipos y helpers compartidos

**Files:**
- Modify: `lib/actions/wod-logs.ts` (todo el archivo, hoy stubbed)

- [ ] **C1.1: Reemplazar el archivo completo con tipos + helpers**

```ts
"use server"

import { createClient } from "@/utils/supabase/server"
import { createAdminClient } from "@/utils/supabase/admin"
import { revalidatePath } from "next/cache"
import { logActivity } from "./activity"
import {
  type ScoreType,
  compareScores,
  todayCaracasISO,
} from "@/lib/constants/wod-score"
import {
  parseBlocks,
  getScoreTypeForBlock,
  type RoutineBlock,
} from "@/lib/constants/routine-blocks"

// ─── Tipos públicos ──────────────────────────────────────────

export interface WodLog {
  id: string
  member_id: string
  routine_id: string
  block_id: string
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
  block_id: string
  score_type: ScoreType
  score_seconds?: number | null
  score_rounds?: number | null
  score_reps?: number | null
  score_kg?: number | null
  rx: boolean
  notes?: string | null
}

export interface RoutineForMemberToday {
  id: string
  date: string
  name: string | null
  content: string
  blocks: RoutineBlock[]
  plan_ids: string[]
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
  position: number
}

export interface WodLeaderboardResult {
  routine_id: string
  block_id: string
  gender: "male" | "female"
  entries: WodLeaderboardEntry[]
}

// ─── Helpers ─────────────────────────────────────────────────

async function getMyMemberRow(): Promise<{
  id: string
  plan_id: string | null
  gender: "male" | "female" | null
  show_wods: boolean
} | null> {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return null

  const { data, error } = await supabase
    .from("members")
    .select("id, plan_id, gender, show_wods")
    .eq("auth_user_id", user.id)
    .maybeSingle()

  if (error) throw error
  if (!data) return null
  return {
    id: data.id,
    plan_id: data.plan_id ?? null,
    gender: (data.gender as "male" | "female" | null) ?? null,
    show_wods: data.show_wods ?? true,
  }
}

function rowToWodLog(row: any): WodLog {
  return {
    id: row.id,
    member_id: row.member_id,
    routine_id: row.routine_id,
    block_id: row.block_id,
    date: row.date,
    score_type: row.score_type as ScoreType,
    score_seconds: row.score_seconds,
    score_rounds: row.score_rounds,
    score_reps: row.score_reps,
    score_kg: row.score_kg ? Number(row.score_kg) : null,
    rx: !!row.rx,
    notes: row.notes,
    created_at: row.created_at,
  }
}
```

- [ ] **C1.2: Type-check**

```bash
npx tsc --noEmit
```

Esperado: errores en consumidores existentes (`log-wod-modal.tsx`, etc.) que serán resueltos en Fase E. Sin errores nuevos en `wod-logs.ts`.

- [ ] **C1.3: No commitear todavía** — se commitea con C2/C3 juntos.

---

### Task C2: Lecturas (rutina hoy + logs propios)

**Files:**
- Modify: `lib/actions/wod-logs.ts` (continuar archivo)

- [ ] **C2.1: Agregar `getRoutineForToday` al final del archivo**

```ts
// ─── Lecturas ────────────────────────────────────────────────

export async function getRoutineForToday(): Promise<RoutineForMemberToday | null> {
  const me = await getMyMemberRow()
  if (!me?.plan_id) return null

  const supabase = await createClient()
  const today = todayCaracasISO()

  const { data, error } = await supabase
    .from("routine_schedule_plans")
    .select(
      "schedule_id, plan_id, routine_schedules!inner(id, date, name, content, blocks)",
    )
    .eq("plan_id", me.plan_id)
    .eq("routine_schedules.date", today)
    .maybeSingle()

  if (error) throw error
  if (!data?.routine_schedules) return null

  const rs = Array.isArray(data.routine_schedules)
    ? data.routine_schedules[0]
    : data.routine_schedules
  if (!rs) return null

  // Recuperar todos los plan_ids del schedule (para el leaderboard)
  const { data: allPlans, error: pErr } = await supabase
    .from("routine_schedule_plans")
    .select("plan_id")
    .eq("schedule_id", rs.id)
  if (pErr) throw pErr

  return {
    id: rs.id,
    date: rs.date,
    name: rs.name ?? null,
    content: rs.content ?? "",
    blocks: parseBlocks(rs.blocks),
    plan_ids: (allPlans ?? []).map((r) => r.plan_id),
  }
}

export async function getMyWodLogsForRoutine(routineId: string): Promise<WodLog[]> {
  const me = await getMyMemberRow()
  if (!me) return []

  const supabase = await createClient()
  const { data, error } = await supabase
    .from("wod_logs")
    .select("*")
    .eq("member_id", me.id)
    .eq("routine_id", routineId)

  if (error) throw error
  return (data ?? []).map(rowToWodLog)
}

export async function getMyWodHistory(limit = 50, offset = 0): Promise<WodLog[]> {
  const me = await getMyMemberRow()
  if (!me) return []

  const supabase = await createClient()
  const { data, error } = await supabase
    .from("wod_logs")
    .select("*")
    .eq("member_id", me.id)
    .order("date", { ascending: false })
    .range(offset, offset + limit - 1)

  if (error) throw error
  return (data ?? []).map(rowToWodLog)
}
```

- [ ] **C2.2: Type-check**

```bash
npx tsc --noEmit
```

- [ ] **C2.3: No commitear todavía**

---

### Task C3: Escrituras (upsert + delete)

**Files:**
- Modify: `lib/actions/wod-logs.ts` (continuar archivo)

- [ ] **C3.1: Agregar `upsertWodLog` y `deleteWodLog`**

```ts
// ─── Escrituras ──────────────────────────────────────────────

export async function upsertWodLog(input: UpsertWodLogInput): Promise<WodLog> {
  const me = await getMyMemberRow()
  if (!me) throw new Error("No autenticado")
  if (!me.plan_id) throw new Error("No tienes plan asignado")

  if (!input.routine_id || !input.block_id) {
    throw new Error("Datos de rutina/bloque incompletos")
  }
  if ((input.notes ?? "").length > 500) {
    throw new Error("Las notas no pueden exceder 500 caracteres")
  }

  const supabase = await createClient()

  // 1. Validar que el schedule existe, contiene el block y aplica al plan del miembro
  const { data: schedule, error: sErr } = await supabase
    .from("routine_schedules")
    .select("id, date, blocks, routine_schedule_plans(plan_id)")
    .eq("id", input.routine_id)
    .maybeSingle()
  if (sErr) throw sErr
  if (!schedule) throw new Error("Rutina no encontrada")

  const blocks = parseBlocks(schedule.blocks)
  const block = blocks.find((b) => b.id === input.block_id)
  if (!block) throw new Error("Bloque no encontrado en la rutina")

  const expectedScoreType = getScoreTypeForBlock(block)
  if (!expectedScoreType) {
    throw new Error("Este bloque no es registrable")
  }
  if (expectedScoreType !== input.score_type) {
    throw new Error("El tipo de score no corresponde al bloque")
  }

  const planIds = (schedule.routine_schedule_plans ?? []).map((r: any) => r.plan_id)
  if (!planIds.includes(me.plan_id)) {
    throw new Error("Esta rutina no aplica a tu plan")
  }

  // 2. Validar rangos por score_type
  const errs: string[] = []
  switch (input.score_type) {
    case "for_time":
      if (!input.score_seconds || input.score_seconds < 1 || input.score_seconds > 14400) {
        errs.push("Tiempo fuera de rango (1s – 4h)")
      }
      break
    case "amrap": {
      const r = input.score_rounds ?? 0
      const reps = input.score_reps ?? 0
      if (r < 0 || reps < 0 || r + reps === 0) errs.push("Rounds o reps inválidos")
      break
    }
    case "for_reps":
      if (!input.score_reps || input.score_reps < 1 || input.score_reps > 99999) {
        errs.push("Reps fuera de rango (1 – 99999)")
      }
      break
    case "weight": {
      const kg = input.score_kg ?? 0
      if (kg < 0.5 || kg > 500) errs.push("Peso fuera de rango (0.5 – 500 kg)")
      break
    }
  }
  if (errs.length > 0) throw new Error(errs[0])

  // 3. Upsert
  const payload = {
    member_id: me.id,
    routine_id: input.routine_id,
    block_id: input.block_id,
    date: schedule.date,
    score_type: input.score_type,
    score_seconds: input.score_type === "for_time" ? input.score_seconds ?? null : null,
    score_rounds: input.score_type === "amrap" ? input.score_rounds ?? null : null,
    score_reps:
      input.score_type === "amrap" || input.score_type === "for_reps"
        ? input.score_reps ?? null
        : null,
    score_kg: input.score_type === "weight" ? input.score_kg ?? null : null,
    rx: input.rx,
    notes: input.notes && input.notes.trim().length > 0 ? input.notes.trim() : null,
    updated_at: new Date().toISOString(),
  }

  const { data, error } = await supabase
    .from("wod_logs")
    .upsert(payload, { onConflict: "member_id,routine_id,block_id" })
    .select("*")
    .single()
  if (error) throw error

  await logActivity({
    action: "wod_logged",
    entityType: "wod_log",
    entityId: data.id,
    entityName: `${input.score_type} · ${schedule.date}`,
  })

  revalidatePath("/portal/wod")
  revalidatePath("/portal/rutinas")

  return rowToWodLog(data)
}

export async function deleteWodLog(id: string): Promise<void> {
  const me = await getMyMemberRow()
  if (!me) throw new Error("No autenticado")

  const supabase = await createClient()
  const { data: existing, error: gErr } = await supabase
    .from("wod_logs")
    .select("id, member_id, score_type, date")
    .eq("id", id)
    .maybeSingle()
  if (gErr) throw gErr
  if (!existing) return
  if (existing.member_id !== me.id) {
    throw new Error("No puedes borrar el log de otro miembro")
  }

  const { error } = await supabase.from("wod_logs").delete().eq("id", id)
  if (error) throw error

  await logActivity({
    action: "wod_log_deleted",
    entityType: "wod_log",
    entityId: existing.id,
    entityName: `${existing.score_type} · ${existing.date}`,
  })

  revalidatePath("/portal/wod")
  revalidatePath("/portal/rutinas")
}
```

- [ ] **C3.2: Type-check**

```bash
npx tsc --noEmit
```

- [ ] **C3.3: No commitear todavía**

---

### Task C4: Leaderboard

**Files:**
- Modify: `lib/actions/wod-logs.ts` (continuar archivo)

- [ ] **C4.1: Agregar `getLeaderboardForBlock`**

```ts
// ─── Leaderboard ─────────────────────────────────────────────

export async function getLeaderboardForBlock(input: {
  routine_id: string
  block_id: string
  gender: "male" | "female"
  limit?: number
}): Promise<WodLeaderboardResult> {
  const supabase = await createClient()
  const {
    data: { user },
  } = await supabase.auth.getUser()
  if (!user) throw new Error("No autenticado")

  const limit = input.limit ?? 10
  const admin = createAdminClient()

  // 1. Recuperar plan_ids del schedule
  const { data: planRows, error: pErr } = await admin
    .from("routine_schedule_plans")
    .select("plan_id")
    .eq("schedule_id", input.routine_id)
  if (pErr) throw pErr
  const planIds = (planRows ?? []).map((r) => r.plan_id)
  if (planIds.length === 0) {
    return {
      routine_id: input.routine_id,
      block_id: input.block_id,
      gender: input.gender,
      entries: [],
    }
  }

  // 2. Buscar miembros del plan + género + show_wods
  const { data: members, error: mErr } = await admin
    .from("members")
    .select("id, name, avatar_url, gender, show_wods, show_avatar, plan_id")
    .in("plan_id", planIds)
    .eq("gender", input.gender)
    .eq("show_wods", true)
  if (mErr) throw mErr
  if (!members || members.length === 0) {
    return {
      routine_id: input.routine_id,
      block_id: input.block_id,
      gender: input.gender,
      entries: [],
    }
  }

  const memberIds = members.map((m) => m.id)
  const memberMap = new Map(members.map((m) => [m.id, m]))

  // 3. Logs del bloque para esos miembros
  const { data: logs, error: lErr } = await admin
    .from("wod_logs")
    .select("*")
    .eq("routine_id", input.routine_id)
    .eq("block_id", input.block_id)
    .in("member_id", memberIds)
  if (lErr) throw lErr

  // 4. Ordenar reusando compareScores; tomar Top N
  const sorted = (logs ?? [])
    .map((row: any) => ({
      member_id: row.member_id,
      score_type: row.score_type as ScoreType,
      score_seconds: row.score_seconds,
      score_rounds: row.score_rounds,
      score_reps: row.score_reps,
      score_kg: row.score_kg ? Number(row.score_kg) : null,
      rx: !!row.rx,
    }))
    .sort((a, b) =>
      compareScores(
        {
          score_type: a.score_type,
          score_seconds: a.score_seconds,
          score_rounds: a.score_rounds,
          score_reps: a.score_reps,
          score_kg: a.score_kg,
        },
        {
          score_type: b.score_type,
          score_seconds: b.score_seconds,
          score_rounds: b.score_rounds,
          score_reps: b.score_reps,
          score_kg: b.score_kg,
        },
      ),
    )
    .slice(0, limit)

  const entries: WodLeaderboardEntry[] = sorted.map((s, i) => {
    const m = memberMap.get(s.member_id)
    return {
      member_id: s.member_id,
      name: m?.name ?? "—",
      avatar_url: m?.show_avatar ? m.avatar_url : null,
      score_type: s.score_type,
      score_seconds: s.score_seconds,
      score_rounds: s.score_rounds,
      score_reps: s.score_reps,
      score_kg: s.score_kg,
      rx: s.rx,
      position: i + 1,
    }
  })

  return {
    routine_id: input.routine_id,
    block_id: input.block_id,
    gender: input.gender,
    entries,
  }
}
```

- [ ] **C4.2: Type-check + lint**

```bash
npx tsc --noEmit
npm run lint
```

Esperado: 0 errores en `wod-logs.ts`. Pueden quedar errores en consumidores antiguos (`log-wod-modal.tsx`, `WodLeaderboard.tsx`, `WodHistoryList.tsx`, `WodLogRow.tsx`, `TodayWodHeader.tsx`) — se resuelven en Fase E.

- [ ] **C4.3: Commit**

```bash
git add lib/actions/wod-logs.ts
git commit -m "feat(wod): server actions de WOD logging y leaderboard sobre routine_schedules"
```

---

## Fase D — Wizard admin: block builder

### Task D1: Sub-editor texto simple (warmup, cooldown, notes)

**Files:**
- Create: `components/section-components/rutinas/blocks-editor/types/TextBlockEditor.tsx`

> Estos 3 tipos comparten un solo input: textarea. Un componente parametrizado evita duplicar código.

- [ ] **D1.1: Crear `TextBlockEditor.tsx`**

```tsx
"use client"

import { Textarea } from "@/components/ui/textarea"
import type {
  WarmupBlock,
  CooldownBlock,
  NotesBlock,
} from "@/lib/constants/routine-blocks"

type TextBlock = WarmupBlock | CooldownBlock | NotesBlock

interface Props {
  block: TextBlock
  placeholder: string
  onChange: (next: TextBlock) => void
}

export function TextBlockEditor({ block, placeholder, onChange }: Props) {
  return (
    <Textarea
      placeholder={placeholder}
      value={block.text}
      onChange={(e) => onChange({ ...block, text: e.target.value })}
      rows={3}
      className="font-mono text-sm"
    />
  )
}
```

- [ ] **D1.2: Type-check**

```bash
npx tsc --noEmit
```

- [ ] **D1.3: Commit**

```bash
git add components/section-components/rutinas/blocks-editor/types/TextBlockEditor.tsx
git commit -m "feat(rutinas): editor de bloques de texto (warmup/cooldown/notes)"
```

---

### Task D2: Sub-editor `StrengthBlockEditor`

**Files:**
- Create: `components/section-components/rutinas/blocks-editor/types/StrengthBlockEditor.tsx`

- [ ] **D2.1: Crear el archivo**

```tsx
"use client"

import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { Textarea } from "@/components/ui/textarea"
import type { StrengthBlock } from "@/lib/constants/routine-blocks"

interface Props {
  block: StrengthBlock
  onChange: (next: StrengthBlock) => void
}

export function StrengthBlockEditor({ block, onChange }: Props) {
  return (
    <div className="space-y-2">
      <div className="grid grid-cols-2 gap-2">
        <div className="col-span-2 space-y-1">
          <Label className="text-xs">Ejercicio</Label>
          <Input
            placeholder="Back Squat"
            value={block.exercise}
            onChange={(e) => onChange({ ...block, exercise: e.target.value })}
          />
        </div>
        <div className="space-y-1">
          <Label className="text-xs">Sets</Label>
          <Input
            type="number"
            min={1}
            max={20}
            value={block.sets}
            onChange={(e) => onChange({ ...block, sets: Number(e.target.value) || 1 })}
          />
        </div>
        <div className="space-y-1">
          <Label className="text-xs">Reps</Label>
          <Input
            placeholder="5"
            value={block.reps}
            onChange={(e) => onChange({ ...block, reps: e.target.value })}
          />
        </div>
        <div className="col-span-2 space-y-1">
          <Label className="text-xs">Peso (opcional)</Label>
          <Input
            placeholder="@ 80% 1RM"
            value={block.weight ?? ""}
            onChange={(e) => onChange({ ...block, weight: e.target.value })}
          />
        </div>
        <div className="col-span-2 space-y-1">
          <Label className="text-xs">Notas (opcional)</Label>
          <Textarea
            rows={2}
            placeholder="Ej: foco en técnica…"
            value={block.notes ?? ""}
            onChange={(e) => onChange({ ...block, notes: e.target.value })}
          />
        </div>
      </div>
    </div>
  )
}
```

- [ ] **D2.2: Type-check + commit**

```bash
npx tsc --noEmit
git add components/section-components/rutinas/blocks-editor/types/StrengthBlockEditor.tsx
git commit -m "feat(rutinas): editor de bloque Strength"
```

---

### Task D3: Helper `MovementListEditor` (lista editable de movimientos)

**Files:**
- Create: `components/section-components/rutinas/blocks-editor/MovementListEditor.tsx`

> Reutilizado por skill, amrap, emom, for_time, for_reps, rft.

- [ ] **D3.1: Crear el archivo**

```tsx
"use client"

import { Input } from "@/components/ui/input"
import { Button } from "@/components/ui/button"
import { Plus, X } from "lucide-react"

interface Props {
  movements: string[]
  onChange: (next: string[]) => void
  placeholder?: string
}

export function MovementListEditor({ movements, onChange, placeholder = "Movimiento" }: Props) {
  const setAt = (idx: number, value: string) => {
    const next = movements.slice()
    next[idx] = value
    onChange(next)
  }
  const removeAt = (idx: number) => {
    onChange(movements.filter((_, i) => i !== idx))
  }
  const add = () => onChange([...movements, ""])

  return (
    <div className="space-y-1.5">
      {movements.map((m, idx) => (
        <div key={idx} className="flex items-center gap-1.5">
          <Input
            placeholder={placeholder}
            value={m}
            onChange={(e) => setAt(idx, e.target.value)}
          />
          <Button
            type="button"
            variant="ghost"
            size="icon"
            className="h-9 w-9 shrink-0 text-muted-foreground"
            onClick={() => removeAt(idx)}
            disabled={movements.length <= 1}
          >
            <X className="h-3.5 w-3.5" />
          </Button>
        </div>
      ))}
      <Button
        type="button"
        variant="outline"
        size="sm"
        onClick={add}
        className="w-full gap-1 border-dashed"
      >
        <Plus className="h-3.5 w-3.5" />
        Movimiento
      </Button>
    </div>
  )
}
```

- [ ] **D3.2: Type-check + commit**

```bash
npx tsc --noEmit
git add components/section-components/rutinas/blocks-editor/MovementListEditor.tsx
git commit -m "feat(rutinas): MovementListEditor reutilizable"
```

---

### Task D4: Sub-editor `SkillBlockEditor`

**Files:**
- Create: `components/section-components/rutinas/blocks-editor/types/SkillBlockEditor.tsx`

- [ ] **D4.1: Crear el archivo**

```tsx
"use client"

import { Label } from "@/components/ui/label"
import { Textarea } from "@/components/ui/textarea"
import type { SkillBlock } from "@/lib/constants/routine-blocks"
import { MovementListEditor } from "../MovementListEditor"

interface Props {
  block: SkillBlock
  onChange: (next: SkillBlock) => void
}

export function SkillBlockEditor({ block, onChange }: Props) {
  return (
    <div className="space-y-2">
      <div className="space-y-1">
        <Label className="text-xs">Ejercicios</Label>
        <MovementListEditor
          movements={block.exercises}
          onChange={(exercises) => onChange({ ...block, exercises })}
          placeholder="Ej: handstand walk 5m"
        />
      </div>
      <div className="space-y-1">
        <Label className="text-xs">Notas (opcional)</Label>
        <Textarea
          rows={2}
          value={block.notes ?? ""}
          onChange={(e) => onChange({ ...block, notes: e.target.value })}
        />
      </div>
    </div>
  )
}
```

- [ ] **D4.2: Type-check + commit**

```bash
npx tsc --noEmit
git add components/section-components/rutinas/blocks-editor/types/SkillBlockEditor.tsx
git commit -m "feat(rutinas): editor de bloque Skill"
```

---

### Task D5: Sub-editores AMRAP, EMOM, For Time, For Reps, RFT

**Files:**
- Create: `components/section-components/rutinas/blocks-editor/types/AmrapBlockEditor.tsx`
- Create: `components/section-components/rutinas/blocks-editor/types/EmomBlockEditor.tsx`
- Create: `components/section-components/rutinas/blocks-editor/types/ForTimeBlockEditor.tsx`
- Create: `components/section-components/rutinas/blocks-editor/types/ForRepsBlockEditor.tsx`
- Create: `components/section-components/rutinas/blocks-editor/types/RftBlockEditor.tsx`

- [ ] **D5.1: Crear `AmrapBlockEditor.tsx`**

```tsx
"use client"

import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import type { AmrapBlock } from "@/lib/constants/routine-blocks"
import { MovementListEditor } from "../MovementListEditor"

interface Props {
  block: AmrapBlock
  onChange: (next: AmrapBlock) => void
}

export function AmrapBlockEditor({ block, onChange }: Props) {
  return (
    <div className="space-y-2">
      <div className="flex items-end gap-2">
        <div className="space-y-1">
          <Label className="text-xs">Minutos</Label>
          <Input
            type="number"
            min={1}
            max={120}
            value={block.minutes}
            onChange={(e) => onChange({ ...block, minutes: Number(e.target.value) || 1 })}
            className="w-20"
          />
        </div>
      </div>
      <div className="space-y-1">
        <Label className="text-xs">Movimientos</Label>
        <MovementListEditor
          movements={block.movements}
          onChange={(movements) => onChange({ ...block, movements })}
        />
      </div>
    </div>
  )
}
```

- [ ] **D5.2: Crear `EmomBlockEditor.tsx`**

```tsx
"use client"

import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { Switch } from "@/components/ui/switch"
import type { EmomBlock } from "@/lib/constants/routine-blocks"
import { MovementListEditor } from "../MovementListEditor"

interface Props {
  block: EmomBlock
  onChange: (next: EmomBlock) => void
}

export function EmomBlockEditor({ block, onChange }: Props) {
  return (
    <div className="space-y-2">
      <div className="flex items-end gap-3">
        <div className="space-y-1">
          <Label className="text-xs">Minutos</Label>
          <Input
            type="number"
            min={1}
            max={120}
            value={block.minutes}
            onChange={(e) => onChange({ ...block, minutes: Number(e.target.value) || 1 })}
            className="w-20"
          />
        </div>
        <label className="flex items-center gap-2 text-xs pb-2">
          <Switch
            checked={block.alternating}
            onCheckedChange={(v) => onChange({ ...block, alternating: v })}
          />
          Alternante
        </label>
      </div>
      <div className="space-y-1">
        <Label className="text-xs">Movimientos</Label>
        <MovementListEditor
          movements={block.movements}
          onChange={(movements) => onChange({ ...block, movements })}
        />
      </div>
    </div>
  )
}
```

- [ ] **D5.3: Crear `ForTimeBlockEditor.tsx`**

```tsx
"use client"

import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import type { ForTimeBlock } from "@/lib/constants/routine-blocks"
import { MovementListEditor } from "../MovementListEditor"

interface Props {
  block: ForTimeBlock
  onChange: (next: ForTimeBlock) => void
}

export function ForTimeBlockEditor({ block, onChange }: Props) {
  return (
    <div className="space-y-2">
      <div className="flex items-end gap-2">
        <div className="space-y-1">
          <Label className="text-xs">Time cap (min, opcional)</Label>
          <Input
            type="number"
            min={1}
            max={120}
            value={block.time_cap_min ?? ""}
            onChange={(e) =>
              onChange({
                ...block,
                time_cap_min: e.target.value ? Number(e.target.value) : undefined,
              })
            }
            className="w-24"
          />
        </div>
      </div>
      <div className="space-y-1">
        <Label className="text-xs">Movimientos</Label>
        <MovementListEditor
          movements={block.movements}
          onChange={(movements) => onChange({ ...block, movements })}
        />
      </div>
    </div>
  )
}
```

- [ ] **D5.4: Crear `ForRepsBlockEditor.tsx`**

```tsx
"use client"

import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import type { ForRepsBlock } from "@/lib/constants/routine-blocks"
import { MovementListEditor } from "../MovementListEditor"

interface Props {
  block: ForRepsBlock
  onChange: (next: ForRepsBlock) => void
}

export function ForRepsBlockEditor({ block, onChange }: Props) {
  return (
    <div className="space-y-2">
      <div className="space-y-1">
        <Label className="text-xs">Target reps</Label>
        <Input
          type="number"
          min={1}
          max={99999}
          value={block.target_reps}
          onChange={(e) => onChange({ ...block, target_reps: Number(e.target.value) || 1 })}
          className="w-32"
        />
      </div>
      <div className="space-y-1">
        <Label className="text-xs">Movimientos</Label>
        <MovementListEditor
          movements={block.movements}
          onChange={(movements) => onChange({ ...block, movements })}
        />
      </div>
    </div>
  )
}
```

- [ ] **D5.5: Crear `RftBlockEditor.tsx`**

```tsx
"use client"

import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import type { RftBlock } from "@/lib/constants/routine-blocks"
import { MovementListEditor } from "../MovementListEditor"

interface Props {
  block: RftBlock
  onChange: (next: RftBlock) => void
}

export function RftBlockEditor({ block, onChange }: Props) {
  return (
    <div className="space-y-2">
      <div className="space-y-1">
        <Label className="text-xs">Rounds</Label>
        <Input
          type="number"
          min={1}
          max={50}
          value={block.rounds}
          onChange={(e) => onChange({ ...block, rounds: Number(e.target.value) || 1 })}
          className="w-24"
        />
      </div>
      <div className="space-y-1">
        <Label className="text-xs">Movimientos</Label>
        <MovementListEditor
          movements={block.movements}
          onChange={(movements) => onChange({ ...block, movements })}
        />
      </div>
    </div>
  )
}
```

- [ ] **D5.6: Type-check + commit**

```bash
npx tsc --noEmit
git add components/section-components/rutinas/blocks-editor/types/AmrapBlockEditor.tsx
git add components/section-components/rutinas/blocks-editor/types/EmomBlockEditor.tsx
git add components/section-components/rutinas/blocks-editor/types/ForTimeBlockEditor.tsx
git add components/section-components/rutinas/blocks-editor/types/ForRepsBlockEditor.tsx
git add components/section-components/rutinas/blocks-editor/types/RftBlockEditor.tsx
git commit -m "feat(rutinas): editores de bloques condicionantes (AMRAP/EMOM/ForTime/ForReps/RFT)"
```

---

### Task D6: `RoutineBlocksEditor` — wrapper con add/remove/reorder

**Files:**
- Create: `components/section-components/rutinas/blocks-editor/RoutineBlocksEditor.tsx`

- [ ] **D6.1: Crear el archivo**

```tsx
"use client"

import { useMemo } from "react"
import { ChevronDown, ChevronUp, Plus, Trash2 } from "lucide-react"
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu"
import { Button } from "@/components/ui/button"
import { Badge } from "@/components/ui/badge"
import { cn } from "@/lib/utils"
import {
  BLOCK_META,
  BLOCK_TYPE_ORDER,
  CONDITIONING_SCORE_TYPE,
  createBlock,
  type BlockType,
  type RoutineBlock,
} from "@/lib/constants/routine-blocks"
import { SCORE_TYPE_LABEL } from "@/lib/constants/wod-score"
import { TextBlockEditor } from "./types/TextBlockEditor"
import { StrengthBlockEditor } from "./types/StrengthBlockEditor"
import { SkillBlockEditor } from "./types/SkillBlockEditor"
import { AmrapBlockEditor } from "./types/AmrapBlockEditor"
import { EmomBlockEditor } from "./types/EmomBlockEditor"
import { ForTimeBlockEditor } from "./types/ForTimeBlockEditor"
import { ForRepsBlockEditor } from "./types/ForRepsBlockEditor"
import { RftBlockEditor } from "./types/RftBlockEditor"

interface Props {
  blocks: RoutineBlock[]
  onChange: (next: RoutineBlock[]) => void
}

export function RoutineBlocksEditor({ blocks, onChange }: Props) {
  const sorted = useMemo(
    () => [...blocks].sort((a, b) => a.order - b.order),
    [blocks],
  )

  const addBlock = (type: BlockType) => {
    const next = [...sorted, createBlock(type, sorted.length)]
    onChange(reorder(next))
  }
  const removeAt = (idx: number) => {
    onChange(reorder(sorted.filter((_, i) => i !== idx)))
  }
  const moveUp = (idx: number) => {
    if (idx === 0) return
    const next = sorted.slice()
    ;[next[idx - 1], next[idx]] = [next[idx], next[idx - 1]]
    onChange(reorder(next))
  }
  const moveDown = (idx: number) => {
    if (idx >= sorted.length - 1) return
    const next = sorted.slice()
    ;[next[idx], next[idx + 1]] = [next[idx + 1], next[idx]]
    onChange(reorder(next))
  }
  const updateBlock = (idx: number, updated: RoutineBlock) => {
    const next = sorted.slice()
    next[idx] = updated
    onChange(next)
  }

  return (
    <div className="space-y-3">
      <div className="flex items-center justify-between">
        <span className="text-xs uppercase tracking-wide text-muted-foreground font-medium">
          Bloques ({sorted.length})
        </span>
        <DropdownMenu>
          <DropdownMenuTrigger asChild>
            <Button size="sm" type="button" className="gap-1.5">
              <Plus className="h-3.5 w-3.5" /> Agregar bloque
            </Button>
          </DropdownMenuTrigger>
          <DropdownMenuContent align="end" className="w-52">
            {BLOCK_TYPE_ORDER.map((t) => {
              const Meta = BLOCK_META[t]
              const Icon = Meta.icon
              return (
                <DropdownMenuItem key={t} onClick={() => addBlock(t)} className="gap-2">
                  <Icon className="h-3.5 w-3.5" /> {Meta.label}
                </DropdownMenuItem>
              )
            })}
          </DropdownMenuContent>
        </DropdownMenu>
      </div>

      {sorted.length === 0 && (
        <div className="rounded-lg border border-dashed border-border p-6 text-center">
          <p className="text-sm text-muted-foreground">
            Aún no hay bloques. Empieza agregando uno.
          </p>
        </div>
      )}

      {sorted.map((block, idx) => {
        const meta = BLOCK_META[block.type]
        const Icon = meta.icon
        const scoreType = CONDITIONING_SCORE_TYPE[block.type]
        const isLoggable = !!scoreType
        return (
          <div
            key={block.id}
            className={cn(
              "rounded-lg border p-3 space-y-2",
              isLoggable
                ? "border-primary/40 ring-1 ring-primary/15 bg-primary/[0.03]"
                : "border-border bg-card",
            )}
          >
            <div className="flex items-center gap-2">
              <Badge variant={isLoggable ? "default" : "secondary"} className="gap-1">
                <Icon className="h-3 w-3" /> {meta.label.toUpperCase()}
              </Badge>
              {isLoggable && scoreType && (
                <Badge variant="outline" className="text-[10px] gap-1 border-primary/40 text-primary">
                  📊 LOG: {SCORE_TYPE_LABEL[scoreType]}
                </Badge>
              )}
              <div className="ml-auto flex items-center gap-0.5">
                <Button
                  type="button"
                  variant="ghost"
                  size="icon"
                  className="h-7 w-7"
                  onClick={() => moveUp(idx)}
                  disabled={idx === 0}
                >
                  <ChevronUp className="h-3.5 w-3.5" />
                </Button>
                <Button
                  type="button"
                  variant="ghost"
                  size="icon"
                  className="h-7 w-7"
                  onClick={() => moveDown(idx)}
                  disabled={idx >= sorted.length - 1}
                >
                  <ChevronDown className="h-3.5 w-3.5" />
                </Button>
                <Button
                  type="button"
                  variant="ghost"
                  size="icon"
                  className="h-7 w-7 text-destructive"
                  onClick={() => removeAt(idx)}
                >
                  <Trash2 className="h-3.5 w-3.5" />
                </Button>
              </div>
            </div>

            <BlockBody block={block} onChange={(b) => updateBlock(idx, b)} />
          </div>
        )
      })}
    </div>
  )
}

function reorder(blocks: RoutineBlock[]): RoutineBlock[] {
  return blocks.map((b, i) => ({ ...b, order: i }))
}

function BlockBody({
  block,
  onChange,
}: {
  block: RoutineBlock
  onChange: (b: RoutineBlock) => void
}) {
  switch (block.type) {
    case "warmup":
      return <TextBlockEditor block={block} placeholder="Ej: 3 rounds: 200m row + 10 air squats" onChange={onChange} />
    case "cooldown":
      return <TextBlockEditor block={block} placeholder="Ej: 5 min foam roll + estiramientos" onChange={onChange} />
    case "notes":
      return <TextBlockEditor block={block} placeholder="Notas adicionales (Markdown)…" onChange={onChange} />
    case "strength":
      return <StrengthBlockEditor block={block} onChange={onChange} />
    case "skill":
      return <SkillBlockEditor block={block} onChange={onChange} />
    case "amrap":
      return <AmrapBlockEditor block={block} onChange={onChange} />
    case "emom":
      return <EmomBlockEditor block={block} onChange={onChange} />
    case "for_time":
      return <ForTimeBlockEditor block={block} onChange={onChange} />
    case "for_reps":
      return <ForRepsBlockEditor block={block} onChange={onChange} />
    case "rft":
      return <RftBlockEditor block={block} onChange={onChange} />
  }
}
```

- [ ] **D6.2: Type-check**

```bash
npx tsc --noEmit
```

- [ ] **D6.3: Commit**

```bash
git add components/section-components/rutinas/blocks-editor/RoutineBlocksEditor.tsx
git commit -m "feat(rutinas): RoutineBlocksEditor con add/remove/reorder"
```

---

### Task D7: Integrar block builder en `routine-wizard-modal.tsx`

**Files:**
- Modify: `components/section-components/rutinas/modals/routine-wizard-modal.tsx`

- [ ] **D7.1: Reemplazar el bloque de imports y schema Zod del form**

Buscar el bloque de imports (líneas 1–37) y el `const schema = ...` (líneas 39–44). Reemplazar por:

```tsx
"use client"

import { useEffect, useMemo, useState } from "react"
import { useForm } from "react-hook-form"
import { zodResolver } from "@hookform/resolvers/zod"
import { z } from "zod"
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query"
import { format, parseISO } from "date-fns"
import { es } from "date-fns/locale"
import { toast } from "sonner"
import { AlertTriangle, Check, ChevronLeft, ChevronRight } from "lucide-react"

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
import { Skeleton } from "@/components/ui/skeleton"
import { cn } from "@/lib/utils"
import { getPlans } from "@/lib/actions/plans"
import {
  checkRoutineConflicts,
  createRoutineSchedule,
  updateRoutineSchedule,
  type RoutineSchedule,
} from "@/lib/actions/routines"
import { createBlock, type RoutineBlock } from "@/lib/constants/routine-blocks"
import { routineBlocksSchema } from "@/lib/schemas/routine-blocks"
import { RoutineBlocksEditor } from "../blocks-editor/RoutineBlocksEditor"

const schema = z.object({
  date: z.string().min(1, "Selecciona una fecha"),
  plan_ids: z.array(z.string().uuid()).min(1, "Selecciona al menos un plan"),
  name: z.string().max(100, "Máx. 100 caracteres").optional(),
  blocks: routineBlocksSchema,
})
type FormValues = z.infer<typeof schema>
```

- [ ] **D7.2: Actualizar `defaultValues` y migración inline desde markdown**

Buscar el bloque `useForm({ defaultValues: ... })` y reemplazarlo:

```tsx
const initialBlocks = useMemo<RoutineBlock[]>(() => {
  if (routine?.blocks && routine.blocks.length > 0) return routine.blocks
  if (routine?.content && routine.content.trim().length > 0) {
    // Migración inline: rutina antigua con solo markdown → un bloque notes
    const b = createBlock("notes", 0)
    return [{ ...b, text: routine.content }] as RoutineBlock[]
  }
  return []
}, [routine])

const form = useForm<FormValues>({
  resolver: zodResolver(schema),
  defaultValues: {
    date: routine?.date ?? todayISO,
    plan_ids: routine?.plans.map((p) => p.id) ?? [],
    name: routine?.name ?? "",
    blocks: initialBlocks,
  },
})

useEffect(() => {
  if (open) {
    form.reset({
      date: routine?.date ?? todayISO,
      plan_ids: routine?.plans.map((p) => p.id) ?? [],
      name: routine?.name ?? "",
      blocks: initialBlocks,
    })
    setStep(1)
    setConflictPlanIds([])
    setAllowReplace(false)
  }
}, [open, routine, todayISO, form, initialBlocks])
```

- [ ] **D7.3: Reemplazar el contenido del paso 3**

Buscar el bloque `{step === 3 && ( ... )}` y reemplazarlo:

```tsx
{step === 3 && (
  <div className="space-y-4">
    <div className="space-y-2">
      <Label htmlFor="routine-name">Nombre (opcional)</Label>
      <Input
        id="routine-name"
        placeholder='Ej: "Murph" prep'
        value={form.watch("name") ?? ""}
        onChange={(e) => form.setValue("name", e.target.value)}
        maxLength={100}
      />
    </div>

    <RoutineBlocksEditor
      blocks={form.watch("blocks") ?? []}
      onChange={(next) => form.setValue("blocks", next, { shouldValidate: true })}
    />

    {form.formState.errors.blocks && (
      <p className="text-xs text-destructive">
        {form.formState.errors.blocks.message ??
          (Array.isArray(form.formState.errors.blocks)
            ? "Hay bloques con campos inválidos"
            : "Bloques inválidos")}
      </p>
    )}
  </div>
)}
```

- [ ] **D7.4: Actualizar `submitMut` para enviar `blocks` en lugar de `content`**

Localizar el `submitMut` y reemplazar el `mutationFn`:

```tsx
const submitMut = useMutation({
  mutationFn: async (values: FormValues) => {
    if (mode === "create") {
      return createRoutineSchedule({
        date: values.date,
        name: values.name?.trim() || null,
        blocks: values.blocks,
        plan_ids: values.plan_ids,
        replace_conflicts: allowReplace,
      })
    } else {
      if (!routine) throw new Error("Rutina no encontrada")
      return updateRoutineSchedule(routine.id, {
        date: values.date,
        name: values.name?.trim() || null,
        blocks: values.blocks,
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
```

- [ ] **D7.5: Actualizar `stepValid` para validar paso 3**

Localizar la línea `const stepValid = ...` y reemplazar:

```tsx
const stepValid =
  (step === 1 && !!form.watch("date") && (mode === "edit" || form.watch("date") >= todayISO)) ||
  (step === 2 && (form.watch("plan_ids") ?? []).length > 0) ||
  (step === 3 && (form.watch("blocks") ?? []).length > 0)
```

- [ ] **D7.6: Eliminar referencias muertas a `content`/Markdown**

Buscar y eliminar imports y bloques no usados: `ReactMarkdown`, `remarkGfm`, `Tabs`, `TabsContent`, `TabsList`, `TabsTrigger`, `Eye`, `Pencil`. Si quedan en imports después del paso 3 nuevo, removerlos.

- [ ] **D7.7: Type-check + lint**

```bash
npx tsc --noEmit
npm run lint
```

Esperado: 0 errores en el wizard.

- [ ] **D7.8: Verificación manual**

Levantar dev:

```bash
npm run dev
```

Como admin:
1. Ir a `/dashboard/rutinas`, click "Crear rutina".
2. Paso 1: elegir fecha futura.
3. Paso 2: seleccionar al menos un plan.
4. Paso 3: agregar 3 bloques (warmup, strength, amrap), llenarlos. Verificar borde amarillo + badge "📊 LOG" en strength y amrap.
5. Reordenar con ↑/↓, eliminar uno, agregar otro tipo distinto.
6. Click "Crear rutina" → toast verde, modal cierra, lista se actualiza.
7. Verificar en Supabase que el row tenga `blocks` con la forma esperada.
8. Editar la misma rutina → debe abrir el wizard con los bloques cargados; cambiar uno y guardar.

- [ ] **D7.9: Commit**

```bash
git add components/section-components/rutinas/modals/routine-wizard-modal.tsx
git commit -m "feat(rutinas): wizard paso 3 usa block builder estructurado"
```

---

## Fase E — Portal del miembro: WOD logger y leaderboard

### Task E1: Eliminar componentes de WOD viejos no reutilizables

**Files:**
- Delete: `components/section-components/portal/wod/WodLeaderboard.tsx`
- Delete: `components/section-components/portal/wod/TodayWodHeader.tsx`
- Delete: `components/section-components/portal/wod/WodHistoryList.tsx`
- Delete: `components/section-components/portal/wod/WodLogRow.tsx`

> Estos componentes fueron diseñados para el modelo viejo (un solo WOD por rutina y `getTodayLeaderboard`). El nuevo flujo usa `WodBlockCard`/`WodMiniLeaderboard`/`WodFullLeaderboardSheet` (Tasks E3–E5). Mantener `WodScoreInputs.tsx` y `log-wod-modal.tsx` para refactor.

- [ ] **E1.1: Eliminar los 4 archivos**

```bash
rm components/section-components/portal/wod/WodLeaderboard.tsx
rm components/section-components/portal/wod/TodayWodHeader.tsx
rm components/section-components/portal/wod/WodHistoryList.tsx
rm components/section-components/portal/wod/WodLogRow.tsx
```

- [ ] **E1.2: Verificar que no queden imports rotos**

```bash
grep -rn "WodLeaderboard\|TodayWodHeader\|WodHistoryList\|WodLogRow" --include="*.tsx" --include="*.ts" .
```

Expected: solo aparezca dentro de `lib/actions/wod-logs.ts` si quedan referencias a tipos. No deben existir imports activos en componentes.

- [ ] **E1.3: Commit**

```bash
git add -A
git commit -m "chore(wod): eliminar componentes del modelo viejo"
```

---

### Task E2: Refactor `LogWodModal` para recibir `block_id`

**Files:**
- Modify: `components/section-components/portal/wod/log-wod-modal.tsx`

- [ ] **E2.1: Reemplazar el archivo completo**

```tsx
"use client"

import { useEffect, useState } from "react"
import { useMutation, useQueryClient } from "@tanstack/react-query"
import { toast } from "sonner"
import { Loader2, Save, Trash2 } from "lucide-react"
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog"
import { Button } from "@/components/ui/button"
import { Label } from "@/components/ui/label"
import { Switch } from "@/components/ui/switch"
import { Textarea } from "@/components/ui/textarea"
import {
  upsertWodLog,
  deleteWodLog,
  type WodLog,
} from "@/lib/actions/wod-logs"
import {
  type ScoreType,
  SCORE_TYPE_LABEL,
} from "@/lib/constants/wod-score"
import {
  BLOCK_META,
  type RoutineBlock,
} from "@/lib/constants/routine-blocks"
import { WodScoreInputs, type WodScoreInputValues } from "./WodScoreInputs"

interface Props {
  open: boolean
  onOpenChange: (open: boolean) => void
  routineId: string
  block: RoutineBlock
  scoreType: ScoreType
  existingLog: WodLog | null
}

const EMPTY_VALUES: WodScoreInputValues = {
  score_type: "for_time",
  minutes: 0, seconds: 0,
  rounds: 0, reps_extra: 0,
  reps: 0, kg: 0,
}

function blockHeadline(block: RoutineBlock): string {
  switch (block.type) {
    case "amrap": return `${BLOCK_META.amrap.label} ${block.minutes} min`
    case "for_time": return BLOCK_META.for_time.label + (block.time_cap_min ? ` · cap ${block.time_cap_min} min` : "")
    case "rft": return `${BLOCK_META.rft.label} · ${block.rounds} rounds`
    case "for_reps": return `${BLOCK_META.for_reps.label} · ${block.target_reps} reps`
    case "strength": return `${BLOCK_META.strength.label}: ${block.exercise || "(sin ejercicio)"}`
    default: return BLOCK_META[block.type].label
  }
}

export function LogWodModal({ open, onOpenChange, routineId, block, scoreType, existingLog }: Props) {
  const queryClient = useQueryClient()

  const [values, setValues] = useState<WodScoreInputValues>(EMPTY_VALUES)
  const [rx, setRx] = useState<boolean>(false)
  const [notes, setNotes] = useState<string>("")
  const [errors, setErrors] = useState<Partial<Record<keyof WodScoreInputValues, string>>>({})

  useEffect(() => {
    if (!open) return
    if (existingLog) {
      setRx(existingLog.rx)
      setNotes(existingLog.notes ?? "")
      const t = existingLog.score_type
      setValues({
        score_type: t,
        minutes: t === "for_time" ? Math.floor((existingLog.score_seconds ?? 0) / 60) : 0,
        seconds: t === "for_time" ? (existingLog.score_seconds ?? 0) % 60 : 0,
        rounds: t === "amrap" ? (existingLog.score_rounds ?? 0) : 0,
        reps_extra: t === "amrap" ? (existingLog.score_reps ?? 0) : 0,
        reps: t === "for_reps" ? (existingLog.score_reps ?? 0) : 0,
        kg: t === "weight" ? Number(existingLog.score_kg ?? 0) : 0,
      })
    } else {
      setRx(false)
      setNotes("")
      setValues({ ...EMPTY_VALUES, score_type: scoreType })
    }
    setErrors({})
  }, [open, existingLog, scoreType])

  const upsertMutation = useMutation({
    mutationFn: async () => {
      const errs: Partial<Record<keyof WodScoreInputValues, string>> = {}
      let payload: Parameters<typeof upsertWodLog>[0]
      switch (scoreType) {
        case "for_time": {
          const total = values.minutes * 60 + values.seconds
          if (total <= 0) errs.seconds = "Ingresa un tiempo válido"
          payload = {
            routine_id: routineId,
            block_id: block.id,
            score_type: "for_time",
            score_seconds: total,
            rx,
            notes: notes || null,
          }
          break
        }
        case "amrap": {
          if (values.rounds < 0) errs.rounds = "Inválido"
          if (values.reps_extra < 0) errs.reps_extra = "Inválido"
          if (values.rounds + values.reps_extra === 0) errs.rounds = "Score vacío"
          payload = {
            routine_id: routineId,
            block_id: block.id,
            score_type: "amrap",
            score_rounds: values.rounds,
            score_reps: values.reps_extra,
            rx,
            notes: notes || null,
          }
          break
        }
        case "for_reps": {
          if (values.reps <= 0) errs.reps = "Debe ser > 0"
          payload = {
            routine_id: routineId,
            block_id: block.id,
            score_type: "for_reps",
            score_reps: values.reps,
            rx,
            notes: notes || null,
          }
          break
        }
        case "weight": {
          if (values.kg <= 0 || values.kg > 500) errs.kg = "Fuera de rango (0–500 kg)"
          payload = {
            routine_id: routineId,
            block_id: block.id,
            score_type: "weight",
            score_kg: values.kg,
            rx,
            notes: notes || null,
          }
          break
        }
      }
      if (Object.keys(errs).length > 0) {
        setErrors(errs)
        throw new Error("Corrige los errores")
      }
      setErrors({})
      return upsertWodLog(payload!)
    },
    onSuccess: () => {
      toast.success(existingLog ? "WOD actualizado" : "WOD registrado")
      queryClient.invalidateQueries({ queryKey: ["my-wod-logs"] })
      queryClient.invalidateQueries({ queryKey: ["wod-leaderboard"] })
      queryClient.invalidateQueries({ queryKey: ["routine-today"] })
      onOpenChange(false)
    },
    onError: (err) => {
      toast.error(err instanceof Error ? err.message : "Error al guardar")
    },
  })

  const deleteMutation = useMutation({
    mutationFn: async () => {
      if (!existingLog) return
      return deleteWodLog(existingLog.id)
    },
    onSuccess: () => {
      toast.success("WOD borrado")
      queryClient.invalidateQueries({ queryKey: ["my-wod-logs"] })
      queryClient.invalidateQueries({ queryKey: ["wod-leaderboard"] })
      queryClient.invalidateQueries({ queryKey: ["routine-today"] })
      onOpenChange(false)
    },
    onError: (err) => {
      toast.error(err instanceof Error ? err.message : "Error al borrar")
    },
  })

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-md max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle>{existingLog ? "Editar WOD" : "Registrar WOD"}</DialogTitle>
          <DialogDescription>
            <span className="font-medium">{blockHeadline(block)}</span>
            <span className="ml-1.5 text-xs text-muted-foreground">
              · score: {SCORE_TYPE_LABEL[scoreType]}
            </span>
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-4">
          <WodScoreInputs values={values} onChange={(v) => setValues(v)} errors={errors} />

          <div className="flex items-center justify-between gap-3 rounded-md border border-border p-3">
            <div>
              <Label htmlFor="rx" className="text-sm font-medium">Como Rx</Label>
              <p className="text-xs text-muted-foreground">¿Hiciste el WOD como prescrito?</p>
            </div>
            <Switch id="rx" checked={rx} onCheckedChange={setRx} />
          </div>

          <div className="space-y-1.5">
            <Label htmlFor="notes" className="text-sm">Notas (opcional)</Label>
            <Textarea
              id="notes"
              placeholder="Ej: usé KB 16kg, partner Juan"
              value={notes}
              onChange={(e) => setNotes(e.target.value.slice(0, 500))}
              rows={3}
            />
            <p className="text-[11px] text-muted-foreground">{notes.length} / 500</p>
          </div>
        </div>

        <DialogFooter className="gap-2 flex-col sm:flex-row mt-2">
          {existingLog && (
            <Button
              type="button"
              variant="outline"
              size="sm"
              onClick={() => deleteMutation.mutate()}
              disabled={deleteMutation.isPending || upsertMutation.isPending}
              className="gap-2 text-destructive hover:text-destructive sm:mr-auto"
            >
              {deleteMutation.isPending
                ? <Loader2 className="h-4 w-4 animate-spin" />
                : <Trash2 className="h-4 w-4" />
              }
              Borrar
            </Button>
          )}
          <Button
            type="button"
            onClick={() => upsertMutation.mutate()}
            disabled={upsertMutation.isPending || deleteMutation.isPending}
            className="gap-2"
          >
            {upsertMutation.isPending
              ? <Loader2 className="h-4 w-4 animate-spin" />
              : <Save className="h-4 w-4" />
            }
            Guardar
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  )
}
```

- [ ] **E2.2: Type-check**

```bash
npx tsc --noEmit
```

- [ ] **E2.3: Commit**

```bash
git add components/section-components/portal/wod/log-wod-modal.tsx
git commit -m "feat(wod): LogWodModal recibe block_id y deriva score_type"
```

---

### Task E3: `WodMiniLeaderboard`

**Files:**
- Create: `components/section-components/portal/wod/WodMiniLeaderboard.tsx`

- [ ] **E3.1: Crear el archivo**

```tsx
"use client"

import { useState } from "react"
import { useQuery } from "@tanstack/react-query"
import { Trophy, Loader2 } from "lucide-react"
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar"
import { Badge } from "@/components/ui/badge"
import { Button } from "@/components/ui/button"
import { cn } from "@/lib/utils"
import { getLeaderboardForBlock } from "@/lib/actions/wod-logs"
import { formatScore } from "@/lib/constants/wod-score"

interface Props {
  routineId: string
  blockId: string
  defaultGender: "male" | "female"
  onOpenFull: () => void
  highlightMemberId?: string
}

export function WodMiniLeaderboard({
  routineId,
  blockId,
  defaultGender,
  onOpenFull,
  highlightMemberId,
}: Props) {
  const [gender, setGender] = useState<"male" | "female">(defaultGender)

  const { data, isLoading } = useQuery({
    queryKey: ["wod-leaderboard", routineId, blockId, gender],
    queryFn: () =>
      getLeaderboardForBlock({ routine_id: routineId, block_id: blockId, gender, limit: 3 }),
    staleTime: 5 * 60 * 1000,
  })

  const entries = data?.entries ?? []

  return (
    <div className="rounded-md border border-border bg-background/40 p-2.5 space-y-2">
      <div className="flex items-center gap-2">
        <Trophy className="h-3.5 w-3.5 text-primary" />
        <span className="text-[10px] uppercase tracking-wide font-semibold text-muted-foreground">
          Top {gender === "male" ? "Hombres" : "Mujeres"}
        </span>
        <div className="ml-auto flex gap-0.5 rounded-md bg-muted/40 p-0.5">
          <button
            onClick={() => setGender("male")}
            className={cn(
              "px-1.5 py-0.5 text-[10px] font-bold rounded",
              gender === "male" ? "bg-foreground/10 text-foreground" : "text-muted-foreground",
            )}
          >M</button>
          <button
            onClick={() => setGender("female")}
            className={cn(
              "px-1.5 py-0.5 text-[10px] font-bold rounded",
              gender === "female" ? "bg-foreground/10 text-foreground" : "text-muted-foreground",
            )}
          >F</button>
        </div>
      </div>

      {isLoading ? (
        <div className="flex items-center justify-center py-3">
          <Loader2 className="h-4 w-4 animate-spin text-muted-foreground" />
        </div>
      ) : entries.length === 0 ? (
        <p className="text-xs text-muted-foreground italic text-center py-2">
          Aún nadie ha registrado este bloque.
        </p>
      ) : (
        <ul className="space-y-1">
          {entries.map((e) => {
            const initials = e.name.split(" ").map((n) => n[0]).join("").slice(0, 2).toUpperCase()
            const isMe = e.member_id === highlightMemberId
            return (
              <li
                key={e.member_id}
                className={cn(
                  "flex items-center gap-2 px-1.5 py-1 rounded",
                  e.position === 1 && "bg-primary/10",
                  isMe && "ring-1 ring-primary/30",
                )}
              >
                <span className="w-5 text-center text-[10px] font-bold tabular-nums text-primary">
                  {e.position}°
                </span>
                <Avatar className="h-6 w-6 shrink-0">
                  <AvatarImage src={e.avatar_url ?? undefined} />
                  <AvatarFallback className="bg-muted text-foreground text-[9px] font-bold">
                    {initials}
                  </AvatarFallback>
                </Avatar>
                <span className="text-xs flex-1 min-w-0 truncate">
                  {e.name}{isMe && <span className="text-muted-foreground ml-1">(tú)</span>}
                </span>
                <span className="text-xs font-bold tabular-nums">
                  {formatScore({
                    score_type: e.score_type,
                    score_seconds: e.score_seconds,
                    score_rounds: e.score_rounds,
                    score_reps: e.score_reps,
                    score_kg: e.score_kg,
                  })}
                </span>
                {e.rx && <Badge variant="default" className="text-[9px] px-1 py-0">RX</Badge>}
              </li>
            )
          })}
        </ul>
      )}

      <Button
        type="button"
        variant="ghost"
        size="sm"
        className="w-full h-7 text-xs text-muted-foreground"
        onClick={onOpenFull}
      >
        Ver Top 10 →
      </Button>
    </div>
  )
}
```

- [ ] **E3.2: Type-check + commit**

```bash
npx tsc --noEmit
git add components/section-components/portal/wod/WodMiniLeaderboard.tsx
git commit -m "feat(wod): WodMiniLeaderboard inline con toggle M/F"
```

---

### Task E4: `WodFullLeaderboardSheet`

**Files:**
- Create: `components/section-components/portal/wod/WodFullLeaderboardSheet.tsx`

- [ ] **E4.1: Crear el archivo**

```tsx
"use client"

import { useState } from "react"
import { useQuery } from "@tanstack/react-query"
import { Loader2, Trophy } from "lucide-react"
import {
  Sheet,
  SheetContent,
  SheetDescription,
  SheetHeader,
  SheetTitle,
} from "@/components/ui/sheet"
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar"
import { Badge } from "@/components/ui/badge"
import { cn } from "@/lib/utils"
import { getLeaderboardForBlock } from "@/lib/actions/wod-logs"
import { formatScore } from "@/lib/constants/wod-score"

interface Props {
  open: boolean
  onOpenChange: (open: boolean) => void
  routineId: string
  blockId: string
  blockLabel: string
  defaultGender: "male" | "female"
  highlightMemberId?: string
}

export function WodFullLeaderboardSheet({
  open,
  onOpenChange,
  routineId,
  blockId,
  blockLabel,
  defaultGender,
  highlightMemberId,
}: Props) {
  const [gender, setGender] = useState<"male" | "female">(defaultGender)

  const { data, isLoading } = useQuery({
    queryKey: ["wod-leaderboard", routineId, blockId, gender, "full"],
    queryFn: () =>
      getLeaderboardForBlock({ routine_id: routineId, block_id: blockId, gender, limit: 10 }),
    staleTime: 5 * 60 * 1000,
    enabled: open,
  })

  const entries = data?.entries ?? []

  return (
    <Sheet open={open} onOpenChange={onOpenChange}>
      <SheetContent side="right" className="w-full sm:max-w-md overflow-y-auto">
        <SheetHeader>
          <SheetTitle className="flex items-center gap-2">
            <Trophy className="h-4 w-4 text-primary" /> Top 10
          </SheetTitle>
          <SheetDescription>{blockLabel}</SheetDescription>
        </SheetHeader>

        <div className="mt-3 flex gap-1 rounded-md bg-muted/40 p-1 w-fit">
          <button
            onClick={() => setGender("male")}
            className={cn(
              "px-3 py-1 text-xs font-semibold rounded",
              gender === "male" ? "bg-foreground/10 text-foreground" : "text-muted-foreground",
            )}
          >Hombres</button>
          <button
            onClick={() => setGender("female")}
            className={cn(
              "px-3 py-1 text-xs font-semibold rounded",
              gender === "female" ? "bg-foreground/10 text-foreground" : "text-muted-foreground",
            )}
          >Mujeres</button>
        </div>

        <div className="mt-4 space-y-1.5">
          {isLoading ? (
            <div className="flex items-center justify-center py-8">
              <Loader2 className="h-5 w-5 animate-spin text-muted-foreground" />
            </div>
          ) : entries.length === 0 ? (
            <p className="text-sm text-muted-foreground text-center py-8 italic">
              Aún nadie ha registrado este bloque hoy.
            </p>
          ) : (
            entries.map((e) => {
              const initials = e.name.split(" ").map((n) => n[0]).join("").slice(0, 2).toUpperCase()
              const isMe = e.member_id === highlightMemberId
              return (
                <div
                  key={e.member_id}
                  className={cn(
                    "flex items-center gap-3 p-2 rounded-md",
                    e.position === 1 && "bg-primary/10",
                    e.position === 2 && "bg-zinc-300/5",
                    e.position === 3 && "bg-amber-700/10",
                    isMe && "ring-1 ring-primary/40",
                  )}
                >
                  <span className="w-7 text-center text-sm font-bold tabular-nums text-primary">
                    {e.position}°
                  </span>
                  <Avatar className="h-9 w-9">
                    <AvatarImage src={e.avatar_url ?? undefined} />
                    <AvatarFallback className="bg-muted text-foreground text-xs font-bold">
                      {initials}
                    </AvatarFallback>
                  </Avatar>
                  <span className="flex-1 text-sm truncate">
                    {e.name}{isMe && <span className="text-muted-foreground ml-1">(tú)</span>}
                  </span>
                  <span className="text-sm font-bold tabular-nums">
                    {formatScore({
                      score_type: e.score_type,
                      score_seconds: e.score_seconds,
                      score_rounds: e.score_rounds,
                      score_reps: e.score_reps,
                      score_kg: e.score_kg,
                    })}
                  </span>
                  <Badge variant={e.rx ? "default" : "outline"} className="text-[10px]">
                    {e.rx ? "RX" : "S"}
                  </Badge>
                </div>
              )
            })
          )}
        </div>
      </SheetContent>
    </Sheet>
  )
}
```

- [ ] **E4.2: Type-check + commit**

```bash
npx tsc --noEmit
git add components/section-components/portal/wod/WodFullLeaderboardSheet.tsx
git commit -m "feat(wod): WodFullLeaderboardSheet con Top 10"
```

---

### Task E5: `WodBlockCard` + `InfoBlockCard`

**Files:**
- Create: `components/section-components/portal/wod/InfoBlockCard.tsx`
- Create: `components/section-components/portal/wod/WodBlockCard.tsx`

- [ ] **E5.1: Crear `InfoBlockCard.tsx`** (bloques no registrables)

```tsx
"use client"

import { Badge } from "@/components/ui/badge"
import { BLOCK_META, type RoutineBlock } from "@/lib/constants/routine-blocks"

interface Props {
  block: RoutineBlock
}

export function InfoBlockCard({ block }: Props) {
  const meta = BLOCK_META[block.type]
  const Icon = meta.icon

  return (
    <div className="rounded-lg border border-dashed border-border bg-card/40 p-3 space-y-1.5">
      <div className="flex items-center gap-2">
        <Badge variant="secondary" className="gap-1 text-[10px]">
          <Icon className="h-3 w-3" /> {meta.label.toUpperCase()}
        </Badge>
      </div>
      <BlockBody block={block} />
    </div>
  )
}

function BlockBody({ block }: { block: RoutineBlock }) {
  switch (block.type) {
    case "warmup":
    case "cooldown":
    case "notes":
      return <p className="text-xs text-muted-foreground whitespace-pre-wrap">{block.text}</p>
    case "skill":
      return (
        <ul className="text-xs text-muted-foreground list-disc pl-4 space-y-0.5">
          {block.exercises.map((e, i) => <li key={i}>{e}</li>)}
        </ul>
      )
    default:
      return null
  }
}
```

- [ ] **E5.2: Crear `WodBlockCard.tsx`** (bloques registrables)

```tsx
"use client"

import { useState } from "react"
import { Pencil } from "lucide-react"
import { Badge } from "@/components/ui/badge"
import { Button } from "@/components/ui/button"
import {
  BLOCK_META,
  CONDITIONING_SCORE_TYPE,
  type RoutineBlock,
} from "@/lib/constants/routine-blocks"
import {
  formatScore,
  SCORE_TYPE_LABEL,
  type ScoreType,
} from "@/lib/constants/wod-score"
import type { WodLog } from "@/lib/actions/wod-logs"
import { LogWodModal } from "./log-wod-modal"
import { WodMiniLeaderboard } from "./WodMiniLeaderboard"
import { WodFullLeaderboardSheet } from "./WodFullLeaderboardSheet"

interface Props {
  routineId: string
  block: RoutineBlock
  myLog: WodLog | null
  defaultGender: "male" | "female"
  myMemberId: string
}

function blockHeadline(block: RoutineBlock): string {
  switch (block.type) {
    case "amrap": return `${BLOCK_META.amrap.label} ${block.minutes} min`
    case "for_time": return BLOCK_META.for_time.label + (block.time_cap_min ? ` · cap ${block.time_cap_min} min` : "")
    case "rft": return `${BLOCK_META.rft.label} · ${block.rounds} rounds`
    case "for_reps": return `${BLOCK_META.for_reps.label} · ${block.target_reps} reps`
    case "strength": return `${BLOCK_META.strength.label}: ${block.exercise || ""}`
    default: return BLOCK_META[block.type].label
  }
}

function blockBody(block: RoutineBlock): string[] {
  switch (block.type) {
    case "amrap":
    case "emom":
    case "for_time":
    case "for_reps":
    case "rft":
      return block.movements
    case "strength":
      return [`${block.sets} × ${block.reps}${block.weight ? ` · ${block.weight}` : ""}`]
    default:
      return []
  }
}

export function WodBlockCard({ routineId, block, myLog, defaultGender, myMemberId }: Props) {
  const [logModalOpen, setLogModalOpen] = useState(false)
  const [sheetOpen, setSheetOpen] = useState(false)

  const scoreType = CONDITIONING_SCORE_TYPE[block.type] as ScoreType | undefined
  if (!scoreType) return null

  const meta = BLOCK_META[block.type]
  const Icon = meta.icon
  const lines = blockBody(block)

  return (
    <div className="rounded-xl border border-border bg-card p-3.5 space-y-3">
      <div className="flex items-center gap-2">
        <Badge variant="default" className="gap-1">
          <Icon className="h-3 w-3" /> {meta.label.toUpperCase()}
        </Badge>
        <span className="text-sm font-semibold flex-1 truncate">{blockHeadline(block)}</span>
        {myLog && (
          <Badge variant="outline" className="text-[10px] border-emerald-500/40 text-emerald-500">
            ✓ LOGEADO
          </Badge>
        )}
      </div>

      {lines.length > 0 && (
        <ul className="text-sm text-muted-foreground space-y-0.5">
          {lines.map((m, i) => <li key={i}>· {m}</li>)}
        </ul>
      )}

      {myLog ? (
        <div className="flex items-center gap-2 rounded-md bg-background/40 px-3 py-2">
          <span className="text-[10px] uppercase tracking-wide text-muted-foreground">Tu marca</span>
          <span className="text-base font-bold tabular-nums text-primary">
            {formatScore({
              score_type: myLog.score_type,
              score_seconds: myLog.score_seconds,
              score_rounds: myLog.score_rounds,
              score_reps: myLog.score_reps,
              score_kg: myLog.score_kg,
            })}
          </span>
          {myLog.rx && (
            <Badge variant="default" className="text-[10px]">RX</Badge>
          )}
          <Button
            type="button"
            variant="ghost"
            size="sm"
            className="ml-auto h-7 gap-1 text-xs"
            onClick={() => setLogModalOpen(true)}
          >
            <Pencil className="h-3 w-3" /> Editar
          </Button>
        </div>
      ) : (
        <Button
          type="button"
          className="w-full gap-2"
          onClick={() => setLogModalOpen(true)}
        >
          ⏱ Registrar {SCORE_TYPE_LABEL[scoreType]}
        </Button>
      )}

      <WodMiniLeaderboard
        routineId={routineId}
        blockId={block.id}
        defaultGender={defaultGender}
        onOpenFull={() => setSheetOpen(true)}
        highlightMemberId={myMemberId}
      />

      <LogWodModal
        open={logModalOpen}
        onOpenChange={setLogModalOpen}
        routineId={routineId}
        block={block}
        scoreType={scoreType}
        existingLog={myLog}
      />

      <WodFullLeaderboardSheet
        open={sheetOpen}
        onOpenChange={setSheetOpen}
        routineId={routineId}
        blockId={block.id}
        blockLabel={blockHeadline(block)}
        defaultGender={defaultGender}
        highlightMemberId={myMemberId}
      />
    </div>
  )
}
```

- [ ] **E5.3: Type-check + commit**

```bash
npx tsc --noEmit
git add components/section-components/portal/wod/InfoBlockCard.tsx
git add components/section-components/portal/wod/WodBlockCard.tsx
git commit -m "feat(wod): WodBlockCard registrable y InfoBlockCard informativo"
```

---

### Task E6: Reescribir `PortalWodMainComponent`

**Files:**
- Modify: `components/section-components/portal/wod/PortalWodMainComponent.tsx`

- [ ] **E6.1: Reemplazar el archivo entero**

```tsx
"use client"

import { useQuery } from "@tanstack/react-query"
import { Calendar, Loader2 } from "lucide-react"
import { format, parseISO } from "date-fns"
import { es } from "date-fns/locale"
import {
  getRoutineForToday,
  getMyWodLogsForRoutine,
} from "@/lib/actions/wod-logs"
import { CONDITIONING_SCORE_TYPE } from "@/lib/constants/routine-blocks"
import { WodBlockCard } from "./WodBlockCard"
import { InfoBlockCard } from "./InfoBlockCard"
import { useEffect, useState } from "react"
import { createClient } from "@/utils/supabase/client"

export default function PortalWodMainComponent() {
  const [me, setMe] = useState<{
    memberId: string
    gender: "male" | "female"
  } | null>(null)
  const [meLoading, setMeLoading] = useState(true)

  useEffect(() => {
    const run = async () => {
      try {
        const supabase = createClient()
        const { data: { user } } = await supabase.auth.getUser()
        if (!user) { setMeLoading(false); return }
        const { data } = await supabase
          .from("members")
          .select("id, gender")
          .eq("auth_user_id", user.id)
          .maybeSingle()
        if (data?.id) {
          setMe({
            memberId: data.id,
            gender: (data.gender as "male" | "female") ?? "male",
          })
        }
      } finally {
        setMeLoading(false)
      }
    }
    run()
  }, [])

  const { data: routine, isLoading: routineLoading } = useQuery({
    queryKey: ["routine-today", me?.memberId],
    queryFn: getRoutineForToday,
    staleTime: 60 * 1000,
    enabled: !!me?.memberId,
  })

  const { data: myLogs = [] } = useQuery({
    queryKey: ["my-wod-logs", me?.memberId, routine?.id],
    queryFn: () => (routine ? getMyWodLogsForRoutine(routine.id) : Promise.resolve([])),
    staleTime: 60 * 1000,
    enabled: !!routine?.id,
  })

  const isLoading = meLoading || routineLoading

  if (isLoading) {
    return (
      <div className="flex items-center justify-center py-12">
        <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" />
      </div>
    )
  }

  if (!me) {
    return (
      <div className="rounded-xl border border-dashed p-10 text-center space-y-3">
        <p className="text-sm font-medium">No tienes un perfil de miembro asignado.</p>
        <p className="text-xs text-muted-foreground">Contacta al admin del gimnasio.</p>
      </div>
    )
  }

  if (!routine) {
    return (
      <div className="space-y-4">
        <div>
          <h1 className="text-2xl font-bold tracking-tight">WOD del día</h1>
          <p className="text-sm text-muted-foreground mt-1">
            {format(new Date(), "EEEE, d 'de' MMMM 'de' yyyy", { locale: es })}
          </p>
        </div>
        <div className="rounded-xl border border-dashed p-10 text-center space-y-3">
          <Calendar className="h-10 w-10 mx-auto text-muted-foreground" />
          <p className="text-sm font-medium">No hay rutina programada para hoy.</p>
          <p className="text-xs text-muted-foreground">Vuelve mañana o revisa el calendario en /portal/rutinas.</p>
        </div>
      </div>
    )
  }

  const sortedBlocks = [...routine.blocks].sort((a, b) => a.order - b.order)
  const registrableCount = sortedBlocks.filter((b) => CONDITIONING_SCORE_TYPE[b.type]).length
  const dateLabel = format(parseISO(routine.date + "T00:00:00"), "EEEE, d 'de' MMMM", { locale: es })

  const logsByBlockId = new Map(myLogs.map((l) => [l.block_id, l]))

  return (
    <div className="space-y-4">
      <div>
        <p className="text-[10px] uppercase tracking-wide text-muted-foreground font-medium">
          {dateLabel.charAt(0).toUpperCase() + dateLabel.slice(1)}
        </p>
        <h1 className="text-2xl font-bold tracking-tight mt-0.5">
          {routine.name ?? "WOD del día"}
        </h1>
        <p className="text-xs text-muted-foreground mt-1">
          {registrableCount} {registrableCount === 1 ? "bloque registrable" : "bloques registrables"}
        </p>
      </div>

      <div className="space-y-3">
        {sortedBlocks.map((block) =>
          CONDITIONING_SCORE_TYPE[block.type] ? (
            <WodBlockCard
              key={block.id}
              routineId={routine.id}
              block={block}
              myLog={logsByBlockId.get(block.id) ?? null}
              defaultGender={me.gender}
              myMemberId={me.memberId}
            />
          ) : (
            <InfoBlockCard key={block.id} block={block} />
          ),
        )}
      </div>
    </div>
  )
}
```

> **Nota:** se usa el cliente Supabase de browser solo para resolver `member_id` y `gender` del usuario actual (auth pura, no CRUD). Esto es coherente con CLAUDE.md (auth puede ir por client). Alternativa: extraer un helper server action `getMyMemberShortInfo()`. La implementación actual mantiene el componente cohesivo.

- [ ] **E6.2: Type-check + lint**

```bash
npx tsc --noEmit
npm run lint
```

- [ ] **E6.3: Verificación manual**

```bash
npm run dev
```

Como miembro logueado:
1. Crear primero (como admin) una rutina para hoy con planes que incluyan al miembro: 1 warmup + 1 strength + 1 amrap.
2. Loguear con el miembro, ir a `/portal/wod`.
3. Verificar header con fecha + nombre + "2 bloques registrables".
4. Ver card warmup (informativa, dashed).
5. Ver card strength con botón "⏱ Registrar Peso" + mini-leaderboard vacío.
6. Click registrar → modal abre con inputs de peso → guardar 100kg RX → toast verde.
7. Card cambia a "✓ LOGEADO" + muestra "Tu marca: 100 kg RX".
8. Mini-leaderboard muestra al miembro en posición 1°.
9. Click "Ver Top 10 →" → sheet lateral abre con la lista.
10. Toggle M/F en sheet y mini-leaderboard funciona.
11. Editar log → cambiar a 105kg → refleja en card y leaderboard.
12. Borrar log → desaparece la marca, vuelve botón "Registrar".

- [ ] **E6.4: Commit**

```bash
git add components/section-components/portal/wod/PortalWodMainComponent.tsx
git commit -m "feat(wod): rehacer /portal/wod con cards por bloque y mini-leaderboard"
```

---

### Task E7: Botón "Registrar tiempo" en `/portal/rutinas`

**Files:**
- Modify: el componente que renderiza los bloques en `/portal/rutinas` (encontrar primero)

- [ ] **E7.1: Localizar el componente que renderiza los bloques de rutinas en el portal**

```bash
grep -rn "parseBlocks\|RoutineBlock" --include="*.tsx" components/section-components/portal/rutinas/
```

> Se espera encontrar un componente que ya itera sobre `routine.blocks`. Si no existe en `/portal/rutinas`, este task puede saltarse — el spec lo marca como "punto de entrada secundario, no bloqueante".

- [ ] **E7.2: Si existe, agregar botón al lado de cada bloque registrable**

En el componente identificado, donde se renderiza un bloque condicionante (con `CONDITIONING_SCORE_TYPE[block.type]`), agregar:

```tsx
{CONDITIONING_SCORE_TYPE[block.type] && me?.memberId && (
  <Button
    type="button"
    variant="outline"
    size="sm"
    className="mt-2"
    onClick={() => openLogModalFor(block)}
  >
    ⏱ Registrar tiempo
  </Button>
)}
```

Donde `openLogModalFor(block)` abre `<LogWodModal routineId={routine.id} block={block} scoreType={...} existingLog={...} />`. Sigue el mismo patrón que `WodBlockCard`.

> Si el componente vive en `/portal/rutinas` y es servidor (RSC), envolver el botón en un sub-componente cliente local, p.ej. `RegisterButton.tsx` adyacente.

- [ ] **E7.3: Type-check + manual**

```bash
npx tsc --noEmit
```

Verificar en navegador que el botón abre el modal correcto y el log persiste.

- [ ] **E7.4: Commit (solo si se hizo el cambio)**

```bash
git add -A
git commit -m "feat(wod): boton de registro en /portal/rutinas como entrada secundaria"
```

> Si E7.1 no encuentra el lugar adecuado (porque la ruta no renderiza bloques aún o lo hace de forma incompatible), commitear nada y dejar nota en el PR: "E7 pendiente de re-evaluación una vez existe la vista de bloques en /portal/rutinas".

---

## Fase F — Verificación final

### Task F1: Recorrido de testing manual completo

Ejecutar el plan §10 del spec.

- [ ] **F1.1: Levantar dev server**

```bash
npm run dev
```

- [ ] **F1.2: Wizard — crear rutina con 3 bloques mixtos**

Como admin, en `/dashboard/rutinas`:
1. "Crear rutina" → fecha futura → seleccionar 1+ planes → paso 3.
2. Agregar warmup, strength (Back Squat 5×3 @ 80%), amrap (20 min con 3 movimientos).
3. Reordenar: subir el amrap, bajar el strength.
4. Guardar.
5. Verificar en Supabase con `SELECT id, blocks FROM routine_schedules WHERE date = 'YYYY-MM-DD';` que la columna `blocks` contiene 3 elementos en el orden esperado y cada bloque tiene `id` UUID.

- [ ] **F1.3: Wizard edit preserva block.id**

1. Editar la rutina → quitar el warmup, agregar un cooldown.
2. Guardar.
3. Verificar que strength y amrap conservan sus `id` originales (consultar SQL).
4. Esto asegura que los `wod_logs` históricos no quedan huérfanos.

- [ ] **F1.4: Migración inline de markdown**

1. Vía SQL directo, crear una rutina con `content = '# AMRAP 20\n10 pull-ups'` y `blocks = '[]'`. Asignar a un plan.
2. Editar esa rutina desde el wizard.
3. Verificar que se carga con un solo bloque `notes` cuyo `text` es el markdown original.

- [ ] **F1.5: Logger - happy path**

1. Loguear como miembro de un plan asociado.
2. `/portal/wod` muestra los 2 bloques registrables.
3. Logear amrap como RX (5 + 12).
4. Refresh: card muestra "✓ LOGEADO", marca "5 + 12", badge RX.
5. Mini-leaderboard te muestra en 1°.

- [ ] **F1.6: Edit + delete log**

1. Click "Editar" → cambiar a 6 + 0 Scaled.
2. Guardar → marca actualizada, sin badge RX.
3. Borrar → vuelve botón "Registrar tiempo".

- [ ] **F1.7: Leaderboard mismo plan + género**

1. Crear/usar segundo miembro mismo plan + mismo género.
2. Logear distinto score.
3. Verificar orden correcto en mini-leaderboard y sheet Top 10.

- [ ] **F1.8: Plan distinto → estado vacío**

1. Loguear como miembro de un plan NO asociado al schedule.
2. `/portal/wod` muestra "No hay rutina programada para hoy."

- [ ] **F1.9: Toggle M/F**

1. En leaderboard cambiar a "F" → muestra solo mujeres.
2. Volver a "M".

- [ ] **F1.10: Visibilidad show_wods**

1. Setear `members.show_wods = false` para uno de los miembros con log.
2. Refresh leaderboard → ese miembro desaparece.
3. Setear back a `true` → reaparece.

- [ ] **F1.11: Validación negativa de score_type**

Vía DevTools (network tab): construir manualmente una llamada a `upsertWodLog` con `score_type: 'weight'` para un bloque AMRAP. Verificar que el server lanza error con mensaje "El tipo de score no corresponde al bloque".

- [ ] **F1.12: Conflicto de unicidad**

1. Logear un bloque.
2. Intentar logear el mismo bloque con `INSERT` directo (no `UPSERT`) → falla con violation.
3. Vía UI: editar siempre debe funcionar (upsert).

- [ ] **F1.13: Limpieza**

```bash
git status
```

Verificar que no quedan archivos modificados ni `console.log` sueltos. Si hay, commitear o limpiar.

- [ ] **F1.14: Commit final con activity logs si aplica**

Si durante el testing se descubren ajustes menores (typos, paddings, edge case): commitear con prefijo `fix(wod): ...`.

---

## Self-review notes (para el ejecutor)

Antes de cerrar el PR final, verificar contra el spec (`docs/superpowers/specs/2026-05-06-wod-logging-design.md`):

- §3 (modelo de datos): ✅ A1, A2.
- §4 (server actions): ✅ B1–B3, C1–C4.
- §5.1 (wizard block builder): ✅ D1–D7.
- §5.2 (portal /portal/wod): ✅ E2–E6.
- §5.3 (botón en /portal/rutinas): ⚠️ E7 (puede quedar pendiente si no existe el componente, ver nota).
- §6 (validación rangos): ✅ embebida en C3.
- §7 (permisos): ✅ embebida en B3 (admin) y C3 (miembro).
- §8 (errores): ✅ throw + toast.error en cada handler.
- §9 (out of scope): respetado — no se introduce realtime, ni admin override, ni notificaciones.
- §10 (testing manual): ✅ F1.

Si encontraste algún gap durante la ejecución, anótalo en el PR y abre un follow-up.
