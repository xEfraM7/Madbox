# WOD Logging dinámico — Diseño

**Fecha:** 2026-05-06
**Estado:** En revisión por el usuario (pre-plan de implementación)
**Ruta admin afectada:** `/dashboard/rutinas` (wizard)
**Ruta portal afectada:** `/portal/wod`, `/portal/rutinas`

---

## 1. Contexto y motivación

El proyecto ya migró el modelo de horarios al de planificación por fecha (`routine_schedules` + `routine_schedule_plans`). En esa migración se truncaron los `wod_logs` y se desactivó el registro de WODs en el portal del miembro, dejando como TODO la "vuelta del WOD logging" sobre el nuevo modelo.

El usuario quiere ahora cerrar ese loop con tres requisitos:

1. **Integración con la creación de planificaciones** — el wizard del admin debe definir qué se va a registrar.
2. **WODs dinámicos** — no todos los WODs son iguales (For Time, AMRAP, For Reps, peso máximo); el sistema debe adaptarse.
3. **Top de mejores tiempos del WOD del día** — leaderboard visible para los miembros.

El proyecto ya tiene gran parte del andamiaje:

- Tabla `wod_logs` con todos los campos de score (`score_type`, `score_seconds`, `score_rounds`, `score_reps`, `score_kg`, `rx`, `notes`).
- Constantes `lib/constants/wod-score.ts` (tipos, formateo, comparación, ranking).
- Constantes `lib/constants/routine-blocks.ts` con 10 tipos de bloques tipados, factory `createBlock`, parser `parseBlocks`, mapeo `CONDITIONING_SCORE_TYPE`, helper `getPrimaryConditioningBlock`.
- Componentes UI scaffolded en `components/section-components/portal/wod/` (logger modal, leaderboard, history, score inputs) — todos deshabilitados.

Lo que falta es: estructura en la rutina, server actions vivas y la pantalla del miembro.

---

## 2. Decisiones cerradas en brainstorming

| Decisión | Resultado |
|---|---|
| Estructura del wizard | Constructor de bloques estructurados (reescribir paso 3) usando los tipos ya definidos en `routine-blocks.ts` |
| Logs por rutina | Un score por bloque registrable (multi-WOD por rutina) |
| Scope del leaderboard | Por planes del schedule + género del viewer |
| Mezcla RX / Scaled | Ranking único, RX como badge informativo |
| Persistencia de bloques | JSONB en `routine_schedules.blocks` (Enfoque A) |
| Visibilidad | Respetar flag `members.show_wods` ya existente |
| Permisos nuevos | Ninguno — admin usa `routines.edit/delete`; miembro usa autenticación + plan match |

---

## 3. Modelo de datos

### 3.1 Migración nueva

`supabase/migrations/20260506120000_wod_logging_blocks.sql`:

```sql
-- 1. Bloques estructurados en routine_schedules
ALTER TABLE routine_schedules
  ADD COLUMN blocks jsonb NOT NULL DEFAULT '[]'::jsonb;

-- 2. block_id en wod_logs + nueva unicidad
ALTER TABLE wod_logs
  ADD COLUMN block_id text NOT NULL DEFAULT '';

ALTER TABLE wod_logs
  DROP CONSTRAINT IF EXISTS wod_logs_member_routine_date_key;

ALTER TABLE wod_logs
  ADD CONSTRAINT wod_logs_member_routine_block_key
  UNIQUE (member_id, routine_id, block_id);

-- 3. Índice de soporte para leaderboard
CREATE INDEX idx_wod_logs_routine_block ON wod_logs(routine_id, block_id);
```

### 3.2 Forma del JSONB `blocks`

Array de objetos con la forma de `RoutineBlock` (definida en `lib/constants/routine-blocks.ts`):

```ts
type RoutineBlock =
  | WarmupBlock | CooldownBlock | NotesBlock
  | StrengthBlock | SkillBlock
  | AmrapBlock | EmomBlock | ForTimeBlock | ForRepsBlock | RftBlock
```

Cada bloque trae:
- `id: string` — UUID generado en cliente con `crypto.randomUUID()` (estable a través de updates para no invalidar `wod_logs.block_id`).
- `order: number` — posición visible.
- `type: BlockType` — uno de los 10 tipos.
- Campos específicos del tipo (movements, minutes, sets, reps, time_cap_min, etc.).

### 3.3 Tipos generados

Tras ejecutar la migración hay que regenerar `types/database.ts` desde Supabase para que `Tables<"routine_schedules">.Row.blocks` tipe como `Json` (el wrapper aplica `parseBlocks()` para devolver `RoutineBlock[]`).

### 3.4 Compatibilidad con `routine_schedules.content`

El campo `content` (markdown) se mantiene. El wizard nuevo lo expone como un bloque `notes` opcional al final, no como un campo aparte. Las rutinas existentes que solo tengan `content` se renderizan en el portal con un solo bloque `notes` de fallback en el render.

---

## 4. Server Actions

### 4.1 `lib/actions/routines.ts` — extender

```ts
export interface RoutineSchedule {
  id: string
  date: string
  name: string | null
  content: string                  // se mantiene; bloque notes mejor que campo aparte
  blocks: RoutineBlock[]           // nuevo, viene del JSONB
  created_at: string | null
  updated_at: string | null
  plans: { id: string; name: string }[]
}

export interface CreateRoutineScheduleInput {
  date: string
  name?: string | null
  content?: string                 // ahora opcional
  blocks: RoutineBlock[]           // requerido (al menos un bloque)
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

Validación con Zod (nuevo: `lib/schemas/routine-blocks.ts`) — discriminated union por `type`. Si falla → `throw new Error(zodIssue.message)`.

`shapeRoutineSchedule()` aplica `parseBlocks(row.blocks)` para defensar contra JSON corrupto (devuelve `[]`).

### 4.2 `lib/actions/wod-logs.ts` — reescribir

Reemplazar las stubs por implementación real:

```ts
// Lectura
getRoutineForToday(): Promise<RoutineSchedule | null>
   // Resuelve member.plan_id → busca schedule de hoy en ese plan

getMyWodLogsForDate(date: string): Promise<WodLog[]>
   // Logs del miembro autenticado para el schedule de esa fecha

getMyWodHistory(limit = 50, offset = 0): Promise<WodLog[]>
   // Historial paginado del miembro

getLeaderboardForBlock(input: {
  routine_id: string
  block_id: string
  gender: "male" | "female"
  limit?: number  // default 10
}): Promise<WodLeaderboardResult>

// Escritura
upsertWodLog(input: {
  routine_id: string
  block_id: string
  score_type: ScoreType
  score_seconds?: number | null
  score_rounds?: number | null
  score_reps?: number | null
  score_kg?: number | null
  rx: boolean
  notes?: string | null
}): Promise<WodLog>

deleteWodLog(id: string): Promise<void>
```

### 4.3 Validaciones críticas en `upsertWodLog`

- Miembro autenticado y existe en `members`.
- `routine_id` existe; `block_id` existe en sus `blocks`.
- `score_type === getScoreTypeForBlock(block)` — protege contra forgery.
- Plan del miembro ∈ planes del schedule.
- Rangos numéricos (ver §6).
- `notes` ≤ 500 chars.

### 4.4 Query del leaderboard

```sql
-- pseudocódigo
SELECT wl.*, m.name, m.avatar_url, m.gender
FROM wod_logs wl
JOIN members m ON m.id = wl.member_id
WHERE wl.routine_id = $1
  AND wl.block_id = $2
  AND m.show_wods = true
  AND m.gender = $3
  AND m.plan_id IN (
    SELECT plan_id FROM routine_schedule_plans WHERE schedule_id = $1
  )
ORDER BY ... -- depende de score_type, ver lib/constants/wod-score.ts
LIMIT $4
```

El sort se hace en JS post-query reusando `compareScores()` para evitar repetir la lógica RX/score_type en SQL.

### 4.5 Side effects

Cada mutación llama:
- `revalidatePath("/portal/wod")`, `revalidatePath("/portal/rutinas")`, `revalidatePath("/dashboard/rutinas")`.
- `logActivity({ action: "wod_logged" | "wod_log_deleted", ... })`.

---

## 5. UI / Componentes

### 5.1 Wizard admin — paso 3 reescrito

Reemplazar el textarea de markdown actual con un block builder:

- **Componente principal**: `<RoutineBlocksEditor blocks onChange />` en `components/section-components/rutinas/blocks-editor/`.
- **Lista de bloques** con drag-to-reorder (usar `@dnd-kit/sortable` si no rompe el budget; alternativa simple: botones ↑/↓).
- **Botón "+ Agregar bloque"** → dropdown con `BLOCK_TYPE_ORDER` (10 opciones); al elegir llama `createBlock(type, blocks.length)` y empuja al array.
- **Sub-componentes por tipo** en `blocks-editor/types/`:
  - `WarmupBlockEditor`, `CooldownBlockEditor`, `NotesBlockEditor` — textarea
  - `StrengthBlockEditor` — exercise + sets + reps + weight + notes
  - `SkillBlockEditor` — lista de movimientos
  - `AmrapBlockEditor` / `EmomBlockEditor` — minutos + lista (EMOM además: alternating switch)
  - `ForTimeBlockEditor` — lista + time_cap_min
  - `ForRepsBlockEditor` — target_reps + lista
  - `RftBlockEditor` — rounds + lista
- **Indicador de registrabilidad**: bloques con `CONDITIONING_SCORE_TYPE[type]` reciben borde amarillo + badge "📊 LOG: [tipo]".
- **Validación**: al avanzar, todos los bloques deben pasar su validación específica (mínimo un movimiento donde aplique, sets > 0, etc.). Errores inline en rojo.
- **Migración inline**: si `routine.content` ≠ "" y `routine.blocks` está vacío, el wizard arranca con un único bloque `notes` cargado con el markdown existente.

### 5.2 Portal miembro — `/portal/wod`

Reemplazar `PortalWodMainComponent.tsx` (hoy "en construcción") por:

```
[Header del día]
  Fecha · Nombre rutina · Plan · "N bloques registrables"

[WodBlockCard × N registrables]
  [Tipo + parámetros]
  [Tu marca o botón "Registrar mi tiempo"]
  [Mini-leaderboard Top 3 + link Ver Top 10]

[InfoBlockCard × M no registrables]
  Cards discretas, solo muestran contenido

Sin rutina: estado vacío con CTA a /portal/rutinas para ver futuras
```

Componentes nuevos:
- `WodBlockCard` — wrapper de bloque registrable con estado (logeado/no), botón log/edit, mini-leaderboard.
- `InfoBlockCard` — vista de bloque no registrable (warmup, cooldown, skill, notes).
- `WodMiniLeaderboard` — Top 3 inline + toggle M/F + link al completo.
- `WodFullLeaderboardSheet` — `<Sheet>` lateral con Top 10 completo.

Reutilizar `LogWodModal` existente — ajustar para recibir `block_id` y derivar `score_type` del bloque vía `getScoreTypeForBlock`.

### 5.3 Portal miembro — `/portal/rutinas`

La vista actual ya renderiza bloques (referenciado en el commit `d9eac4f`). Agregar el botón "Registrar mi tiempo" en cada bloque registrable, abriendo el mismo `LogWodModal`. Dos puntos de entrada → mismo flujo.

### 5.4 TanStack Query keys y staleTime

```ts
['routine-today', memberId]                            staleTime: 60s
['my-wod-logs', memberId, scheduleId]                  staleTime: 60s
['my-wod-history', memberId, page]                     staleTime: 60s
['wod-leaderboard', routineId, blockId, gender]        staleTime: 5 * 60_000
```

Mutaciones (`upsertWodLog`, `deleteWodLog`) invalidan: `routine-today`, `my-wod-logs`, `my-wod-history`, `wod-leaderboard`.

---

## 6. Validación y rangos

| Score type | Validación |
|---|---|
| `for_time` | 1 ≤ `score_seconds` ≤ 14400 (4h) |
| `amrap` | `score_rounds` ≥ 0 ∧ `score_reps` ≥ 0 ∧ rounds + reps > 0 |
| `for_reps` | 1 ≤ `score_reps` ≤ 99999 |
| `weight` | 0.5 ≤ `score_kg` ≤ 500 (paso 0.5) |
| Notes | ≤ 500 chars |

Validación en cliente (UI inline) y en server action. La de server es la fuente de verdad.

---

## 7. Permisos

| Acción | Permiso requerido |
|---|---|
| Crear/editar rutina con bloques | `routines.edit` (o `isAdmin`) |
| Eliminar rutina | `routines.delete` |
| Logear/editar/borrar mi WOD | Auth + `members.plan_id` ∈ planes del schedule |
| Ver leaderboard | Auth (cualquier miembro) |
| Aparecer en leaderboard | `members.show_wods = true` |

No se introducen permisos nuevos. La columna `members.show_wods` ya existe.

---

## 8. Manejo de errores

- Server actions throw `Error` con mensaje en español. TanStack Query lo captura y la UI muestra `toast.error(error.message)`.
- ZodError → `error.issues[0].message` se propaga.
- Conflicto de unicidad en `wod_logs` → mensaje "Ya tienes un score para este bloque, edítalo en su lugar".
- Bloque inválido en wizard → error inline rojo bajo el campo.
- Si miembro no tiene plan asignado → `/portal/wod` muestra estado vacío "Asigna un plan para ver tus rutinas".

---

## 9. Out of scope (YAGNI)

Para mantener manejable el scope, **NO** se incluye:

- Edición de logs de otros miembros por parte del admin (puede agregarse luego con permiso `wod_logs.edit`).
- Realtime updates del leaderboard (refetch con stale time de 5 min basta).
- Histórico cross-rutina ("este mes hiciste 12 WODs RX") — vivirá en `/portal/perfil`.
- Comentarios/likes en logs de otros miembros.
- Exportar leaderboard a imagen/PDF.
- Notificaciones push cuando alguien rompe tu marca.
- Marcador "ganador del día" en `/portal/descubrir`.
- Tiebreaker times para WODs con cap (variante CrossFit Open).
- Drag-to-reorder con animaciones complejas — flechas ↑/↓ son aceptables si `@dnd-kit` no entra en el scope.

---

## 10. Plan de testing manual

Antes de cerrar la tarea:

1. **Wizard**: crear rutina con 1 warmup + 1 strength + 1 amrap. Verificar persistencia del JSONB.
2. **Wizard edit**: editar la rutina, reordenar bloques, eliminar uno. Verificar que los `id` de los bloques restantes se mantienen.
3. **Migración inline**: editar una rutina pre-existente que solo tenga `content` markdown — verificar que se carga como bloque `notes`.
4. **Logger - happy path**: login como miembro de un plan asociado → `/portal/wod` muestra los 2 bloques registrables → log AMRAP RX → refresh muestra "✓ LOGEADO".
5. **Logger - edit/delete**: editar el log, cambiar score, marcar Scaled, borrar.
6. **Leaderboard - mismo plan/género**: segundo miembro mismo plan/género logea → ambos aparecen ordenados correctamente.
7. **Leaderboard - plan distinto**: miembro de plan no asociado → `/portal/wod` muestra estado vacío.
8. **Leaderboard - toggle M/F**: cambia el filtro, refleja correctamente.
9. **Visibilidad**: miembro con `show_wods = false` no aparece en leaderboard pero sí ve sus logs.
10. **Validación negativa**: intentar logear con `score_type` distinto al del bloque vía DevTools → server rechaza.
11. **Conflicto**: intentar logear dos veces el mismo bloque → segundo intento da error de unicidad con mensaje claro.
12. **Sin rutina**: día sin rutina programada para mi plan → estado vacío en `/portal/wod`.

---

## 11. Archivos afectados (referencia rápida)

**Nuevos:**
- `supabase/migrations/20260506120000_wod_logging_blocks.sql`
- `lib/schemas/routine-blocks.ts` (Zod schemas)
- `components/section-components/rutinas/blocks-editor/RoutineBlocksEditor.tsx`
- `components/section-components/rutinas/blocks-editor/types/*.tsx` (10 sub-editores)
- `components/section-components/portal/wod/WodBlockCard.tsx`
- `components/section-components/portal/wod/InfoBlockCard.tsx`
- `components/section-components/portal/wod/WodMiniLeaderboard.tsx`
- `components/section-components/portal/wod/WodFullLeaderboardSheet.tsx`

**Modificados:**
- `types/database.ts` (regenerar)
- `lib/actions/routines.ts` (extender con bloques)
- `lib/actions/wod-logs.ts` (reescribir, hoy stubbed)
- `components/section-components/rutinas/modals/routine-wizard-modal.tsx` (paso 3)
- `components/section-components/portal/wod/PortalWodMainComponent.tsx` (rehacer)
- `components/section-components/portal/wod/log-wod-modal.tsx` (recibir block_id)
- `components/section-components/portal/wod/WodLeaderboard.tsx` (firma nueva)
- Vista de `/portal/rutinas` que renderiza bloques (agregar botón log)

---

## 12. Apéndice — Mockups de referencia

Los mockups visuales generados durante el brainstorming viven en `.superpowers/brainstorm/1906-1778082793/content/`:

- `bienvenida.html` — overview del estado actual
- `wizard-block-builder.html` — paso 3 del wizard rediseñado
- `portal-wod.html` — pantalla `/portal/wod` con cards y leaderboard
