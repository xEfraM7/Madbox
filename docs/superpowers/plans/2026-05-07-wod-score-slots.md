# WOD Score Slots — Plan de implementación

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Reemplazar el modelo block-centric implementado el 2026-05-06 por un modelo donde el admin escribe Markdown libre y declara N "slots de score" (`{name, score_type}`); el miembro registra un score por slot con leaderboard segmentado por plan + género.

**Architecture:**
- Postgres: drop `routine_schedules.blocks`, add `routine_schedules.score_slots JSONB`, rename `wod_logs.block_id → slot_id`, replace constraint e índice.
- Validación: Zod array de slots `{id, order, name, score_type}`.
- Server actions: `routines.ts` y `wod-logs.ts` cambian `blocks` → `score_slots` y `block_id` → `slot_id`. Función renombrada: `getLeaderboardForBlock` → `getLeaderboardForSlot`.
- UI admin: paso 3 del wizard restaura el editor de Markdown (Tabs Editor/Preview con `ReactMarkdown` + `remarkGfm`) y agrega un `ScoreSlotsManager` para la lista de slots.
- UI portal: render del Markdown + cards por slot. Renombre `WodBlockCard → WodSlotCard`. Eliminación de `InfoBlockCard`.
- Cleanup: borrar `lib/constants/routine-blocks.ts`, `lib/schemas/routine-blocks.ts` y toda la carpeta `components/section-components/rutinas/blocks-editor/`.

**Tech Stack:** Next.js 16 + React 19 + TypeScript 5, Supabase (`@supabase/ssr`), TanStack Query 5, shadcn/ui (Radix), React Hook Form 7 + Zod 3, `react-markdown` + `remark-gfm`, `sonner`, `lucide-react`, `date-fns`.

**Pre-requisitos antes de empezar:**
- Working tree limpio (commit/stash de cualquier cambio pendiente).
- Acceso al proyecto Supabase vía MCP `mcp__supabase__*`. Project ID: `pnpoegsergczspixocez`.
- Servidor de desarrollo local funcional (`npm run dev`).
- Spec de referencia: `docs/superpowers/specs/2026-05-07-wod-score-slots-design.md`.
- Estado actual: el modelo block-centric ya está implementado y funcionando en `main`. Este plan lo reemplaza.

**Convenciones del proyecto:**
- No hay tests automatizados. Verificación = `npx tsc --noEmit` + `npm run lint` + verificación manual con `npm run dev` cuando toca UI/server action.
- Idioma de UI/comentarios/commits: español.
- Server actions mutativas llaman `revalidatePath` y `logActivity` cuando aplique.
- Estilos: dark mode fijo, paleta amarillo/dorado; iconos `lucide-react`; toasts `sonner`.
- Imports con alias `@/*`. Evitar `any` salvo cuando lo exige la API de Supabase.

---

## Fase A — Base de datos, tipos y validación

### Task A1: Migración SQL — drop blocks, add score_slots, rename block_id

**Files:**
- Create: `supabase/migrations/20260507120000_wod_score_slots.sql`

> **Nota sobre el timestamp:** si en `supabase/migrations/` ya existe una con prefijo posterior a `20260507120000`, usar la hora actual UTC en formato `YYYYMMDDHHmmss`.

- [ ] **A1.1: Crear el archivo con el SQL completo**

```sql
-- Reemplazo del modelo block-centric por score_slots.
-- Se hace drop de blocks (sin data viva), rename block_id -> slot_id,
-- y se reemplaza el constraint/índice asociado.

-- 1. Drop la columna blocks
ALTER TABLE routine_schedules DROP COLUMN blocks;

-- 2. Nueva columna score_slots
ALTER TABLE routine_schedules
  ADD COLUMN score_slots jsonb NOT NULL DEFAULT '[]'::jsonb;

-- 3. Renombrar block_id -> slot_id
ALTER TABLE wod_logs RENAME COLUMN block_id TO slot_id;

-- 4. Reemplazar constraint
ALTER TABLE wod_logs
  DROP CONSTRAINT IF EXISTS wod_logs_member_routine_block_key;
ALTER TABLE wod_logs
  ADD CONSTRAINT wod_logs_member_routine_slot_key
  UNIQUE (member_id, routine_id, slot_id);

-- 5. Reemplazar índice
DROP INDEX IF EXISTS idx_wod_logs_routine_block;
CREATE INDEX IF NOT EXISTS idx_wod_logs_routine_slot
  ON wod_logs(routine_id, slot_id);
```

- [ ] **A1.2: Aplicar la migración vía MCP**

Llamar `mcp__supabase__apply_migration` con:
- `project_id: "pnpoegsergczspixocez"`
- `name: "wod_score_slots"`
- `query`: el contenido SQL completo del archivo creado.

Si falla por nombre de constraint distinto, ejecutar primero:
```sql
SELECT conname FROM pg_constraint WHERE conrelid = 'wod_logs'::regclass;
```
y ajustar el `DROP CONSTRAINT IF EXISTS`.

- [ ] **A1.3: Verificar la migración**

Llamar `mcp__supabase__execute_sql` con:
```sql
SELECT
  table_name,
  column_name,
  data_type,
  is_nullable,
  column_default
FROM information_schema.columns
WHERE (table_name = 'routine_schedules' AND column_name IN ('blocks', 'score_slots'))
   OR (table_name = 'wod_logs' AND column_name IN ('block_id', 'slot_id'))
ORDER BY table_name, column_name;
```

Esperado:
- `routine_schedules.blocks` no aparece (dropped)
- `routine_schedules.score_slots jsonb NOT NULL DEFAULT '[]'::jsonb`
- `wod_logs.block_id` no aparece (renamed)
- `wod_logs.slot_id text NOT NULL DEFAULT ''`

Verificar el constraint:
```sql
SELECT conname FROM pg_constraint WHERE conrelid = 'wod_logs'::regclass;
```
Esperado: aparece `wod_logs_member_routine_slot_key`, no aparece `wod_logs_member_routine_block_key`.

- [ ] **A1.4: Commit**

```bash
git add supabase/migrations/20260507120000_wod_score_slots.sql
git commit -m "feat(wod): migracion drop blocks, add score_slots, rename block_id->slot_id"
```

---

### Task A2: Regenerar types/database.ts

**Files:**
- Modify: `types/database.ts` (regenerado entero)

- [ ] **A2.1: Llamar `mcp__supabase__generate_typescript_types`**

Con `project_id: "pnpoegsergczspixocez"`. Sobrescribir el contenido completo de `types/database.ts` con el output.

- [ ] **A2.2: Verificar campos clave**

```bash
grep -n "score_slots\|slot_id" types/database.ts | head -10
```
Esperado: `score_slots: Json` aparece en `routine_schedules`; `slot_id: string` aparece en `wod_logs`. No debe aparecer `blocks:` ni `block_id:` en la sección de Row.

- [ ] **A2.3: Type-check parcial**

```bash
npx tsc --noEmit 2>&1 | head -60
```
Esperado: aparecerán errores en `lib/actions/routines.ts` y `lib/actions/wod-logs.ts` por `blocks` / `block_id` no encontrados — se resuelven en B y C. No debe haber errores adentro de `types/database.ts`.

- [ ] **A2.4: Commit**

```bash
git add types/database.ts
git commit -m "chore(types): regenerar database.ts con score_slots y slot_id"
```

---

### Task A3: Crear `lib/constants/score-slots.ts`

**Files:**
- Create: `lib/constants/score-slots.ts`

- [ ] **A3.1: Crear el archivo con el tipo + helpers**

```ts
import type { ScoreType } from "@/lib/constants/wod-score"

export interface ScoreSlot {
  id: string         // UUID estable
  order: number      // 0-indexed
  name: string       // 1–100 chars
  score_type: ScoreType
}

export function createScoreSlot(score_type: ScoreType, order: number): ScoreSlot {
  return {
    id: typeof crypto !== "undefined" && "randomUUID" in crypto
      ? crypto.randomUUID()
      : `slot-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`,
    order,
    name: "",
    score_type,
  }
}

export function parseScoreSlots(raw: unknown): ScoreSlot[] {
  if (!Array.isArray(raw)) return []
  const valid: ScoreSlot[] = []
  for (const item of raw) {
    if (
      item &&
      typeof item === "object" &&
      typeof (item as any).id === "string" &&
      typeof (item as any).order === "number" &&
      typeof (item as any).name === "string" &&
      ["for_time", "amrap", "for_reps", "weight"].includes((item as any).score_type)
    ) {
      valid.push({
        id: (item as any).id,
        order: (item as any).order,
        name: (item as any).name,
        score_type: (item as any).score_type as ScoreType,
      })
    }
  }
  return valid.sort((a, b) => a.order - b.order)
}
```

- [ ] **A3.2: Type-check**

```bash
npx tsc --noEmit 2>&1 | grep "score-slots" | head -10
```
Esperado: 0 errores en `score-slots.ts`.

- [ ] **A3.3: No commitear todavía** — se commitea con A4.

---

### Task A4: Crear `lib/schemas/score-slots.ts`

**Files:**
- Create: `lib/schemas/score-slots.ts`

- [ ] **A4.1: Crear el archivo**

```ts
import { z } from "zod"

export const scoreSlotSchema = z.object({
  id: z.string().min(1),
  order: z.number().int().min(0),
  name: z.string().min(1, "Nombre requerido").max(100, "Máx. 100 caracteres"),
  score_type: z.enum(["for_time", "amrap", "for_reps", "weight"]),
})

// Array vacío es válido — rutina sin logging (rest day, recovery, skill puro).
export const scoreSlotsSchema = z.array(scoreSlotSchema)
```

- [ ] **A4.2: Type-check**

```bash
npx tsc --noEmit 2>&1 | grep "score-slots" | head -10
```
Esperado: 0 errores en los archivos nuevos.

- [ ] **A4.3: Commit**

```bash
git add lib/constants/score-slots.ts lib/schemas/score-slots.ts
git commit -m "feat(wod): tipo ScoreSlot, helpers parseScoreSlots/createScoreSlot y schema Zod"
```

---

## Fase B — Server actions: routines.ts

### Task B1: Reemplazar imports e interfaces

**Files:**
- Modify: `lib/actions/routines.ts` (top del archivo, imports e interfaces)

- [ ] **B1.1: Cambiar imports**

Localizar las 3 líneas:
```ts
import type { RoutineBlock } from "@/lib/constants/routine-blocks"
import { parseBlocks } from "@/lib/constants/routine-blocks"
import { routineBlocksSchema } from "@/lib/schemas/routine-blocks"
```

Reemplazar por:
```ts
import type { ScoreSlot } from "@/lib/constants/score-slots"
import { parseScoreSlots } from "@/lib/constants/score-slots"
import { scoreSlotsSchema } from "@/lib/schemas/score-slots"
```

- [ ] **B1.2: Reemplazar las 3 interfaces**

Buscar:
```ts
export interface RoutineSchedule {
  id: string
  date: string
  name: string | null
  content: string
  blocks: RoutineBlock[]
  ...
}
```

Reemplazar por:
```ts
export interface RoutineSchedule {
  id: string
  date: string // YYYY-MM-DD
  name: string | null
  content: string
  score_slots: ScoreSlot[]
  created_at: string | null
  updated_at: string | null
  plans: Array<{ id: string; name: string }>
}

export interface CreateRoutineScheduleInput {
  date: string
  name?: string | null
  content?: string
  score_slots: ScoreSlot[]
  plan_ids: string[]
  replace_conflicts?: boolean
}

export interface UpdateRoutineScheduleInput {
  date?: string
  name?: string | null
  content?: string
  score_slots?: ScoreSlot[]
  plan_ids?: string[]
  replace_conflicts?: boolean
}
```

(reemplazar también las 2 interfaces Create/Update si existen separadas — debe quedar el bloque completo arriba).

- [ ] **B1.3: Type-check**

```bash
npx tsc --noEmit 2>&1 | grep "routines.ts" | head -20
```
Esperable: errores en `shapeRoutineSchedule`, `createRoutineSchedule`, `updateRoutineSchedule` por `blocks` no manejado. Se resuelven en B2/B3.

- [ ] **B1.4: No commitear todavía** — se commitea con B2/B3.

---

### Task B2: Mapear `score_slots` en lecturas

**Files:**
- Modify: `lib/actions/routines.ts` (función `shapeRoutineSchedule` y los SELECT)

- [ ] **B2.1: Actualizar `shapeRoutineSchedule`**

Localizar la función completa y reemplazarla:

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
    score_slots: parseScoreSlots(row.score_slots),
    created_at: row.created_at ?? null,
    updated_at: row.updated_at ?? null,
    plans: plansArr,
  }
}
```

- [ ] **B2.2: Reemplazar `blocks` por `score_slots` en los SELECT**

Buscar todas las ocurrencias de `blocks` en strings de SELECT y reemplazarlas por `score_slots`. Hay 3 lugares (`getRoutineSchedules`, `getRoutineSchedule`, `getRoutineForMemberOnDate`). Antes:
```ts
.select(
  "id, date, name, content, blocks, created_at, updated_at, routine_schedule_plans(plan_id, plans(id, name))",
)
```
Después:
```ts
.select(
  "id, date, name, content, score_slots, created_at, updated_at, routine_schedule_plans(plan_id, plans(id, name))",
)
```

En `getRoutineForMemberOnDate` el SELECT está anidado dentro de `routine_schedule_plans!inner(...)` — agregar `score_slots` allí también.

- [ ] **B2.3: Type-check**

```bash
npx tsc --noEmit 2>&1 | grep "routines.ts" | head -20
```
Errores remanentes en `createRoutineSchedule` y `updateRoutineSchedule` esperables — se resuelven en B3.

- [ ] **B2.4: No commitear todavía**

---

### Task B3: Validar y persistir `score_slots` en create/update

**Files:**
- Modify: `lib/actions/routines.ts` (`createRoutineSchedule`, `updateRoutineSchedule`)

- [ ] **B3.1: Reemplazar `createRoutineSchedule`**

Localizar la función y sustituirla completa:

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

  // Validar score_slots con Zod (puede ser vacío)
  const parsedSlots = scoreSlotsSchema.safeParse(input.score_slots ?? [])
  if (!parsedSlots.success) {
    throw new Error(parsedSlots.error.issues[0]?.message ?? "Slots inválidos")
  }
  const score_slots = parsedSlots.data

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
      score_slots: score_slots as any,
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

  let validatedSlots: ScoreSlot[] | undefined
  if (input.score_slots !== undefined) {
    const parsed = scoreSlotsSchema.safeParse(input.score_slots)
    if (!parsed.success) {
      throw new Error(parsed.error.issues[0]?.message ?? "Slots inválidos")
    }
    validatedSlots = parsed.data
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
  if (validatedSlots !== undefined) updatePayload.score_slots = validatedSlots

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
npx tsc --noEmit 2>&1 | grep "routines.ts" | head -10
```
Esperado: 0 errores en `routines.ts`. Errores remanentes esperados en `wod-logs.ts` y consumidores UI — se resuelven en C, D, E.

- [ ] **B3.4: Commit**

```bash
git add lib/actions/routines.ts
git commit -m "feat(rutinas): persistir score_slots validados con Zod en server actions"
```

---

## Fase C — Server actions: wod-logs.ts

### Task C1: Renombrar `block_id` → `slot_id` en interfaces y helpers

**Files:**
- Modify: `lib/actions/wod-logs.ts` (sección de tipos públicos y helpers)

- [ ] **C1.1: Cambiar imports**

Buscar:
```ts
import {
  parseBlocks,
  getScoreTypeForBlock,
  type RoutineBlock,
} from "@/lib/constants/routine-blocks"
```

Reemplazar por:
```ts
import {
  parseScoreSlots,
  type ScoreSlot,
} from "@/lib/constants/score-slots"
```

(Quitar `getScoreTypeForBlock` y `RoutineBlock` — no se usan en el nuevo modelo.)

- [ ] **C1.2: Renombrar campo en `WodLog`**

Buscar:
```ts
export interface WodLog {
  id: string
  member_id: string
  routine_id: string
  block_id: string
  ...
}
```

Reemplazar por:
```ts
export interface WodLog {
  id: string
  member_id: string
  routine_id: string
  slot_id: string
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
```

- [ ] **C1.3: Renombrar campo en `UpsertWodLogInput`**

Buscar y reemplazar la interfaz:

```ts
export interface UpsertWodLogInput {
  routine_id: string
  slot_id: string
  score_type: ScoreType
  score_seconds?: number | null
  score_rounds?: number | null
  score_reps?: number | null
  score_kg?: number | null
  rx: boolean
  notes?: string | null
}
```

- [ ] **C1.4: Reemplazar `RoutineForMemberToday`**

Buscar:
```ts
export interface RoutineForMemberToday {
  ...
  blocks: RoutineBlock[]
  plan_ids: string[]
}
```

Reemplazar por:
```ts
export interface RoutineForMemberToday {
  id: string
  date: string
  name: string | null
  content: string
  score_slots: ScoreSlot[]
  plan_ids: string[]
}
```

- [ ] **C1.5: Renombrar `block_id` en `WodLeaderboardResult`**

Buscar:
```ts
export interface WodLeaderboardResult {
  routine_id: string
  block_id: string
  gender: "male" | "female"
  entries: WodLeaderboardEntry[]
}
```

Reemplazar por:
```ts
export interface WodLeaderboardResult {
  routine_id: string
  slot_id: string
  gender: "male" | "female"
  entries: WodLeaderboardEntry[]
}
```

- [ ] **C1.6: Actualizar `rowToWodLog`**

Buscar la función y reemplazar:
```ts
function rowToWodLog(row: any): WodLog {
  return {
    id: row.id,
    member_id: row.member_id,
    routine_id: row.routine_id,
    slot_id: row.slot_id,
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

- [ ] **C1.7: No commitear todavía** — se commitea con C2/C3/C4.

---

### Task C2: Actualizar `getRoutineForToday`

**Files:**
- Modify: `lib/actions/wod-logs.ts` (función `getRoutineForToday`)

- [ ] **C2.1: Reemplazar la función**

```ts
export async function getRoutineForToday(): Promise<RoutineForMemberToday | null> {
  const me = await getMyMemberRow()
  if (!me?.plan_id) return null

  const supabase = await createClient()
  const today = todayCaracasISO()

  const { data, error } = await supabase
    .from("routine_schedule_plans")
    .select(
      "schedule_id, plan_id, routine_schedules!inner(id, date, name, content, score_slots)",
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
    score_slots: parseScoreSlots(rs.score_slots),
    plan_ids: (allPlans ?? []).map((r) => r.plan_id),
  }
}
```

- [ ] **C2.2: No commitear todavía**

---

### Task C3: Actualizar `upsertWodLog` (validación contra `score_slots`)

**Files:**
- Modify: `lib/actions/wod-logs.ts` (función `upsertWodLog`)

- [ ] **C3.1: Reemplazar la función**

```ts
export async function upsertWodLog(input: UpsertWodLogInput): Promise<WodLog> {
  const me = await getMyMemberRow()
  if (!me) throw new Error("No autenticado")
  if (!me.plan_id) throw new Error("No tienes plan asignado")

  if (!input.routine_id || !input.slot_id) {
    throw new Error("Datos de rutina/slot incompletos")
  }
  if ((input.notes ?? "").length > 500) {
    throw new Error("Las notas no pueden exceder 500 caracteres")
  }

  const supabase = await createClient()

  // 1. Validar que el schedule existe, contiene el slot y aplica al plan del miembro
  const { data: schedule, error: sErr } = await supabase
    .from("routine_schedules")
    .select("id, date, score_slots, routine_schedule_plans(plan_id)")
    .eq("id", input.routine_id)
    .maybeSingle()
  if (sErr) throw sErr
  if (!schedule) throw new Error("Rutina no encontrada")

  const slots = parseScoreSlots(schedule.score_slots)
  const slot = slots.find((s) => s.id === input.slot_id)
  if (!slot) throw new Error("Slot no encontrado en la rutina")

  if (slot.score_type !== input.score_type) {
    throw new Error("El tipo de score no corresponde al slot")
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
    slot_id: input.slot_id,
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
    .upsert(payload, { onConflict: "member_id,routine_id,slot_id" })
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
```

- [ ] **C3.2: No commitear todavía**

---

### Task C4: Renombrar `getLeaderboardForBlock` → `getLeaderboardForSlot`

**Files:**
- Modify: `lib/actions/wod-logs.ts` (función `getLeaderboardForBlock`)

- [ ] **C4.1: Reemplazar la función**

```ts
export async function getLeaderboardForSlot(input: {
  routine_id: string
  slot_id: string
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
      slot_id: input.slot_id,
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
      slot_id: input.slot_id,
      gender: input.gender,
      entries: [],
    }
  }

  const memberIds = members.map((m) => m.id)
  const memberMap = new Map(members.map((m) => [m.id, m]))

  // 3. Logs del slot para esos miembros
  const { data: logs, error: lErr } = await admin
    .from("wod_logs")
    .select("*")
    .eq("routine_id", input.routine_id)
    .eq("slot_id", input.slot_id)
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
    slot_id: input.slot_id,
    gender: input.gender,
    entries,
  }
}
```

- [ ] **C4.2: Type-check + lint**

```bash
npx tsc --noEmit 2>&1 | grep "wod-logs.ts" | head -10
```
Esperado: 0 errores en `wod-logs.ts`. Errores en consumidores UI esperables — se resuelven en E.

```bash
npm run lint 2>&1 | tail -10
```

- [ ] **C4.3: Commit**

```bash
git add lib/actions/wod-logs.ts
git commit -m "feat(wod): server actions ahora operan sobre score_slots y slot_id"
```

---

## Fase D — Cleanup + Wizard admin

### Task D1: Eliminar archivos del modelo block-centric

**Files:**
- Delete: `lib/constants/routine-blocks.ts`
- Delete: `lib/schemas/routine-blocks.ts`
- Delete: `components/section-components/rutinas/blocks-editor/` (carpeta entera)
- Delete: `components/section-components/portal/wod/InfoBlockCard.tsx`

- [ ] **D1.1: Eliminar los archivos**

```bash
rm lib/constants/routine-blocks.ts
rm lib/schemas/routine-blocks.ts
rm -rf components/section-components/rutinas/blocks-editor
rm components/section-components/portal/wod/InfoBlockCard.tsx
```

- [ ] **D1.2: Verificar imports rotos**

```bash
grep -rn "from \"@/lib/constants/routine-blocks\"\|from \"@/lib/schemas/routine-blocks\"\|blocks-editor\|InfoBlockCard" --include="*.tsx" --include="*.ts" . 2>/dev/null | grep -v "node_modules\|\.next"
```

Esperado: aparecerán matches en `routine-wizard-modal.tsx`, `WodBlockCard.tsx`, `PortalWodMainComponent.tsx` — esos se resuelven en D2 y E. No debe haber otros consumidores.

- [ ] **D1.3: No commitear todavía** — se commitea junto a D2 (el wizard depende de esto).

---

### Task D2: Crear `ScoreSlotsManager`

**Files:**
- Create: `components/section-components/rutinas/ScoreSlotsManager.tsx`

- [ ] **D2.1: Crear el archivo**

```tsx
"use client"

import { useMemo } from "react"
import { ChevronDown, ChevronUp, Plus, Trash2 } from "lucide-react"
import { Input } from "@/components/ui/input"
import { Button } from "@/components/ui/button"
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select"
import {
  createScoreSlot,
  type ScoreSlot,
} from "@/lib/constants/score-slots"
import {
  SCORE_TYPE_LABEL,
  SCORE_TYPE_ORDER,
  type ScoreType,
} from "@/lib/constants/wod-score"

interface Props {
  slots: ScoreSlot[]
  onChange: (next: ScoreSlot[]) => void
}

function reorder(slots: ScoreSlot[]): ScoreSlot[] {
  return slots.map((s, i) => ({ ...s, order: i }))
}

export function ScoreSlotsManager({ slots, onChange }: Props) {
  const sorted = useMemo(
    () => [...slots].sort((a, b) => a.order - b.order),
    [slots],
  )

  const addSlot = () => {
    onChange(reorder([...sorted, createScoreSlot("for_time", sorted.length)]))
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
  const updateAt = (idx: number, patch: Partial<ScoreSlot>) => {
    const next = sorted.slice()
    next[idx] = { ...next[idx], ...patch }
    onChange(next)
  }

  return (
    <div className="space-y-2">
      <div className="flex items-center justify-between">
        <span className="text-xs uppercase tracking-wide text-muted-foreground font-medium">
          Slots de score ({sorted.length})
        </span>
        <Button
          type="button"
          size="sm"
          variant="outline"
          onClick={addSlot}
          className="gap-1.5"
        >
          <Plus className="h-3.5 w-3.5" /> Agregar slot
        </Button>
      </div>

      {sorted.length === 0 ? (
        <div className="rounded-lg border border-dashed border-border p-4 text-center">
          <p className="text-xs text-muted-foreground">
            Sin slots. La rutina será solo informativa (no se registrarán scores).
          </p>
        </div>
      ) : (
        <ul className="space-y-1.5">
          {sorted.map((slot, idx) => (
            <li
              key={slot.id}
              className="flex items-center gap-1.5 rounded-md border border-border bg-card p-2"
            >
              <Input
                placeholder='Ej: "Murph" o "Back Squat 5RM"'
                value={slot.name}
                onChange={(e) => updateAt(idx, { name: e.target.value })}
                maxLength={100}
                className="flex-1"
              />
              <Select
                value={slot.score_type}
                onValueChange={(v) => updateAt(idx, { score_type: v as ScoreType })}
              >
                <SelectTrigger className="w-32">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  {SCORE_TYPE_ORDER.map((t) => (
                    <SelectItem key={t} value={t}>
                      {SCORE_TYPE_LABEL[t]}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
              <Button
                type="button"
                variant="ghost"
                size="icon"
                className="h-8 w-8 shrink-0"
                onClick={() => moveUp(idx)}
                disabled={idx === 0}
              >
                <ChevronUp className="h-3.5 w-3.5" />
              </Button>
              <Button
                type="button"
                variant="ghost"
                size="icon"
                className="h-8 w-8 shrink-0"
                onClick={() => moveDown(idx)}
                disabled={idx >= sorted.length - 1}
              >
                <ChevronDown className="h-3.5 w-3.5" />
              </Button>
              <Button
                type="button"
                variant="ghost"
                size="icon"
                className="h-8 w-8 shrink-0 text-destructive"
                onClick={() => removeAt(idx)}
              >
                <Trash2 className="h-3.5 w-3.5" />
              </Button>
            </li>
          ))}
        </ul>
      )}
    </div>
  )
}
```

- [ ] **D2.2: Type-check**

```bash
npx tsc --noEmit 2>&1 | grep "ScoreSlotsManager" | head -10
```
Esperado: 0 errores. Si `Select` no está en `components/ui/`, instalarlo:
```bash
npx shadcn@latest add select
```
y reintentar.

- [ ] **D2.3: No commitear todavía** — se commitea con D3.

---

### Task D3: Refactorizar `routine-wizard-modal.tsx`

**Files:**
- Modify: `components/section-components/rutinas/modals/routine-wizard-modal.tsx`

- [ ] **D3.1: Reemplazar imports**

Localizar el bloque de imports (líneas 1–37) y reemplazar las 3 últimas líneas:

```ts
import { createBlock, type RoutineBlock } from "@/lib/constants/routine-blocks"
import { routineBlocksSchema } from "@/lib/schemas/routine-blocks"
import { RoutineBlocksEditor } from "../blocks-editor/RoutineBlocksEditor"
```

Reemplazar por:
```ts
import ReactMarkdown from "react-markdown"
import remarkGfm from "remark-gfm"
import { Eye, Pencil } from "lucide-react"
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs"
import { Textarea } from "@/components/ui/textarea"
import { type ScoreSlot } from "@/lib/constants/score-slots"
import { scoreSlotsSchema } from "@/lib/schemas/score-slots"
import { ScoreSlotsManager } from "../ScoreSlotsManager"
```

> Si `Tabs` o `Textarea` no están instalados, ejecutar `npx shadcn@latest add tabs textarea`.

- [ ] **D3.2: Reemplazar el schema y el tipo `FormValues`**

Buscar:
```ts
const schema = z.object({
  date: z.string().min(1, "Selecciona una fecha"),
  plan_ids: z.array(z.string().uuid()).min(1, "Selecciona al menos un plan"),
  name: z.string().max(100, "Máx. 100 caracteres").optional(),
  blocks: routineBlocksSchema,
})
type FormValues = z.infer<typeof schema>
```

Reemplazar por:
```ts
const schema = z.object({
  date: z.string().min(1, "Selecciona una fecha"),
  plan_ids: z.array(z.string().uuid()).min(1, "Selecciona al menos un plan"),
  name: z.string().max(100, "Máx. 100 caracteres").optional(),
  content: z.string(),
  score_slots: scoreSlotsSchema,
})
type FormValues = z.infer<typeof schema>
```

- [ ] **D3.3: Reemplazar `initialBlocks` por `initialSlots` y ajustar `useForm`/`useEffect`**

Buscar el bloque que empieza con `const initialBlocks = useMemo<RoutineBlock[]>` y termina al final del `useEffect`. Reemplazarlo entero:

```ts
const initialSlots = useMemo<ScoreSlot[]>(
  () => (routine?.score_slots ?? []),
  [routine],
)

const form = useForm<FormValues>({
  resolver: zodResolver(schema),
  defaultValues: {
    date: routine?.date ?? todayISO,
    plan_ids: routine?.plans.map((p) => p.id) ?? [],
    name: routine?.name ?? "",
    content: routine?.content ?? "",
    score_slots: initialSlots,
  },
})

useEffect(() => {
  if (open) {
    form.reset({
      date: routine?.date ?? todayISO,
      plan_ids: routine?.plans.map((p) => p.id) ?? [],
      name: routine?.name ?? "",
      content: routine?.content ?? "",
      score_slots: initialSlots,
    })
    setStep(1)
    setConflictPlanIds([])
    setAllowReplace(false)
  }
}, [open, routine, todayISO, form, initialSlots])
```

- [ ] **D3.4: Reemplazar `form.watch("blocks")` por `form.watch("content")` y `form.watch("score_slots")`**

Buscar en el archivo cualquier ocurrencia de `const blocks = form.watch("blocks")` y reemplazarla:

```ts
const content = form.watch("content")
const score_slots = form.watch("score_slots")
```

- [ ] **D3.5: Actualizar `submitMut`**

Localizar `submitMut` y dentro del `mutationFn`, cambiar las llamadas:

```ts
const submitMut = useMutation({
  mutationFn: async (values: FormValues) => {
    if (mode === "create") {
      return createRoutineSchedule({
        date: values.date,
        name: values.name?.trim() || null,
        content: values.content,
        score_slots: values.score_slots,
        plan_ids: values.plan_ids,
        replace_conflicts: allowReplace,
      })
    } else {
      if (!routine) throw new Error("Rutina no encontrada")
      return updateRoutineSchedule(routine.id, {
        date: values.date,
        name: values.name?.trim() || null,
        content: values.content,
        score_slots: values.score_slots,
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

- [ ] **D3.6: Actualizar `stepValid`**

Buscar:
```ts
const stepValid =
  (step === 1 && !!date && (mode === "edit" || date >= todayISO)) ||
  (step === 2 && planIds.length > 0) ||
  (step === 3 && (blocks ?? []).length > 0)
```

Reemplazar por:
```ts
const stepValid =
  (step === 1 && !!date && (mode === "edit" || date >= todayISO)) ||
  (step === 2 && planIds.length > 0) ||
  (step === 3 &&
    (!!content?.trim() || (score_slots ?? []).length > 0))
```

- [ ] **D3.7: Reemplazar el contenido del paso 3**

Buscar el bloque `{step === 3 && ( ... )}` completo y reemplazarlo:

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

    <div className="space-y-2">
      <Label>Contenido (Markdown)</Label>
      <Tabs defaultValue="editor">
        <TabsList className="grid w-full grid-cols-2">
          <TabsTrigger value="editor" className="gap-1.5">
            <Pencil className="h-3.5 w-3.5" /> Editor
          </TabsTrigger>
          <TabsTrigger value="preview" className="gap-1.5">
            <Eye className="h-3.5 w-3.5" /> Preview
          </TabsTrigger>
        </TabsList>
        <TabsContent value="editor">
          <Textarea
            placeholder="# AMRAP 20'&#10;- 10 pull-ups&#10;- 20 push-ups&#10;- 30 air squats"
            value={content ?? ""}
            onChange={(e) => form.setValue("content", e.target.value, { shouldValidate: true })}
            rows={10}
            className="font-mono text-sm"
          />
        </TabsContent>
        <TabsContent value="preview">
          <div className="rounded-md border border-border bg-card/40 p-3 min-h-[12rem] prose prose-invert prose-sm max-w-none">
            {content?.trim() ? (
              <ReactMarkdown remarkPlugins={[remarkGfm]}>{content}</ReactMarkdown>
            ) : (
              <p className="text-xs text-muted-foreground italic">Sin contenido. Empieza a escribir en la pestaña Editor.</p>
            )}
          </div>
        </TabsContent>
      </Tabs>
    </div>

    <ScoreSlotsManager
      slots={score_slots ?? []}
      onChange={(next) => form.setValue("score_slots", next, { shouldValidate: true })}
    />

    {form.formState.errors.score_slots && (
      <p className="text-xs text-destructive">
        {form.formState.errors.score_slots.message ??
          (Array.isArray(form.formState.errors.score_slots)
            ? "Hay slots con campos inválidos"
            : "Slots inválidos")}
      </p>
    )}

    {!stepValid && (
      <p className="text-xs text-muted-foreground">
        Agrega al menos contenido en Markdown o un slot de score.
      </p>
    )}
  </div>
)}
```

- [ ] **D3.8: Type-check + lint**

```bash
npx tsc --noEmit 2>&1 | grep "routine-wizard-modal" | head -10
```
Esperado: 0 errores en `routine-wizard-modal.tsx`.

```bash
npm run lint 2>&1 | tail -10
```

- [ ] **D3.9: Verificación manual**

```bash
npm run dev
```

Como admin, ir a `/dashboard/rutinas`:
1. Click "Crear rutina" → fecha futura → siguiente.
2. Seleccionar al menos un plan → siguiente.
3. Paso 3 muestra:
   - Input de nombre (opcional)
   - Tabs Editor/Preview de Markdown
   - Slot manager con botón "Agregar slot"
4. Escribir Markdown: `# AMRAP 20'\n- 10 pull-ups\n- 20 push-ups\n- 30 air squats`
5. Click Preview → ve el render.
6. Volver a Editor.
7. Agregar slot "Murph" tipo `For Time`.
8. Agregar slot "Back Squat 5RM" tipo `Peso`.
9. Reordenar con ↑/↓.
10. Eliminar uno y agregar otro.
11. Click "Crear rutina" → toast verde, modal cierra.
12. Verificar en Supabase: `SELECT id, content, score_slots FROM routine_schedules WHERE date = '...';` que `content` tiene el markdown y `score_slots` tiene los slots con UUIDs.
13. Editar la misma rutina → debe abrir con todo cargado; cambiar el name de un slot y guardar; verificar que los IDs persisten.
14. Probar caso "rutina informativa": markdown sin slots → guardar → rutina creada con `score_slots = []`.
15. Probar caso "rutina sin nada": dejar vacío todo en paso 3 → botón "Crear rutina" debe estar deshabilitado.

- [ ] **D3.10: Commit**

```bash
git add -A
git commit -m "feat(rutinas): wizard paso 3 con editor Markdown + ScoreSlotsManager"
```

(El commit incluye el cleanup de D1, el ScoreSlotsManager de D2 y el wizard de D3 — todos cohesivos.)

---

## Fase E — Portal del miembro

### Task E1: Renombrar `WodBlockCard` → `WodSlotCard`

**Files:**
- Rename: `components/section-components/portal/wod/WodBlockCard.tsx` → `WodSlotCard.tsx`
- Modify: el contenido nuevo

- [ ] **E1.1: Renombrar el archivo**

```bash
git mv components/section-components/portal/wod/WodBlockCard.tsx components/section-components/portal/wod/WodSlotCard.tsx
```

- [ ] **E1.2: Reemplazar el contenido completo**

```tsx
"use client"

import { useState } from "react"
import { Pencil } from "lucide-react"
import { Badge } from "@/components/ui/badge"
import { Button } from "@/components/ui/button"
import {
  formatScore,
  SCORE_TYPE_LABEL,
} from "@/lib/constants/wod-score"
import type { ScoreSlot } from "@/lib/constants/score-slots"
import type { WodLog } from "@/lib/actions/wod-logs"
import { LogWodModal } from "./log-wod-modal"
import { WodMiniLeaderboard } from "./WodMiniLeaderboard"
import { WodFullLeaderboardSheet } from "./WodFullLeaderboardSheet"

interface Props {
  routineId: string
  slot: ScoreSlot
  myLog: WodLog | null
  defaultGender: "male" | "female"
  myMemberId: string
}

export function WodSlotCard({ routineId, slot, myLog, defaultGender, myMemberId }: Props) {
  const [logModalOpen, setLogModalOpen] = useState(false)
  const [sheetOpen, setSheetOpen] = useState(false)

  const scoreTypeLabel = SCORE_TYPE_LABEL[slot.score_type]

  return (
    <div className="rounded-xl border border-border bg-card p-3.5 space-y-3">
      <div className="flex items-center gap-2">
        <Badge variant="default" className="gap-1">
          {scoreTypeLabel.toUpperCase()}
        </Badge>
        <span className="text-sm font-semibold flex-1 truncate">{slot.name}</span>
        {myLog && (
          <Badge variant="outline" className="text-[10px] border-emerald-500/40 text-emerald-500">
            LOGEADO
          </Badge>
        )}
      </div>

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
          Registrar {scoreTypeLabel}
        </Button>
      )}

      <WodMiniLeaderboard
        routineId={routineId}
        slotId={slot.id}
        defaultGender={defaultGender}
        onOpenFull={() => setSheetOpen(true)}
        highlightMemberId={myMemberId}
      />

      <LogWodModal
        open={logModalOpen}
        onOpenChange={setLogModalOpen}
        routineId={routineId}
        slot={slot}
        existingLog={myLog}
      />

      <WodFullLeaderboardSheet
        open={sheetOpen}
        onOpenChange={setSheetOpen}
        routineId={routineId}
        slotId={slot.id}
        slotLabel={slot.name}
        defaultGender={defaultGender}
        highlightMemberId={myMemberId}
      />
    </div>
  )
}
```

- [ ] **E1.3: No commitear todavía** — la nueva interfaz de `LogWodModal` y los `slotId` props se ajustan en E2/E3/E4.

---

### Task E2: Adaptar `LogWodModal` para recibir `slot`

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
import { SCORE_TYPE_LABEL } from "@/lib/constants/wod-score"
import type { ScoreSlot } from "@/lib/constants/score-slots"
import { WodScoreInputs, type WodScoreInputValues } from "./WodScoreInputs"

interface Props {
  open: boolean
  onOpenChange: (open: boolean) => void
  routineId: string
  slot: ScoreSlot
  existingLog: WodLog | null
}

const EMPTY_VALUES: WodScoreInputValues = {
  score_type: "for_time",
  minutes: 0, seconds: 0,
  rounds: 0, reps_extra: 0,
  reps: 0, kg: 0,
}

export function LogWodModal({ open, onOpenChange, routineId, slot, existingLog }: Props) {
  const queryClient = useQueryClient()
  const scoreType = slot.score_type

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
            slot_id: slot.id,
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
            slot_id: slot.id,
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
            slot_id: slot.id,
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
            slot_id: slot.id,
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
            <span className="font-medium">{slot.name}</span>
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

- [ ] **E2.2: No commitear todavía** — sigue dependiendo de E3/E4 (props renombrados).

---

### Task E3: Renombrar `blockId` → `slotId` en `WodMiniLeaderboard`

**Files:**
- Modify: `components/section-components/portal/wod/WodMiniLeaderboard.tsx`

- [ ] **E3.1: Reemplazar el archivo completo**

```tsx
"use client"

import { useState } from "react"
import { useQuery } from "@tanstack/react-query"
import { Trophy, Loader2 } from "lucide-react"
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar"
import { Badge } from "@/components/ui/badge"
import { Button } from "@/components/ui/button"
import { cn } from "@/lib/utils"
import { getLeaderboardForSlot } from "@/lib/actions/wod-logs"
import { formatScore } from "@/lib/constants/wod-score"

interface Props {
  routineId: string
  slotId: string
  defaultGender: "male" | "female"
  onOpenFull: () => void
  highlightMemberId?: string
}

export function WodMiniLeaderboard({
  routineId,
  slotId,
  defaultGender,
  onOpenFull,
  highlightMemberId,
}: Props) {
  const [gender, setGender] = useState<"male" | "female">(defaultGender)

  const { data, isLoading } = useQuery({
    queryKey: ["wod-leaderboard", routineId, slotId, gender],
    queryFn: () =>
      getLeaderboardForSlot({ routine_id: routineId, slot_id: slotId, gender, limit: 3 }),
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
          Aún nadie ha registrado este slot.
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
        Ver Top 10
      </Button>
    </div>
  )
}
```

- [ ] **E3.2: No commitear todavía**

---

### Task E4: Renombrar `blockId` → `slotId` en `WodFullLeaderboardSheet`

**Files:**
- Modify: `components/section-components/portal/wod/WodFullLeaderboardSheet.tsx`

- [ ] **E4.1: Reemplazar el archivo completo**

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
import { getLeaderboardForSlot } from "@/lib/actions/wod-logs"
import { formatScore } from "@/lib/constants/wod-score"

interface Props {
  open: boolean
  onOpenChange: (open: boolean) => void
  routineId: string
  slotId: string
  slotLabel: string
  defaultGender: "male" | "female"
  highlightMemberId?: string
}

export function WodFullLeaderboardSheet({
  open,
  onOpenChange,
  routineId,
  slotId,
  slotLabel,
  defaultGender,
  highlightMemberId,
}: Props) {
  const [gender, setGender] = useState<"male" | "female">(defaultGender)

  const { data, isLoading } = useQuery({
    queryKey: ["wod-leaderboard", routineId, slotId, gender, "full"],
    queryFn: () =>
      getLeaderboardForSlot({ routine_id: routineId, slot_id: slotId, gender, limit: 10 }),
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
          <SheetDescription>{slotLabel}</SheetDescription>
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
              Aún nadie ha registrado este slot hoy.
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

- [ ] **E4.2: No commitear todavía**

---

### Task E5: Reescribir `PortalWodMainComponent`

**Files:**
- Modify: `components/section-components/portal/wod/PortalWodMainComponent.tsx`

- [ ] **E5.1: Reemplazar el archivo completo**

```tsx
"use client"

import { useEffect, useState } from "react"
import { useQuery } from "@tanstack/react-query"
import { Calendar, Loader2 } from "lucide-react"
import { format, parseISO } from "date-fns"
import { es } from "date-fns/locale"
import ReactMarkdown from "react-markdown"
import remarkGfm from "remark-gfm"
import {
  getRoutineForToday,
  getMyWodLogsForRoutine,
} from "@/lib/actions/wod-logs"
import { WodSlotCard } from "./WodSlotCard"
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

  // Caso límite: rutina existe pero sin contenido ni slots → tratar como "no hay rutina"
  if (!routine.content?.trim() && routine.score_slots.length === 0) {
    return (
      <div className="space-y-4">
        <div>
          <h1 className="text-2xl font-bold tracking-tight">WOD del día</h1>
        </div>
        <div className="rounded-xl border border-dashed p-10 text-center space-y-3">
          <Calendar className="h-10 w-10 mx-auto text-muted-foreground" />
          <p className="text-sm font-medium">La rutina de hoy está vacía.</p>
          <p className="text-xs text-muted-foreground">Avísale al admin del gimnasio.</p>
        </div>
      </div>
    )
  }

  const sortedSlots = [...routine.score_slots].sort((a, b) => a.order - b.order)
  const dateLabel = format(parseISO(routine.date + "T00:00:00"), "EEEE, d 'de' MMMM", { locale: es })
  const logsBySlotId = new Map(myLogs.map((l) => [l.slot_id, l]))

  return (
    <div className="space-y-4">
      <div>
        <p className="text-[10px] uppercase tracking-wide text-muted-foreground font-medium">
          {dateLabel.charAt(0).toUpperCase() + dateLabel.slice(1)}
        </p>
        <h1 className="text-2xl font-bold tracking-tight mt-0.5">
          {routine.name ?? "WOD del día"}
        </h1>
        {sortedSlots.length > 0 && (
          <p className="text-xs text-muted-foreground mt-1">
            {sortedSlots.length} {sortedSlots.length === 1 ? "slot de score" : "slots de score"}
          </p>
        )}
      </div>

      {routine.content?.trim() && (
        <div className="rounded-xl border border-border bg-card/40 p-4 prose prose-invert prose-sm max-w-none">
          <ReactMarkdown remarkPlugins={[remarkGfm]}>{routine.content}</ReactMarkdown>
        </div>
      )}

      {sortedSlots.length > 0 && (
        <div className="space-y-3">
          {sortedSlots.map((slot) => (
            <WodSlotCard
              key={slot.id}
              routineId={routine.id}
              slot={slot}
              myLog={logsBySlotId.get(slot.id) ?? null}
              defaultGender={me.gender}
              myMemberId={me.memberId}
            />
          ))}
        </div>
      )}
    </div>
  )
}
```

- [ ] **E5.2: Type-check + lint final**

```bash
npx tsc --noEmit 2>&1 | head -30
```
Esperado: 0 errores en todo el proyecto.

```bash
npm run lint 2>&1 | tail -15
```

- [ ] **E5.3: Verificación manual**

```bash
npm run dev
```

Como miembro:
1. Ir a `/portal/wod`.
2. Header con fecha + nombre de la rutina + "2 slots de score".
3. Markdown render correcto del contenido.
4. 2 cards (una por slot). Card "Murph" con botón "Registrar For Time".
5. Click en Registrar → modal con title "Registrar WOD" y description "Murph · score: For Time".
6. Ingresar 32:15 RX → guardar → toast verde, card cambia a "✓ LOGEADO" + "Tu marca: 32:15".
7. Mini-leaderboard muestra al miembro en 1°.
8. Toggle M/F funciona.
9. Click "Ver Top 10" → sheet abre con la lista.
10. Edit log → cambiar a 30:00 → guardar → marca actualizada.
11. Borrar log → vuelve botón "Registrar".

- [ ] **E5.4: Commit**

```bash
git add -A
git commit -m "feat(wod): portal /portal/wod con markdown render + WodSlotCard por slot"
```

---

## Fase F — Verificación final

### Task F1: Recorrido de testing manual completo

Ejecutar el plan §9 del spec (`docs/superpowers/specs/2026-05-07-wod-score-slots-design.md`).

- [ ] **F1.1: Verificar la migración aplicada**

```sql
-- Vía mcp__supabase__execute_sql
SELECT
  table_name,
  column_name,
  data_type,
  is_nullable,
  column_default
FROM information_schema.columns
WHERE (table_name = 'routine_schedules' AND column_name IN ('blocks', 'score_slots'))
   OR (table_name = 'wod_logs' AND column_name IN ('block_id', 'slot_id'))
ORDER BY table_name, column_name;
```
Esperado: `blocks` y `block_id` no aparecen; `score_slots` y `slot_id` sí.

- [ ] **F1.2: Wizard — crear rutina con markdown + 2 slots**

1. `/dashboard/rutinas` → "Crear rutina" → fecha futura → siguiente → planes → siguiente.
2. Paso 3: nombre "Murph day", markdown completo, 2 slots: "Murph" (For Time), "Back Squat 5RM" (Peso).
3. Click Preview → Markdown se renderiza.
4. Reordenar los slots con ↑/↓.
5. Crear → toast verde, modal cierra.
6. Verificar SQL: `SELECT id, content, score_slots FROM routine_schedules WHERE date = '...';` — el `score_slots` contiene 2 elementos con UUIDs y los datos esperados.

- [ ] **F1.3: Wizard — edit preserva slot.id**

1. Editar la rutina del paso anterior.
2. Cambiar el name del primer slot, agregar uno nuevo, guardar.
3. Verificar SQL que los slots existentes conservan su `id`.

- [ ] **F1.4: Caso "rutina informativa" (sin slots)**

1. Crear una rutina con solo markdown, sin slots.
2. Guardar → `score_slots = []`.
3. Como miembro, `/portal/wod` → muestra solo el markdown, sin cards.

- [ ] **F1.5: Caso "rutina sin nada"**

1. Crear rutina, paso 3: dejar vacío todo.
2. Verificar que botón "Crear rutina" está deshabilitado (mensaje "Agrega al menos contenido en Markdown o un slot de score").

- [ ] **F1.6: Logger happy path**

1. Como miembro de plan asociado, `/portal/wod` muestra rutina con 2 slots.
2. Registrar Murph 32:15 RX → toast → card cambia a "✓ LOGEADO" + "Tu marca: 32:15" + badge RX.
3. Mini-leaderboard te muestra en 1°.

- [ ] **F1.7: Edit + delete**

1. Click "Editar" → cambiar a 30:00 Scaled → guardar.
2. Card actualizada, sin badge RX.
3. Borrar → vuelve botón "Registrar".

- [ ] **F1.8: Toggle M/F**

1. En mini-leaderboard, click "F" → muestra solo mujeres.
2. Volver a "M".
3. Repetir en sheet Top 10.

- [ ] **F1.9: Validación negativa**

1. Vía DevTools (network tab): construir manualmente una llamada a `upsertWodLog` con `slot_id` que no existe → error "Slot no encontrado en la rutina".
2. Construir con `score_type` que no coincide con el slot → error "El tipo de score no corresponde al slot".

- [ ] **F1.10: Plan distinto → empty state**

1. Loguear como miembro de plan NO asociado.
2. `/portal/wod` muestra "No hay rutina programada para hoy."

- [ ] **F1.11: Visibilidad show_wods**

1. Setear `members.show_wods = false` para uno de los miembros con log.
2. Refresh `/portal/wod` (o al sheet) → ese miembro desaparece del leaderboard.
3. Setear `true` → reaparece.

- [ ] **F1.12: MemberDetailModal sigue funcionando**

1. `/portal/descubrir` → click en algún miembro con WODs.
2. Verificar que la sección "WODs recientes" se muestra correctamente con el `routine_name` desde el JOIN.

- [ ] **F1.13: Limpieza final**

```bash
git status
```
Verificar que no quedan archivos modificados ni `console.log`.

```bash
npx tsc --noEmit 2>&1 | head -10
npm run lint 2>&1 | tail -5
```
Esperado: 0 errores y 0 warnings nuevos.

- [ ] **F1.14: Verificar archivos eliminados**

```bash
ls lib/constants/routine-blocks.ts 2>/dev/null && echo "FAIL: aún existe"
ls lib/schemas/routine-blocks.ts 2>/dev/null && echo "FAIL: aún existe"
ls components/section-components/rutinas/blocks-editor 2>/dev/null && echo "FAIL: aún existe"
ls components/section-components/portal/wod/InfoBlockCard.tsx 2>/dev/null && echo "FAIL: aún existe"
ls components/section-components/portal/wod/WodBlockCard.tsx 2>/dev/null && echo "FAIL: aún existe"
echo "Verificación de archivos eliminados completada"
```

Esperado: ningún "FAIL", solo el mensaje final.

- [ ] **F1.15: Si hay ajustes durante el testing**

Si encuentras typos, paddings, edge cases: commitear con prefijo `fix(wod): ...`.

---

## Self-review notes (para el ejecutor)

Antes de cerrar, verificar contra el spec (`docs/superpowers/specs/2026-05-07-wod-score-slots-design.md`):

- §2 (modelo de datos): A1 (migración) + A2 (types) ✅
- §3 (server actions routines): B1–B3 ✅
- §3 (server actions wod-logs): C1–C4 ✅
- §4 (wizard admin): D1 (cleanup) + D2 (ScoreSlotsManager) + D3 (wizard) ✅
- §5 (portal /portal/wod): E1 (WodSlotCard) + E2 (LogWodModal) + E3 (Mini) + E4 (Sheet) + E5 (Main) ✅
- §6 (validación, permisos, errores): embebidos en B3 (admin) y C3 (miembro) ✅
- §7 (out of scope): respetado ✅
- §8 (archivos afectados): cubierto en cada fase ✅
- §9 (testing manual): F1 ✅

Si encuentras un gap, ábrelo como follow-up commit con prefijo `fix(wod): ...`.
