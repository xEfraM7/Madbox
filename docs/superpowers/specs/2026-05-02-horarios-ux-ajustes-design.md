# Horarios admin — Ajustes UX (Design Spec)

**Fecha:** 2026-05-02
**Scope:** Admin portal `/dashboard/horarios` (sección Horarios y Rutinas).
**Tipo:** UX refactor de 3 áreas independientes pero relacionadas.

---

## Resumen ejecutivo

Tres mejoras al admin de horarios:

1. **Cerrado oculta planes**: Cuando un día se marca como cerrado, no mostrar la lista de planes ni rutinas; solo un estado limpio "Cerrado".
2. **AM/PM implícito por turno**: Eliminar el toggle AM/PM del input de horas. Como las secciones ya están etiquetadas "Mañana" y "Tarde", el periodo se infiere automáticamente.
3. **Editor de rutinas WOD-aware multi-bloque**: Reemplazar el editor Markdown crudo por un editor estructurado basado en bloques tipados de CrossFit. Renderiza bonito en el portal del miembro y conecta con el WOD logging.

Cada cambio es independiente y se puede shippear por separado, pero todos viven en `components/section-components/horarios/` y `components/section-components/portal/...`.

---

## Issue 1 — Día cerrado oculta planes

### Problema actual
En [DayColumn.tsx](components/section-components/horarios/DayColumn.tsx), cuando un día está cerrado (estado interno: `open_time === close_time === "00:00:00"`), `ScheduleInline` correctamente muestra solo "Cerrado", pero la sección inferior con los planes y sus `RoutineCard`s sigue renderizándose. El admin ve planes y puede asignarles rutinas en un día que el gym ni siquiera abre — confuso.

### Solución
Propagar el estado `isClosed` del row al `DayColumn`. Si el día está cerrado:
- Ocultar el `<div className="border-t -mx-3" />` y la sección de planes.
- Mostrar en su lugar un placeholder neutro: `<p className="text-xs text-muted-foreground italic text-center py-4">Cerrado</p>`.

La lógica `isClosed(open, close)` ya existe en `ScheduleInline.tsx` líneas 21-24. La extraemos a un helper compartido y la usamos en ambos componentes.

### Archivos afectados
- `lib/utils.ts` — agregar `isDayClosed(open, close)`.
- `components/section-components/horarios/ScheduleInline.tsx` — usar el helper.
- `components/section-components/horarios/DayColumn.tsx` — leer `isClosed` y condicionar el render del bloque de planes.

### Edge cases
- Día con `open_time = null` y `close_time = null` (sin definir): no se considera "cerrado" — sigue mostrando los planes (admin aún no configura el horario, pero puede asignar rutinas).
- Día abierto solo en tarde (sin mañana): no aplica el caso "cerrado"; los planes se muestran normal.

---

## Issue 2 — AM/PM implícito por turno

### Problema actual
[ScheduleInline.tsx:67-142](components/section-components/horarios/ScheduleInline.tsx) define `Time12h` con un botón AM/PM por input. Como las secciones ya se llaman "Mañana" y "Tarde", el toggle es redundante y el admin debe acordarse de cliquearlo. Causa errores comunes (mañana abre 6 PM en vez de 6 AM).

### Solución
1. Quitar el botón AM/PM del componente `Time12h`. El input solo pide hora (1-12) y minutos.
2. El componente recibe una prop nueva `period: "AM" | "PM"` que es fija según la sección que lo usa:
   - Mañana: `period="AM"` siempre.
   - Tarde: `period="PM"` siempre.
3. Convención de la hora 12 (caso ambiguo):
   - **En cualquier sección, "12" siempre se interpreta como mediodía (12:00).** Esto cubre los casos comunes:
     - "Mañana abre 6, cierra 12" → 06:00-12:00 ✓
     - "Tarde abre 12, cierra 5" → 12:00-17:00 ✓
   - No soportamos "cierra a medianoche" (caso raro en gyms). Si llega a hacer falta, se agrega un toggle aparte "¿Hasta medianoche?" sin tocar este flujo.

### Cambios concretos en `Time12h`

```tsx
// Nueva firma
function Time12h({
  value,        // string "HH:MM" en 24h
  period,       // "AM" | "PM" — fijo por sección, no editable
  onCommit,
  disabled,
}: {
  value: string
  period: "AM" | "PM"
  onCommit: (next: string) => void
  disabled?: boolean
})

// Conversión 12h → 24h con regla "12 = noon":
function format24(h12: number, minute: number, period: "AM" | "PM"): string {
  let h: number
  if (period === "AM") h = h12 === 12 ? 0 : h12          // 12 AM no se usa, pero quedaría como 00:00
  else h = h12 === 12 ? 12 : h12 + 12                     // 12 PM = noon = 12:00
  return `${String(h).padStart(2, "0")}:${String(minute).padStart(2, "0")}`
}
```

**Nota de la regla "12=noon" para mañana**: técnicamente "12 AM" sería medianoche (00:00), pero el admin nunca va a tipear 12 en mañana queriendo decir "medianoche". Si tipea 12, quiere decir mediodía (porque es lo único que tiene sentido en un horario de gym mañana). Por eso, en la sección Mañana, si el admin escribe 12, lo guardamos como **12:00** (noon), no 00:00.

```ts
// Regla efectiva
function format24Morning(h12: number, minute: number): string {
  const h = h12 === 12 ? 12 : h12  // 12 → noon, otros → AM
  return `${pad(h)}:${pad(minute)}`
}

function format24Afternoon(h12: number, minute: number): string {
  const h = h12 === 12 ? 12 : h12 + 12  // 12 → noon, otros → PM
  return `${pad(h)}:${pad(minute)}`
}
```

### Archivos afectados
- `components/section-components/horarios/ScheduleInline.tsx`:
  - Quitar el `<button>` de AM/PM dentro de `Time12h`.
  - Quitar la prop `period` interna y el state `period`; pasar `period` desde fuera.
  - Reemplazar `format24` por `format24Morning` y `format24Afternoon` o un solo `format24(h, m, period, useNoonFor12)`.
  - En el render principal, pasar `period="AM"` al `Time12h` de Mañana y `period="PM"` al de Tarde.

### Edge cases
- Migration: registros existentes pueden tener "Mañana abre 6 PM" (admin se equivocó con el toggle). No los tocamos retroactivamente; el admin los puede arreglar al pasar por ese día.
- Validación cruzada: si abre > cierra en Mañana o Tarde después del shift implícito → el `mutation.mutate` lo rechazaba antes? Verificar en `updateGymSchedule`. Si no, agregar validación cliente y backend que rechace `open >= close` por turno.

---

## Issue 3 — Editor de rutinas WOD-aware multi-bloque

### Problema actual
[routine-form-modal.tsx](components/section-components/horarios/modals/routine-form-modal.tsx) usa un `<Textarea>` con Markdown crudo. El admin debe saber sintaxis (`**`, `#`, `-`). Sin estructura, las rutinas quedan inconsistentes y el render en el portal del miembro depende totalmente de la disciplina del coach.

### Solución
Reemplazar el campo `content` (string Markdown) por un campo `blocks` (array de bloques tipados) almacenado como JSONB en la tabla `routines`. La columna `content` se mantiene como legacy (no se borra ni se vacía en la migración) pero la UI nueva no la lee. Una migración posterior la dropeará cuando confirmemos que nada la consume.

### Catálogo de tipos de bloque (10)

#### Bloques de **conditioning** (mapean a `score_type` del WOD logging)

| `type` | Campos | Score |
|---|---|---|
| `amrap` | `minutes: number`, `movements: string[]` | `amrap` |
| `for_time` | `movements: string[]`, `time_cap_min?: number` | `for_time` |
| `rft` | `rounds: number`, `movements: string[]` | `for_time` |
| `for_reps` | `target_reps: number`, `movements: string[]` | `for_reps` |
| `emom` | `minutes: number`, `movements: string[]`, `alternating: boolean` | (sin score) |

#### Bloques de **fuerza / técnica**

| `type` | Campos | Score |
|---|---|---|
| `strength` | `exercise: string`, `sets: number`, `reps: string`, `weight?: string`, `notes?: string` | `weight` |
| `skill` | `exercises: string[]`, `notes?: string` | (sin score) |

#### Bloques de **soporte (texto libre)**

| `type` | Campos |
|---|---|
| `warmup` | `text: string` |
| `cooldown` | `text: string` |
| `notes` | `text: string` |

### Modelo de datos

#### Tipo TypeScript

```ts
// lib/constants/routine-blocks.ts

export type BlockType =
  | 'warmup' | 'strength' | 'skill'
  | 'amrap' | 'emom' | 'for_time' | 'for_reps' | 'rft'
  | 'cooldown' | 'notes'

export interface BlockBase {
  id: string         // uuid v4 generado en cliente
  order: number      // 0-indexed
  type: BlockType
}

export interface WarmupBlock extends BlockBase { type: 'warmup'; text: string }
export interface CooldownBlock extends BlockBase { type: 'cooldown'; text: string }
export interface NotesBlock extends BlockBase { type: 'notes'; text: string }

export interface StrengthBlock extends BlockBase {
  type: 'strength'
  exercise: string
  sets: number
  reps: string         // string porque "5", "5-3-1", "AMRAP" son válidos
  weight?: string      // string porque "80 kg", "70%", "BW" son válidos
  notes?: string
}

export interface SkillBlock extends BlockBase {
  type: 'skill'
  exercises: string[]
  notes?: string
}

export interface AmrapBlock extends BlockBase { type: 'amrap'; minutes: number; movements: string[] }
export interface EmomBlock extends BlockBase { type: 'emom'; minutes: number; movements: string[]; alternating: boolean }
export interface ForTimeBlock extends BlockBase { type: 'for_time'; movements: string[]; time_cap_min?: number }
export interface ForRepsBlock extends BlockBase { type: 'for_reps'; target_reps: number; movements: string[] }
export interface RftBlock extends BlockBase { type: 'rft'; rounds: number; movements: string[] }

export type RoutineBlock =
  | WarmupBlock | CooldownBlock | NotesBlock
  | StrengthBlock | SkillBlock
  | AmrapBlock | EmomBlock | ForTimeBlock | ForRepsBlock | RftBlock

// Mapeo bloque → score_type del WOD logging
export const CONDITIONING_TYPES: Record<string, ScoreType | null> = {
  amrap: 'amrap',
  for_time: 'for_time',
  rft: 'for_time',
  for_reps: 'for_reps',
  emom: null,
  strength: 'weight',
}

// Para cada bloque, su icono lucide y label
export const BLOCK_META: Record<BlockType, { label: string; icon: LucideIcon; color: string }> = { ... }
```

#### Cambio de schema Postgres

```sql
-- Migración: agregar blocks a routines
ALTER TABLE public.routines
  ADD COLUMN IF NOT EXISTS blocks jsonb NOT NULL DEFAULT '[]'::jsonb;

-- Migración M1: convertir content existente a un único bloque 'notes'
UPDATE public.routines
SET blocks = jsonb_build_array(
  jsonb_build_object(
    'id', gen_random_uuid()::text,
    'order', 0,
    'type', 'notes',
    'text', content
  )
)
WHERE content IS NOT NULL
  AND content <> ''
  AND blocks = '[]'::jsonb;

-- content se mantiene como columna por compatibilidad pero ya no se usa en UI nueva.
-- (Se puede dropear en una migración posterior cuando confirmemos.)
```

### Layout del editor (admin)

`routine-form-modal.tsx` se reescribe. Layout vertical:

```
┌─ Modal: Nueva rutina ─────────────────────────────┐
│  Nombre: [Metabólico Lunes A_______________]      │
│                                                    │
│  Bloques:                                          │
│  ┌──────────────────────────────────────────────┐ │
│  │ ⋮⋮  🔥 Warm-up           ↑ ↓ ✕ │  (1 de 3)   │ │
│  │     [Movilidad de hombros — 5 min...]        │ │
│  └──────────────────────────────────────────────┘ │
│  ┌──────────────────────────────────────────────┐ │
│  │ ⋮⋮  💪 Strength          ↑ ↓ ✕ │  (2 de 3)   │ │
│  │  Ejercicio: [Back Squat ___________]         │ │
│  │  Sets:   [5]   Reps: [5]    Peso: [80 kg]    │ │
│  │  Notas (opcional): [_______________________] │ │
│  └──────────────────────────────────────────────┘ │
│  ┌──────────────────────────────────────────────┐ │
│  │ ⋮⋮  ⏱️ AMRAP             ↑ ↓ ✕ │  (3 de 3)   │ │
│  │  Minutos: [12]                               │ │
│  │  Movimientos:                                │ │
│  │   • [10 burpees__________________] ✕         │ │
│  │   • [15 KB swings @ 24/16kg______] ✕         │ │
│  │   • [20 box jumps________________] ✕         │ │
│  │   [+ Agregar movimiento]                     │ │
│  └──────────────────────────────────────────────┘ │
│                                                    │
│  [+ Agregar bloque ▼]                              │
│   └ Warm-up | Strength | Skill | AMRAP | EMOM     │
│     | For Time | RFT | For Reps | Cool-down       │
│     | Notas del coach                              │
│                                                    │
│  [Cancelar]              [Guardar rutina]          │
└────────────────────────────────────────────────────┘
```

#### Componentes a crear

- `RoutineBlockEditor.tsx`: container que orquesta la lista de bloques (state, reordenar, eliminar).
- `block-editors/`: una carpeta con un editor por tipo (`WarmupEditor`, `StrengthEditor`, `AmrapEditor`, etc.). Cada editor recibe `block` y `onChange(updated)` y renderiza los campos específicos.
- `BlockPicker.tsx`: dropdown "+ Agregar bloque" con los 10 tipos.

#### Reordenamiento
Botones ↑ y ↓ en la cabecera de cada bloque. No usamos librería de drag-drop para mantener el bundle ligero y la UX consistente entre desktop/mobile. (Si más adelante se pide drag-drop con `@dnd-kit/core`, es swap-in.)

#### Validación
- Nombre de rutina: requerido, no vacío.
- Cada bloque: campos requeridos según el tipo (ej. `minutes > 0`, `rounds > 0`, `target_reps > 0`, `sets > 0`, `movements.length > 0` para conditioning blocks). Validación en cliente con Zod por tipo de bloque.
- Una rutina puede tener 0 bloques al guardar (caso "rutina pendiente"); pero ≥1 es lo esperado.

### Render en el portal del miembro

`TodayRoutineCard.tsx` (home), `TodayWodHeader.tsx` (`/portal/wod`), y `MemberDetailModal.tsx` (Descubrir → WODs recientes) usan ahora un componente compartido nuevo `<RoutineBlocks blocks={blocks} />`. Por cada bloque renderiza una *card* con icono, label, y los campos formateados.

Ejemplo del bloque AMRAP:

```
┌──────────────────────────────────┐
│  ⏱️  AMRAP 12                     │
├──────────────────────────────────┤
│  • 10 burpees                    │
│  • 15 KB swings @ 24/16kg        │
│  • 20 box jumps                  │
└──────────────────────────────────┘
```

Ejemplo del bloque Strength:
```
┌──────────────────────────────────┐
│  💪  Strength                     │
├──────────────────────────────────┤
│  Back Squat                      │
│  5 × 5  @ 80 kg                  │
│  ─────────                       │
│  Mantén pecho arriba en el bajón │
└──────────────────────────────────┘
```

Componente shared: `components/shared/routine-blocks/`. Reusable entre admin (preview) y miembro.

### Migración M1 — qué pasa con las rutinas existentes

Cada rutina con `content` no vacío en la DB se migra a un único bloque tipo `notes` con `text = content`. Esto preserva el contenido pero pierde el formato Markdown (negritas, headers, listas) — el render mostrará texto plano dentro del bloque "Notas del coach". El admin puede editar la rutina y reorganizarla en bloques cuando quiera.

Tradeoff aceptado: rutinas viejas se ven menos lindas hasta que el admin las edite. Nuevas rutinas siempre usan bloques.

### Integración con WOD logging — WL1

Modificar `getTodayWodLog`, `getMyPlanRoutines`, y la lógica del `LogWodModal`:

1. Cuando `LogWodModal` abre, busca en `routine.blocks` el primer bloque con `type` en `['amrap', 'for_time', 'rft', 'for_reps', 'strength']`.
2. Si lo encuentra → `score_type` queda fijado a ese tipo. **El selector de score type del modal se oculta** (ya no es necesario que el miembro elija).
3. Si no encuentra ninguno (rutina solo de skill/warmup/cooldown/notes/emom) → el botón "Registrar mi WOD" no se renderiza ni en `TodayRoutineCard` ni en `TodayWodHeader`. Ese día no hay nada que loguear.
4. EMOM no es scorable; quien tiene un EMOM puro como bloque principal → no logea (correcto, no hay convención de score).

#### Cambios en `lib/actions/wod-logs.ts`

- `getMyPlanRoutines()` retorna también el campo `blocks` por rutina.
- Nuevo helper exportado: `getPrimaryConditioningBlock(blocks: RoutineBlock[]): RoutineBlock | null`.
- `getTodayLeaderboard()` filtra logs solo del bloque principal de la rutina del día.

#### Cambios en `LogWodModal`
- Remover los `<button>` del selector de score type (líneas 1278-1296 del modal actual).
- Mostrar arriba un label fijo con el bloque principal: `"Score: AMRAP 12 (10 burpees, 15 KB swings, 20 box jumps)"`.
- `score_type` se setea desde el bloque y no desde state.

### Edge cases

- **Rutina con 0 bloques**: no se puede registrar WOD; el admin recibe warning "rutina vacía" al guardar pero se permite.
- **Rutina con 2 conditioning blocks**: solo el primero (por `order` ascendente) cuenta para el logging. El admin debe ordenar primero el bloque medible.
- **Rutina solo Strength**: `score_type = weight`. El input pide kg.
- **Migración de rutinas legacy**: el bloque tipo `notes` no es conditioning → la rutina migrada NO tiene logging hasta que el admin la convierta. El comportamiento del WOD logging para rutinas legacy es "no registrable" (consistente).

---

## Out of scope

Cosas que conscientemente NO incluimos en este spec:

- **Drag & drop con librería externa** (`@dnd-kit`). Usamos botones ↑↓ y handle visual `⋮⋮` decorativo. Se puede agregar en un follow-up sin cambiar el modelo de datos.
- **Tipos exotic de WOD**: Tabata, Death by, Chipper, Ladder. Cubrimos el 90% con los 10 tipos. Si el admin pide alguno → agregar más tipos al `BlockType` union.
- **Plantillas de rutina guardadas**: el admin puede usar el botón "Duplicar rutina" (existente) para clonar.
- **Markdown libre dentro de bloques de texto**: los bloques `warmup`, `cooldown`, `notes` aceptan solo texto plano con saltos de línea. No se renderiza Markdown.
- **Marcar bloque "principal" explícito** (WL3): por ahora, "primer conditioning block en orden" es la regla. Si causa fricción, se agrega un toggle "Es el WOD del día" en cada bloque.
- **Borrar la columna `content`**: se mantiene en DB después de la migración M1. Se dropea en una migración posterior cuando confirmemos que nada la lee.
- **UI mejorada de movimientos** (ej. autocompletado de ejercicios comunes): los movimientos siguen siendo `string[]` con texto libre.

---

## Resumen de archivos afectados

### Nuevos
- `lib/constants/routine-blocks.ts` — types, helpers (`getPrimaryConditioningBlock`, `BLOCK_META`).
- `components/shared/routine-blocks/RoutineBlocks.tsx` — render del array de bloques (uso en portal miembro).
- `components/shared/routine-blocks/blocks/` — un componente de render por tipo (10 archivos pequeños).
- `components/section-components/horarios/modals/RoutineBlockEditor.tsx` — orquesta la lista editable.
- `components/section-components/horarios/modals/block-editors/` — un editor por tipo (10 archivos).
- `components/section-components/horarios/modals/BlockPicker.tsx` — dropdown "+ Agregar bloque".
- `supabase/migrations/20260502160000_routines_blocks.sql` — agregar columna y migrar `content` → `blocks`.
- `lib/utils.ts` — agregar `isDayClosed(open, close)`.

### Modificados
- `components/section-components/horarios/DayColumn.tsx` — ocultar planes si día cerrado.
- `components/section-components/horarios/ScheduleInline.tsx` — `Time12h` sin AM/PM toggle; recibe `period` por prop.
- `components/section-components/horarios/modals/routine-form-modal.tsx` — reemplazar Textarea por `RoutineBlockEditor`.
- `components/section-components/horarios/modals/routine-preview-modal.tsx` — usar `<RoutineBlocks>` compartido.
- `components/section-components/portal/home/TodayRoutineCard.tsx` — render con `<RoutineBlocks>`.
- `components/section-components/portal/wod/TodayWodHeader.tsx` — render con `<RoutineBlocks>`.
- `components/section-components/portal/descubrir/MemberDetailModal.tsx` — sección WODs recientes muestra el bloque principal.
- `components/section-components/portal/wod/log-wod-modal.tsx` — remover selector de score type; usar bloque principal.
- `lib/actions/routines.ts` — `createRoutine`/`updateRoutine` aceptan `blocks` además de `name`. `content` deja de usarse.
- `lib/actions/wod-logs.ts` — `getTodayWodLog`, `getMyPlanRoutines`, `getTodayLeaderboard` retornan `blocks` y filtran por bloque principal.
- `types/database.ts` — regenerar para incluir `blocks` en `routines`.

---

## Decisiones de diseño cerradas

| Pregunta | Decisión |
|---|---|
| Editor: A toolbar / B secciones / C WOD-aware | **C** |
| Estructura: B1 multi-bloque / B2 single | **B1** |
| Set de tipos | 10 tipos confirmados |
| Migración: M1 / M2 / M3 | **M1** (autoconvert a bloque `notes`) |
| WOD logging: WL1 / WL2 / WL3 / WL4 | **WL1** (auto-detect primer conditioning block) |
| Hora 12 en mañana/tarde | Siempre = mediodía (12:00) |
| Drag & drop | No (botones ↑↓ + handle decorativo) |
| Tipos exotic (Tabata/Chipper/etc.) | Out of scope |

---

## Plan de implementación (alto nivel — el plan detallado va en `plans/`)

Orden sugerido para shippear en pequeñas partes verificables:

1. **Issue 1 (Cerrado oculta planes)** — 1 task, 30 min. Independiente de los otros.
2. **Issue 2 (AM/PM implícito)** — 1 task, 1 h. Independiente.
3. **Issue 3a (DB + types)** — migración + regen + helpers de constants.
4. **Issue 3b (Editor admin)** — `RoutineBlockEditor` + 10 block editors + `BlockPicker` en `routine-form-modal.tsx`.
5. **Issue 3c (Render miembro)** — `<RoutineBlocks>` compartido + 10 block renderers.
6. **Issue 3d (WOD logging integration)** — modificar `LogWodModal` y server actions de logging para usar `getPrimaryConditioningBlock`.
7. **QA manual end-to-end** — verificar admin crea rutina con 3 bloques, miembro ve el render, registra WOD del bloque principal.
