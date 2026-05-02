# WOD Logging — Design

**Status:** Draft
**Date:** 2026-05-02
**Owner:** Madbox

## Resumen

Cada miembro puede registrar el resultado de un WOD que hizo (tiempo, rounds, reps o peso), con bandera RX/Scaled y notas. Hay leaderboard del WOD del día y un historial personal en una página nueva `/portal/wod`. Los miembros pueden también lanzar el log desde el `TodayRoutineCard` en la home del portal.

## Motivación

El sistema ya muestra al miembro la rutina del día (`getTodayRoutineForMember`), pero no hay forma de cerrar el ciclo: hicieron el WOD ¿y con qué resultado? Sin eso no se puede:
- Construir un historial deportivo del miembro.
- Mostrar leaderboards (gamificación / comunidad).
- Hilar al sistema de RMs / Descubrir que ya existe.

## Goals

- Registro polimórfico de WODs (4 tipos de score) con RX/Scaled y notas.
- Botón inline desde la `TodayRoutineCard`.
- Página `/portal/wod` con leaderboard del día + historial personal cronológico.
- Permitir backdating (max=hoy).
- Editar/borrar logs propios.
- Privacidad: nuevo toggle `show_wods` (default true) que controla si tus logs aparecen en leaderboards y en el modal público de Descubrir.

## Non-goals (out of scope)

- Detección automática de PR (el usuario dijo "no").
- Vista admin de "quiénes hicieron el WOD" (out de este spec).
- WODs benchmark (Fran/Helen/Cindy) precargados.
- Programación de WODs ad-hoc fuera del sistema de `routine_assignments`.
- Comparación de scores entre rutinas distintas.
- Comentarios sociales en logs ajenos.
- Exportar/imprimir.

## Modelo de datos

### Tabla nueva `wod_logs`

```sql
CREATE TABLE public.wod_logs (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  member_id uuid NOT NULL REFERENCES public.members(id) ON DELETE CASCADE,
  routine_id uuid NOT NULL REFERENCES public.routines(id) ON DELETE CASCADE,
  date date NOT NULL CHECK (date <= current_date),

  score_type text NOT NULL CHECK (score_type IN ('for_time','amrap','for_reps','weight')),

  -- Solo el campo correspondiente al score_type es no-null
  score_seconds integer CHECK (score_seconds IS NULL OR score_seconds > 0),
  score_rounds  integer CHECK (score_rounds  IS NULL OR score_rounds  >= 0),
  score_reps    integer CHECK (score_reps    IS NULL OR score_reps    >= 0),
  score_kg      numeric(6,2) CHECK (score_kg IS NULL OR (score_kg > 0 AND score_kg <= 500)),

  rx boolean NOT NULL DEFAULT false,
  notes text,

  created_at timestamptz DEFAULT now(),
  updated_at timestamptz DEFAULT now(),

  UNIQUE (member_id, routine_id, date),

  CONSTRAINT wod_logs_score_shape CHECK (
    (score_type = 'for_time' AND score_seconds IS NOT NULL AND score_rounds IS NULL AND score_reps IS NULL AND score_kg IS NULL)
    OR (score_type = 'amrap'    AND score_seconds IS NULL AND score_rounds IS NOT NULL AND score_kg IS NULL)
    OR (score_type = 'for_reps' AND score_seconds IS NULL AND score_rounds IS NULL AND score_reps IS NOT NULL AND score_kg IS NULL)
    OR (score_type = 'weight'   AND score_seconds IS NULL AND score_rounds IS NULL AND score_reps IS NULL AND score_kg IS NOT NULL)
  )
);

CREATE INDEX wod_logs_member_date_idx ON public.wod_logs (member_id, date DESC);
CREATE INDEX wod_logs_routine_date_idx ON public.wod_logs (routine_id, date DESC);
```

**Notas de diseño:**

- **`UNIQUE (member_id, routine_id, date)`** habilita semántica upsert (re-loggear sobreescribe). Si un miembro hace el mismo WOD dos veces el mismo día, escribe encima del primero — caso ultra raro, simplifica mucho el flujo de edición.
- **`date`** se separa de `created_at`: permite logear retroactivamente (`max=hoy` server-side). El usuario eligió B en pregunta 5.
- **`routine_id`** referencia rutinas, no `routine_assignments`. Si en el futuro se descontinúa una asignación, los logs siguen apuntando a la rutina (que es la unidad atómica del WOD).
- **AMRAP guarda `rounds` y `reps_extra` separados** porque la UI los pide separados. El ranking se computa en server: `rounds * 1000 + reps_extra` (rep cap por round es siempre <1000 en CrossFit; este es el truco para tener un solo número rankeable sin generated columns).
- **`for_reps`** usa `score_reps` (el AMRAP usa `score_rounds` + `score_reps`).

### Helpers de score (shared util)

```ts
// lib/constants/wod-score.ts
export type ScoreType = 'for_time' | 'amrap' | 'for_reps' | 'weight'

export interface WodScore {
  score_type: ScoreType
  score_seconds: number | null
  score_rounds: number | null
  score_reps: number | null
  score_kg: number | null
}

// Valor único comparable (ya orientado a "más es mejor" excepto for_time)
export function rankableValue(s: WodScore): number {
  switch (s.score_type) {
    case 'for_time': return s.score_seconds ?? 0
    case 'amrap':    return (s.score_rounds ?? 0) * 1000 + (s.score_reps ?? 0)
    case 'for_reps': return s.score_reps ?? 0
    case 'weight':   return Number(s.score_kg ?? 0)
  }
}

// "Lower is better" => for_time. Resto: higher better.
export function isLowerBetter(t: ScoreType): boolean {
  return t === 'for_time'
}

export function formatScore(s: WodScore): string {
  switch (s.score_type) {
    case 'for_time': {
      const sec = s.score_seconds ?? 0
      const m = Math.floor(sec / 60)
      const r = sec % 60
      return `${m}:${r.toString().padStart(2, '0')}`
    }
    case 'amrap': {
      const r = s.score_rounds ?? 0
      const reps = s.score_reps ?? 0
      return reps > 0 ? `${r} + ${reps}` : `${r} rounds`
    }
    case 'for_reps':
      return `${s.score_reps ?? 0} reps`
    case 'weight':
      return `${Number(s.score_kg ?? 0).toLocaleString('es-VE')} kg`
  }
}

export const SCORE_TYPE_LABEL: Record<ScoreType, string> = {
  for_time: 'For Time',
  amrap: 'AMRAP',
  for_reps: 'For Reps',
  weight: 'Peso',
}
```

### Cambios en `members`

Una columna nueva, en línea con el patrón de `show_rms`:

```sql
ALTER TABLE public.members
  ADD COLUMN IF NOT EXISTS show_wods boolean NOT NULL DEFAULT true;
```

`show_wods=false` significa: "mis logs de WOD existen en mi historial pero no aparecen en leaderboards públicos ni en el modal de Descubrir".

## Privacidad y RLS

### `wod_logs`

```sql
ALTER TABLE public.wod_logs ENABLE ROW LEVEL SECURITY;

-- SELECT: dueño del log o admin
CREATE POLICY "wod_logs_self_or_admin_select" ON public.wod_logs
  FOR SELECT TO authenticated
  USING (
    EXISTS (SELECT 1 FROM public.admins WHERE auth_user_id = auth.uid())
    OR member_id IN (SELECT id FROM public.members WHERE auth_user_id = auth.uid())
  );

-- INSERT/UPDATE/DELETE: solo dueño
CREATE POLICY "wod_logs_own_write" ON public.wod_logs
  FOR ALL TO authenticated
  USING (member_id IN (SELECT id FROM public.members WHERE auth_user_id = auth.uid()))
  WITH CHECK (member_id IN (SELECT id FROM public.members WHERE auth_user_id = auth.uid()));
```

**Cross-member reads (leaderboard, perfil público) usan `createAdminClient()`** desde server actions, igual que en RMs/Descubrir. Cada server action verifica que el caller esté autenticado antes de usar el admin client. Esto evita exponer `email`/`phone` por una RLS demasiado abierta.

## UI / UX

### 1) `TodayRoutineCard` — botón inline

Agregar al fondo de la card existente:

- Si **no hay log para hoy**: botón primario "Registrar mi WOD" → abre modal.
- Si **hay log**: card mini mostrando el score formateado + RX/Scaled + botón "Editar" en la esquina (lápiz).

Si la rutina del día es `null`, no se muestra el botón (no hay rutina contra la cual logear).

### 2) Modal `LogWodModal`

Campos:

- **Tipo de score** (`Tabs` o `Select`, 4 opciones): For Time / AMRAP / For Reps / Peso.
- **Inputs según tipo:**
  - For Time: dos `<input type="number">` (min, sec).
  - AMRAP: dos inputs (rounds, reps_extra).
  - For Reps: un input (total reps).
  - Peso: un input numérico (kg, decimal).
- **Fecha** (`<input type="date">`, default hoy, max=hoy).
- **RX / Scaled** — toggle (Switch o un par de pills); default Scaled.
- **Notas** (textarea opcional, max 500 chars).
- Footer: "Borrar" (si edit existente) + "Guardar".

Validación con Zod por tipo (discriminated union):

```ts
const baseSchema = z.object({
  date: z.string().refine((s) => s <= todayISO(), 'Fecha futura no permitida'),
  rx: z.boolean(),
  notes: z.string().max(500).optional(),
})

const schema = z.discriminatedUnion('score_type', [
  baseSchema.extend({ score_type: z.literal('for_time'), minutes: z.number().min(0).max(120), seconds: z.number().min(0).max(59) }),
  baseSchema.extend({ score_type: z.literal('amrap'),    rounds: z.number().min(0).max(999), reps_extra: z.number().min(0).max(999) }),
  baseSchema.extend({ score_type: z.literal('for_reps'), reps: z.number().min(1).max(99999) }),
  baseSchema.extend({ score_type: z.literal('weight'),   kg: z.number().positive().max(500) }),
])
```

### 3) Página `/portal/wod`

Estructura:

```
┌─────────────────────────────────────────────────┐
│  WOD del día — <Nombre rutina>                   │
│  [contenido de la rutina, colapsable]            │
│  [Botón "Registrar mi WOD" si no logeado hoy]   │
│  [O bloque "Tu score: 8:45 RX" + Editar]        │
├─────────────────────────────────────────────────┤
│  🏆 Leaderboard de hoy (Top 10)                  │
│  ┌──────────────────────────────────────────┐   │
│  │ 1° avatar Juan       8:45  RX            │   │
│  │ 2° avatar María      9:12  RX            │   │
│  │ 3° avatar Pedro     10:30  Scaled        │   │
│  └──────────────────────────────────────────┘   │
├─────────────────────────────────────────────────┤
│  Mi historial                                    │
│  [Lista cronológica desc, agrupada por mes]      │
│  • 02 May · Cindy · 18 + 5 RX                    │
│  • 01 May · Helen · 12:34 Scaled                 │
│  • ...                                           │
└─────────────────────────────────────────────────┘
```

**Comportamiento del leaderboard:**

- Filtra por `routine_id = today's routine` para el plan del usuario actual + `date = today`.
- Si el usuario actual NO tiene plan o no hay rutina hoy: oculta esta sección, solo muestra el historial.
- Si hay rutina pero nadie ha logeado hoy: muestra "Aún nadie ha registrado el WOD de hoy. ¡Sé el primero!".
- Solo aparecen logs de miembros con `show_wods = true` (y el master `discoverable = true`).
- Top 10. Ordena con `rankableValue` + `isLowerBetter`.
- Resaltar al usuario actual con un `ring-primary` si está en el top.
- Tiebreaker: `created_at ASC` (quien logeó primero gana en empate).

**Historial:**

- Server action `getMyWodHistory(limit?)` devuelve los logs del usuario, descendente por `date` luego `created_at`.
- Agrupado por mes en la UI (header tipo "Mayo 2026").
- Click en una fila → abre `LogWodModal` en modo edición.
- Cada fila muestra: fecha, nombre rutina, score formateado, badge RX/Scaled, ícono de notas (si tiene).
- Paginación simple: botón "Cargar más" (offset client-side; server action acepta `limit` y `offset`).

### 4) Nav del portal — agregar "WOD"

`app/portal/layout.tsx` — agregar entre "Descubrir" y "Clases":

```tsx
{ name: "WOD", href: "/portal/wod", icon: Flame }
```

**Total nav:** 6 ítems (Inicio, Descubrir, **WOD**, Clases, Pagos, Perfil). En mobile el bottom nav queda apretado pero sigue cabiendo (íconos + texto pequeño). Si el espacio lo amerita, abreviar "Descubrir" → "Buscar" (no requerido por ahora).

### 5) Integración con Descubrir / `MemberDetailModal`

En `MemberDetailModal` (modal de perfil público de otro miembro), agregar al final una sección "WODs recientes":

- Solo si `show_wods = true` del miembro mostrado.
- Top 5 logs más recientes.
- Si `show_wods = false`: ocultar la sección entera (sin texto explicativo, igual que como se hace con RMs cuando `show_rms=false` se muestra mensaje sutil).

En `MemberCard` (grid Descubrir): no agregar WODs (la card ya está densa). Solo el modal de detalle.

### 6) Tab "Privacidad" del Perfil — agregar 5to toggle

```ts
{ key: "show_wods", title: "Mostrar mis WODs", desc: "Tus registros de WOD serán visibles en leaderboards y en tu perfil público." }
```

## Server actions

Archivo nuevo: `lib/actions/wod-logs.ts`.

### Tipos exportados

```ts
export interface WodLog {
  id: string
  member_id: string
  routine_id: string
  routine_name: string  // join con routines
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
  position: number  // 1-based
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
```

### Funciones

```ts
// Cliente: caller propio
export async function getTodayWodLog(): Promise<WodLog | null>
export async function getMyWodHistory(limit?: number, offset?: number): Promise<WodLog[]>
export async function upsertWodLog(input: UpsertWodLogInput): Promise<WodLog>
export async function deleteWodLog(id: string): Promise<void>

// Cross-member (admin client + ensureAuthenticated)
export async function getTodayLeaderboard(): Promise<{
  routine: { id: string; name: string; content: string } | null
  entries: WodLeaderboardEntry[]
}>

// Para MemberDetailModal en Descubrir
export async function getMemberRecentWods(memberId: string, limit: number): Promise<WodLog[]>
```

**`getTodayLeaderboard` — lógica detallada:**

1. `ensureAuthenticated()`.
2. Obtener `member_id` y `plan_id` del caller (admin client, lookup por `auth_user_id`).
3. Si no tiene plan: retornar `{ routine: null, entries: [] }`.
4. Computar `today_label` (igual que `getTodayLabel` en routines.ts).
5. Lookup `routine_assignments` por `(plan_id, today_label)` → routine_id, routine.
6. Si no hay assignment: retornar `{ routine: null, entries: [] }`.
7. Query `wod_logs` join `members` (filtrando `discoverable=true`, `show_wods=true`) por `(routine_id, date=today)`.
8. Computar `rankable` para cada uno; ordenar (lower-better si `for_time`); slice top 10.
9. Devolver con `position` 1-based.

**Validación en `upsertWodLog`:**

- `date <= today` (server-side, además del CHECK de DB).
- Por `score_type`, validar que el campo correspondiente está presente y los demás `null`.
- Convertir `score_seconds = minutes*60 + seconds` desde el input del modal antes del insert.
- `notes.length <= 500`.
- En upsert, usar `onConflict: 'member_id,routine_id,date'`.

**`logActivity`:**

Extender `ActivityAction` con `"wod_logged" | "wod_deleted"` y `EntityType` con `"wod_log"`. Anotar después de cada upsert/delete.

**Revalidate paths:**

- `/portal` (TodayRoutineCard)
- `/portal/wod`
- `/portal/descubrir` (cambia el modal público de cualquier miembro que vea otro)

## Componentes UI nuevos

```
components/section-components/portal/wod/
├── PortalWodMainComponent.tsx       # main page, dispatcher
├── TodayWodHeader.tsx                # rutina + botón log/edit
├── WodLeaderboard.tsx                # top 10 del día
├── WodHistoryList.tsx                # historial agrupado por mes
├── log-wod-modal.tsx                 # modal de logging (compartido con TodayRoutineCard)
├── WodScoreInputs.tsx                # inputs por score_type (reutilizable)
└── WodLogRow.tsx                     # fila de historial (clickable -> editar)

components/section-components/portal/home/
└── TodayRoutineCard.tsx              # MODIFICAR: agregar botón "Registrar WOD"

components/section-components/portal/descubrir/
└── MemberDetailModal.tsx             # MODIFICAR: agregar sección "WODs recientes"

components/section-components/portal/perfil/
└── PrivacidadTab.tsx                 # MODIFICAR: agregar toggle show_wods
```

## Flujo de datos (TanStack Query)

| Query key | Fuente | staleTime |
|---|---|---|
| `["today-wod-log"]` | `getTodayWodLog` | 60s |
| `["my-wod-history", { limit, offset }]` | `getMyWodHistory` | 60s |
| `["today-leaderboard"]` | `getTodayLeaderboard` | 60s |
| `["member-recent-wods", memberId]` | `getMemberRecentWods` | 5min |

Después de mutar: invalidar `["today-wod-log"]`, `["my-wod-history"]`, `["today-leaderboard"]`. No invalidar `member-recent-wods` cross-user (se refrescan por staleTime cuando otro miembro abre el modal).

## Edge cases

- **Miembro sin plan asignado**: TodayRoutineCard ya maneja esto; el botón "Registrar WOD" se oculta. Página `/portal/wod` muestra solo historial (vacío si nunca logeó).
- **No hay rutina asignada para hoy**: igual.
- **Editar log de fecha pasada**: ok, modal permite cualquier fecha hasta hoy.
- **Log re-asignado a routine_id que ya no existe** (admin borró la rutina): `ON DELETE CASCADE` borra el log también. Aceptable: si la rutina se elimina del sistema, los registros contra ella desaparecen. (Si se quiere preservar histórico, cambiar a `ON DELETE SET NULL` y manejar `routine_id IS NULL` en UI — fuera de scope ahora.)
- **AMRAP con 0 rounds + N reps**: válido (logró menos de un round entero).
- **For Time con 0 segundos**: inválido por CHECK (`score_seconds > 0`).
- **Empate en leaderboard**: tiebreaker por `created_at ASC` (quien logeó primero).
- **Toggle `show_wods=false` mientras hay logs**: los logs siguen existiendo (privados). Volver a `true` los re-expone.

## Convenciones

- Idioma UI: español.
- Toasts con `sonner`.
- Confirmación de borrado de log: SweetAlert2 (alineado con resto del sistema), no nativo.
- Iconos: `lucide-react`. Sugerencias: `Flame` (página WOD), `Trophy` (leaderboard), `Calendar` (historial), `Pencil` (edit), `Trash2` (delete).
- Nombres de archivos: PascalCase para main component (`PortalWodMainComponent.tsx`), kebab-case para modals/utils (`log-wod-modal.tsx`).

## Riesgos / preguntas abiertas

1. **Bottom nav con 6 ítems en mobile** puede verse apretado. Solución preferida: si se ve mal, abreviar "Descubrir" → "Comunidad" o quitar texto en bottom nav (solo íconos). Decidir en QA visual.
2. **Score input UX para AMRAP**: pedirle al usuario "rounds" + "reps" implica que ya sabe contar rounds. Es lo estándar en gimnasios CrossFit (cualquier coach lo cuenta así).
3. **Performance del leaderboard**: con 100 miembros activos, `wod_logs` con índice `(routine_id, date)` resuelve en ms. No es preocupación a corto plazo.
4. **Si el admin cambia la rutina del día post-facto** (ej: lunes a las 8pm cambia la routine_assignment a otra rutina): los logs ya hechos quedan apuntando a la rutina previa, y el leaderboard "de hoy" pasa a ser de la rutina nueva (ya nadie ha logeado contra esa). Comportamiento aceptable; si causa fricción, fijar `routine_id` en el momento del log es lo correcto (que ya hacemos).

## Spec sign-off

Una vez aprobado este spec, sigue: **plan de implementación** en `docs/superpowers/plans/2026-05-02-wod-logging.md` con tasks atómicos, código completo y commits frecuentes — mismo formato que el spec/plan de RMs.
