# RMs y Descubrir — Plan de Implementación

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Implementar registro de marcas personales (RMs) en el perfil del cliente con totales por familia, y una sección "Descubrir" donde los miembros se ven entre sí, con toggles granulares de privacidad.

**Architecture:** Tabla nueva `personal_records` con UNIQUE(member_id, movement); 4 columnas boolean en `members` para visibilidad; server actions en `lib/actions/records.ts` que usan admin client para reads cross-member; Perfil refactorizado a tabs (Datos / Marcas / Privacidad); página nueva `/portal/descubrir` con grid de cards + ranking + modal de detalle.

**Tech Stack:** Next.js 16 (App Router, Server Actions), React 19, TypeScript estricto, Supabase (Postgres + RLS + admin client), TanStack Query 5, shadcn/ui (Tabs, Dialog, Switch, Card), React Hook Form + Zod, Tailwind CSS 4, Sonner, lucide-react.

**Spec:** [docs/superpowers/specs/2026-05-02-rms-discover-design.md](../specs/2026-05-02-rms-discover-design.md)

**Convenciones del proyecto (recordatorio):**
- Server actions con `"use server"` arriba; UI nunca toca Supabase desde el cliente.
- `revalidatePath` y `logActivity` después de cada mutación que aplique.
- Errores de Supabase con `throw error`.
- TanStack Query para state del servidor en cliente; invalidar queries en `onSuccess`.
- Idioma español en UI; nombres de movimientos en inglés.
- Modo oscuro fijo. Yellow primary sobre fondo negro.
- Verificación con `npx tsc --noEmit --skipLibCheck` + browser manual (no hay tests automatizados).
- Solo commiteamos código que compila sin errores.

---

## Estructura de archivos

**Crear:**
- `supabase/migrations/20260502140000_personal_records_setup.sql`
- `lib/constants/movements.ts`
- `lib/actions/records.ts`
- `components/section-components/portal/perfil/DatosTab.tsx`
- `components/section-components/portal/perfil/MarcasTab.tsx`
- `components/section-components/portal/perfil/PrivacidadTab.tsx`
- `components/section-components/portal/perfil/edit-record-modal.tsx`
- `components/section-components/portal/perfil/totals-strip.tsx`
- `app/portal/descubrir/page.tsx`
- `components/section-components/portal/descubrir/PortalDescubrirMainComponent.tsx`
- `components/section-components/portal/descubrir/MemberCard.tsx`
- `components/section-components/portal/descubrir/MemberDetailModal.tsx`
- `components/section-components/portal/descubrir/RankingStrip.tsx`

**Modificar:**
- `types/database.ts` (regenerado, no se edita a mano salvo limpieza post-regen)
- `lib/actions/activity.ts`
- `app/portal/layout.tsx`
- `components/section-components/portal/perfil/PortalPerfilMainComponent.tsx`

---

### Task 1: Migración DB + types regen + activity types

**Files:**
- Create: `supabase/migrations/20260502140000_personal_records_setup.sql`
- Modify: `types/database.ts` (regenerado)
- Modify: `lib/actions/activity.ts`

- [ ] **Step 1: Crear el archivo de migración**

Crear `supabase/migrations/20260502140000_personal_records_setup.sql` con este contenido exacto:

```sql
-- Personal records (RMs) + visibility toggles en members

-- 1. Tabla personal_records
CREATE TABLE IF NOT EXISTS public.personal_records (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  member_id uuid NOT NULL REFERENCES public.members(id) ON DELETE CASCADE,
  movement text NOT NULL CHECK (movement IN (
    'snatch','power_snatch','hang_squat_snatch','hang_power_snatch',
    'clean','power_clean','hang_squat_clean','hang_power_clean','clean_and_jerk',
    'back_squat','front_squat','overhead_squat',
    'push_press','push_jerk','split_jerk',
    'deadlift','thruster'
  )),
  weight_kg numeric(5,2) NOT NULL CHECK (weight_kg > 0 AND weight_kg <= 500),
  achieved_at date CHECK (achieved_at <= current_date),
  created_at timestamptz DEFAULT now(),
  updated_at timestamptz DEFAULT now(),
  UNIQUE (member_id, movement)
);

CREATE INDEX IF NOT EXISTS personal_records_member_id_idx ON public.personal_records(member_id);

-- 2. RLS personal_records
ALTER TABLE public.personal_records ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "personal_records_self_or_admin_select" ON public.personal_records;
CREATE POLICY "personal_records_self_or_admin_select" ON public.personal_records
  FOR SELECT TO authenticated
  USING (
    EXISTS (SELECT 1 FROM public.admins WHERE auth_user_id = auth.uid())
    OR member_id IN (SELECT id FROM public.members WHERE auth_user_id = auth.uid())
  );

DROP POLICY IF EXISTS "personal_records_own_write" ON public.personal_records;
CREATE POLICY "personal_records_own_write" ON public.personal_records
  FOR ALL TO authenticated
  USING (member_id IN (SELECT id FROM public.members WHERE auth_user_id = auth.uid()))
  WITH CHECK (member_id IN (SELECT id FROM public.members WHERE auth_user_id = auth.uid()));

-- 3. Toggles de visibilidad en members
ALTER TABLE public.members
  ADD COLUMN IF NOT EXISTS discoverable boolean NOT NULL DEFAULT true,
  ADD COLUMN IF NOT EXISTS show_plan boolean NOT NULL DEFAULT true,
  ADD COLUMN IF NOT EXISTS show_avatar boolean NOT NULL DEFAULT true,
  ADD COLUMN IF NOT EXISTS show_rms boolean NOT NULL DEFAULT true;

CREATE INDEX IF NOT EXISTS members_discoverable_idx ON public.members(discoverable) WHERE discoverable = true;
```

- [ ] **Step 2: Aplicar la migración**

Run: `npx supabase db push`
Expected: "Applying migration 20260502140000_personal_records_setup.sql..." y "Finished supabase db push."

- [ ] **Step 3: Regenerar types**

Run: `npx supabase gen types typescript --linked > types/database.ts`

Esto reemplaza `types/database.ts`. La salida tiene dos basura conocidas:
- Primera línea: `Initialising login role...` (de stderr capturado)
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
  period: string      // "2026-01"
  label: string       // "Enero 2026"
  isOldest: boolean   // To highlight the oldest one
}
```

- [ ] **Step 6: Verificar que personal_records aparece en types**

Buscar en `types/database.ts` la sección `personal_records:` — debe existir con `Row`, `Insert`, `Update`. Y `members.Row` debe incluir `discoverable`, `show_plan`, `show_avatar`, `show_rms`.

- [ ] **Step 7: Extender ActivityAction y EntityType**

Editar `lib/actions/activity.ts`. En la unión `ActivityAction`, agregar:
```ts
  | "pr_updated" | "pr_deleted"
```

En `EntityType`, agregar:
```ts
  | "personal_record"
```

- [ ] **Step 8: Verificar TypeScript**

Run: `npx tsc --noEmit --skipLibCheck`
Expected: salida vacía (sin errores).

- [ ] **Step 9: Commit**

```bash
git add supabase/migrations/20260502140000_personal_records_setup.sql types/database.ts lib/actions/activity.ts
git commit -m "feat(rms): migración personal_records y toggles de visibilidad

Co-Authored-By: Claude Opus 4.7 <noreply@anthropic.com>"
```

---

### Task 2: Constantes de movimientos

**Files:**
- Create: `lib/constants/movements.ts`

- [ ] **Step 1: Crear el archivo de constantes**

Crear `lib/constants/movements.ts` con este contenido exacto:

```ts
export type MovementId =
  | 'snatch' | 'power_snatch' | 'hang_squat_snatch' | 'hang_power_snatch'
  | 'clean' | 'power_clean' | 'hang_squat_clean' | 'hang_power_clean' | 'clean_and_jerk'
  | 'back_squat' | 'front_squat' | 'overhead_squat'
  | 'push_press' | 'push_jerk' | 'split_jerk'
  | 'deadlift'
  | 'thruster'

export type MovementFamily = 'olympic' | 'squat' | 'press' | 'pull' | 'hybrid'

export interface Movement {
  id: MovementId
  label: string
  family: MovementFamily
  inOlympicTotal?: boolean
  inSquatTotal?: boolean
  inPressTotal?: boolean
}

export const MOVEMENTS: Movement[] = [
  { id: 'snatch', label: 'Snatch', family: 'olympic', inOlympicTotal: true },
  { id: 'power_snatch', label: 'Power Snatch', family: 'olympic' },
  { id: 'hang_squat_snatch', label: 'Hang Squat Snatch', family: 'olympic' },
  { id: 'hang_power_snatch', label: 'Hang Power Snatch', family: 'olympic' },
  { id: 'clean', label: 'Clean', family: 'olympic' },
  { id: 'power_clean', label: 'Power Clean', family: 'olympic' },
  { id: 'hang_squat_clean', label: 'Hang Squat Clean', family: 'olympic' },
  { id: 'hang_power_clean', label: 'Hang Power Clean', family: 'olympic' },
  { id: 'clean_and_jerk', label: 'Clean & Jerk', family: 'olympic', inOlympicTotal: true },
  { id: 'back_squat', label: 'Back Squat', family: 'squat', inSquatTotal: true },
  { id: 'front_squat', label: 'Front Squat', family: 'squat', inSquatTotal: true },
  { id: 'overhead_squat', label: 'Overhead Squat', family: 'squat', inSquatTotal: true },
  { id: 'push_press', label: 'Push Press', family: 'press', inPressTotal: true },
  { id: 'push_jerk', label: 'Push Jerk', family: 'press', inPressTotal: true },
  { id: 'split_jerk', label: 'Split Jerk', family: 'press', inPressTotal: true },
  { id: 'deadlift', label: 'Deadlift', family: 'pull' },
  { id: 'thruster', label: 'Thruster', family: 'hybrid' },
]

export const FAMILY_LABEL: Record<MovementFamily, string> = {
  olympic: 'Halterofilia',
  squat: 'Squats',
  press: 'Presses & Jerks',
  pull: 'Pulls',
  hybrid: 'Hybrid',
}

export const FAMILY_ORDER: MovementFamily[] = ['olympic', 'squat', 'press', 'pull', 'hybrid']

export function getMovement(id: MovementId): Movement {
  const m = MOVEMENTS.find((x) => x.id === id)
  if (!m) throw new Error(`Unknown movement: ${id}`)
  return m
}

export function getMovementsByFamily(family: MovementFamily): Movement[] {
  return MOVEMENTS.filter((m) => m.family === family)
}

// Calcula los 4 totales a partir de un map de PRs (movimiento -> peso).
export function calculateTotals(records: Record<string, number>): {
  grand: number
  olympic: number
  squat: number
  press: number
} {
  let grand = 0, olympic = 0, squat = 0, press = 0
  for (const m of MOVEMENTS) {
    const w = records[m.id] ?? 0
    grand += w
    if (m.inOlympicTotal) olympic += w
    if (m.inSquatTotal) squat += w
    if (m.inPressTotal) press += w
  }
  return { grand, olympic, squat, press }
}
```

- [ ] **Step 2: Verificar TypeScript**

Run: `npx tsc --noEmit --skipLibCheck`
Expected: sin errores.

- [ ] **Step 3: Commit**

```bash
git add lib/constants/movements.ts
git commit -m "feat(rms): constantes de movimientos y cálculo de totales

Co-Authored-By: Claude Opus 4.7 <noreply@anthropic.com>"
```

---

### Task 3: Server actions de records propios y visibilidad

**Files:**
- Create: `lib/actions/records.ts` (parcial — solo own records + visibility)

- [ ] **Step 1: Crear el archivo con las server actions iniciales**

Crear `lib/actions/records.ts` con este contenido inicial (las funciones cross-member se agregan en Task 4):

```ts
"use server"

import { createClient } from "@/utils/supabase/server"
import { revalidatePath } from "next/cache"
import type { MovementId } from "@/lib/constants/movements"
import { getMovement } from "@/lib/constants/movements"
import { logActivity } from "./activity"

// ─── Helper: obtener member_id del usuario autenticado ────

async function getMyMemberId(): Promise<string> {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) throw new Error("No autenticado")

  const { data: member, error } = await supabase
    .from("members")
    .select("id")
    .eq("auth_user_id", user.id)
    .maybeSingle()

  if (error) throw error
  if (!member) throw new Error("Miembro no encontrado")
  return member.id
}

// ─── Mis records ─────────────────────────────────────────

export interface PersonalRecord {
  id: string
  movement: MovementId
  weight_kg: number
  achieved_at: string | null
  updated_at: string | null
}

export async function getMyRecords(): Promise<PersonalRecord[]> {
  const supabase = await createClient()
  const memberId = await getMyMemberId()

  const { data, error } = await supabase
    .from("personal_records")
    .select("id, movement, weight_kg, achieved_at, updated_at")
    .eq("member_id", memberId)
    .order("movement")

  if (error) throw error
  return (data ?? []) as PersonalRecord[]
}

export async function upsertRecord(input: {
  movement: MovementId
  weight_kg: number
  achieved_at?: string | null
}): Promise<PersonalRecord> {
  if (input.weight_kg <= 0 || input.weight_kg > 500) {
    throw new Error("Peso fuera de rango (0 < peso ≤ 500 kg)")
  }

  const supabase = await createClient()
  const memberId = await getMyMemberId()

  const { data, error } = await supabase
    .from("personal_records")
    .upsert(
      {
        member_id: memberId,
        movement: input.movement,
        weight_kg: input.weight_kg,
        achieved_at: input.achieved_at ?? null,
        updated_at: new Date().toISOString(),
      },
      { onConflict: "member_id,movement" },
    )
    .select("id, movement, weight_kg, achieved_at, updated_at")
    .single()

  if (error) throw error

  await logActivity({
    action: "pr_updated",
    entityType: "personal_record",
    entityId: data.id,
    entityName: getMovement(input.movement).label,
  })

  revalidatePath("/portal/perfil")
  revalidatePath("/portal/descubrir")
  return data as PersonalRecord
}

export async function deleteRecord(movement: MovementId): Promise<void> {
  const supabase = await createClient()
  const memberId = await getMyMemberId()

  const { data: existing } = await supabase
    .from("personal_records")
    .select("id")
    .eq("member_id", memberId)
    .eq("movement", movement)
    .maybeSingle()

  if (!existing) return

  const { error } = await supabase
    .from("personal_records")
    .delete()
    .eq("id", existing.id)

  if (error) throw error

  await logActivity({
    action: "pr_deleted",
    entityType: "personal_record",
    entityId: existing.id,
    entityName: getMovement(movement).label,
  })

  revalidatePath("/portal/perfil")
  revalidatePath("/portal/descubrir")
}

// ─── Visibilidad ─────────────────────────────────────────

export interface VisibilitySettings {
  discoverable: boolean
  show_plan: boolean
  show_avatar: boolean
  show_rms: boolean
}

export async function getMyVisibility(): Promise<VisibilitySettings> {
  const supabase = await createClient()
  const memberId = await getMyMemberId()

  const { data, error } = await supabase
    .from("members")
    .select("discoverable, show_plan, show_avatar, show_rms")
    .eq("id", memberId)
    .single()

  if (error) throw error
  return {
    discoverable: data.discoverable ?? true,
    show_plan: data.show_plan ?? true,
    show_avatar: data.show_avatar ?? true,
    show_rms: data.show_rms ?? true,
  }
}

export async function updateMyVisibility(
  patch: Partial<VisibilitySettings>,
): Promise<void> {
  const supabase = await createClient()
  const memberId = await getMyMemberId()

  const { error } = await supabase
    .from("members")
    .update(patch)
    .eq("id", memberId)

  if (error) throw error

  revalidatePath("/portal/perfil")
  revalidatePath("/portal/descubrir")
}
```

- [ ] **Step 2: Verificar TypeScript**

Run: `npx tsc --noEmit --skipLibCheck`
Expected: sin errores.

- [ ] **Step 3: Commit**

```bash
git add lib/actions/records.ts
git commit -m "feat(rms): server actions de records propios y visibilidad

Co-Authored-By: Claude Opus 4.7 <noreply@anthropic.com>"
```

---

### Task 4: Server actions cross-member (Discover)

**Files:**
- Modify: `lib/actions/records.ts`

- [ ] **Step 1: Agregar imports y server actions cross-member al final del archivo**

Editar `lib/actions/records.ts`. Agregar al import existente de `@/utils/supabase/server` un import del admin client al tope (después de los imports actuales):

```ts
import { createAdminClient } from "@/utils/supabase/admin"
```

Verifica antes que `@/utils/supabase/admin` exporte una función `createAdminClient` (o ajusta el nombre según corresponda — algunos proyectos exportan `createClient`). Si exporta `createClient`, importarla como:
```ts
import { createClient as createAdminClient } from "@/utils/supabase/admin"
```

Luego agregar al final del archivo (antes del último cierre, si aplica) este bloque completo:

```ts
import { calculateTotals, MOVEMENTS } from "@/lib/constants/movements"

// ─── Discover (cross-member) ─────────────────────────────

export interface DiscoverableMember {
  id: string
  name: string
  avatar_url: string | null
  plan_name: string | null
  totals: { grand: number; olympic: number; squat: number; press: number } | null
  top_records: Array<{ movement: MovementId; weight_kg: number }>
}

export interface MemberPublicProfile extends DiscoverableMember {
  start_date: string | null
  records: PersonalRecord[]
}

export interface RankingEntry {
  member_id: string
  name: string
  avatar_url: string | null
  total_kg: number
}

async function ensureAuthenticated(): Promise<void> {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) throw new Error("No autenticado")
}

interface MemberRow {
  id: string
  name: string
  avatar_url: string | null
  plan_id: string | null
  start_date: string | null
  discoverable: boolean
  show_plan: boolean
  show_avatar: boolean
  show_rms: boolean
  plans: { name: string } | null
}

interface RecordRow {
  member_id: string
  movement: MovementId
  weight_kg: number
  achieved_at: string | null
  id: string
  updated_at: string | null
}

export async function getDiscoverableMembers(search?: string): Promise<DiscoverableMember[]> {
  await ensureAuthenticated()

  const admin = createAdminClient()

  let query = admin
    .from("members")
    .select("id, name, avatar_url, plan_id, start_date, discoverable, show_plan, show_avatar, show_rms, plans(name)")
    .eq("discoverable", true)
    .order("name", { ascending: true })

  if (search && search.trim().length > 0) {
    query = query.ilike("name", `%${search.trim()}%`)
  }

  const { data: members, error } = await query
  if (error) throw error
  if (!members || members.length === 0) return []

  const memberIds = members.map((m) => m.id)

  const { data: records, error: recError } = await admin
    .from("personal_records")
    .select("member_id, movement, weight_kg")
    .in("member_id", memberIds)

  if (recError) throw recError

  const recordsByMember: Record<string, Record<MovementId, number>> = {}
  for (const r of (records ?? []) as Array<Pick<RecordRow, "member_id" | "movement" | "weight_kg">>) {
    recordsByMember[r.member_id] ??= {} as Record<MovementId, number>
    recordsByMember[r.member_id][r.movement] = Number(r.weight_kg)
  }

  return (members as unknown as MemberRow[]).map((m) => {
    const rms = recordsByMember[m.id] ?? ({} as Record<MovementId, number>)
    const totals = m.show_rms ? calculateTotals(rms) : null

    const topRecords = m.show_rms
      ? MOVEMENTS
          .map((mv) => ({ movement: mv.id, weight_kg: rms[mv.id] ?? 0 }))
          .filter((r) => r.weight_kg > 0)
          .sort((a, b) => b.weight_kg - a.weight_kg)
          .slice(0, 3)
      : []

    return {
      id: m.id,
      name: m.name,
      avatar_url: m.show_avatar ? m.avatar_url : null,
      plan_name: m.show_plan && m.plans ? m.plans.name : null,
      totals,
      top_records: topRecords,
    }
  })
}

export async function getMemberPublicProfile(memberId: string): Promise<MemberPublicProfile> {
  await ensureAuthenticated()

  const admin = createAdminClient()

  const { data: member, error } = await admin
    .from("members")
    .select("id, name, avatar_url, plan_id, start_date, discoverable, show_plan, show_avatar, show_rms, plans(name)")
    .eq("id", memberId)
    .maybeSingle()

  if (error) throw error
  if (!member || !member.discoverable) {
    throw new Error("Miembro no encontrado")
  }

  const m = member as unknown as MemberRow

  const { data: records, error: recError } = await admin
    .from("personal_records")
    .select("id, movement, weight_kg, achieved_at, updated_at")
    .eq("member_id", memberId)
    .order("movement")

  if (recError) throw recError

  const recList: PersonalRecord[] = m.show_rms
    ? ((records ?? []) as PersonalRecord[])
    : []

  const recsMap: Record<string, number> = {}
  for (const r of recList) recsMap[r.movement] = Number(r.weight_kg)

  const totals = m.show_rms ? calculateTotals(recsMap) : null

  const topRecords = m.show_rms
    ? recList
        .filter((r) => Number(r.weight_kg) > 0)
        .sort((a, b) => Number(b.weight_kg) - Number(a.weight_kg))
        .slice(0, 3)
        .map((r) => ({ movement: r.movement, weight_kg: Number(r.weight_kg) }))
    : []

  return {
    id: m.id,
    name: m.name,
    avatar_url: m.show_avatar ? m.avatar_url : null,
    plan_name: m.show_plan && m.plans ? m.plans.name : null,
    start_date: m.start_date,
    totals,
    top_records: topRecords,
    records: recList,
  }
}

export async function getTopByCategory(
  category: "grand" | "olympic" | "squat" | "press",
): Promise<RankingEntry[]> {
  await ensureAuthenticated()

  const admin = createAdminClient()

  const { data: members, error } = await admin
    .from("members")
    .select("id, name, avatar_url, discoverable, show_rms, show_avatar")
    .eq("discoverable", true)
    .eq("show_rms", true)

  if (error) throw error
  if (!members || members.length === 0) return []

  const memberIds = members.map((m) => m.id)

  const { data: records, error: recError } = await admin
    .from("personal_records")
    .select("member_id, movement, weight_kg")
    .in("member_id", memberIds)

  if (recError) throw recError

  const byMember: Record<string, Record<MovementId, number>> = {}
  for (const r of (records ?? []) as Array<Pick<RecordRow, "member_id" | "movement" | "weight_kg">>) {
    byMember[r.member_id] ??= {} as Record<MovementId, number>
    byMember[r.member_id][r.movement] = Number(r.weight_kg)
  }

  const entries: RankingEntry[] = members
    .map((m) => {
      const recs = byMember[m.id] ?? ({} as Record<MovementId, number>)
      const totals = calculateTotals(recs)
      return {
        member_id: m.id,
        name: m.name,
        avatar_url: m.show_avatar ? m.avatar_url : null,
        total_kg: totals[category],
      }
    })
    .filter((e) => e.total_kg > 0)
    .sort((a, b) => b.total_kg - a.total_kg)
    .slice(0, 3)

  return entries
}
```

**Importante:** El import de `calculateTotals, MOVEMENTS` puede chocar con import existente al tope del archivo. Si ya está importado `getMovement` desde el mismo módulo, agregar `calculateTotals, MOVEMENTS` al mismo import line:
```ts
import { getMovement, calculateTotals, MOVEMENTS } from "@/lib/constants/movements"
```
Y borrar el import duplicado al final.

- [ ] **Step 2: Verificar TypeScript**

Run: `npx tsc --noEmit --skipLibCheck`
Expected: sin errores. Si hay error sobre `createAdminClient`, ajustar el nombre del import al que efectivamente exporte `@/utils/supabase/admin`.

- [ ] **Step 3: Commit**

```bash
git add lib/actions/records.ts
git commit -m "feat(rms): server actions de Descubrir con admin client

Co-Authored-By: Claude Opus 4.7 <noreply@anthropic.com>"
```

---

### Task 5: EditRecordModal

**Files:**
- Create: `components/section-components/portal/perfil/edit-record-modal.tsx`

- [ ] **Step 1: Crear el modal de edición de un PR**

Crear `components/section-components/portal/perfil/edit-record-modal.tsx` con este contenido exacto:

```tsx
"use client"

import { useEffect } from "react"
import { useForm } from "react-hook-form"
import { zodResolver } from "@hookform/resolvers/zod"
import { z } from "zod"
import { useMutation, useQueryClient } from "@tanstack/react-query"
import { Loader2, Save, Trash2 } from "lucide-react"
import { toast } from "sonner"
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogFooter,
  DialogDescription,
} from "@/components/ui/dialog"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { upsertRecord, deleteRecord } from "@/lib/actions/records"
import type { MovementId } from "@/lib/constants/movements"
import { getMovement } from "@/lib/constants/movements"

const schema = z.object({
  weight_kg: z.coerce.number().positive("Debe ser mayor a 0").max(500, "Máximo 500 kg"),
  achieved_at: z.string().optional(),
})

type FormData = z.infer<typeof schema>

interface EditRecordModalProps {
  open: boolean
  onOpenChange: (open: boolean) => void
  movement: MovementId
  currentWeight: number | null
  currentDate: string | null
}

export function EditRecordModal({
  open,
  onOpenChange,
  movement,
  currentWeight,
  currentDate,
}: EditRecordModalProps) {
  const queryClient = useQueryClient()
  const movementInfo = getMovement(movement)

  const { register, handleSubmit, reset, formState: { errors } } = useForm<FormData>({
    resolver: zodResolver(schema),
    defaultValues: {
      weight_kg: currentWeight ?? undefined,
      achieved_at: currentDate ?? "",
    },
  })

  useEffect(() => {
    if (open) {
      reset({
        weight_kg: currentWeight ?? undefined,
        achieved_at: currentDate ?? "",
      })
    }
  }, [open, currentWeight, currentDate, reset])

  const upsertMutation = useMutation({
    mutationFn: (data: FormData) =>
      upsertRecord({
        movement,
        weight_kg: data.weight_kg,
        achieved_at: data.achieved_at && data.achieved_at.length > 0 ? data.achieved_at : null,
      }),
    onSuccess: () => {
      toast.success(`PR actualizado: ${movementInfo.label}`)
      queryClient.invalidateQueries({ queryKey: ["my-records"] })
      onOpenChange(false)
    },
    onError: (err) => {
      toast.error(err instanceof Error ? err.message : "Error al guardar")
    },
  })

  const deleteMutation = useMutation({
    mutationFn: () => deleteRecord(movement),
    onSuccess: () => {
      toast.success(`PR borrado: ${movementInfo.label}`)
      queryClient.invalidateQueries({ queryKey: ["my-records"] })
      onOpenChange(false)
    },
    onError: (err) => {
      toast.error(err instanceof Error ? err.message : "Error al borrar")
    },
  })

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle>{movementInfo.label}</DialogTitle>
          <DialogDescription>
            Registra tu mejor marca personal en este movimiento.
          </DialogDescription>
        </DialogHeader>
        <form onSubmit={handleSubmit((d) => upsertMutation.mutate(d))} className="space-y-4">
          <div className="space-y-1.5">
            <Label htmlFor="weight_kg" className="text-sm">Peso (kg)</Label>
            <Input
              id="weight_kg"
              type="number"
              step="0.5"
              min={0.5}
              max={500}
              placeholder="Ej: 100"
              {...register("weight_kg")}
            />
            {errors.weight_kg && (
              <p className="text-xs text-destructive">{errors.weight_kg.message}</p>
            )}
          </div>
          <div className="space-y-1.5">
            <Label htmlFor="achieved_at" className="text-sm">
              Fecha (opcional)
            </Label>
            <Input
              id="achieved_at"
              type="date"
              max={new Date().toISOString().slice(0, 10)}
              className="scheme-dark"
              {...register("achieved_at")}
            />
          </div>
          <DialogFooter className="gap-2 flex-col sm:flex-row">
            {currentWeight !== null && (
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
                Borrar PR
              </Button>
            )}
            <Button
              type="submit"
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
        </form>
      </DialogContent>
    </Dialog>
  )
}
```

- [ ] **Step 2: Verificar TypeScript**

Run: `npx tsc --noEmit --skipLibCheck`
Expected: sin errores.

- [ ] **Step 3: Commit**

```bash
git add components/section-components/portal/perfil/edit-record-modal.tsx
git commit -m "feat(rms): modal de edición de un PR

Co-Authored-By: Claude Opus 4.7 <noreply@anthropic.com>"
```

---

### Task 6: TotalsStrip

**Files:**
- Create: `components/section-components/portal/perfil/totals-strip.tsx`

- [ ] **Step 1: Crear el strip de totales**

Crear `components/section-components/portal/perfil/totals-strip.tsx`:

```tsx
"use client"

import { Card, CardContent } from "@/components/ui/card"
import { Trophy, Dumbbell, Layers, Activity } from "lucide-react"

interface TotalsStripProps {
  totals: { grand: number; olympic: number; squat: number; press: number }
}

const ITEMS: Array<{
  key: keyof TotalsStripProps["totals"]
  label: string
  icon: React.ComponentType<{ className?: string }>
  color: string
}> = [
  { key: "grand",   label: "Grand Total",   icon: Trophy,   color: "text-primary" },
  { key: "olympic", label: "Olympic Total", icon: Dumbbell, color: "text-blue-400" },
  { key: "squat",   label: "Squat Total",   icon: Layers,   color: "text-green-400" },
  { key: "press",   label: "Press Total",   icon: Activity, color: "text-orange-400" },
]

export function TotalsStrip({ totals }: TotalsStripProps) {
  return (
    <div className="grid grid-cols-2 md:grid-cols-4 gap-2 sm:gap-3">
      {ITEMS.map(({ key, label, icon: Icon, color }) => {
        const value = totals[key]
        return (
          <Card key={key}>
            <CardContent className="py-3 sm:py-4">
              <div className="flex items-center gap-2">
                <Icon className={`h-4 w-4 sm:h-5 sm:w-5 shrink-0 ${color}`} />
                <p className="text-[10px] sm:text-xs uppercase text-muted-foreground tracking-wide truncate">
                  {label}
                </p>
              </div>
              <p className="mt-1.5 sm:mt-2 text-lg sm:text-2xl font-bold tabular-nums">
                {value > 0 ? value.toLocaleString("es-VE") : "—"}
                {value > 0 && <span className="text-xs sm:text-sm font-normal text-muted-foreground ml-1">kg</span>}
              </p>
            </CardContent>
          </Card>
        )
      })}
    </div>
  )
}
```

- [ ] **Step 2: Verificar TypeScript**

Run: `npx tsc --noEmit --skipLibCheck`
Expected: sin errores.

- [ ] **Step 3: Commit**

```bash
git add components/section-components/portal/perfil/totals-strip.tsx
git commit -m "feat(rms): strip de 4 totales (Grand/Olympic/Squat/Press)

Co-Authored-By: Claude Opus 4.7 <noreply@anthropic.com>"
```

---

### Task 7: MarcasTab

**Files:**
- Create: `components/section-components/portal/perfil/MarcasTab.tsx`

- [ ] **Step 1: Crear MarcasTab**

Crear `components/section-components/portal/perfil/MarcasTab.tsx`:

```tsx
"use client"

import { useMemo, useState } from "react"
import { useQuery } from "@tanstack/react-query"
import { format } from "date-fns"
import { es } from "date-fns/locale"
import { Loader2, Pencil } from "lucide-react"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { getMyRecords, type PersonalRecord } from "@/lib/actions/records"
import {
  MOVEMENTS,
  FAMILY_LABEL,
  FAMILY_ORDER,
  calculateTotals,
  getMovementsByFamily,
  type MovementId,
} from "@/lib/constants/movements"
import { TotalsStrip } from "./totals-strip"
import { EditRecordModal } from "./edit-record-modal"

export function MarcasTab() {
  const [editingMovement, setEditingMovement] = useState<MovementId | null>(null)

  const { data: records = [], isLoading } = useQuery({
    queryKey: ["my-records"],
    queryFn: getMyRecords,
    staleTime: 5 * 60 * 1000,
  })

  const recordsByMovement = useMemo(() => {
    const map: Record<string, PersonalRecord> = {}
    for (const r of records) map[r.movement] = r
    return map
  }, [records])

  const totals = useMemo(() => {
    const map: Record<string, number> = {}
    for (const r of records) map[r.movement] = Number(r.weight_kg)
    return calculateTotals(map)
  }, [records])

  if (isLoading) {
    return (
      <div className="flex justify-center py-12">
        <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" />
      </div>
    )
  }

  const editingRecord = editingMovement ? recordsByMovement[editingMovement] : null

  return (
    <div className="space-y-5 sm:space-y-6">
      <TotalsStrip totals={totals} />

      <div className="space-y-3 sm:space-y-4">
        {FAMILY_ORDER.map((family) => {
          const movements = getMovementsByFamily(family)
          if (movements.length === 0) return null
          return (
            <Card key={family}>
              <CardHeader className="pb-2">
                <CardTitle className="text-sm font-semibold uppercase tracking-wide text-muted-foreground">
                  {FAMILY_LABEL[family]}
                </CardTitle>
              </CardHeader>
              <CardContent className="pb-3">
                <ul className="divide-y divide-border">
                  {movements.map((m) => {
                    const r = recordsByMovement[m.id]
                    const w = r ? Number(r.weight_kg) : null
                    return (
                      <li key={m.id}>
                        <button
                          type="button"
                          onClick={() => setEditingMovement(m.id)}
                          className="w-full flex items-center justify-between gap-3 py-2.5 text-left hover:bg-muted/30 -mx-3 px-3 rounded transition-colors group"
                        >
                          <span className="text-sm truncate min-w-0 flex-1">{m.label}</span>
                          <span className="flex items-center gap-3 shrink-0">
                            {w !== null ? (
                              <>
                                <span className="text-sm font-semibold tabular-nums">
                                  {w.toLocaleString("es-VE")}
                                  <span className="text-xs font-normal text-muted-foreground ml-1">kg</span>
                                </span>
                                {r?.achieved_at && (
                                  <span className="text-[11px] text-muted-foreground hidden sm:inline">
                                    {format(new Date(r.achieved_at + "T00:00:00"), "d MMM yyyy", { locale: es })}
                                  </span>
                                )}
                              </>
                            ) : (
                              <span className="text-sm text-muted-foreground">—</span>
                            )}
                            <Pencil className="h-3.5 w-3.5 text-muted-foreground opacity-0 group-hover:opacity-100 transition-opacity" />
                          </span>
                        </button>
                      </li>
                    )
                  })}
                </ul>
              </CardContent>
            </Card>
          )
        })}
      </div>

      <EditRecordModal
        open={editingMovement !== null}
        onOpenChange={(open) => !open && setEditingMovement(null)}
        movement={editingMovement ?? "snatch"}
        currentWeight={editingRecord ? Number(editingRecord.weight_kg) : null}
        currentDate={editingRecord?.achieved_at ?? null}
      />
    </div>
  )
}
```

- [ ] **Step 2: Verificar TypeScript**

Run: `npx tsc --noEmit --skipLibCheck`
Expected: sin errores.

- [ ] **Step 3: Commit**

```bash
git add components/section-components/portal/perfil/MarcasTab.tsx
git commit -m "feat(rms): MarcasTab con totales y lista de RMs por familia

Co-Authored-By: Claude Opus 4.7 <noreply@anthropic.com>"
```

---

### Task 8: PrivacidadTab

**Files:**
- Create: `components/section-components/portal/perfil/PrivacidadTab.tsx`

- [ ] **Step 1: Crear PrivacidadTab**

Crear `components/section-components/portal/perfil/PrivacidadTab.tsx`:

```tsx
"use client"

import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query"
import { toast } from "sonner"
import { Loader2 } from "lucide-react"
import { Card, CardContent } from "@/components/ui/card"
import { Switch } from "@/components/ui/switch"
import { Label } from "@/components/ui/label"
import { cn } from "@/lib/utils"
import {
  getMyVisibility,
  updateMyVisibility,
  type VisibilitySettings,
} from "@/lib/actions/records"

const TOGGLES: Array<{
  key: keyof VisibilitySettings
  title: string
  desc: string
  isMaster?: boolean
}> = [
  {
    key: "discoverable",
    title: "Aparecer en Descubrir",
    desc: "Que otros miembros te vean en la sección Descubrir.",
    isMaster: true,
  },
  {
    key: "show_avatar",
    title: "Mostrar avatar",
    desc: "Tu foto aparecerá en tu card. Si no, se muestran tus iniciales.",
  },
  {
    key: "show_plan",
    title: "Mostrar plan",
    desc: "Otros verán a qué plan estás suscrito.",
  },
  {
    key: "show_rms",
    title: "Mostrar mis RMs",
    desc: "Tus marcas serán visibles en tu card y contarán para los rankings.",
  },
]

export function PrivacidadTab() {
  const queryClient = useQueryClient()

  const { data: visibility, isLoading } = useQuery({
    queryKey: ["my-visibility"],
    queryFn: getMyVisibility,
    staleTime: 5 * 60 * 1000,
  })

  const mutation = useMutation({
    mutationFn: (patch: Partial<VisibilitySettings>) => updateMyVisibility(patch),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["my-visibility"] })
      toast.success("Privacidad actualizada")
    },
    onError: (err) => {
      toast.error(err instanceof Error ? err.message : "Error al actualizar")
    },
  })

  if (isLoading || !visibility) {
    return (
      <div className="flex justify-center py-12">
        <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" />
      </div>
    )
  }

  return (
    <Card>
      <CardContent className="pt-5 sm:pt-6 divide-y divide-border">
        {TOGGLES.map((t, i) => {
          const checked = visibility[t.key]
          const masterOff = !visibility.discoverable && !t.isMaster
          return (
            <div
              key={t.key}
              className={cn(
                "flex items-start justify-between gap-3 sm:gap-4 py-4",
                i === 0 && "pt-0",
                masterOff && "opacity-50",
              )}
            >
              <div className="min-w-0 flex-1">
                <Label
                  htmlFor={`tog-${t.key}`}
                  className={cn("text-sm font-medium", masterOff && "cursor-not-allowed")}
                >
                  {t.title}
                </Label>
                <p className="text-xs text-muted-foreground mt-0.5">{t.desc}</p>
                {masterOff && (
                  <p className="text-[11px] text-muted-foreground mt-1 italic">
                    Activa &quot;Aparecer en Descubrir&quot; primero.
                  </p>
                )}
              </div>
              <Switch
                id={`tog-${t.key}`}
                checked={checked}
                disabled={masterOff || mutation.isPending}
                onCheckedChange={(next) => mutation.mutate({ [t.key]: next })}
              />
            </div>
          )
        })}
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
git add components/section-components/portal/perfil/PrivacidadTab.tsx
git commit -m "feat(rms): PrivacidadTab con 4 toggles (master + 3 categorías)

Co-Authored-By: Claude Opus 4.7 <noreply@anthropic.com>"
```

---

### Task 9: DatosTab + refactor PortalPerfilMainComponent a tabs

**Files:**
- Create: `components/section-components/portal/perfil/DatosTab.tsx`
- Modify: `components/section-components/portal/perfil/PortalPerfilMainComponent.tsx`

- [ ] **Step 1: Crear DatosTab con el contenido actual de PortalPerfilMainComponent**

Crear `components/section-components/portal/perfil/DatosTab.tsx`. Copiar lo que actualmente vive en `PortalPerfilMainComponent.tsx` desde el grid `md:grid-cols-[260px_1fr]` hasta el final del componente (la card de avatar + form de datos + card de contraseña). Envolverlo en una función `DatosTab()` exportada. Mantener todos los hooks (useForm, useMutation, etc.) que actualmente usa el form.

Contenido completo:

```tsx
"use client"

import { useRef, useState } from "react"
import { useForm } from "react-hook-form"
import { zodResolver } from "@hookform/resolvers/zod"
import { z } from "zod"
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query"
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

export function DatosTab() {
  const queryClient = useQueryClient()
  const fileRef = useRef<HTMLInputElement>(null)
  const [avatarPreview, setAvatarPreview] = useState<string | null>(null)
  const [uploadingAvatar, setUploadingAvatar] = useState(false)

  const { data: profile } = useQuery({
    queryKey: ["my-profile"],
    queryFn: getMyProfile,
    staleTime: 5 * 60 * 1000,
  })

  const { register, handleSubmit, formState: { errors } } = useForm<FormData>({
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

    const reader = new FileReader()
    reader.onload = (ev) => setAvatarPreview(ev.target?.result as string)
    reader.readAsDataURL(file)

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

  const initials = profile?.name
    ? profile.name.split(" ").map((n: string) => n[0]).join("").slice(0, 2).toUpperCase()
    : "?"

  return (
    <div className="grid gap-4 md:gap-6 md:grid-cols-[260px_1fr]">
      <Card className="md:sticky md:top-20 md:self-start">
        <CardContent className="pt-6 flex flex-col items-center gap-3">
          <div className="relative">
            <Avatar className="h-24 w-24 sm:h-28 sm:w-28 border-2 border-primary/20">
              <AvatarImage src={avatarPreview ?? profile?.avatar_url ?? undefined} />
              <AvatarFallback className="bg-primary/20 text-primary text-xl font-bold">
                {initials}
              </AvatarFallback>
            </Avatar>
            <button
              type="button"
              onClick={() => fileRef.current?.click()}
              disabled={uploadingAvatar}
              className="absolute bottom-0 right-0 flex h-9 w-9 items-center justify-center rounded-full bg-primary text-primary-foreground shadow-md transition-colors hover:bg-primary/90 disabled:opacity-50"
              aria-label="Cambiar foto de perfil"
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
          <div className="text-center">
            <p className="font-medium text-sm truncate max-w-[200px]">{profile?.name}</p>
            <p className="text-[11px] text-muted-foreground mt-1">JPG, PNG o WebP · Máx 2MB</p>
          </div>
        </CardContent>
      </Card>

      <div className="space-y-4 sm:space-y-5 min-w-0">
        <Card>
          <CardHeader className="pb-3">
            <CardTitle className="text-sm sm:text-base">Datos personales</CardTitle>
          </CardHeader>
          <CardContent>
            <form
              onSubmit={handleSubmit((d) => updateMutation.mutate(d))}
              className="space-y-4"
            >
              <div className="space-y-1.5">
                <Label htmlFor="name" className="text-xs sm:text-sm">Nombre completo</Label>
                <Input id="name" {...register("name")} />
                {errors.name && <p className="text-xs text-destructive">{errors.name.message}</p>}
              </div>
              <div className="grid gap-4 sm:grid-cols-2">
                <div className="space-y-1.5">
                  <Label htmlFor="phone" className="text-xs sm:text-sm">Teléfono</Label>
                  <Input id="phone" type="tel" {...register("phone")} />
                </div>
                <div className="space-y-1.5">
                  <Label htmlFor="email" className="text-xs sm:text-sm">Email</Label>
                  <Input id="email" type="email" {...register("email")} />
                  {errors.email && <p className="text-xs text-destructive">{errors.email.message}</p>}
                </div>
              </div>
              <p className="text-[11px] sm:text-xs text-muted-foreground">
                Si cambias el email recibirás un correo de verificación.
              </p>
              <Button
                type="submit"
                className="w-full sm:w-auto"
                disabled={updateMutation.isPending}
              >
                {updateMutation.isPending && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
                <Save className="mr-2 h-4 w-4" />
                Guardar cambios
              </Button>
            </form>
          </CardContent>
        </Card>

        <Card>
          <CardContent className="py-4 flex flex-col sm:flex-row sm:items-center justify-between gap-3">
            <div className="min-w-0">
              <p className="text-sm font-medium">Contraseña</p>
              <p className="text-xs text-muted-foreground mt-0.5">
                Cambia tu contraseña de acceso al portal
              </p>
            </div>
            <Link href="/portal/cambiar-contrasena" className="shrink-0">
              <Button variant="outline" size="sm" className="gap-2 w-full sm:w-auto">
                <KeyRound className="h-4 w-4" />
                Cambiar contraseña
              </Button>
            </Link>
          </CardContent>
        </Card>
      </div>
    </div>
  )
}
```

- [ ] **Step 2: Refactor PortalPerfilMainComponent.tsx a tabs**

Reemplazar TODO el contenido de `components/section-components/portal/perfil/PortalPerfilMainComponent.tsx` por:

```tsx
"use client"

import { useQuery } from "@tanstack/react-query"
import { Loader2 } from "lucide-react"
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs"
import { getMyProfile } from "@/lib/actions/portal"
import { DatosTab } from "./DatosTab"
import { MarcasTab } from "./MarcasTab"
import { PrivacidadTab } from "./PrivacidadTab"

export default function PortalPerfilMainComponent() {
  const { isLoading } = useQuery({
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

  return (
    <div className="space-y-5 sm:space-y-6">
      <div>
        <h1 className="text-xl sm:text-2xl font-bold">Mi Perfil</h1>
        <p className="text-muted-foreground text-xs sm:text-sm mt-0.5">
          Tus datos, marcas y configuración de privacidad
        </p>
      </div>

      <Tabs defaultValue="datos" className="space-y-5 sm:space-y-6">
        <TabsList className="w-full sm:w-auto">
          <TabsTrigger value="datos" className="flex-1 sm:flex-none">Datos</TabsTrigger>
          <TabsTrigger value="marcas" className="flex-1 sm:flex-none">Marcas</TabsTrigger>
          <TabsTrigger value="privacidad" className="flex-1 sm:flex-none">Privacidad</TabsTrigger>
        </TabsList>
        <TabsContent value="datos"><DatosTab /></TabsContent>
        <TabsContent value="marcas"><MarcasTab /></TabsContent>
        <TabsContent value="privacidad"><PrivacidadTab /></TabsContent>
      </Tabs>
    </div>
  )
}
```

- [ ] **Step 3: Verificar TypeScript**

Run: `npx tsc --noEmit --skipLibCheck`
Expected: sin errores.

- [ ] **Step 4: Probar en navegador**

`npm run dev`. Loguearse como un miembro y entrar a `/portal/perfil`. Verificar:
- Las 3 tabs aparecen y conmutan correctamente.
- "Datos" muestra el contenido de antes (avatar + form + cambiar contraseña).
- "Marcas" muestra los 4 totales arriba (todos en "—" si no hay PRs) y las 5 familias con sus movimientos.
- Click en un movimiento → modal abre, se puede guardar peso y fecha.
- Después de guardar → toast de éxito y el peso aparece en la lista.
- "Privacidad" muestra los 4 toggles, todos en ON por defecto. Toggle a OFF en master → los otros 3 quedan deshabilitados.

- [ ] **Step 5: Commit**

```bash
git add components/section-components/portal/perfil/DatosTab.tsx components/section-components/portal/perfil/PortalPerfilMainComponent.tsx
git commit -m "feat(rms): refactor Perfil a tabs (Datos/Marcas/Privacidad)

Co-Authored-By: Claude Opus 4.7 <noreply@anthropic.com>"
```

---

### Task 10: RankingStrip

**Files:**
- Create: `components/section-components/portal/descubrir/RankingStrip.tsx`

- [ ] **Step 1: Crear RankingStrip**

Crear `components/section-components/portal/descubrir/RankingStrip.tsx`:

```tsx
"use client"

import { useQuery } from "@tanstack/react-query"
import { Trophy, Loader2 } from "lucide-react"
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar"
import { Card, CardContent } from "@/components/ui/card"
import { cn } from "@/lib/utils"
import { getTopByCategory } from "@/lib/actions/records"

const POSITION_STYLES = [
  { ring: "ring-yellow-400", bg: "bg-yellow-400/10", label: "1°", scale: "scale-110" },
  { ring: "ring-slate-300",  bg: "bg-slate-300/10",  label: "2°", scale: "" },
  { ring: "ring-amber-700",  bg: "bg-amber-700/10",  label: "3°", scale: "" },
]

export function RankingStrip() {
  const { data: top = [], isLoading } = useQuery({
    queryKey: ["discover-top", "grand"],
    queryFn: () => getTopByCategory("grand"),
    staleTime: 5 * 60 * 1000,
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

  if (top.length === 0) return null

  return (
    <Card>
      <CardContent className="py-4 sm:py-5">
        <div className="flex items-center gap-2 mb-4">
          <Trophy className="h-4 w-4 text-primary" />
          <p className="text-xs sm:text-sm font-semibold uppercase tracking-wide">
            Top Grand Total
          </p>
        </div>
        <div className="grid grid-cols-3 gap-2 sm:gap-3">
          {top.map((entry, i) => {
            const styles = POSITION_STYLES[i] ?? POSITION_STYLES[2]
            const initials = entry.name
              .split(" ")
              .map((n) => n[0])
              .join("")
              .slice(0, 2)
              .toUpperCase()
            return (
              <div
                key={entry.member_id}
                className={cn(
                  "flex flex-col items-center gap-1.5 p-2 sm:p-3 rounded-lg",
                  styles.bg,
                )}
              >
                <Avatar
                  className={cn(
                    "h-12 w-12 sm:h-14 sm:w-14 ring-2 transition-transform",
                    styles.ring,
                    styles.scale,
                  )}
                >
                  <AvatarImage src={entry.avatar_url ?? undefined} />
                  <AvatarFallback className="bg-muted text-foreground text-xs font-bold">
                    {initials}
                  </AvatarFallback>
                </Avatar>
                <p className="text-[10px] uppercase font-bold text-muted-foreground">
                  {styles.label}
                </p>
                <p className="text-xs sm:text-sm font-medium text-center truncate max-w-full">
                  {entry.name}
                </p>
                <p className="text-sm sm:text-base font-bold tabular-nums">
                  {entry.total_kg.toLocaleString("es-VE")}
                  <span className="text-[10px] font-normal text-muted-foreground ml-0.5">kg</span>
                </p>
              </div>
            )
          })}
        </div>
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
git add components/section-components/portal/descubrir/RankingStrip.tsx
git commit -m "feat(discover): RankingStrip con podio de Top 3 Grand Total

Co-Authored-By: Claude Opus 4.7 <noreply@anthropic.com>"
```

---

### Task 11: MemberCard

**Files:**
- Create: `components/section-components/portal/descubrir/MemberCard.tsx`

- [ ] **Step 1: Crear MemberCard**

Crear `components/section-components/portal/descubrir/MemberCard.tsx`:

```tsx
"use client"

import { Trophy } from "lucide-react"
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar"
import { Badge } from "@/components/ui/badge"
import { Card, CardContent } from "@/components/ui/card"
import { getMovement, type MovementId } from "@/lib/constants/movements"
import type { DiscoverableMember } from "@/lib/actions/records"

interface MemberCardProps {
  member: DiscoverableMember
  onClick: () => void
}

export function MemberCard({ member, onClick }: MemberCardProps) {
  const initials = member.name
    .split(" ")
    .map((n) => n[0])
    .join("")
    .slice(0, 2)
    .toUpperCase()

  return (
    <Card
      onClick={onClick}
      className="cursor-pointer transition-colors hover:border-primary/40"
    >
      <CardContent className="py-4 sm:py-5 space-y-3">
        <div className="flex items-center gap-3">
          <Avatar className="h-12 w-12 sm:h-14 sm:w-14 shrink-0 border-2 border-primary/20">
            <AvatarImage src={member.avatar_url ?? undefined} />
            <AvatarFallback className="bg-primary/20 text-primary text-sm font-bold">
              {initials}
            </AvatarFallback>
          </Avatar>
          <div className="min-w-0 flex-1">
            <p className="font-semibold text-sm truncate">{member.name}</p>
            {member.plan_name && (
              <Badge variant="outline" className="mt-1 text-[10px]">
                {member.plan_name}
              </Badge>
            )}
          </div>
        </div>

        {member.totals && member.totals.grand > 0 && (
          <div className="flex items-center gap-2 px-2 py-1.5 rounded-md bg-primary/5">
            <Trophy className="h-3.5 w-3.5 text-primary shrink-0" />
            <span className="text-xs text-muted-foreground">Grand Total</span>
            <span className="ml-auto text-sm font-bold tabular-nums">
              {member.totals.grand.toLocaleString("es-VE")}
              <span className="text-[10px] font-normal text-muted-foreground ml-0.5">kg</span>
            </span>
          </div>
        )}

        {member.top_records.length > 0 ? (
          <ul className="space-y-1 pt-1">
            {member.top_records.map((r) => (
              <li
                key={r.movement}
                className="flex items-center justify-between gap-2 text-xs"
              >
                <span className="text-muted-foreground truncate">
                  {getMovement(r.movement as MovementId).label}
                </span>
                <span className="font-semibold tabular-nums shrink-0">
                  {r.weight_kg.toLocaleString("es-VE")} kg
                </span>
              </li>
            ))}
          </ul>
        ) : (
          <p className="text-xs text-muted-foreground italic pt-1">
            {member.totals === null ? "Marcas privadas" : "Sin marcas registradas"}
          </p>
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
git add components/section-components/portal/descubrir/MemberCard.tsx
git commit -m "feat(discover): MemberCard con avatar, plan, total y top 3 PRs

Co-Authored-By: Claude Opus 4.7 <noreply@anthropic.com>"
```

---

### Task 12: MemberDetailModal

**Files:**
- Create: `components/section-components/portal/descubrir/MemberDetailModal.tsx`

- [ ] **Step 1: Crear MemberDetailModal**

Crear `components/section-components/portal/descubrir/MemberDetailModal.tsx`:

```tsx
"use client"

import { useQuery } from "@tanstack/react-query"
import { format } from "date-fns"
import { es } from "date-fns/locale"
import { Loader2, CalendarDays } from "lucide-react"
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar"
import { Badge } from "@/components/ui/badge"
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog"
import { getMemberPublicProfile } from "@/lib/actions/records"
import {
  FAMILY_LABEL,
  FAMILY_ORDER,
  getMovementsByFamily,
} from "@/lib/constants/movements"
import { TotalsStrip } from "../perfil/totals-strip"

interface MemberDetailModalProps {
  memberId: string | null
  onClose: () => void
}

export function MemberDetailModal({ memberId, onClose }: MemberDetailModalProps) {
  const open = memberId !== null

  const { data: profile, isLoading } = useQuery({
    queryKey: ["member-public", memberId],
    queryFn: () => getMemberPublicProfile(memberId as string),
    enabled: open,
    staleTime: 5 * 60 * 1000,
  })

  const initials = profile?.name
    ? profile.name.split(" ").map((n: string) => n[0]).join("").slice(0, 2).toUpperCase()
    : "?"

  const recordsByMovement = (() => {
    if (!profile) return {}
    const map: Record<string, number> = {}
    for (const r of profile.records) map[r.movement] = Number(r.weight_kg)
    return map
  })()

  return (
    <Dialog open={open} onOpenChange={(o) => !o && onClose()}>
      <DialogContent className="sm:max-w-2xl max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle className="sr-only">Perfil del miembro</DialogTitle>
        </DialogHeader>

        {isLoading || !profile ? (
          <div className="flex justify-center py-12">
            <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" />
          </div>
        ) : (
          <div className="space-y-5">
            <div className="flex items-start gap-4">
              <Avatar className="h-16 w-16 sm:h-20 sm:w-20 shrink-0 border-2 border-primary/30">
                <AvatarImage src={profile.avatar_url ?? undefined} />
                <AvatarFallback className="bg-primary/20 text-primary text-lg font-bold">
                  {initials}
                </AvatarFallback>
              </Avatar>
              <div className="min-w-0 flex-1">
                <h2 className="text-lg sm:text-xl font-bold truncate">{profile.name}</h2>
                <div className="flex flex-wrap gap-2 mt-2">
                  {profile.plan_name && (
                    <Badge variant="outline" className="text-[11px]">
                      {profile.plan_name}
                    </Badge>
                  )}
                  {profile.start_date && (
                    <Badge variant="outline" className="text-[11px] gap-1">
                      <CalendarDays className="h-3 w-3" />
                      Desde {format(new Date(profile.start_date + "T00:00:00"), "MMM yyyy", { locale: es })}
                    </Badge>
                  )}
                </div>
              </div>
            </div>

            {profile.totals === null ? (
              <p className="text-sm text-muted-foreground text-center py-6">
                Este miembro optó por no mostrar sus marcas.
              </p>
            ) : (
              <>
                <TotalsStrip totals={profile.totals} />

                <div className="space-y-3">
                  {FAMILY_ORDER.map((family) => {
                    const movements = getMovementsByFamily(family)
                    if (movements.length === 0) return null
                    return (
                      <div key={family} className="border rounded-lg p-3 sm:p-4">
                        <h3 className="text-xs font-semibold uppercase tracking-wide text-muted-foreground mb-2">
                          {FAMILY_LABEL[family]}
                        </h3>
                        <ul className="space-y-1.5">
                          {movements.map((m) => {
                            const w = recordsByMovement[m.id]
                            return (
                              <li
                                key={m.id}
                                className="flex items-center justify-between gap-3 text-sm"
                              >
                                <span className="truncate">{m.label}</span>
                                <span className="font-semibold tabular-nums shrink-0">
                                  {w !== undefined && w > 0
                                    ? `${w.toLocaleString("es-VE")} kg`
                                    : "—"}
                                </span>
                              </li>
                            )
                          })}
                        </ul>
                      </div>
                    )
                  })}
                </div>
              </>
            )}
          </div>
        )}
      </DialogContent>
    </Dialog>
  )
}
```

- [ ] **Step 2: Verificar TypeScript**

Run: `npx tsc --noEmit --skipLibCheck`
Expected: sin errores.

- [ ] **Step 3: Commit**

```bash
git add components/section-components/portal/descubrir/MemberDetailModal.tsx
git commit -m "feat(discover): MemberDetailModal con totales y RMs por familia

Co-Authored-By: Claude Opus 4.7 <noreply@anthropic.com>"
```

---

### Task 13: PortalDescubrirMainComponent + página

**Files:**
- Create: `app/portal/descubrir/page.tsx`
- Create: `components/section-components/portal/descubrir/PortalDescubrirMainComponent.tsx`

- [ ] **Step 1: Crear la ruta**

Crear `app/portal/descubrir/page.tsx`:

```tsx
import PortalDescubrirMainComponent from "@/components/section-components/portal/descubrir/PortalDescubrirMainComponent"

export default function Page() {
  return <PortalDescubrirMainComponent />
}
```

- [ ] **Step 2: Crear el componente principal**

Crear `components/section-components/portal/descubrir/PortalDescubrirMainComponent.tsx`:

```tsx
"use client"

import { useMemo, useState } from "react"
import { useQuery } from "@tanstack/react-query"
import { Loader2, Search, Users } from "lucide-react"
import { Input } from "@/components/ui/input"
import { Card, CardContent } from "@/components/ui/card"
import { getDiscoverableMembers } from "@/lib/actions/records"
import { RankingStrip } from "./RankingStrip"
import { MemberCard } from "./MemberCard"
import { MemberDetailModal } from "./MemberDetailModal"

export default function PortalDescubrirMainComponent() {
  const [search, setSearch] = useState("")
  const [selectedMemberId, setSelectedMemberId] = useState<string | null>(null)

  const { data: members = [], isLoading } = useQuery({
    queryKey: ["discoverable-members"],
    queryFn: () => getDiscoverableMembers(),
    staleTime: 60 * 1000,
  })

  const filtered = useMemo(() => {
    if (!search.trim()) return members
    const q = search.trim().toLowerCase()
    return members.filter((m) => m.name.toLowerCase().includes(q))
  }, [members, search])

  if (isLoading) {
    return (
      <div className="flex justify-center py-20">
        <Loader2 className="h-8 w-8 animate-spin text-muted-foreground" />
      </div>
    )
  }

  return (
    <div className="space-y-5 sm:space-y-6">
      <div>
        <h1 className="text-xl sm:text-2xl font-bold">Descubrir</h1>
        <p className="text-muted-foreground text-xs sm:text-sm mt-0.5">
          Conoce a la comunidad de Madbox
        </p>
      </div>

      <RankingStrip />

      <div className="relative">
        <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
        <Input
          type="search"
          placeholder="Buscar miembro..."
          value={search}
          onChange={(e) => setSearch(e.target.value)}
          className="pl-9"
        />
      </div>

      {filtered.length === 0 ? (
        <Card>
          <CardContent className="py-12 flex flex-col items-center gap-3 text-center">
            <div className="flex h-12 w-12 items-center justify-center rounded-full bg-muted">
              <Users className="h-6 w-6 text-muted-foreground" />
            </div>
            <p className="text-sm text-muted-foreground">
              {search.trim()
                ? "No se encontraron miembros con ese nombre."
                : "Aún no hay miembros visibles en Descubrir."}
            </p>
          </CardContent>
        </Card>
      ) : (
        <div className="space-y-2">
          <p className="text-xs text-muted-foreground">
            Comunidad ({filtered.length} {filtered.length === 1 ? "miembro" : "miembros"})
          </p>
          <div className="grid gap-3 sm:gap-4 sm:grid-cols-2 lg:grid-cols-3">
            {filtered.map((m) => (
              <MemberCard
                key={m.id}
                member={m}
                onClick={() => setSelectedMemberId(m.id)}
              />
            ))}
          </div>
        </div>
      )}

      <MemberDetailModal
        memberId={selectedMemberId}
        onClose={() => setSelectedMemberId(null)}
      />
    </div>
  )
}
```

- [ ] **Step 3: Verificar TypeScript**

Run: `npx tsc --noEmit --skipLibCheck`
Expected: sin errores.

- [ ] **Step 4: Commit**

```bash
git add app/portal/descubrir/page.tsx components/section-components/portal/descubrir/PortalDescubrirMainComponent.tsx
git commit -m "feat(discover): página Descubrir con grid, búsqueda y modal

Co-Authored-By: Claude Opus 4.7 <noreply@anthropic.com>"
```

---

### Task 14: Agregar "Descubrir" al nav del portal

**Files:**
- Modify: `app/portal/layout.tsx`

- [ ] **Step 1: Agregar el ítem al nav**

Editar `app/portal/layout.tsx`. Modificar el import de `lucide-react` para incluir `Compass`:

```tsx
import { Home, Calendar, CreditCard, User, LogOut, Menu, X, Compass } from "lucide-react"
```

Y dentro del array `nav`, agregar `Descubrir` entre `Inicio` y `Clases`:

```tsx
const nav = [
  { name: "Inicio", href: "/portal", icon: Home },
  { name: "Descubrir", href: "/portal/descubrir", icon: Compass },
  { name: "Clases", href: "/portal/clases", icon: Calendar },
  { name: "Pagos", href: "/portal/pagos", icon: CreditCard },
  { name: "Perfil", href: "/portal/perfil", icon: User },
]
```

- [ ] **Step 2: Verificar TypeScript**

Run: `npx tsc --noEmit --skipLibCheck`
Expected: sin errores.

- [ ] **Step 3: Probar en navegador**

`npm run dev`. Loguearse como un miembro:
- El bottom nav (mobile) tiene 5 ítems con "Descubrir" entre "Inicio" y "Clases".
- El top nav (desktop) tiene los mismos 5 ítems con el ícono Compass.
- Click en "Descubrir" → carga `/portal/descubrir` y muestra los miembros (incluyéndome a mí, si soy `discoverable`).
- Crear un PR de Snatch desde Mi Perfil → Marcas. Verificar que aparece en mi card en Descubrir.
- Click en una card de otro miembro → modal con detalle.
- Buscar por nombre → filtra correctamente.
- Si soy el único: Top 1 muestra solo 1 podio.

- [ ] **Step 4: Commit**

```bash
git add app/portal/layout.tsx
git commit -m "feat(discover): agregar Descubrir al nav del portal

Co-Authored-By: Claude Opus 4.7 <noreply@anthropic.com>"
```

---

### Task 15: QA manual end-to-end

**Files:** ninguno; solo testing.

- [ ] **Step 1: Build limpio**

Run: `npm run build`
Expected: build exitoso sin errores ni warnings nuevos.

- [ ] **Step 2: Casos de RMs**

Con `npm run dev` activo, loguearse como un miembro:

- [ ] Mi Perfil → Tab "Marcas". Los 4 totales arriba marcan en "—".
- [ ] Click en Snatch → modal con los inputs. Guardar 80kg con fecha de hoy → toast OK, lista refleja "80 kg" + fecha.
- [ ] Click en Snatch otra vez → modal abre con valores pre-cargados. Cambiar a 85kg → guardar → toast OK, lista refleja 85 kg.
- [ ] Click en Snatch otra vez → click "Borrar PR" → toast OK, vuelve a "—".
- [ ] Llenar Back Squat (140), Front Squat (120), OHS (50). Squat Total muestra 310 kg.
- [ ] Llenar Snatch (80) + Clean & Jerk (100). Olympic Total muestra 180 kg.
- [ ] Llenar Push Press (90), Push Jerk (95), Split Jerk (100). Press Total muestra 285 kg.
- [ ] Grand Total = suma de todo lo registrado.
- [ ] Validación: intentar guardar 0 kg o > 500 kg → muestra error de Zod.
- [ ] Validación: intentar fecha futura → no se permite (max attribute en input bloquea).

- [ ] **Step 3: Casos de Privacidad**

- [ ] Mi Perfil → Tab "Privacidad". Los 4 toggles están en ON.
- [ ] Toggle "Mostrar mis RMs" a OFF. Refresh `/portal/descubrir`. Mi card aparece pero sin la sección de RMs (texto "Marcas privadas"). Mi avatar no está en el podio del ranking.
- [ ] Toggle "Mostrar avatar" a OFF. En Descubrir mi card muestra iniciales en vez de foto.
- [ ] Toggle "Mostrar plan" a OFF. En Descubrir mi card no muestra el badge de plan.
- [ ] Toggle "Aparecer en Descubrir" a OFF. Refresh `/portal/descubrir` desde otra cuenta o invisible. No aparezco en la grilla. Los otros 3 toggles quedan visualmente disabled.
- [ ] Volver master a ON → los otros 3 toggles vuelven a su estado previo.

- [ ] **Step 4: Casos de Discover**

- [ ] Loguearse como otro miembro. Ir a `/portal/descubrir`. Ver lista con todos los miembros `discoverable=true`.
- [ ] Buscar un nombre parcial → filtro funciona.
- [ ] Click en una card → modal con detalle. Solo se ven datos públicos (nada de email/teléfono).
- [ ] Si el miembro tiene `show_rms=false`: el modal muestra mensaje "Este miembro optó por no mostrar sus marcas".
- [ ] Si nadie tiene PRs: el ranking no aparece o aparece con menos de 3 podios.
- [ ] Verificar en DB (Supabase Studio) que los `personal_records` no tienen email/phone leakeado al cliente — solo lo que devuelven los server actions.

- [ ] **Step 5: Casos de borde**

- [ ] Miembro nuevo (sin PRs): tab Marcas vacío, totales en "—". Aparece en Descubrir con "Sin marcas registradas".
- [ ] Cancelar el modal de edición sin guardar → no cambia nada.
- [ ] Bottom nav: con 5 ítems, los íconos cabrán bien.
- [ ] Mobile: tab Marcas es scrolleable, el modal de detalle hace scroll dentro del Dialog.
- [ ] Todos los toasts se ven en español.

- [ ] **Step 6: Final commit (si hubo fixes)**

Si encontraste bugs durante QA:
```bash
git add -p
git commit -m "fix(rms): correcciones del QA manual

Co-Authored-By: Claude Opus 4.7 <noreply@anthropic.com>"
```

---

## Resumen de tasks

| # | Task | Files | Output |
|---|---|---|---|
| 1 | Migración + types + activity | 3 | DB lista, types regenerados |
| 2 | Constantes movimientos | 1 | Lista de 17 + helpers |
| 3 | Server actions own + visibility | 1 | API propia |
| 4 | Server actions Discover | 1 | API cross-member |
| 5 | EditRecordModal | 1 | Modal de edición |
| 6 | TotalsStrip | 1 | 4 totales en cards |
| 7 | MarcasTab | 1 | Pestaña Marcas |
| 8 | PrivacidadTab | 1 | Pestaña Privacidad |
| 9 | DatosTab + tabs perfil | 2 | Perfil con 3 tabs |
| 10 | RankingStrip | 1 | Podio Top 3 |
| 11 | MemberCard | 1 | Card en grid |
| 12 | MemberDetailModal | 1 | Modal de detalle |
| 13 | PortalDescubrirMainComponent + page | 2 | Sección Descubrir |
| 14 | Agregar Descubrir al nav | 1 | Nav del portal con 5 ítems |
| 15 | QA manual | 0 | Verificación |
