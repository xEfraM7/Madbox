# WOD Score Slots — Design Spec

**Fecha:** 2026-05-07
**Estado:** Draft
**Reemplaza:** `2026-05-06-wod-logging-design.md` (modelo block-centric)

## 1. Goal

Permitir al admin programar rutinas con **contenido en Markdown libre** y, por separado, definir **N "slots de score"** que indican qué resultados deben registrar los miembros. Los miembros registran un score por slot; el sistema mantiene un leaderboard por slot segmentado por plan + género.

Este spec **reemplaza** el modelo block-centric implementado el 2026-05-06: drop de `routine_schedules.blocks`, rename `wod_logs.block_id → slot_id`, eliminación de todos los componentes del block builder, restauración del editor de Markdown del wizard y del render de Markdown en `/portal/wod`.

**Motivación del cambio:**
- El block builder forzaba una estructura rígida; el admin prefiere escribir Markdown libre como antes.
- La separación entre *qué se hace* (Markdown) y *qué se registra* (slots) es más simple: el admin no tiene que mapear cada bloque a un score type, solo declara los scores que quiere coleccionar.

## 2. Modelo de datos

### 2.1 Migración SQL

```sql
-- Drop la columna blocks (no hay data en producción más allá del default '[]')
ALTER TABLE routine_schedules DROP COLUMN blocks;

-- Nueva columna score_slots (lista de slots)
ALTER TABLE routine_schedules
  ADD COLUMN score_slots jsonb NOT NULL DEFAULT '[]'::jsonb;

-- Renombrar block_id → slot_id en wod_logs
ALTER TABLE wod_logs RENAME COLUMN block_id TO slot_id;

-- Reemplazar constraint
ALTER TABLE wod_logs DROP CONSTRAINT wod_logs_member_routine_block_key;
ALTER TABLE wod_logs
  ADD CONSTRAINT wod_logs_member_routine_slot_key
  UNIQUE (member_id, routine_id, slot_id);

-- Reemplazar índice
DROP INDEX IF EXISTS idx_wod_logs_routine_block;
CREATE INDEX idx_wod_logs_routine_slot ON wod_logs(routine_id, slot_id);
```

### 2.2 Tipo TypeScript del slot

```ts
// lib/constants/score-slots.ts
export type ScoreSlot = {
  id: string         // UUID estable, no cambia entre edits
  order: number      // posición 0-indexed en la lista
  name: string       // 1–100 chars (ej: "Murph", "Back Squat 5RM")
  score_type: "for_time" | "amrap" | "for_reps" | "weight"
}

export function createScoreSlot(score_type: ScoreSlot["score_type"], order: number): ScoreSlot {
  return { id: crypto.randomUUID(), order, name: "", score_type }
}

export function parseScoreSlots(raw: unknown): ScoreSlot[] {
  // safeParse + sort by order
  const parsed = scoreSlotsSchema.safeParse(raw)
  if (!parsed.success) return []
  return [...parsed.data].sort((a, b) => a.order - b.order)
}
```

### 2.3 Schema Zod

```ts
// lib/schemas/score-slots.ts
import { z } from "zod"

export const scoreSlotSchema = z.object({
  id: z.string().min(1),
  order: z.number().int().min(0),
  name: z.string().min(1, "Nombre requerido").max(100, "Máx. 100 caracteres"),
  score_type: z.enum(["for_time", "amrap", "for_reps", "weight"]),
})

export const scoreSlotsSchema = z.array(scoreSlotSchema)
// Array vacío es válido — rutina sin logging (rest day, recovery, skill puro)
```

### 2.4 Archivos a eliminar

- `lib/constants/routine-blocks.ts`
- `lib/schemas/routine-blocks.ts`
- `components/section-components/rutinas/blocks-editor/` (carpeta entera con 9 archivos)
- `components/section-components/portal/wod/InfoBlockCard.tsx`

## 3. Server actions

### 3.1 `lib/actions/routines.ts`

Interfaces actualizadas:

```ts
export interface RoutineSchedule {
  id: string
  date: string // YYYY-MM-DD
  name: string | null
  content: string                  // Markdown libre (fuente de verdad del contenido)
  score_slots: ScoreSlot[]         // reemplaza blocks
  created_at: string | null
  updated_at: string | null
  plans: Array<{ id: string; name: string }>
}

export interface CreateRoutineScheduleInput {
  date: string
  name?: string | null
  content: string                  // requerido (puede ser "")
  score_slots: ScoreSlot[]         // puede ser []
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

Cambios funcionales:
- `shapeRoutineSchedule(row)` lee `row.score_slots` con `parseScoreSlots()`
- Todos los SELECT cambian `blocks` → `score_slots`
- `createRoutineSchedule` valida slots con `scoreSlotsSchema.safeParse(input.score_slots)` (acepta `[]`); persiste `content` y `score_slots`
- `updateRoutineSchedule` igual; si `input.score_slots !== undefined` se valida y persiste

### 3.2 `lib/actions/wod-logs.ts`

Renombre simple:

```ts
export interface WodLog {
  // ...
  slot_id: string                  // era block_id
  // ... resto sin cambios
}

export interface UpsertWodLogInput {
  routine_id: string
  slot_id: string                  // era block_id
  score_type: ScoreType
  // ... resto sin cambios
}

export interface RoutineForMemberToday {
  id: string
  date: string
  name: string | null
  content: string
  score_slots: ScoreSlot[]         // reemplaza blocks
  plan_ids: string[]
}

export interface WodLeaderboardResult {
  routine_id: string
  slot_id: string                  // era block_id
  gender: "male" | "female"
  entries: WodLeaderboardEntry[]
}
```

Funciones afectadas:
- `getRoutineForToday` — SELECT cambia `blocks` → `score_slots`; mapea con `parseScoreSlots`
- `upsertWodLog` — valida que `slot_id` exista en `schedule.score_slots`, que `slot.score_type === input.score_type`, que el plan del miembro esté en el schedule, y los rangos numéricos (sin cambios desde 5.1)
- `getLeaderboardForBlock` → renombrar a `getLeaderboardForSlot`; recibe `slot_id` en vez de `block_id`; resto idéntico
- `rowToWodLog` — lee `row.slot_id`
- `getMyWodLogsForRoutine`, `getMyWodHistory`, `deleteWodLog`, `getMemberRecentWods` — sin cambios funcionales (solo el campo renombrado)

## 4. Wizard admin (paso 3)

### 4.1 Layout

```
┌─ Paso 3: Contenido ─────────────────────────────┐
│                                                  │
│  Nombre (opcional)                               │
│  ┌──────────────────────────────────────────┐   │
│  │ "Murph" prep                             │   │
│  └──────────────────────────────────────────┘   │
│                                                  │
│  [Editor] [Preview]                              │
│  ┌──────────────────────────────────────────┐   │
│  │ # AMRAP 20'                              │   │
│  │ - 10 pull-ups                            │   │
│  │ - 20 push-ups                            │   │
│  │ - 30 air squats                          │   │
│  │                                          │   │
│  │ # Strength                               │   │
│  │ Back Squat 5×3 @ 80%                     │   │
│  └──────────────────────────────────────────┘   │
│                                                  │
│  Slots de score (2)            [+ Agregar slot]  │
│  ┌──────────────────────────────────────────┐   │
│  │ Murph                  [for_time ▼]  ↑↓🗑│   │
│  ├──────────────────────────────────────────┤   │
│  │ Back Squat 5RM         [weight ▼]    ↑↓🗑│   │
│  └──────────────────────────────────────────┘   │
└──────────────────────────────────────────────────┘
```

### 4.2 Componentes

**Markdown editor restaurado:**
- Vuelven los imports `ReactMarkdown`, `remarkGfm`, `Tabs`, `TabsContent`, `TabsList`, `TabsTrigger`, iconos `Eye`, `Pencil`
- Tabs "Editor" / "Preview" con prose styling consistente con `RutinaViewer`

**`ScoreSlotsManager` (nuevo, ~100 líneas):**
- Lista vertical de slots, una fila por slot:
  - `<Input>` con `slot.name` (max 100 chars)
  - `<Select>` con 4 opciones traducidas: "For Time", "AMRAP", "For Reps", "Peso"
  - Botones `<Button variant="ghost" size="icon">` con `<ChevronUp />`, `<ChevronDown />`, `<Trash2 />`
- Botón "Agregar slot" al final del listado: crea con `createScoreSlot("for_time", slots.length)`
- Reordenar reasigna `order` (helper `reorder()` igual que en el ex-`RoutineBlocksEditor`)
- Empty state: "Sin slots de score. La rutina será solo informativa."

**Form schema (Zod):**

```ts
const schema = z.object({
  date: z.string().min(1, "Selecciona una fecha"),
  plan_ids: z.array(z.string().uuid()).min(1, "Selecciona al menos un plan"),
  name: z.string().max(100).optional(),
  content: z.string(),                    // markdown, puede ser ""
  score_slots: scoreSlotsSchema,          // puede ser []
})
```

**`stepValid` (versión completa):**

```ts
const stepValid =
  (step === 1 && !!form.watch("date") && (mode === "edit" || form.watch("date") >= todayISO)) ||
  (step === 2 && (form.watch("plan_ids") ?? []).length > 0) ||
  (step === 3 &&
    (!!form.watch("content")?.trim() ||
      (form.watch("score_slots") ?? []).length > 0))
```

Regla del paso 3: al menos uno de `content` (Markdown no vacío) o `score_slots` (lista no vacía). Una rutina no puede ser totalmente vacía.

### 4.3 Migración inline al editar

Al abrir el wizard en `mode: "edit"` con una rutina existente:
- `content`: ya viene como string (sin cambios)
- `score_slots`: viene como `ScoreSlot[]` desde `parseScoreSlots`

No hay migración inline desde `blocks` porque la columna ya está dropped (la migración SQL corre antes que cualquier deploy del nuevo wizard).

### 4.4 Archivos

- **Crear:** `components/section-components/rutinas/ScoreSlotsManager.tsx`
- **Modificar:** `components/section-components/rutinas/modals/routine-wizard-modal.tsx`
- **Eliminar:** todo `components/section-components/rutinas/blocks-editor/`

## 5. Portal del miembro `/portal/wod`

### 5.1 Layout

```
┌──────────────────────────────────────────────────┐
│ MARTES, 6 MAYO 2026                              │
│ "Murph" prep                                     │
│ 2 slots de score                                 │
├──────────────────────────────────────────────────┤
│                                                  │
│ # AMRAP 20'                ← Markdown render     │
│ - 10 pull-ups                                    │
│ - 20 push-ups                                    │
│ - 30 air squats                                  │
│                                                  │
│ # Strength                                       │
│ Back Squat 5×3 @ 80%                             │
│                                                  │
├──────────────────────────────────────────────────┤
│ ┌─[FOR TIME] ─ Murph ──────── ✓ LOGEADO─────┐   │
│ │ Tu marca: 32:15 · RX                      │   │
│ │ ┌─ Top Hombres ──────────────  [M][F]──┐  │   │
│ │ │ 1° ⬢ Carlos M.        28:42 · RX     │  │   │
│ │ │ 2° ⬢ Efraín C. (tú)   32:15 · RX     │  │   │
│ │ │ 3° ⬢ Luis M.          35:08          │  │   │
│ │ │ Ver Top 10 →                          │  │   │
│ │ └────────────────────────────────────────┘  │   │
│ └─────────────────────────────────────────────┘  │
│                                                  │
│ ┌─[WEIGHT] ─ Back Squat 5RM ─────────────────┐  │
│ │ [Registrar Peso]                            │  │
│ │ Aún nadie ha registrado este slot.          │  │
│ └─────────────────────────────────────────────┘  │
└──────────────────────────────────────────────────┘
```

### 5.2 Componentes

**`WodSlotCard` (renombre de `WodBlockCard`):**
- Recibe `slot: ScoreSlot` en vez de `block: RoutineBlock`
- Header: `<Badge>` con label del score_type + `<span>{slot.name}</span>` + badge "✓ LOGEADO" condicional
- Si miembro tiene log: muestra "Tu marca: {formatScore(...)}" + Rx badge si aplica + botón "Editar"
- Si no: botón "Registrar {SCORE_TYPE_LABEL[slot.score_type]}"
- Embebido: `<WodMiniLeaderboard routineId blockId={slot.id} ...>` (ver 5.3)
- Modales: `<LogWodModal>` y `<WodFullLeaderboardSheet>`

**`WodMiniLeaderboard` y `WodFullLeaderboardSheet`:**
- Solo renombre de prop `blockId` → `slotId` (interno) o, alternativamente, mantener nombre de prop y solo pasar `slot.id` desde el parent. Decisión: **renombrar a `slotId`** para coherencia.
- Llama `getLeaderboardForSlot({ routine_id, slot_id, gender, limit })`
- Resto idéntico

**`LogWodModal`:**
- Nuevos props: `{ open, onOpenChange, routineId, slot: ScoreSlot, scoreType: ScoreType, existingLog }`
- Title: `"Registrar WOD"` o `"Editar WOD"`
- Description: `<span className="font-medium">{slot.name}</span>` + `· score: {SCORE_TYPE_LABEL[scoreType]}`
- Pierde `blockHeadline()` y todo el switch por block.type — ahora trivial
- En el upsert: `slot_id: slot.id` (en vez de `block_id: block.id`)

**`PortalWodMainComponent`:**
- Mismo flujo de auth + queries (`getRoutineForToday`, `getMyWodLogsForRoutine`)
- Render orden:
  1. Header (fecha + nombre + cuenta de slots)
  2. `<MarkdownRender content={routine.content} />` (componente nuevo o inline con `ReactMarkdown` + `remarkGfm` + clases prose)
  3. Iteración por `routine.score_slots.sort((a,b) => a.order - b.order)` → `<WodSlotCard>` por cada uno
- `logsBySlotId = new Map(myLogs.map(l => [l.slot_id, l]))`

### 5.3 Empty states

- **Sin perfil de miembro:** "No tienes un perfil de miembro asignado." (igual que ahora)
- **Sin rutina hoy:** "No hay rutina programada para hoy." (igual que ahora)
- **Rutina con `content === "" && score_slots.length === 0`:** mismo mensaje que sin rutina (no se programó nada útil)
- **Rutina con `content` y `score_slots.length === 0`:** muestra solo el Markdown, sin cards (rutina informativa, no se registra)
- **Rutina con `score_slots.length > 0` y leaderboard vacío:** card del slot con "Aún nadie ha registrado este slot."

### 5.4 Archivos

- **Renombrar:** `WodBlockCard.tsx` → `WodSlotCard.tsx`
- **Eliminar:** `InfoBlockCard.tsx`
- **Modificar:** `WodMiniLeaderboard.tsx`, `WodFullLeaderboardSheet.tsx`, `log-wod-modal.tsx`, `PortalWodMainComponent.tsx` (el render de Markdown se hace inline con `ReactMarkdown` + `remarkGfm` y clases prose, sin componente helper separado)

## 6. Validación, permisos, errores

### 6.1 Validación en `upsertWodLog` (server)

```ts
1. Auth: user logueado, miembro existe, miembro.plan_id no es null
2. routine_id existe en routine_schedules
3. score_slots del schedule contiene un slot con id === input.slot_id
4. slot.score_type === input.score_type
5. Plan del miembro ∈ schedule.routine_schedule_plans (cualquier match)
6. Rangos numéricos por score_type:
   - for_time:  1 ≤ score_seconds ≤ 14400  (1s a 4h)
   - amrap:     score_rounds ≥ 0, score_reps ≥ 0, rounds + reps > 0
   - for_reps:  1 ≤ score_reps ≤ 99999
   - weight:    0.5 ≤ score_kg ≤ 500
7. notes ≤ 500 chars
```

Mensajes de error en español, lanzados como `throw new Error(...)` para que TanStack los capture.

### 6.2 Validación de slots (en `createRoutineSchedule` / `updateRoutineSchedule`)

- Permiso `routines.edit` (admin con flag `isAdmin` siempre pasa)
- `score_slots`: array (puede ser vacío)
- Cada slot validado por `scoreSlotSchema` (id, order, name 1-100, score_type del enum)
- `plan_ids`: ≥ 1
- `date`: en create, ≥ hoy en TZ Caracas

### 6.3 Permisos

| Actor | Acción | Permiso |
|---|---|---|
| Admin | crear/editar rutina | `routines.edit` |
| Miembro | crear/editar/borrar SU log | autenticado + plan asignado |
| Cualquier user logueado | ver leaderboard | autenticado |
| Miembro | ver `getRoutineForToday()` | autenticado + plan asignado |

Bypass de RLS para leaderboard (cross-member): vía `createAdminClient()` solo en server action `getLeaderboardForSlot`.

### 6.4 Manejo de errores

- Server: `throw new Error(mensaje)` → TanStack `onError(err)` → `toast.error(err.message)`
- Cliente (form): validación inline con mensajes debajo del input erróneo
- Conflictos de fecha: misma UX actual (modal de confirmación, `replace_conflicts`)

## 7. Out of scope

- Realtime updates del leaderboard
- Admin override para registrar logs de otros miembros
- Notificaciones push/email por récords rotos
- Históricos / PRs personales agregados a través del tiempo
- Comparación entre días o agregaciones semanales
- Coexistencia con el modelo de bloques (eliminado completamente)
- Migración de data de la columna `blocks` (no hay data viva)
- Validación cruzada Markdown ↔ slots (admin define ambos libremente)
- Drag-and-drop visual de slots (se reordena con ↑/↓)

## 8. Resumen de archivos afectados

### A crear

- `supabase/migrations/20260507120000_wod_score_slots.sql`
- `lib/constants/score-slots.ts`
- `lib/schemas/score-slots.ts`
- `components/section-components/rutinas/ScoreSlotsManager.tsx`

### A renombrar

- `components/section-components/portal/wod/WodBlockCard.tsx` → `WodSlotCard.tsx`

### A modificar

- `lib/actions/routines.ts` — cambiar `blocks` → `score_slots` en interfaces, shape, create, update
- `lib/actions/wod-logs.ts` — renombrar `block_id` → `slot_id`, `getLeaderboardForBlock` → `getLeaderboardForSlot`, mapear `score_slots` en `getRoutineForToday`
- `types/database.ts` — regenerar después de la migración
- `components/section-components/rutinas/modals/routine-wizard-modal.tsx` — restaurar Markdown editor + Tabs, agregar `<ScoreSlotsManager>`
- `components/section-components/portal/wod/log-wod-modal.tsx` — recibir `slot` en vez de `block`
- `components/section-components/portal/wod/WodMiniLeaderboard.tsx` — prop `slotId`
- `components/section-components/portal/wod/WodFullLeaderboardSheet.tsx` — prop `slotId`
- `components/section-components/portal/wod/PortalWodMainComponent.tsx` — render Markdown + cards por slot
- `components/section-components/portal/descubrir/MemberDetailModal.tsx` — el JOIN ya devuelve `routine_name`; sin cambios funcionales si `WodLog.slot_id` no es leído

### A eliminar

- `lib/constants/routine-blocks.ts`
- `lib/schemas/routine-blocks.ts`
- `components/section-components/rutinas/blocks-editor/` (carpeta entera)
  - `RoutineBlocksEditor.tsx`
  - `MovementListEditor.tsx`
  - `types/TextBlockEditor.tsx`
  - `types/StrengthBlockEditor.tsx`
  - `types/SkillBlockEditor.tsx`
  - `types/AmrapBlockEditor.tsx`
  - `types/EmomBlockEditor.tsx`
  - `types/ForTimeBlockEditor.tsx`
  - `types/ForRepsBlockEditor.tsx`
  - `types/RftBlockEditor.tsx`
- `components/section-components/portal/wod/InfoBlockCard.tsx`

## 9. Testing manual (post-implementación)

1. **Migración aplicada:** verificar en Supabase que `routine_schedules.blocks` no existe, `score_slots jsonb NOT NULL DEFAULT '[]'` sí existe; `wod_logs` tiene `slot_id text NOT NULL DEFAULT ''` con constraint `wod_logs_member_routine_slot_key`.
2. **Wizard admin → crear rutina:**
   - Paso 3 muestra editor Markdown con tabs Editor/Preview
   - Slot manager debajo con botón "Agregar slot"
   - Crear rutina con Markdown + 2 slots ("Murph" for_time, "Back Squat 5RM" weight)
   - Verificar en SQL que `score_slots` tiene 2 elementos con UUIDs estables
3. **Wizard edit:** abrir la misma rutina, cambiar el name de un slot, agregar un slot, reordenar, guardar. Verificar que los slots existentes conservan su `id`.
4. **Portal /portal/wod (miembro):**
   - Header con fecha + name + "2 slots de score"
   - Markdown render correcto
   - 2 cards (una por slot) con botón Registrar
   - Mini-leaderboard vacío en cada card
5. **Logger happy path:** registrar Murph 32:15 RX → toast verde, card cambia a "✓ LOGEADO", aparece "Tu marca: 32:15", aparece en mini-leaderboard 1°
6. **Edit + delete log:** editar a 30:00, guardar; borrar; vuelve botón "Registrar"
7. **Toggle M/F** funciona en mini y en sheet
8. **Validación negativa:** vía DevTools mandar `slot_id` con `score_type` que no coincide con el slot → error "El tipo de score no corresponde al slot"
9. **Empty states:** rutina con `content` pero sin slots → solo markdown, sin cards
10. **Conflictos de fecha:** intentar crear rutina para una fecha+plan ya ocupado → modal de confirmación
11. **MemberDetailModal:** verificar que sigue mostrando WODs recientes (usa `routine_name` del JOIN)
12. **Limpieza:** `git status` limpio, type-check 0 errores, lint sin warnings nuevos

---

## Histórico

- 2026-05-06: spec original `2026-05-06-wod-logging-design.md` con modelo block-centric (implementado en 13 commits)
- 2026-05-07: este spec; reemplazo total a markdown + score_slots
