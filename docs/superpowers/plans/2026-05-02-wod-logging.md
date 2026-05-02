# WOD Logging — Plan de Implementación

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Permitir que cada miembro registre el resultado de un WOD (4 tipos de score), edite/borre logs propios, vea un leaderboard del WOD del día y un historial cronológico, todo con privacidad granular.

**Architecture:** Tabla nueva `wod_logs` con score polimórfico (4 columnas score_*); UNIQUE(member_id, routine_id, date) para upsert; toggle `show_wods` en members; server actions en `lib/actions/wod-logs.ts` (own + cross-member via admin client); página nueva `/portal/wod` con leaderboard del día + historial; botón inline en `TodayRoutineCard`; sección "WODs recientes" en `MemberDetailModal`.

**Tech Stack:** Next.js 16 (App Router, Server Actions), React 19, TypeScript estricto, Supabase (Postgres + RLS + admin client), TanStack Query 5, shadcn/ui (Tabs, Dialog, Switch, Card, Tabs/Pills), React Hook Form + Zod (discriminated union), Tailwind CSS 4, Sonner, lucide-react.

**Spec:** [docs/superpowers/specs/2026-05-02-wod-logging-design.md](../specs/2026-05-02-wod-logging-design.md)

**Convenciones del proyecto (recordatorio):**
- Server actions con `"use server"` arriba; UI nunca toca Supabase desde el cliente.
- `revalidatePath` y `logActivity` después de cada mutación que aplique.
- Errores de Supabase con `throw error`.
- TanStack Query para state del servidor en cliente; invalidar queries en `onSuccess`.
- Idioma español en UI; identificadores técnicos en inglés.
- Modo oscuro fijo. Yellow primary sobre fondo negro.
- Verificación con `npx tsc --noEmit --skipLibCheck` + browser manual.
- Solo commiteamos código que compila sin errores.

---

## Estructura de archivos

**Crear:**
- `supabase/migrations/20260502150000_wod_logs_setup.sql`
- `lib/constants/wod-score.ts`
- `lib/actions/wod-logs.ts`
- `components/section-components/portal/wod/PortalWodMainComponent.tsx`
- `components/section-components/portal/wod/TodayWodHeader.tsx`
- `components/section-components/portal/wod/WodLeaderboard.tsx`
- `components/section-components/portal/wod/WodHistoryList.tsx`
- `components/section-components/portal/wod/WodLogRow.tsx`
- `components/section-components/portal/wod/log-wod-modal.tsx`
- `components/section-components/portal/wod/WodScoreInputs.tsx`
- `app/portal/wod/page.tsx`

**Modificar:**
- `types/database.ts` (regenerado, no se edita a mano salvo limpieza post-regen)
- `lib/actions/activity.ts`
- `app/portal/layout.tsx` (agregar nav item "WOD")
- `components/section-components/portal/home/TodayRoutineCard.tsx` (agregar botón log)
- `components/section-components/portal/descubrir/MemberDetailModal.tsx` (sección WODs recientes)
- `components/section-components/portal/perfil/PrivacidadTab.tsx` (toggle `show_wods`)

---

### Task 1: Migración DB + types regen + activity types

**Files:**
- Create: `supabase/migrations/20260502150000_wod_logs_setup.sql`
- Modify: `types/database.ts` (regenerado)
- Modify: `lib/actions/activity.ts`

- [ ] **Step 1: Crear el archivo de migración**

Crear `supabase/migrations/20260502150000_wod_logs_setup.sql` con este contenido exacto:

```sql
-- WOD logs + toggle show_wods en members

-- 1. Tabla wod_logs
CREATE TABLE IF NOT EXISTS public.wod_logs (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  member_id uuid NOT NULL REFERENCES public.members(id) ON DELETE CASCADE,
  routine_id uuid NOT NULL REFERENCES public.routines(id) ON DELETE CASCADE,
  date date NOT NULL CHECK (date <= current_date),
  score_type text NOT NULL CHECK (score_type IN ('for_time','amrap','for_reps','weight')),
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

CREATE INDEX IF NOT EXISTS wod_logs_member_date_idx ON public.wod_logs (member_id, date DESC);
CREATE INDEX IF NOT EXISTS wod_logs_routine_date_idx ON public.wod_logs (routine_id, date DESC);

-- 2. RLS
ALTER TABLE public.wod_logs ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "wod_logs_self_or_admin_select" ON public.wod_logs;
CREATE POLICY "wod_logs_self_or_admin_select" ON public.wod_logs
  FOR SELECT TO authenticated
  USING (
    EXISTS (SELECT 1 FROM public.admins WHERE auth_user_id = auth.uid())
    OR member_id IN (SELECT id FROM public.members WHERE auth_user_id = auth.uid())
  );

DROP POLICY IF EXISTS "wod_logs_own_write" ON public.wod_logs;
CREATE POLICY "wod_logs_own_write" ON public.wod_logs
  FOR ALL TO authenticated
  USING (member_id IN (SELECT id FROM public.members WHERE auth_user_id = auth.uid()))
  WITH CHECK (member_id IN (SELECT id FROM public.members WHERE auth_user_id = auth.uid()));

-- 3. Toggle show_wods en members
ALTER TABLE public.members
  ADD COLUMN IF NOT EXISTS show_wods boolean NOT NULL DEFAULT true;
```

- [ ] **Step 2: Aplicar la migración**

Run: `npx supabase db push`
Expected: "Applying migration 20260502150000_wod_logs_setup.sql..." y "Finished supabase db push."

- [ ] **Step 3: Regenerar types**

Run: `npx supabase gen types typescript --linked > types/database.ts`

Esta salida tiene dos basura conocidas:
- Primera línea: `Initialising login role...`
- Última línea: `<claude-code-hint v="1" type="plugin" value="supabase@claude-plugins-official" />`

Y se pierden las interfaces custom al final del archivo (`MonthlyClosing`, `MonthlyClosingPreview`, `PendingPeriod`).

- [ ] **Step 4: Limpiar la primera línea**

Editar `types/database.ts`: quitar la primera línea `Initialising login role...`. Deja `export type Json =` como primera línea.

- [ ] **Step 5: Reemplazar el final del archivo**

Buscar la última línea que es:
```
} as const
<claude-code-hint v="1" type="plugin" value="supabase@claude-plugins-official" />
```

Reemplazar por:
```
} as const

// Monthly Closing types
export interface MonthlyClosing {
  id: string
  period: string

  // Ingresos membresías
  membership_revenue_bs: number
  membership_revenue_usd_cash: number
  membership_revenue_usdt: number
  membership_payments_count: number

  // Ingresos clases
  class_revenue_bs: number
  class_revenue_usd_cash: number
  class_revenue_usdt: number
  class_payments_count: number

  // Total USD
  total_revenue_usd: number

  // Métricas miembros
  active_members: number
  new_members: number
  expired_members: number
  frozen_members: number
  total_members: number
  retention_rate: number

  // Fondos
  funds_bs: number
  funds_usd_cash: number
  funds_usdt: number
  funds_reset: boolean

  // Tasas
  rate_bcv: number
  rate_usdt: number
  rate_custom: number

  // Metadata
  closed_by: string | null
  closed_at: string
  notes: string | null
  created_at: string

  // Relaciones
  admin?: { name: string }
}

export interface MonthlyClosingPreview {
  period: string
  membership_revenue: { bs: number; usd_cash: number; usdt: number; count: number }
  class_revenue: { bs: number; usd_cash: number; usdt: number; count: number }
  total_revenue_usd: number
  members: { active: number; new: number; expired: number; frozen: number; total: number; retention: number }
  funds: { bs: number; usd_cash: number; usdt: number }
  rates: { bcv: number; usdt: number; custom: number }
}

export interface PendingPeriod {
  period: string
  label: string
  isOldest: boolean
}
```

- [ ] **Step 6: Verificar wod_logs en types**

Buscar en `types/database.ts` la sección `wod_logs:` — debe existir con `Row`, `Insert`, `Update`. Y `members.Row` debe incluir `show_wods`.

- [ ] **Step 7: Extender ActivityAction y EntityType**

Editar `lib/actions/activity.ts`. En la unión `ActivityAction`, agregar al final:
```ts
  | "wod_logged" | "wod_deleted"
```

En `EntityType`, agregar:
```ts
  | "wod_log"
```

- [ ] **Step 8: Verificar TypeScript**

Run: `npx tsc --noEmit --skipLibCheck`
Expected: salida vacía.

- [ ] **Step 9: Commit**

```bash
git add supabase/migrations/20260502150000_wod_logs_setup.sql types/database.ts lib/actions/activity.ts
git commit -m "feat(wod): migración wod_logs y toggle show_wods

Co-Authored-By: Claude Opus 4.7 <noreply@anthropic.com>"
```

---

### Task 2: Constantes y helpers de score

**Files:**
- Create: `lib/constants/wod-score.ts`

- [ ] **Step 1: Crear el archivo de constantes**

Crear `lib/constants/wod-score.ts`:

```ts
export type ScoreType = 'for_time' | 'amrap' | 'for_reps' | 'weight'

export interface WodScore {
  score_type: ScoreType
  score_seconds: number | null
  score_rounds: number | null
  score_reps: number | null
  score_kg: number | null
}

export const SCORE_TYPE_LABEL: Record<ScoreType, string> = {
  for_time: 'For Time',
  amrap: 'AMRAP',
  for_reps: 'For Reps',
  weight: 'Peso',
}

export const SCORE_TYPE_ORDER: ScoreType[] = ['for_time', 'amrap', 'for_reps', 'weight']

// Más es mejor para todos excepto for_time.
export function isLowerBetter(t: ScoreType): boolean {
  return t === 'for_time'
}

// Valor único comparable. Para AMRAP: rounds * 1000 + reps_extra (reps por round siempre < 1000 en CrossFit).
export function rankableValue(s: WodScore): number {
  switch (s.score_type) {
    case 'for_time': return s.score_seconds ?? 0
    case 'amrap':    return (s.score_rounds ?? 0) * 1000 + (s.score_reps ?? 0)
    case 'for_reps': return s.score_reps ?? 0
    case 'weight':   return Number(s.score_kg ?? 0)
  }
}

export function compareScores(a: WodScore, b: WodScore): number {
  if (a.score_type !== b.score_type) return 0
  const va = rankableValue(a)
  const vb = rankableValue(b)
  return isLowerBetter(a.score_type) ? va - vb : vb - va
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

// Mapeo de date (YYYY-MM-DD) → label de día en español, en zona América/Caracas.
const DAY_LABELS = ['Domingo','Lunes','Martes','Miércoles','Jueves','Viernes','Sábado']

export function getDayOfWeekLabel(dateISO: string): string {
  const d = new Date(dateISO + 'T12:00:00')
  // Forzar zona Venezuela vía Intl
  const fmt = new Intl.DateTimeFormat('en-US', { timeZone: 'America/Caracas', weekday: 'long' })
  const eng = fmt.format(d).toLowerCase()
  const map: Record<string, string> = {
    monday: 'Lunes', tuesday: 'Martes', wednesday: 'Miércoles',
    thursday: 'Jueves', friday: 'Viernes', saturday: 'Sábado', sunday: 'Domingo',
  }
  return map[eng] ?? DAY_LABELS[d.getDay()]
}

export function todayCaracasISO(): string {
  // YYYY-MM-DD en zona Venezuela
  const fmt = new Intl.DateTimeFormat('en-CA', { timeZone: 'America/Caracas', year: 'numeric', month: '2-digit', day: '2-digit' })
  return fmt.format(new Date())
}
```

- [ ] **Step 2: Verificar TypeScript**

Run: `npx tsc --noEmit --skipLibCheck`
Expected: sin errores.

- [ ] **Step 3: Commit**

```bash
git add lib/constants/wod-score.ts
git commit -m "feat(wod): constantes y helpers de score (rankable, format, día)

Co-Authored-By: Claude Opus 4.7 <noreply@anthropic.com>"
```

---

### Task 3: Server actions own logs (CRUD propio)

**Files:**
- Create: `lib/actions/wod-logs.ts` (parcial — own CRUD; cross-member en Task 4)

- [ ] **Step 1: Crear el archivo con las server actions iniciales**

Crear `lib/actions/wod-logs.ts`:

```ts
"use server"

import { createClient } from "@/utils/supabase/server"
import { revalidatePath } from "next/cache"
import {
  type ScoreType,
  todayCaracasISO,
  getDayOfWeekLabel,
} from "@/lib/constants/wod-score"
import { logActivity } from "./activity"

// ─── Helpers ─────────────────────────────────────────────

async function getMyMemberInfo(): Promise<{ id: string; plan_id: string | null }> {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) throw new Error("No autenticado")

  const { data, error } = await supabase
    .from("members")
    .select("id, plan_id")
    .eq("auth_user_id", user.id)
    .maybeSingle()

  if (error) throw error
  if (!data) throw new Error("Miembro no encontrado")
  return { id: data.id, plan_id: data.plan_id }
}

// ─── Tipos ───────────────────────────────────────────────

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
  routine: { id: string; name: string; content: string } | null
}

// ─── Validación ──────────────────────────────────────────

function validateScoreShape(input: UpsertWodLogInput): {
  score_seconds: number | null
  score_rounds: number | null
  score_reps: number | null
  score_kg: number | null
} {
  switch (input.score_type) {
    case "for_time": {
      const s = input.score_seconds
      if (typeof s !== "number" || s <= 0) throw new Error("Tiempo inválido")
      return { score_seconds: s, score_rounds: null, score_reps: null, score_kg: null }
    }
    case "amrap": {
      const r = input.score_rounds
      const reps = input.score_reps ?? 0
      if (typeof r !== "number" || r < 0) throw new Error("Rounds inválido")
      if (typeof reps !== "number" || reps < 0) throw new Error("Reps inválido")
      return { score_seconds: null, score_rounds: r, score_reps: reps, score_kg: null }
    }
    case "for_reps": {
      const reps = input.score_reps
      if (typeof reps !== "number" || reps <= 0) throw new Error("Reps inválido")
      return { score_seconds: null, score_rounds: null, score_reps: reps, score_kg: null }
    }
    case "weight": {
      const kg = input.score_kg
      if (typeof kg !== "number" || kg <= 0 || kg > 500) throw new Error("Peso fuera de rango")
      return { score_seconds: null, score_rounds: null, score_reps: null, score_kg: kg }
    }
  }
}

// ─── Plan routines (para que el modal sepa qué rutina atar a una fecha) ──

export async function getMyPlanRoutines(): Promise<PlanRoutineForDay[]> {
  const supabase = await createClient()
  const me = await getMyMemberInfo()

  if (!me.plan_id) return []

  const { data, error } = await supabase
    .from("routine_assignments")
    .select("day_of_week, routines(id, name, content)")
    .eq("plan_id", me.plan_id)

  if (error) throw error

  return (data ?? []).map((row: any) => ({
    day_of_week: row.day_of_week,
    routine: Array.isArray(row.routines) ? (row.routines[0] ?? null) : (row.routines ?? null),
  }))
}

// ─── Mis logs ────────────────────────────────────────────

export async function getTodayWodLog(): Promise<WodLog | null> {
  const supabase = await createClient()
  const me = await getMyMemberInfo()

  if (!me.plan_id) return null

  const today = todayCaracasISO()
  const todayLabel = getDayOfWeekLabel(today)

  // Encontrar la rutina del plan para hoy
  const { data: assignment, error: aErr } = await supabase
    .from("routine_assignments")
    .select("routine_id")
    .eq("plan_id", me.plan_id)
    .eq("day_of_week", todayLabel)
    .maybeSingle()

  if (aErr) throw aErr
  if (!assignment) return null

  const { data, error } = await supabase
    .from("wod_logs")
    .select("id, member_id, routine_id, date, score_type, score_seconds, score_rounds, score_reps, score_kg, rx, notes, created_at, routines(name)")
    .eq("member_id", me.id)
    .eq("routine_id", assignment.routine_id)
    .eq("date", today)
    .maybeSingle()

  if (error) throw error
  if (!data) return null

  const routineName = Array.isArray((data as any).routines)
    ? ((data as any).routines[0]?.name ?? "")
    : ((data as any).routines?.name ?? "")

  return {
    id: data.id,
    member_id: data.member_id,
    routine_id: data.routine_id,
    routine_name: routineName,
    date: data.date,
    score_type: data.score_type as ScoreType,
    score_seconds: data.score_seconds,
    score_rounds: data.score_rounds,
    score_reps: data.score_reps,
    score_kg: data.score_kg !== null ? Number(data.score_kg) : null,
    rx: data.rx,
    notes: data.notes,
    created_at: data.created_at,
  }
}

export async function getMyWodHistory(limit = 50, offset = 0): Promise<WodLog[]> {
  const supabase = await createClient()
  const me = await getMyMemberInfo()

  const { data, error } = await supabase
    .from("wod_logs")
    .select("id, member_id, routine_id, date, score_type, score_seconds, score_rounds, score_reps, score_kg, rx, notes, created_at, routines(name)")
    .eq("member_id", me.id)
    .order("date", { ascending: false })
    .order("created_at", { ascending: false })
    .range(offset, offset + limit - 1)

  if (error) throw error

  return (data ?? []).map((row: any) => ({
    id: row.id,
    member_id: row.member_id,
    routine_id: row.routine_id,
    routine_name: Array.isArray(row.routines) ? (row.routines[0]?.name ?? "") : (row.routines?.name ?? ""),
    date: row.date,
    score_type: row.score_type as ScoreType,
    score_seconds: row.score_seconds,
    score_rounds: row.score_rounds,
    score_reps: row.score_reps,
    score_kg: row.score_kg !== null ? Number(row.score_kg) : null,
    rx: row.rx,
    notes: row.notes,
    created_at: row.created_at,
  }))
}

export async function upsertWodLog(input: UpsertWodLogInput): Promise<WodLog> {
  if (input.notes && input.notes.length > 500) {
    throw new Error("Notas no pueden exceder 500 caracteres")
  }
  const today = todayCaracasISO()
  if (input.date > today) throw new Error("Fecha futura no permitida")

  const shape = validateScoreShape(input)

  const supabase = await createClient()
  const me = await getMyMemberInfo()

  const { data, error } = await supabase
    .from("wod_logs")
    .upsert(
      {
        member_id: me.id,
        routine_id: input.routine_id,
        date: input.date,
        score_type: input.score_type,
        score_seconds: shape.score_seconds,
        score_rounds: shape.score_rounds,
        score_reps: shape.score_reps,
        score_kg: shape.score_kg,
        rx: input.rx,
        notes: input.notes ?? null,
        updated_at: new Date().toISOString(),
      },
      { onConflict: "member_id,routine_id,date" },
    )
    .select("id, member_id, routine_id, date, score_type, score_seconds, score_rounds, score_reps, score_kg, rx, notes, created_at, routines(name)")
    .single()

  if (error) throw error

  const routineName = Array.isArray((data as any).routines)
    ? ((data as any).routines[0]?.name ?? "")
    : ((data as any).routines?.name ?? "")

  await logActivity({
    action: "wod_logged",
    entityType: "wod_log",
    entityId: data.id,
    entityName: `${routineName} · ${input.date}`,
  })

  revalidatePath("/portal")
  revalidatePath("/portal/wod")
  revalidatePath("/portal/descubrir")

  return {
    id: data.id,
    member_id: data.member_id,
    routine_id: data.routine_id,
    routine_name: routineName,
    date: data.date,
    score_type: data.score_type as ScoreType,
    score_seconds: data.score_seconds,
    score_rounds: data.score_rounds,
    score_reps: data.score_reps,
    score_kg: data.score_kg !== null ? Number(data.score_kg) : null,
    rx: data.rx,
    notes: data.notes,
    created_at: data.created_at,
  }
}

export async function deleteWodLog(id: string): Promise<void> {
  const supabase = await createClient()
  const me = await getMyMemberInfo()

  const { data: existing } = await supabase
    .from("wod_logs")
    .select("id, date, routines(name)")
    .eq("id", id)
    .eq("member_id", me.id)
    .maybeSingle()

  if (!existing) throw new Error("Log no encontrado")

  const { error } = await supabase
    .from("wod_logs")
    .delete()
    .eq("id", id)
    .eq("member_id", me.id)

  if (error) throw error

  const routineName = Array.isArray((existing as any).routines)
    ? ((existing as any).routines[0]?.name ?? "")
    : ((existing as any).routines?.name ?? "")

  await logActivity({
    action: "wod_deleted",
    entityType: "wod_log",
    entityId: id,
    entityName: `${routineName} · ${existing.date}`,
  })

  revalidatePath("/portal")
  revalidatePath("/portal/wod")
  revalidatePath("/portal/descubrir")
}
```

- [ ] **Step 2: Verificar TypeScript**

Run: `npx tsc --noEmit --skipLibCheck`
Expected: sin errores.

- [ ] **Step 3: Commit**

```bash
git add lib/actions/wod-logs.ts
git commit -m "feat(wod): server actions CRUD propio + plan routines

Co-Authored-By: Claude Opus 4.7 <noreply@anthropic.com>"
```

---

### Task 4: Server actions cross-member (leaderboard + recent)

**Files:**
- Modify: `lib/actions/wod-logs.ts`

- [ ] **Step 1: Agregar imports cross-member al tope del archivo**

Editar `lib/actions/wod-logs.ts`. Agregar después de los imports existentes:

```ts
import { createAdminClient } from "@/utils/supabase/admin"
import { rankableValue, isLowerBetter } from "@/lib/constants/wod-score"
```

- [ ] **Step 2: Agregar funciones cross-member al final del archivo**

Pegar al final de `lib/actions/wod-logs.ts`:

```ts
// ─── Cross-member ────────────────────────────────────────

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
  routine: { id: string; name: string; content: string } | null
  entries: WodLeaderboardEntry[]
}

async function ensureAuthenticatedAndGetMember(): Promise<{ id: string; plan_id: string | null }> {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) throw new Error("No autenticado")

  const { data, error } = await supabase
    .from("members")
    .select("id, plan_id")
    .eq("auth_user_id", user.id)
    .maybeSingle()

  if (error) throw error
  if (!data) throw new Error("Miembro no encontrado")
  return { id: data.id, plan_id: data.plan_id }
}

export async function getTodayLeaderboard(): Promise<WodLeaderboardResult> {
  const me = await ensureAuthenticatedAndGetMember()
  if (!me.plan_id) return { routine: null, entries: [] }

  const today = todayCaracasISO()
  const todayLabel = getDayOfWeekLabel(today)

  const admin = createAdminClient()

  // 1. Encontrar la rutina del plan del caller para hoy
  const { data: assignment, error: aErr } = await admin
    .from("routine_assignments")
    .select("routine_id, routines(id, name, content)")
    .eq("plan_id", me.plan_id)
    .eq("day_of_week", todayLabel)
    .maybeSingle()

  if (aErr) throw aErr
  if (!assignment) return { routine: null, entries: [] }

  const routine = Array.isArray((assignment as any).routines)
    ? ((assignment as any).routines[0] ?? null)
    : ((assignment as any).routines ?? null)
  if (!routine) return { routine: null, entries: [] }

  // 2. Logs de hoy contra esa rutina (cross-member)
  const { data: logs, error: lErr } = await admin
    .from("wod_logs")
    .select("member_id, score_type, score_seconds, score_rounds, score_reps, score_kg, rx, created_at")
    .eq("routine_id", assignment.routine_id)
    .eq("date", today)

  if (lErr) throw lErr
  if (!logs || logs.length === 0) return { routine, entries: [] }

  const memberIds = Array.from(new Set(logs.map((l) => l.member_id)))

  // 3. Filtrar miembros con discoverable=true && show_wods=true (admin client lee solo cols safe)
  const { data: members, error: mErr } = await admin
    .from("members")
    .select("id, name, avatar_url, discoverable, show_wods, show_avatar")
    .in("id", memberIds)
    .eq("discoverable", true)
    .eq("show_wods", true)

  if (mErr) throw mErr
  if (!members || members.length === 0) return { routine, entries: [] }

  const visibleIds = new Set(members.map((m) => m.id))
  const memberById = new Map(members.map((m) => [m.id, m]))

  // 4. Computar y ordenar
  const enriched = logs
    .filter((l) => visibleIds.has(l.member_id))
    .map((l) => {
      const m = memberById.get(l.member_id)!
      const score = {
        score_type: l.score_type as ScoreType,
        score_seconds: l.score_seconds,
        score_rounds: l.score_rounds,
        score_reps: l.score_reps,
        score_kg: l.score_kg !== null ? Number(l.score_kg) : null,
      }
      return {
        member_id: l.member_id,
        name: m.name,
        avatar_url: m.show_avatar ? m.avatar_url : null,
        score_type: score.score_type,
        score_seconds: score.score_seconds,
        score_rounds: score.score_rounds,
        score_reps: score.score_reps,
        score_kg: score.score_kg,
        rx: l.rx,
        rankable: rankableValue(score),
        created_at: l.created_at as string,
      }
    })

  enriched.sort((a, b) => {
    const lower = isLowerBetter(a.score_type)
    const cmp = lower ? a.rankable - b.rankable : b.rankable - a.rankable
    if (cmp !== 0) return cmp
    // Tiebreaker: created_at ASC (logeó primero gana)
    return a.created_at.localeCompare(b.created_at)
  })

  const top = enriched.slice(0, 10).map((e, i) => ({
    member_id: e.member_id,
    name: e.name,
    avatar_url: e.avatar_url,
    score_type: e.score_type,
    score_seconds: e.score_seconds,
    score_rounds: e.score_rounds,
    score_reps: e.score_reps,
    score_kg: e.score_kg,
    rx: e.rx,
    rankable: e.rankable,
    position: i + 1,
  }))

  return { routine, entries: top }
}

export async function getMemberRecentWods(memberId: string, limit = 5): Promise<WodLog[]> {
  await ensureAuthenticatedAndGetMember()
  const admin = createAdminClient()

  // Verificar que el miembro consultado es discoverable y tiene show_wods=true
  const { data: target, error: mErr } = await admin
    .from("members")
    .select("id, discoverable, show_wods")
    .eq("id", memberId)
    .maybeSingle()

  if (mErr) throw mErr
  if (!target || !target.discoverable || !target.show_wods) return []

  const { data, error } = await admin
    .from("wod_logs")
    .select("id, member_id, routine_id, date, score_type, score_seconds, score_rounds, score_reps, score_kg, rx, notes, created_at, routines(name)")
    .eq("member_id", memberId)
    .order("date", { ascending: false })
    .order("created_at", { ascending: false })
    .limit(limit)

  if (error) throw error

  return (data ?? []).map((row: any) => ({
    id: row.id,
    member_id: row.member_id,
    routine_id: row.routine_id,
    routine_name: Array.isArray(row.routines) ? (row.routines[0]?.name ?? "") : (row.routines?.name ?? ""),
    date: row.date,
    score_type: row.score_type as ScoreType,
    score_seconds: row.score_seconds,
    score_rounds: row.score_rounds,
    score_reps: row.score_reps,
    score_kg: row.score_kg !== null ? Number(row.score_kg) : null,
    rx: row.rx,
    notes: row.notes,
    created_at: row.created_at,
  }))
}
```

- [ ] **Step 3: Verificar TypeScript**

Run: `npx tsc --noEmit --skipLibCheck`
Expected: sin errores.

- [ ] **Step 4: Commit**

```bash
git add lib/actions/wod-logs.ts
git commit -m "feat(wod): leaderboard del día y recentWods cross-member

Co-Authored-By: Claude Opus 4.7 <noreply@anthropic.com>"
```

---

### Task 5: WodScoreInputs (input reutilizable por tipo)

**Files:**
- Create: `components/section-components/portal/wod/WodScoreInputs.tsx`

- [ ] **Step 1: Crear el componente de inputs**

Crear `components/section-components/portal/wod/WodScoreInputs.tsx`:

```tsx
"use client"

import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import type { ScoreType } from "@/lib/constants/wod-score"

export interface WodScoreInputValues {
  score_type: ScoreType
  minutes: number
  seconds: number
  rounds: number
  reps_extra: number
  reps: number
  kg: number
}

interface WodScoreInputsProps {
  values: WodScoreInputValues
  onChange: (next: WodScoreInputValues) => void
  errors?: Partial<Record<keyof WodScoreInputValues, string>>
}

function num(v: string): number {
  const n = Number(v)
  return Number.isFinite(n) && n >= 0 ? n : 0
}

export function WodScoreInputs({ values, onChange, errors }: WodScoreInputsProps) {
  const set = <K extends keyof WodScoreInputValues>(k: K, v: WodScoreInputValues[K]) =>
    onChange({ ...values, [k]: v })

  switch (values.score_type) {
    case "for_time":
      return (
        <div className="grid grid-cols-2 gap-3">
          <div className="space-y-1.5">
            <Label htmlFor="minutes" className="text-sm">Minutos</Label>
            <Input
              id="minutes"
              type="number"
              min={0}
              max={120}
              value={values.minutes}
              onChange={(e) => set("minutes", num(e.target.value))}
            />
            {errors?.minutes && <p className="text-xs text-destructive">{errors.minutes}</p>}
          </div>
          <div className="space-y-1.5">
            <Label htmlFor="seconds" className="text-sm">Segundos</Label>
            <Input
              id="seconds"
              type="number"
              min={0}
              max={59}
              value={values.seconds}
              onChange={(e) => set("seconds", num(e.target.value))}
            />
            {errors?.seconds && <p className="text-xs text-destructive">{errors.seconds}</p>}
          </div>
        </div>
      )
    case "amrap":
      return (
        <div className="grid grid-cols-2 gap-3">
          <div className="space-y-1.5">
            <Label htmlFor="rounds" className="text-sm">Rounds completos</Label>
            <Input
              id="rounds"
              type="number"
              min={0}
              max={999}
              value={values.rounds}
              onChange={(e) => set("rounds", num(e.target.value))}
            />
            {errors?.rounds && <p className="text-xs text-destructive">{errors.rounds}</p>}
          </div>
          <div className="space-y-1.5">
            <Label htmlFor="reps_extra" className="text-sm">Reps extra</Label>
            <Input
              id="reps_extra"
              type="number"
              min={0}
              max={999}
              value={values.reps_extra}
              onChange={(e) => set("reps_extra", num(e.target.value))}
            />
            {errors?.reps_extra && <p className="text-xs text-destructive">{errors.reps_extra}</p>}
          </div>
        </div>
      )
    case "for_reps":
      return (
        <div className="space-y-1.5">
          <Label htmlFor="reps" className="text-sm">Total reps</Label>
          <Input
            id="reps"
            type="number"
            min={1}
            max={99999}
            value={values.reps}
            onChange={(e) => set("reps", num(e.target.value))}
            placeholder="Ej: 150"
          />
          {errors?.reps && <p className="text-xs text-destructive">{errors.reps}</p>}
        </div>
      )
    case "weight":
      return (
        <div className="space-y-1.5">
          <Label htmlFor="kg" className="text-sm">Peso (kg)</Label>
          <Input
            id="kg"
            type="number"
            step="0.5"
            min={0.5}
            max={500}
            value={values.kg}
            onChange={(e) => set("kg", num(e.target.value))}
            placeholder="Ej: 100"
          />
          {errors?.kg && <p className="text-xs text-destructive">{errors.kg}</p>}
        </div>
      )
  }
}
```

- [ ] **Step 2: Verificar TypeScript**

Run: `npx tsc --noEmit --skipLibCheck`
Expected: sin errores.

- [ ] **Step 3: Commit**

```bash
git add components/section-components/portal/wod/WodScoreInputs.tsx
git commit -m "feat(wod): inputs reutilizables por tipo de score

Co-Authored-By: Claude Opus 4.7 <noreply@anthropic.com>"
```

---

### Task 6: LogWodModal

**Files:**
- Create: `components/section-components/portal/wod/log-wod-modal.tsx`

- [ ] **Step 1: Crear el modal de logging**

Crear `components/section-components/portal/wod/log-wod-modal.tsx`:

```tsx
"use client"

import { useEffect, useMemo, useState } from "react"
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query"
import { toast } from "sonner"
import { Loader2, Save, Trash2 } from "lucide-react"
import {
  Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle,
} from "@/components/ui/dialog"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { Switch } from "@/components/ui/switch"
import { Textarea } from "@/components/ui/textarea"
import { cn } from "@/lib/utils"
import {
  upsertWodLog, deleteWodLog, getMyPlanRoutines,
  type WodLog,
} from "@/lib/actions/wod-logs"
import {
  type ScoreType, SCORE_TYPE_LABEL, SCORE_TYPE_ORDER,
  todayCaracasISO, getDayOfWeekLabel,
} from "@/lib/constants/wod-score"
import { WodScoreInputs, type WodScoreInputValues } from "./WodScoreInputs"

interface LogWodModalProps {
  open: boolean
  onOpenChange: (open: boolean) => void
  // Si se pasa, modo edición
  existingLog?: WodLog | null
  // Para "Registrar WOD" desde TodayRoutineCard, ya conocemos hoy/rutina; preseed
  defaultDate?: string
  defaultRoutineId?: string
}

const EMPTY_VALUES: WodScoreInputValues = {
  score_type: "for_time",
  minutes: 0, seconds: 0,
  rounds: 0, reps_extra: 0,
  reps: 0, kg: 0,
}

export function LogWodModal({ open, onOpenChange, existingLog, defaultDate, defaultRoutineId }: LogWodModalProps) {
  const queryClient = useQueryClient()
  const today = todayCaracasISO()

  const [date, setDate] = useState<string>(defaultDate ?? today)
  const [values, setValues] = useState<WodScoreInputValues>(EMPTY_VALUES)
  const [rx, setRx] = useState<boolean>(false)
  const [notes, setNotes] = useState<string>("")
  const [errors, setErrors] = useState<Partial<Record<keyof WodScoreInputValues, string>>>({})

  // Cargar rutinas del plan para mapear date -> routine_id
  const { data: planRoutines = [] } = useQuery({
    queryKey: ["my-plan-routines"],
    queryFn: getMyPlanRoutines,
    staleTime: 5 * 60 * 1000,
  })

  const dayLabel = getDayOfWeekLabel(date)
  const routineForDay = useMemo(
    () => planRoutines.find((p) => p.day_of_week === dayLabel)?.routine ?? null,
    [planRoutines, dayLabel],
  )

  // Reset al abrir
  useEffect(() => {
    if (!open) return
    if (existingLog) {
      setDate(existingLog.date)
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
      setDate(defaultDate ?? today)
      setRx(false)
      setNotes("")
      setValues(EMPTY_VALUES)
    }
    setErrors({})
  }, [open, existingLog, defaultDate, today])

  const targetRoutineId = existingLog?.routine_id ?? defaultRoutineId ?? routineForDay?.id ?? null

  const upsertMutation = useMutation({
    mutationFn: async () => {
      if (!targetRoutineId) throw new Error("No hay rutina asignada para esa fecha")

      const errs: Partial<Record<keyof WodScoreInputValues, string>> = {}
      let payload: Parameters<typeof upsertWodLog>[0]
      switch (values.score_type) {
        case "for_time": {
          const total = values.minutes * 60 + values.seconds
          if (total <= 0) errs.seconds = "Ingresa un tiempo válido"
          payload = {
            routine_id: targetRoutineId,
            date,
            score_type: "for_time",
            score_seconds: total,
            rx, notes: notes || null,
          }
          break
        }
        case "amrap": {
          if (values.rounds < 0) errs.rounds = "Inválido"
          if (values.reps_extra < 0) errs.reps_extra = "Inválido"
          payload = {
            routine_id: targetRoutineId,
            date,
            score_type: "amrap",
            score_rounds: values.rounds,
            score_reps: values.reps_extra,
            rx, notes: notes || null,
          }
          break
        }
        case "for_reps": {
          if (values.reps <= 0) errs.reps = "Debe ser > 0"
          payload = {
            routine_id: targetRoutineId,
            date,
            score_type: "for_reps",
            score_reps: values.reps,
            rx, notes: notes || null,
          }
          break
        }
        case "weight": {
          if (values.kg <= 0 || values.kg > 500) errs.kg = "Fuera de rango (0–500 kg)"
          payload = {
            routine_id: targetRoutineId,
            date,
            score_type: "weight",
            score_kg: values.kg,
            rx, notes: notes || null,
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
      queryClient.invalidateQueries({ queryKey: ["today-wod-log"] })
      queryClient.invalidateQueries({ queryKey: ["my-wod-history"] })
      queryClient.invalidateQueries({ queryKey: ["today-leaderboard"] })
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
      queryClient.invalidateQueries({ queryKey: ["today-wod-log"] })
      queryClient.invalidateQueries({ queryKey: ["my-wod-history"] })
      queryClient.invalidateQueries({ queryKey: ["today-leaderboard"] })
      onOpenChange(false)
    },
    onError: (err) => {
      toast.error(err instanceof Error ? err.message : "Error al borrar")
    },
  })

  const setScoreType = (t: ScoreType) => setValues({ ...values, score_type: t })

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-md max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle>{existingLog ? "Editar WOD" : "Registrar WOD"}</DialogTitle>
          <DialogDescription>
            {routineForDay
              ? <>Rutina: <span className="font-semibold">{routineForDay.name}</span></>
              : <span className="text-destructive">Sin rutina asignada para {dayLabel}</span>}
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-4">
          <div className="space-y-1.5">
            <Label htmlFor="date" className="text-sm">Fecha</Label>
            <Input
              id="date"
              type="date"
              max={today}
              value={date}
              onChange={(e) => setDate(e.target.value)}
              className="scheme-dark"
            />
          </div>

          <div className="space-y-1.5">
            <Label className="text-sm">Tipo de score</Label>
            <div className="grid grid-cols-4 gap-1 rounded-md border border-border p-1">
              {SCORE_TYPE_ORDER.map((t) => (
                <button
                  key={t}
                  type="button"
                  onClick={() => setScoreType(t)}
                  className={cn(
                    "px-2 py-1.5 text-xs font-medium rounded transition-colors",
                    values.score_type === t
                      ? "bg-primary text-primary-foreground"
                      : "text-muted-foreground hover:text-foreground hover:bg-muted/50",
                  )}
                >
                  {SCORE_TYPE_LABEL[t]}
                </button>
              ))}
            </div>
          </div>

          <WodScoreInputs values={values} onChange={setValues} errors={errors} />

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
            disabled={upsertMutation.isPending || deleteMutation.isPending || !targetRoutineId}
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

> **Nota al ejecutor:** Si `@/components/ui/textarea` no existe en el proyecto, agregar el componente shadcn estándar. Verifica antes con `Glob` `components/ui/textarea*`.

- [ ] **Step 2: Verificar TypeScript**

Run: `npx tsc --noEmit --skipLibCheck`
Expected: sin errores.

- [ ] **Step 3: Commit**

```bash
git add components/section-components/portal/wod/log-wod-modal.tsx
git commit -m "feat(wod): modal LogWodModal con date picker y rutina dinámica

Co-Authored-By: Claude Opus 4.7 <noreply@anthropic.com>"
```

---

### Task 7: TodayWodHeader (rutina del día + botón log/edit)

**Files:**
- Create: `components/section-components/portal/wod/TodayWodHeader.tsx`

- [ ] **Step 1: Crear el componente**

Crear `components/section-components/portal/wod/TodayWodHeader.tsx`:

```tsx
"use client"

import { useState } from "react"
import { useQuery } from "@tanstack/react-query"
import ReactMarkdown from "react-markdown"
import { Flame, Pencil, Plus, Loader2 } from "lucide-react"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { Button } from "@/components/ui/button"
import { Badge } from "@/components/ui/badge"
import { getTodayRoutineForMember } from "@/lib/actions/routines"
import { getTodayWodLog } from "@/lib/actions/wod-logs"
import { formatScore } from "@/lib/constants/wod-score"
import { LogWodModal } from "./log-wod-modal"

export function TodayWodHeader() {
  const [modalOpen, setModalOpen] = useState(false)

  const { data: routineToday, isLoading: lr } = useQuery({
    queryKey: ["portal-today-routine"],
    queryFn: getTodayRoutineForMember,
    staleTime: 5 * 60 * 1000,
  })

  const { data: log = null, isLoading: ll } = useQuery({
    queryKey: ["today-wod-log"],
    queryFn: getTodayWodLog,
    staleTime: 60 * 1000,
  })

  if (lr || ll) {
    return (
      <Card>
        <CardContent className="py-8 flex items-center justify-center">
          <Loader2 className="h-5 w-5 animate-spin text-muted-foreground" />
        </CardContent>
      </Card>
    )
  }

  if (!routineToday) {
    return (
      <Card>
        <CardContent className="py-6 text-center text-sm text-muted-foreground">
          No tienes un plan asignado.
        </CardContent>
      </Card>
    )
  }

  return (
    <>
      <Card>
        <CardHeader>
          <div className="flex items-center gap-3">
            <Flame className="h-5 w-5 text-primary" />
            <div className="min-w-0">
              <CardTitle className="text-base">
                {routineToday.routine ? routineToday.routine.name : "Sin rutina asignada hoy"}
              </CardTitle>
              <p className="text-xs text-muted-foreground mt-0.5 truncate">
                {routineToday.day_of_week}{routineToday.plan_name ? ` · ${routineToday.plan_name}` : ""}
              </p>
            </div>
          </div>
        </CardHeader>
        <CardContent className="space-y-4">
          {routineToday.routine ? (
            <div className="prose prose-invert prose-sm max-w-none">
              <ReactMarkdown>{routineToday.routine.content || "_Sin contenido._"}</ReactMarkdown>
            </div>
          ) : (
            <p className="text-sm text-muted-foreground">
              Tu coach aún no asignó la rutina de hoy.
            </p>
          )}

          {routineToday.routine && (
            <div className="border-t pt-4">
              {log ? (
                <div className="flex items-center justify-between gap-3 rounded-md bg-primary/5 p-3">
                  <div className="min-w-0">
                    <p className="text-xs text-muted-foreground uppercase tracking-wide">Tu score</p>
                    <p className="font-bold text-lg tabular-nums">
                      {formatScore({
                        score_type: log.score_type,
                        score_seconds: log.score_seconds,
                        score_rounds: log.score_rounds,
                        score_reps: log.score_reps,
                        score_kg: log.score_kg,
                      })}
                    </p>
                  </div>
                  <Badge variant={log.rx ? "default" : "outline"} className="shrink-0">
                    {log.rx ? "RX" : "Scaled"}
                  </Badge>
                  <Button size="sm" variant="outline" onClick={() => setModalOpen(true)} className="gap-2 shrink-0">
                    <Pencil className="h-3.5 w-3.5" />
                    Editar
                  </Button>
                </div>
              ) : (
                <Button size="sm" onClick={() => setModalOpen(true)} className="w-full gap-2">
                  <Plus className="h-4 w-4" />
                  Registrar mi WOD
                </Button>
              )}
            </div>
          )}
        </CardContent>
      </Card>

      <LogWodModal
        open={modalOpen}
        onOpenChange={setModalOpen}
        existingLog={log}
        defaultRoutineId={routineToday.routine?.id}
      />
    </>
  )
}
```

- [ ] **Step 2: Verificar TypeScript**

Run: `npx tsc --noEmit --skipLibCheck`
Expected: sin errores.

- [ ] **Step 3: Commit**

```bash
git add components/section-components/portal/wod/TodayWodHeader.tsx
git commit -m "feat(wod): TodayWodHeader con rutina + score actual o botón log

Co-Authored-By: Claude Opus 4.7 <noreply@anthropic.com>"
```

---

### Task 8: WodLeaderboard

**Files:**
- Create: `components/section-components/portal/wod/WodLeaderboard.tsx`

- [ ] **Step 1: Crear el componente**

Crear `components/section-components/portal/wod/WodLeaderboard.tsx`:

```tsx
"use client"

import { useQuery } from "@tanstack/react-query"
import { Trophy, Loader2 } from "lucide-react"
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar"
import { Badge } from "@/components/ui/badge"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { cn } from "@/lib/utils"
import { getTodayLeaderboard } from "@/lib/actions/wod-logs"
import { formatScore } from "@/lib/constants/wod-score"

const POSITION_BG = ["bg-yellow-400/10", "bg-slate-300/10", "bg-amber-700/10"]

export function WodLeaderboard() {
  const { data, isLoading } = useQuery({
    queryKey: ["today-leaderboard"],
    queryFn: getTodayLeaderboard,
    staleTime: 60 * 1000,
  })

  if (isLoading) {
    return (
      <Card>
        <CardContent className="py-6 flex items-center justify-center">
          <Loader2 className="h-5 w-5 animate-spin text-muted-foreground" />
        </CardContent>
      </Card>
    )
  }

  if (!data || !data.routine) return null

  return (
    <Card>
      <CardHeader className="pb-3">
        <div className="flex items-center gap-2">
          <Trophy className="h-4 w-4 text-primary" />
          <CardTitle className="text-sm font-semibold uppercase tracking-wide">
            Leaderboard de hoy
          </CardTitle>
        </div>
      </CardHeader>
      <CardContent>
        {data.entries.length === 0 ? (
          <p className="text-sm text-muted-foreground text-center py-4">
            Aún nadie ha registrado el WOD de hoy. ¡Sé el primero!
          </p>
        ) : (
          <ul className="space-y-1.5">
            {data.entries.map((e) => {
              const initials = e.name.split(" ").map((n) => n[0]).join("").slice(0, 2).toUpperCase()
              const podium = e.position <= 3
              return (
                <li
                  key={e.member_id}
                  className={cn(
                    "flex items-center gap-3 px-2 py-1.5 rounded-md",
                    podium && POSITION_BG[e.position - 1],
                  )}
                >
                  <span className={cn(
                    "shrink-0 w-7 text-center text-xs font-bold tabular-nums",
                    podium ? "text-foreground" : "text-muted-foreground",
                  )}>
                    {e.position}°
                  </span>
                  <Avatar className="h-8 w-8 shrink-0">
                    <AvatarImage src={e.avatar_url ?? undefined} />
                    <AvatarFallback className="bg-muted text-foreground text-[10px] font-bold">
                      {initials}
                    </AvatarFallback>
                  </Avatar>
                  <span className="text-sm flex-1 min-w-0 truncate">{e.name}</span>
                  <span className="text-sm font-bold tabular-nums shrink-0">
                    {formatScore({
                      score_type: e.score_type,
                      score_seconds: e.score_seconds,
                      score_rounds: e.score_rounds,
                      score_reps: e.score_reps,
                      score_kg: e.score_kg,
                    })}
                  </span>
                  <Badge variant={e.rx ? "default" : "outline"} className="text-[10px] shrink-0">
                    {e.rx ? "RX" : "S"}
                  </Badge>
                </li>
              )
            })}
          </ul>
        )}
      </CardContent>
    </Card>
  )
}
```

- [ ] **Step 2: Verificar TypeScript**

Run: `npx tsc --noEmit --skipLibCheck`
Expected: sin errores.

- [ ] **Step 3: Commit**

```bash
git add components/section-components/portal/wod/WodLeaderboard.tsx
git commit -m "feat(wod): leaderboard del día (Top 10) con podio destacado

Co-Authored-By: Claude Opus 4.7 <noreply@anthropic.com>"
```

---

### Task 9: WodLogRow + WodHistoryList

**Files:**
- Create: `components/section-components/portal/wod/WodLogRow.tsx`
- Create: `components/section-components/portal/wod/WodHistoryList.tsx`

- [ ] **Step 1: Crear WodLogRow**

Crear `components/section-components/portal/wod/WodLogRow.tsx`:

```tsx
"use client"

import { format } from "date-fns"
import { es } from "date-fns/locale"
import { StickyNote } from "lucide-react"
import { Badge } from "@/components/ui/badge"
import { formatScore } from "@/lib/constants/wod-score"
import type { WodLog } from "@/lib/actions/wod-logs"

interface WodLogRowProps {
  log: WodLog
  onClick: () => void
}

export function WodLogRow({ log, onClick }: WodLogRowProps) {
  const dateObj = new Date(log.date + "T00:00:00")
  return (
    <button
      type="button"
      onClick={onClick}
      className="w-full flex items-center gap-3 py-2.5 px-3 -mx-3 rounded hover:bg-muted/30 transition-colors text-left"
    >
      <div className="shrink-0 text-center w-10">
        <p className="text-xs text-muted-foreground uppercase tracking-wide">
          {format(dateObj, "MMM", { locale: es })}
        </p>
        <p className="text-base font-bold tabular-nums">
          {format(dateObj, "d", { locale: es })}
        </p>
      </div>
      <div className="min-w-0 flex-1">
        <p className="text-sm font-medium truncate">{log.routine_name || "(rutina)"}</p>
        <p className="text-xs text-muted-foreground">
          {format(dateObj, "EEEE", { locale: es })}
        </p>
      </div>
      <div className="flex items-center gap-2 shrink-0">
        {log.notes && <StickyNote className="h-3.5 w-3.5 text-muted-foreground" />}
        <span className="text-sm font-bold tabular-nums">
          {formatScore({
            score_type: log.score_type,
            score_seconds: log.score_seconds,
            score_rounds: log.score_rounds,
            score_reps: log.score_reps,
            score_kg: log.score_kg,
          })}
        </span>
        <Badge variant={log.rx ? "default" : "outline"} className="text-[10px]">
          {log.rx ? "RX" : "S"}
        </Badge>
      </div>
    </button>
  )
}
```

- [ ] **Step 2: Crear WodHistoryList**

Crear `components/section-components/portal/wod/WodHistoryList.tsx`:

```tsx
"use client"

import { useMemo, useState } from "react"
import { useQuery } from "@tanstack/react-query"
import { format } from "date-fns"
import { es } from "date-fns/locale"
import { Loader2, Calendar } from "lucide-react"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { getMyWodHistory, type WodLog } from "@/lib/actions/wod-logs"
import { WodLogRow } from "./WodLogRow"
import { LogWodModal } from "./log-wod-modal"

export function WodHistoryList() {
  const [editing, setEditing] = useState<WodLog | null>(null)

  const { data: logs = [], isLoading } = useQuery({
    queryKey: ["my-wod-history"],
    queryFn: () => getMyWodHistory(50, 0),
    staleTime: 60 * 1000,
  })

  // Agrupar por mes
  const grouped = useMemo(() => {
    const map = new Map<string, WodLog[]>()
    for (const l of logs) {
      const key = l.date.slice(0, 7) // YYYY-MM
      const arr = map.get(key) ?? []
      arr.push(l)
      map.set(key, arr)
    }
    return Array.from(map.entries()).sort(([a], [b]) => b.localeCompare(a))
  }, [logs])

  return (
    <>
      <Card>
        <CardHeader className="pb-3">
          <div className="flex items-center gap-2">
            <Calendar className="h-4 w-4 text-primary" />
            <CardTitle className="text-sm font-semibold uppercase tracking-wide">
              Mi historial
            </CardTitle>
          </div>
        </CardHeader>
        <CardContent>
          {isLoading ? (
            <div className="py-6 flex justify-center">
              <Loader2 className="h-5 w-5 animate-spin text-muted-foreground" />
            </div>
          ) : logs.length === 0 ? (
            <p className="text-sm text-muted-foreground text-center py-6">
              Aún no has registrado ningún WOD.
            </p>
          ) : (
            <div className="space-y-4">
              {grouped.map(([month, items]) => {
                const label = format(new Date(month + "-01T00:00:00"), "MMMM yyyy", { locale: es })
                return (
                  <div key={month}>
                    <p className="text-[11px] font-semibold uppercase text-muted-foreground tracking-wide mb-1.5">
                      {label}
                    </p>
                    <ul className="divide-y divide-border">
                      {items.map((l) => (
                        <li key={l.id}>
                          <WodLogRow log={l} onClick={() => setEditing(l)} />
                        </li>
                      ))}
                    </ul>
                  </div>
                )
              })}
            </div>
          )}
        </CardContent>
      </Card>

      <LogWodModal
        open={editing !== null}
        onOpenChange={(o) => !o && setEditing(null)}
        existingLog={editing}
      />
    </>
  )
}
```

- [ ] **Step 3: Verificar TypeScript**

Run: `npx tsc --noEmit --skipLibCheck`
Expected: sin errores.

- [ ] **Step 4: Commit**

```bash
git add components/section-components/portal/wod/WodLogRow.tsx components/section-components/portal/wod/WodHistoryList.tsx
git commit -m "feat(wod): historial agrupado por mes con click para editar

Co-Authored-By: Claude Opus 4.7 <noreply@anthropic.com>"
```

---

### Task 10: PortalWodMainComponent + página

**Files:**
- Create: `app/portal/wod/page.tsx`
- Create: `components/section-components/portal/wod/PortalWodMainComponent.tsx`

- [ ] **Step 1: Crear el page**

Crear `app/portal/wod/page.tsx`:

```tsx
import PortalWodMainComponent from "@/components/section-components/portal/wod/PortalWodMainComponent"

export default function Page() {
  return <PortalWodMainComponent />
}
```

- [ ] **Step 2: Crear el main component**

Crear `components/section-components/portal/wod/PortalWodMainComponent.tsx`:

```tsx
"use client"

import { TodayWodHeader } from "./TodayWodHeader"
import { WodLeaderboard } from "./WodLeaderboard"
import { WodHistoryList } from "./WodHistoryList"

export default function PortalWodMainComponent() {
  return (
    <div className="space-y-5 sm:space-y-6">
      <div>
        <h1 className="text-xl sm:text-2xl font-bold">WOD</h1>
        <p className="text-muted-foreground text-xs sm:text-sm mt-0.5">
          Registra tu resultado y mira el leaderboard del día
        </p>
      </div>

      <TodayWodHeader />
      <WodLeaderboard />
      <WodHistoryList />
    </div>
  )
}
```

- [ ] **Step 3: Verificar TypeScript**

Run: `npx tsc --noEmit --skipLibCheck`
Expected: sin errores.

- [ ] **Step 4: Commit**

```bash
git add app/portal/wod/page.tsx components/section-components/portal/wod/PortalWodMainComponent.tsx
git commit -m "feat(wod): página /portal/wod con header, leaderboard e historial

Co-Authored-By: Claude Opus 4.7 <noreply@anthropic.com>"
```

---

### Task 11: Agregar botón "Registrar WOD" en TodayRoutineCard del home

**Files:**
- Modify: `components/section-components/portal/home/TodayRoutineCard.tsx`

- [ ] **Step 1: Reemplazar el contenido del archivo**

Reemplazar TODO el contenido de `components/section-components/portal/home/TodayRoutineCard.tsx` por:

```tsx
"use client"

import { useState } from "react"
import { useQuery } from "@tanstack/react-query"
import ReactMarkdown from "react-markdown"
import { CalendarDays, Loader2, Pencil, Plus } from "lucide-react"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { Button } from "@/components/ui/button"
import { Badge } from "@/components/ui/badge"
import { getTodayRoutineForMember } from "@/lib/actions/routines"
import { getTodayWodLog } from "@/lib/actions/wod-logs"
import { formatScore } from "@/lib/constants/wod-score"
import { LogWodModal } from "../wod/log-wod-modal"

export function TodayRoutineCard() {
  const [modalOpen, setModalOpen] = useState(false)

  const { data, isLoading } = useQuery({
    queryKey: ["portal-today-routine"],
    queryFn: getTodayRoutineForMember,
    staleTime: 5 * 60 * 1000,
  })

  const { data: log = null } = useQuery({
    queryKey: ["today-wod-log"],
    queryFn: getTodayWodLog,
    staleTime: 60 * 1000,
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

  if (!data) return null

  return (
    <>
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
        <CardContent className="space-y-4">
          {data.routine ? (
            <div className="prose prose-invert prose-sm max-w-none">
              <ReactMarkdown>{data.routine.content || "_Sin contenido._"}</ReactMarkdown>
            </div>
          ) : (
            <p className="text-sm text-muted-foreground">
              Tu coach aún no asignó la rutina de hoy.
            </p>
          )}

          {data.routine && (
            <div className="border-t pt-4">
              {log ? (
                <div className="flex items-center justify-between gap-3 rounded-md bg-primary/5 p-3">
                  <div className="min-w-0">
                    <p className="text-[10px] text-muted-foreground uppercase tracking-wide">Tu score</p>
                    <p className="font-bold text-base tabular-nums">
                      {formatScore({
                        score_type: log.score_type,
                        score_seconds: log.score_seconds,
                        score_rounds: log.score_rounds,
                        score_reps: log.score_reps,
                        score_kg: log.score_kg,
                      })}
                    </p>
                  </div>
                  <Badge variant={log.rx ? "default" : "outline"} className="shrink-0">
                    {log.rx ? "RX" : "Scaled"}
                  </Badge>
                  <Button size="sm" variant="outline" onClick={() => setModalOpen(true)} className="gap-2 shrink-0">
                    <Pencil className="h-3.5 w-3.5" />
                    Editar
                  </Button>
                </div>
              ) : (
                <Button size="sm" onClick={() => setModalOpen(true)} className="w-full gap-2">
                  <Plus className="h-4 w-4" />
                  Registrar mi WOD
                </Button>
              )}
            </div>
          )}
        </CardContent>
      </Card>

      <LogWodModal
        open={modalOpen}
        onOpenChange={setModalOpen}
        existingLog={log}
        defaultRoutineId={data.routine?.id}
      />
    </>
  )
}
```

- [ ] **Step 2: Verificar TypeScript**

Run: `npx tsc --noEmit --skipLibCheck`
Expected: sin errores.

- [ ] **Step 3: Commit**

```bash
git add components/section-components/portal/home/TodayRoutineCard.tsx
git commit -m "feat(wod): integrar botón Registrar WOD en TodayRoutineCard del home

Co-Authored-By: Claude Opus 4.7 <noreply@anthropic.com>"
```

---

### Task 12: Sección "WODs recientes" en MemberDetailModal

**Files:**
- Modify: `components/section-components/portal/descubrir/MemberDetailModal.tsx`

- [ ] **Step 1: Leer el archivo actual**

Leer `components/section-components/portal/descubrir/MemberDetailModal.tsx`. Vamos a agregar imports y una sección debajo del bloque de RMs.

- [ ] **Step 2: Agregar imports al tope (junto a los existentes)**

Agregar después de `import { TotalsStrip } from "../perfil/totals-strip"`:

```tsx
import { useQuery } from "@tanstack/react-query"
import { Flame } from "lucide-react"
import { Badge } from "@/components/ui/badge"
import { getMemberRecentWods } from "@/lib/actions/wod-logs"
import { formatScore } from "@/lib/constants/wod-score"
```

> Si `useQuery` ya está importado del archivo, dedupear (debería venir de `@tanstack/react-query`). Idem `Badge`, `Flame`. Sólo agregar lo que falte.

- [ ] **Step 3: Agregar query de recent WODs después de la query de profile**

Dentro del componente `MemberDetailModal`, después de la `useQuery` que llama a `getMemberPublicProfile`, agregar:

```tsx
  const { data: recentWods = [] } = useQuery({
    queryKey: ["member-recent-wods", memberId],
    queryFn: () => getMemberRecentWods(memberId as string, 5),
    enabled: open,
    staleTime: 5 * 60 * 1000,
  })
```

- [ ] **Step 4: Agregar la sección al final del bloque de detalle**

Justo antes del último `)` de cierre del JSX condicional `<>...</>` (después del `</div>` que cierra el bloque de familias de RMs), agregar:

```tsx
            {recentWods.length > 0 && (
              <div className="border rounded-lg p-3 sm:p-4 space-y-3">
                <div className="flex items-center gap-2">
                  <Flame className="h-4 w-4 text-primary" />
                  <h3 className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">
                    WODs recientes
                  </h3>
                </div>
                <ul className="space-y-1.5">
                  {recentWods.map((w) => (
                    <li key={w.id} className="flex items-center gap-3 text-sm">
                      <span className="text-xs text-muted-foreground w-16 shrink-0 tabular-nums">
                        {w.date.slice(5)}
                      </span>
                      <span className="flex-1 min-w-0 truncate">{w.routine_name}</span>
                      <span className="font-semibold tabular-nums shrink-0">
                        {formatScore({
                          score_type: w.score_type,
                          score_seconds: w.score_seconds,
                          score_rounds: w.score_rounds,
                          score_reps: w.score_reps,
                          score_kg: w.score_kg,
                        })}
                      </span>
                      <Badge variant={w.rx ? "default" : "outline"} className="text-[10px] shrink-0">
                        {w.rx ? "RX" : "S"}
                      </Badge>
                    </li>
                  ))}
                </ul>
              </div>
            )}
```

> **Detalle de ubicación:** ese bloque va dentro del JSX `<>...</>` del caso "totals !== null", justo después del `</div>` que cierra el wrapper de las familias (FAMILY_ORDER.map). Si el archivo no tiene esa estructura exacta (puede haber cambiado), pegarlo después del último componente visible y antes del cierre `</div>` exterior del bloque de detalle.

- [ ] **Step 5: Verificar TypeScript**

Run: `npx tsc --noEmit --skipLibCheck`
Expected: sin errores.

- [ ] **Step 6: Commit**

```bash
git add components/section-components/portal/descubrir/MemberDetailModal.tsx
git commit -m "feat(wod): sección WODs recientes en MemberDetailModal

Co-Authored-By: Claude Opus 4.7 <noreply@anthropic.com>"
```

---

### Task 13: Toggle show_wods en PrivacidadTab

**Files:**
- Modify: `components/section-components/portal/perfil/PrivacidadTab.tsx`
- Modify: `lib/actions/records.ts` (extender `VisibilitySettings` y queries para incluir `show_wods`)

- [ ] **Step 1: Extender VisibilitySettings en records.ts**

Editar `lib/actions/records.ts`. En `VisibilitySettings`:

```ts
export interface VisibilitySettings {
  discoverable: boolean
  show_plan: boolean
  show_avatar: boolean
  show_rms: boolean
  show_wods: boolean
}
```

En `getMyVisibility`, agregar `show_wods` al select:
```ts
    .select("discoverable, show_plan, show_avatar, show_rms, show_wods")
```

Y en el return:
```ts
  return {
    discoverable: data.discoverable ?? true,
    show_plan: data.show_plan ?? true,
    show_avatar: data.show_avatar ?? true,
    show_rms: data.show_rms ?? true,
    show_wods: data.show_wods ?? true,
  }
```

`updateMyVisibility` ya recibe `Partial<VisibilitySettings>`, no necesita cambios.

- [ ] **Step 2: Agregar el toggle en PrivacidadTab**

Editar `components/section-components/portal/perfil/PrivacidadTab.tsx`. En el array `TOGGLES`, después del último item (`show_rms`), agregar:

```ts
  {
    key: "show_wods",
    title: "Mostrar mis WODs",
    desc: "Tus registros de WOD aparecerán en leaderboards y en tu perfil público.",
  },
```

- [ ] **Step 3: Verificar TypeScript**

Run: `npx tsc --noEmit --skipLibCheck`
Expected: sin errores.

- [ ] **Step 4: Commit**

```bash
git add lib/actions/records.ts components/section-components/portal/perfil/PrivacidadTab.tsx
git commit -m "feat(wod): toggle show_wods en pestaña Privacidad

Co-Authored-By: Claude Opus 4.7 <noreply@anthropic.com>"
```

---

### Task 14: Agregar "WOD" al nav del portal

**Files:**
- Modify: `app/portal/layout.tsx`

- [ ] **Step 1: Agregar Flame al import**

Editar `app/portal/layout.tsx`. Cambiar:
```tsx
import { Home, Calendar, CreditCard, User, LogOut, Menu, X, Compass } from "lucide-react"
```
por:
```tsx
import { Home, Calendar, CreditCard, User, LogOut, Menu, X, Compass, Flame } from "lucide-react"
```

- [ ] **Step 2: Agregar el ítem WOD entre Descubrir y Clases**

Cambiar el array `nav` para que quede:

```tsx
const nav = [
  { name: "Inicio", href: "/portal", icon: Home },
  { name: "Descubrir", href: "/portal/descubrir", icon: Compass },
  { name: "WOD", href: "/portal/wod", icon: Flame },
  { name: "Clases", href: "/portal/clases", icon: Calendar },
  { name: "Pagos", href: "/portal/pagos", icon: CreditCard },
  { name: "Perfil", href: "/portal/perfil", icon: User },
]
```

- [ ] **Step 3: Verificar TypeScript + visual**

Run: `npx tsc --noEmit --skipLibCheck`
Expected: sin errores.

`npm run dev`. Loguearse como miembro:
- Bottom nav en mobile tiene 6 ítems. Verificar que no se rompe (íconos + labels caben).
  - Si visualmente se ve apretado, considerar reducir el `text-[11px]` actual a `text-[10px]` SOLO en el bottom nav, o quitar el label en mobile (íconos solamente).
  - Decidir en QA visual antes de commit final.
- Top nav en desktop muestra los 6 ítems.

- [ ] **Step 4: Commit**

```bash
git add app/portal/layout.tsx
git commit -m "feat(wod): agregar WOD al nav del portal (ícono Flame)

Co-Authored-By: Claude Opus 4.7 <noreply@anthropic.com>"
```

---

### Task 15: QA manual end-to-end

**Files:** ninguno; solo testing.

- [ ] **Step 1: Build limpio**

Run: `npm run build`
Expected: build exitoso sin errores nuevos.

- [ ] **Step 2: Casos de logging**

Con `npm run dev`, loguearse como miembro con plan asignado:

- [ ] Ir a `/portal/wod`. Header muestra rutina de hoy y botón "Registrar mi WOD".
- [ ] Click → modal abre con date=hoy, score_type=for_time, rutina = nombre de la rutina del plan para hoy.
- [ ] Cambiar score_type a AMRAP → inputs cambian a Rounds + Reps.
- [ ] Llenar 12 rounds + 5 reps + RX ON + nota "tested" → Guardar → toast OK.
- [ ] Header muestra "12 + 5 RX" en bloque azul + botón "Editar".
- [ ] Click "Editar" → modal pre-poblado. Cambiar a 13 rounds + 0 reps → Guardar → header refleja "13 rounds" RX.
- [ ] Click "Editar" → "Borrar" → toast OK → vuelve botón "Registrar mi WOD".
- [ ] Probar score_type=for_time: 8 min 30 seg → guardar → muestra "8:30".
- [ ] Probar score_type=for_reps: 150 reps → guardar → muestra "150 reps".
- [ ] Probar score_type=weight: 100 kg → guardar → muestra "100 kg".

- [ ] **Step 3: Casos de fechas pasadas**

- [ ] En el modal, cambiar la fecha a ayer. La línea "Rutina:" actualiza al nombre de la rutina del plan para ayer (si hay assignment). Si no hay → mensaje rojo "Sin rutina asignada para [día]" y botón Guardar disabled.
- [ ] Intentar fecha futura desde devtools (forzar `<input type="date">` máx) → server rechaza con "Fecha futura no permitida".

- [ ] **Step 4: Casos del Home**

- [ ] Ir a `/portal`. `TodayRoutineCard` muestra el botón "Registrar mi WOD" si no logeado, o el bloque con score + botón Editar si logeado. Mismo modal que en `/portal/wod`.

- [ ] **Step 5: Casos de leaderboard**

- [ ] Loguearse como otro miembro del mismo plan, registrar un WOD del día (peor que el primer miembro para for_time).
- [ ] Volver al primer miembro → `/portal/wod` → leaderboard muestra los 2 con orden correcto (mejor primero).
- [ ] Tiebreaker: dos miembros con mismo score → quien logeó primero queda 1°.
- [ ] Si nadie ha logeado: muestra "Aún nadie ha registrado el WOD de hoy."
- [ ] Si miembro tiene `show_wods=false` → no aparece en el leaderboard (probar desactivando en Perfil → Privacidad).

- [ ] **Step 6: Casos de Privacidad**

- [ ] Mi Perfil → Privacidad. El nuevo toggle "Mostrar mis WODs" aparece en ON.
- [ ] OFF → refresh `/portal/wod` desde otra cuenta. Mi entry no aparece en leaderboard. Mi modal en Descubrir no muestra "WODs recientes".
- [ ] Master `discoverable=false` → todos los toggles incluido `show_wods` quedan grises/disabled.

- [ ] **Step 7: Casos de Descubrir**

- [ ] Loguearse como otro miembro. Ir a `/portal/descubrir`. Click en card de un miembro con WODs → modal muestra sección "WODs recientes" con últimos 5.
- [ ] Si el miembro tiene `show_wods=false` → la sección "WODs recientes" no aparece.
- [ ] Solo se ven datos públicos: rutina, fecha, score, RX/Scaled. Notas no se exponen (verificar). Email/teléfono nunca expuestos.

- [ ] **Step 8: Casos de borde**

- [ ] Miembro sin plan: `/portal/wod` muestra "No tienes un plan asignado" en lugar del header. Historial vacío.
- [ ] Miembro con plan pero sin assignment hoy: Header muestra "Sin rutina asignada hoy" sin botón log. Leaderboard oculto. Historial intacto.
- [ ] Bottom nav con 6 ítems: verificar que se ve bien en mobile (≤375px).
- [ ] Modal scrolleable: en mobile pequeño, el modal hace scroll interno (max-h-[90vh] overflow-y-auto).

- [ ] **Step 9: Final commit (si hubo fixes)**

Si encontraste bugs:
```bash
git add -p
git commit -m "fix(wod): correcciones del QA manual

Co-Authored-By: Claude Opus 4.7 <noreply@anthropic.com>"
```

---

## Resumen de tasks

| # | Task | Files | Output |
|---|---|---|---|
| 1 | Migración + types + activity | 3 | DB + types + actions extendidos |
| 2 | Constantes wod-score | 1 | rankableValue, formatScore, helpers |
| 3 | Server actions own | 1 | get/upsert/delete propios |
| 4 | Server actions cross-member | 1 | leaderboard + recent |
| 5 | WodScoreInputs | 1 | inputs reutilizables |
| 6 | LogWodModal | 1 | modal logging completo |
| 7 | TodayWodHeader | 1 | header de la página |
| 8 | WodLeaderboard | 1 | top 10 del día |
| 9 | WodLogRow + WodHistoryList | 2 | historial agrupado |
| 10 | PortalWodMainComponent + page | 2 | página /portal/wod |
| 11 | Botón en TodayRoutineCard | 1 | integración con home |
| 12 | WODs recientes en Descubrir | 1 | integración Descubrir |
| 13 | Toggle show_wods | 2 | privacidad granular |
| 14 | Nav portal | 1 | item WOD agregado |
| 15 | QA manual | 0 | verificación |
