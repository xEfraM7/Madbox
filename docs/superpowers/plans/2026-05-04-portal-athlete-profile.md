# Perfil de atleta + Descubrir por género + Ficha compartible — Plan de Implementación

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Añadir campos de atleta (género, fecha de nacimiento, peso, altura, atleta desde, nivel, frase) al perfil del miembro, separar Descubrir por género con tabs y rankings divididos, y permitir generar/compartir una ficha PNG 9:16 con branding Madbox para redes sociales.

**Architecture:** Migración Postgres añade 8 columnas a `members`; `gender` y `quote` son siempre públicos cuando están llenos, mientras que edad/peso/altura/nivel/atleta_desde se gobiernan con un toggle `show_body_metrics`. Server actions en `lib/actions/portal.ts` y `lib/actions/records.ts` se extienden para devolver y filtrar estos datos. Descubrir gana tabs Hombres/Mujeres con ranking dividido. La ficha PNG se genera client-side con `html-to-image` capturando un componente `AthleteCard` de 1080×1920 montado fuera de pantalla, y se comparte vía Web Share API o se descarga.

**Tech Stack:** Next.js 16 (App Router, Server Actions), React 19, TypeScript estricto, Supabase (Postgres + RLS + admin client), TanStack Query 5, shadcn/ui (Tabs, Dialog, Switch, Card, RadioGroup, Select), React Hook Form + Zod, Tailwind CSS 4, Sonner, lucide-react, **html-to-image (nuevo)**.

**Spec:** [docs/superpowers/specs/2026-05-04-portal-athlete-profile-design.md](../specs/2026-05-04-portal-athlete-profile-design.md)

**Convenciones del proyecto (recordatorio):**
- Server actions con `"use server"` arriba; UI nunca toca Supabase desde el cliente.
- `revalidatePath` después de cada mutación que aplique.
- Errores de Supabase con `throw error` para que TanStack Query los capture.
- TanStack Query para state del servidor en cliente; invalidar queries en `onSuccess`.
- Idioma español en UI; commits en español, sin emojis.
- Modo oscuro fijo. Primary yellow sobre fondo negro.
- Verificación con `npx tsc --noEmit --skipLibCheck` + smoke test manual en navegador (no hay tests automatizados).
- Solo commiteamos código que compila sin errores.

---

## Estructura de archivos

**Crear:**
- `supabase/migrations/20260504120000_athlete_profile_setup.sql`
- `lib/constants/athlete.ts` (labels, opciones de gender/level)
- `components/section-components/portal/perfil/AthleteProfileForm.tsx` (form de la nueva card "Perfil de atleta")
- `components/section-components/portal/perfil/AthleteCard.tsx` (template visual 1080×1920 para la PNG)
- `components/section-components/portal/perfil/ShareAthleteButton.tsx` (botón + lógica de captura/share)
- `lib/hooks/use-share-athlete-card.ts` (hook que orquesta render → captura → share)
- `components/section-components/portal/home/CompletarPerfilBanner.tsx` (banner home si falta género)

**Modificar:**
- `types/database.ts` (regenerado tras la migración)
- `lib/utils.ts` (añadir helper `calculateAge`)
- `lib/actions/portal.ts` (extender `updateMyProfile`, añadir `getMyAthleteCardData`)
- `lib/actions/records.ts` (extender `VisibilitySettings`, `getDiscoverableMembers`, `getTopByCategory`, `getMemberPublicProfile`)
- `components/section-components/portal/perfil/DatosTab.tsx` (incrustar `AthleteProfileForm` y `ShareAthleteButton`)
- `components/section-components/portal/perfil/PrivacidadTab.tsx` (toggle `show_body_metrics`)
- `components/section-components/portal/descubrir/PortalDescubrirMainComponent.tsx` (Tabs Hombres/Mujeres)
- `components/section-components/portal/descubrir/RankingStrip.tsx` (acepta prop `gender`)
- `components/section-components/portal/descubrir/MemberCard.tsx` (ring de color por género)
- `components/section-components/portal/descubrir/MemberDetailModal.tsx` (sección "Datos del atleta")
- `components/section-components/portal/home/PortalHomeMainComponent.tsx` (incrusta `CompletarPerfilBanner`)
- `package.json` + `package-lock.json` (instalar `html-to-image`)

---

### Task 1: Migración DB + regenerar types

**Files:**
- Create: `supabase/migrations/20260504120000_athlete_profile_setup.sql`
- Modify: `types/database.ts`

- [ ] **Step 1: Crear el archivo de migración**

Crear `supabase/migrations/20260504120000_athlete_profile_setup.sql` con este contenido exacto:

```sql
-- Perfil de atleta: género, datos físicos, nivel, frase y toggle de privacidad

ALTER TABLE public.members
  ADD COLUMN IF NOT EXISTS gender text CHECK (gender IN ('male','female')),
  ADD COLUMN IF NOT EXISTS birth_date date,
  ADD COLUMN IF NOT EXISTS weight_kg numeric(5,2),
  ADD COLUMN IF NOT EXISTS height_cm numeric(5,1),
  ADD COLUMN IF NOT EXISTS athlete_since date,
  ADD COLUMN IF NOT EXISTS athlete_level text CHECK (athlete_level IN ('rx','scaled','beginner')),
  ADD COLUMN IF NOT EXISTS quote text,
  ADD COLUMN IF NOT EXISTS show_body_metrics boolean DEFAULT false NOT NULL;

-- Index para tab de género (Descubrir filtra por gender + discoverable)
CREATE INDEX IF NOT EXISTS members_gender_discoverable_idx
  ON public.members(gender, discoverable)
  WHERE discoverable = true AND gender IS NOT NULL;
```

- [ ] **Step 2: Aplicar la migración**

Aplicar usando el flujo habitual del proyecto. Hay 2 opciones según cómo se gestione Supabase localmente:

**Opción A (Supabase MCP):** Pasar el contenido SQL del Step 1 al tool `mcp__supabase__apply_migration` con `name: "athlete_profile_setup"`.

**Opción B (Supabase CLI):** Si el proyecto está linkeado:
```bash
npx supabase db push
```

Verificar que la migración se aplicó sin errores.

- [ ] **Step 3: Regenerar tipos**

```bash
npx supabase gen types typescript --linked > types/database.ts
```

(Si el proyecto usa `--project-id` en lugar de `--linked`, ajustar al patrón existente.)

- [ ] **Step 4: Verificar tipos**

Abrir `types/database.ts` y confirmar que `Tables<"members">` ahora incluye:
- `gender: string | null`
- `birth_date: string | null`
- `weight_kg: number | null`
- `height_cm: number | null`
- `athlete_since: string | null`
- `athlete_level: string | null`
- `quote: string | null`
- `show_body_metrics: boolean`

Correr typecheck:
```bash
npx tsc --noEmit --skipLibCheck
```

Esperado: PASS (sin errores nuevos; los archivos que aún no se modificaron siguen funcionando porque las columnas son nullable).

- [ ] **Step 5: Commit**

```bash
git add supabase/migrations/20260504120000_athlete_profile_setup.sql types/database.ts
git commit -m "feat(perfil): migración de campos de atleta y regen tipos"
```

---

### Task 2: Helpers y constantes

**Files:**
- Modify: `lib/utils.ts`
- Create: `lib/constants/athlete.ts`

- [ ] **Step 1: Añadir `calculateAge` en `lib/utils.ts`**

Abrir `lib/utils.ts` y añadir al final del archivo:

```ts
import { differenceInYears } from "date-fns"

/**
 * Calcula edad en años redondeados desde una fecha de nacimiento (string ISO YYYY-MM-DD).
 * Devuelve null si la fecha es inválida o futura.
 */
export function calculateAge(birthDate: string | null | undefined): number | null {
  if (!birthDate) return null
  const date = new Date(birthDate + "T00:00:00")
  if (Number.isNaN(date.getTime())) return null
  const years = differenceInYears(new Date(), date)
  if (years < 0 || years > 120) return null
  return years
}
```

(Si `lib/utils.ts` ya importa `date-fns`, no duplicar el import; añadir `differenceInYears` al import existente.)

- [ ] **Step 2: Crear `lib/constants/athlete.ts`**

```ts
export type Gender = "male" | "female"
export type AthleteLevel = "rx" | "scaled" | "beginner"

export const GENDER_LABEL: Record<Gender, string> = {
  male: "Hombre",
  female: "Mujer",
}

export const GENDER_OPTIONS: Array<{ value: Gender; label: string }> = [
  { value: "male", label: "Hombre" },
  { value: "female", label: "Mujer" },
]

export const ATHLETE_LEVEL_LABEL: Record<AthleteLevel, string> = {
  rx: "Rx",
  scaled: "Scaled",
  beginner: "Principiante",
}

export const ATHLETE_LEVEL_OPTIONS: Array<{ value: AthleteLevel; label: string }> = [
  { value: "rx", label: "Rx" },
  { value: "scaled", label: "Scaled" },
  { value: "beginner", label: "Principiante" },
]

export function isGender(v: unknown): v is Gender {
  return v === "male" || v === "female"
}

export function isAthleteLevel(v: unknown): v is AthleteLevel {
  return v === "rx" || v === "scaled" || v === "beginner"
}
```

- [ ] **Step 3: Verificar typecheck**

```bash
npx tsc --noEmit --skipLibCheck
```

Esperado: PASS.

- [ ] **Step 4: Commit**

```bash
git add lib/utils.ts lib/constants/athlete.ts
git commit -m "feat(perfil): helper calculateAge y constantes de género/nivel"
```

---

### Task 3: Server action — extender `updateMyProfile` y privacidad

**Files:**
- Modify: `lib/actions/portal.ts`
- Modify: `lib/actions/records.ts`

- [ ] **Step 1: Extender `updateMyProfile` en `lib/actions/portal.ts`**

Reemplazar la función `updateMyProfile` por esta versión (mantener todo lo demás del archivo intacto):

```ts
import { z } from "zod"
import type { Gender, AthleteLevel } from "@/lib/constants/athlete"

const profileUpdateSchema = z.object({
  name: z.string().min(2).max(100).optional(),
  phone: z.string().max(40).optional(),
  email: z.string().email().optional(),
  gender: z.enum(["male", "female"]).nullable().optional(),
  birth_date: z
    .string()
    .regex(/^\d{4}-\d{2}-\d{2}$/, "Fecha inválida")
    .nullable()
    .optional()
    .refine((v) => {
      if (!v) return true
      const d = new Date(v + "T00:00:00")
      const year = d.getFullYear()
      return year >= 1940 && d.getTime() <= Date.now()
    }, "Fecha fuera de rango"),
  weight_kg: z.number().min(30).max(250).nullable().optional(),
  height_cm: z.number().int().min(100).max(220).nullable().optional(),
  athlete_since: z
    .string()
    .regex(/^\d{4}-\d{2}-\d{2}$/, "Fecha inválida")
    .nullable()
    .optional()
    .refine((v) => {
      if (!v) return true
      const d = new Date(v + "T00:00:00")
      return d.getFullYear() >= 2010 && d.getTime() <= Date.now()
    }, "Fecha fuera de rango"),
  athlete_level: z.enum(["rx", "scaled", "beginner"]).nullable().optional(),
  quote: z
    .string()
    .max(120)
    .transform((s) => s.replace(/<[^>]*>/g, "").trim())
    .nullable()
    .optional(),
})

export type ProfileUpdateInput = z.infer<typeof profileUpdateSchema>

export async function updateMyProfile(data: ProfileUpdateInput) {
  const parsed = profileUpdateSchema.parse(data)
  const { member, user, supabase } = await getCurrentMember()

  const allowed: Record<string, unknown> = {
    updated_at: new Date().toISOString(),
  }
  if (parsed.name !== undefined) allowed.name = parsed.name
  if (parsed.phone !== undefined) allowed.phone = parsed.phone
  if (parsed.email !== undefined) allowed.email = parsed.email
  if (parsed.gender !== undefined) allowed.gender = parsed.gender
  if (parsed.birth_date !== undefined) allowed.birth_date = parsed.birth_date
  if (parsed.weight_kg !== undefined) allowed.weight_kg = parsed.weight_kg
  if (parsed.height_cm !== undefined) allowed.height_cm = parsed.height_cm
  if (parsed.athlete_since !== undefined) allowed.athlete_since = parsed.athlete_since
  if (parsed.athlete_level !== undefined) allowed.athlete_level = parsed.athlete_level
  if (parsed.quote !== undefined) allowed.quote = parsed.quote

  const { error } = await supabase
    .from("members")
    .update(allowed)
    .eq("id", member.id)

  if (error) throw error

  if (parsed.email && parsed.email !== user.email) {
    await supabase.auth.updateUser({ email: parsed.email })
  }

  revalidatePath("/portal/perfil")
  revalidatePath("/portal")
  revalidatePath("/portal/descubrir")
}
```

Y añadir los imports al tope del archivo si faltan:

```ts
import { z } from "zod"
```

(`Gender` y `AthleteLevel` solo se usan en el tipo derivado, no hace falta importarlos directamente — el `z.enum` ya los infiere.)

- [ ] **Step 2: Extender `VisibilitySettings` en `lib/actions/records.ts`**

Localizar el bloque `// ─── Visibilidad ─` y reemplazar:

```ts
export interface VisibilitySettings {
  discoverable: boolean
  show_plan: boolean
  show_avatar: boolean
  show_rms: boolean
  show_wods: boolean
  show_body_metrics: boolean
}

export async function getMyVisibility(): Promise<VisibilitySettings> {
  const supabase = await createClient()
  const memberId = await getMyMemberId()

  const { data, error } = await supabase
    .from("members")
    .select("discoverable, show_plan, show_avatar, show_rms, show_wods, show_body_metrics")
    .eq("id", memberId)
    .single()

  if (error) throw error
  return {
    discoverable: data.discoverable ?? true,
    show_plan: data.show_plan ?? true,
    show_avatar: data.show_avatar ?? true,
    show_rms: data.show_rms ?? true,
    show_wods: data.show_wods ?? true,
    show_body_metrics: data.show_body_metrics ?? false,
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

- [ ] **Step 3: Typecheck**

```bash
npx tsc --noEmit --skipLibCheck
```

Esperado: PASS.

- [ ] **Step 4: Smoke test manual (Network tab)**

Arrancar dev server: `npm run dev`. Loguearse como un miembro de prueba en `/portal`. Abrir DevTools → Network. Ir a `/portal/perfil` y abrir la pestaña Privacidad. Toggle cualquier switch. Confirmar que la request se completa sin errores 500. Aún no veremos el toggle nuevo; eso viene en Task 7.

- [ ] **Step 5: Commit**

```bash
git add lib/actions/portal.ts lib/actions/records.ts
git commit -m "feat(perfil): extender server actions con campos de atleta y show_body_metrics"
```

---

### Task 4: Server actions de Descubrir filtradas por género

**Files:**
- Modify: `lib/actions/records.ts`

- [ ] **Step 1: Modificar `getDiscoverableMembers` para aceptar `gender`**

Localizar la función existente y reemplazarla por:

```ts
export async function getDiscoverableMembers(
  options: { gender: "male" | "female"; search?: string },
): Promise<DiscoverableMember[]> {
  await ensureAuthenticated()

  const admin = createAdminClient()

  let query = admin
    .from("members")
    .select("id, name, avatar_url, plan_id, start_date, gender, discoverable, show_plan, show_avatar, show_rms, plans(name)")
    .eq("discoverable", true)
    .eq("gender", options.gender)
    .order("name", { ascending: true })

  if (options.search && options.search.trim().length > 0) {
    query = query.ilike("name", `%${options.search.trim()}%`)
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
```

Asegurarse de que la interface `MemberRow` (más arriba en el archivo) incluya `gender: string | null`. Si no la incluye, añadir el campo:

```ts
interface MemberRow {
  id: string
  name: string
  avatar_url: string | null
  plan_id: string | null
  start_date: string | null
  gender: string | null
  discoverable: boolean
  show_plan: boolean
  show_avatar: boolean
  show_rms: boolean
  plans: { name: string } | null
}
```

- [ ] **Step 2: Modificar `getTopByCategory` para aceptar `gender`**

Reemplazar la función existente por:

```ts
export async function getTopByCategory(
  category: "grand" | "olympic" | "squat" | "press",
  gender: "male" | "female",
): Promise<RankingEntry[]> {
  await ensureAuthenticated()

  const admin = createAdminClient()

  const { data: members, error } = await admin
    .from("members")
    .select("id, name, avatar_url, discoverable, show_rms, show_avatar, gender")
    .eq("discoverable", true)
    .eq("show_rms", true)
    .eq("gender", gender)

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

- [ ] **Step 3: Modificar `getMemberPublicProfile` para devolver datos de atleta**

Primero, extender la interface `MemberPublicProfile`:

```ts
export interface MemberPublicProfile extends DiscoverableMember {
  start_date: string | null
  records: PersonalRecord[]
  gender: "male" | "female" | null
  quote: string | null
  // Solo si show_body_metrics = true:
  age: number | null
  weight_kg: number | null
  height_cm: number | null
  athlete_since_year: number | null
  athlete_level: "rx" | "scaled" | "beginner" | null
}
```

Luego reemplazar la función `getMemberPublicProfile` por:

```ts
export async function getMemberPublicProfile(memberId: string): Promise<MemberPublicProfile> {
  await ensureAuthenticated()

  const admin = createAdminClient()

  const { data: member, error } = await admin
    .from("members")
    .select(
      "id, name, avatar_url, plan_id, start_date, gender, quote, " +
      "birth_date, weight_kg, height_cm, athlete_since, athlete_level, " +
      "discoverable, show_plan, show_avatar, show_rms, show_body_metrics, plans(name)",
    )
    .eq("id", memberId)
    .maybeSingle()

  if (error) throw error
  if (!member || !member.discoverable) {
    throw new Error("Miembro no encontrado")
  }

  type FullRow = MemberRow & {
    quote: string | null
    birth_date: string | null
    weight_kg: number | null
    height_cm: number | null
    athlete_since: string | null
    athlete_level: string | null
    show_body_metrics: boolean
  }
  const m = member as unknown as FullRow

  const { data: records, error: recError } = await admin
    .from("personal_records")
    .select("id, movement, weight_kg, achieved_at, updated_at")
    .eq("member_id", memberId)
    .order("movement")

  if (recError) throw recError

  const recList: PersonalRecord[] = m.show_rms ? ((records ?? []) as PersonalRecord[]) : []

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

  // Cálculo de edad solo si datos físicos son públicos
  const age = m.show_body_metrics && m.birth_date
    ? (() => {
        const d = new Date(m.birth_date + "T00:00:00")
        if (Number.isNaN(d.getTime())) return null
        const years = Math.floor((Date.now() - d.getTime()) / (1000 * 60 * 60 * 24 * 365.25))
        return years >= 0 && years <= 120 ? years : null
      })()
    : null

  const athlete_since_year = m.show_body_metrics && m.athlete_since
    ? new Date(m.athlete_since + "T00:00:00").getFullYear()
    : null

  return {
    id: m.id,
    name: m.name,
    avatar_url: m.show_avatar ? m.avatar_url : null,
    plan_name: m.show_plan && m.plans ? m.plans.name : null,
    start_date: m.start_date,
    gender: (m.gender as "male" | "female" | null) ?? null,
    quote: m.quote && m.quote.trim().length > 0 ? m.quote : null,
    age,
    weight_kg: m.show_body_metrics ? m.weight_kg : null,
    height_cm: m.show_body_metrics ? m.height_cm : null,
    athlete_since_year,
    athlete_level: m.show_body_metrics ? (m.athlete_level as "rx" | "scaled" | "beginner" | null) : null,
    totals,
    top_records: topRecords,
    records: recList,
  }
}
```

- [ ] **Step 4: Typecheck**

```bash
npx tsc --noEmit --skipLibCheck
```

Esperado: errores en los lugares donde se llama a la API vieja (Descubrir y RankingStrip pasan a los siguientes tasks). Si hay errores, anotarlos pero continuar — los Tasks 8 y 9 los resuelven.

Si hay errores en archivos que **no** están en nuestra lista de modificados (ej. `lib/actions/`), revisar.

- [ ] **Step 5: Commit**

```bash
git add lib/actions/records.ts
git commit -m "feat(descubrir): server actions filtradas por género y perfil público con datos atleta"
```

---

### Task 5: Toggle de privacidad `show_body_metrics`

**Files:**
- Modify: `components/section-components/portal/perfil/PrivacidadTab.tsx`

- [ ] **Step 1: Añadir el toggle entre `show_rms` y `show_wods`**

Localizar el array `TOGGLES` y añadir la entrada nueva entre `show_rms` y `show_wods`:

```ts
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
  {
    key: "show_body_metrics",
    title: "Mostrar datos físicos",
    desc: "Otros verán tu edad, peso, altura, nivel y desde cuándo entrenas. Tu fecha de nacimiento exacta nunca se muestra.",
  },
  {
    key: "show_wods",
    title: "Mostrar mis WODs",
    desc: "Tus registros de WOD aparecerán en leaderboards y en tu perfil público.",
  },
]
```

- [ ] **Step 2: Smoke test**

Arrancar dev server, ir a `/portal/perfil` → pestaña Privacidad. Verificar:
- Aparecen 6 toggles (discoverable, avatar, plan, RMs, datos físicos, WODs).
- Toggle "Mostrar datos físicos" arranca apagado por default.
- Encenderlo → toast "Privacidad actualizada".
- Apagar "Aparecer en Descubrir" → todos los demás se atenúan, incluyendo el nuevo.

- [ ] **Step 3: Typecheck**

```bash
npx tsc --noEmit --skipLibCheck
```

Esperado: PASS.

- [ ] **Step 4: Commit**

```bash
git add components/section-components/portal/perfil/PrivacidadTab.tsx
git commit -m "feat(perfil): toggle Mostrar datos físicos en Privacidad"
```

---

### Task 6: Form "Perfil de atleta" en DatosTab

**Files:**
- Create: `components/section-components/portal/perfil/AthleteProfileForm.tsx`
- Modify: `components/section-components/portal/perfil/DatosTab.tsx`

- [ ] **Step 1: Crear `AthleteProfileForm.tsx`**

```tsx
"use client"

import { useForm } from "react-hook-form"
import { zodResolver } from "@hookform/resolvers/zod"
import { z } from "zod"
import { useMutation, useQueryClient } from "@tanstack/react-query"
import { toast } from "sonner"
import { Loader2, Save } from "lucide-react"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { Textarea } from "@/components/ui/textarea"
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select"
import { RadioGroup, RadioGroupItem } from "@/components/ui/radio-group"
import { updateMyProfile } from "@/lib/actions/portal"
import { ATHLETE_LEVEL_OPTIONS, GENDER_OPTIONS } from "@/lib/constants/athlete"

const schema = z.object({
  gender: z.enum(["male", "female"]).nullable(),
  birth_date: z.string().regex(/^\d{4}-\d{2}-\d{2}$/, "Fecha inválida").or(z.literal("")),
  weight_kg: z.coerce.number().min(30).max(250).or(z.literal("")).optional(),
  height_cm: z.coerce.number().int().min(100).max(220).or(z.literal("")).optional(),
  // UI input es month (YYYY-MM); persistimos como YYYY-MM-01
  athlete_since_month: z.string().regex(/^\d{4}-\d{2}$/, "Mes inválido").or(z.literal("")),
  athlete_level: z.enum(["rx", "scaled", "beginner"]).nullable(),
  quote: z.string().max(120).default(""),
})

type FormData = z.infer<typeof schema>

interface Props {
  initial: {
    gender: string | null
    birth_date: string | null
    weight_kg: number | null
    height_cm: number | null
    athlete_since: string | null
    athlete_level: string | null
    quote: string | null
  }
}

export function AthleteProfileForm({ initial }: Props) {
  const queryClient = useQueryClient()

  const {
    register,
    handleSubmit,
    setValue,
    watch,
    formState: { errors },
  } = useForm<FormData>({
    resolver: zodResolver(schema),
    values: {
      gender: (initial.gender as "male" | "female" | null) ?? null,
      birth_date: initial.birth_date ?? "",
      weight_kg: (initial.weight_kg ?? "") as FormData["weight_kg"],
      height_cm: (initial.height_cm ?? "") as FormData["height_cm"],
      athlete_since_month: initial.athlete_since
        ? initial.athlete_since.slice(0, 7)
        : "",
      athlete_level: (initial.athlete_level as FormData["athlete_level"]) ?? null,
      quote: initial.quote ?? "",
    },
  })

  const gender = watch("gender")
  const level = watch("athlete_level")

  const mutation = useMutation({
    mutationFn: async (d: FormData) => {
      await updateMyProfile({
        gender: d.gender,
        birth_date: d.birth_date === "" ? null : d.birth_date,
        weight_kg: d.weight_kg === "" || d.weight_kg === undefined ? null : Number(d.weight_kg),
        height_cm: d.height_cm === "" || d.height_cm === undefined ? null : Number(d.height_cm),
        athlete_since: d.athlete_since_month === "" ? null : `${d.athlete_since_month}-01`,
        athlete_level: d.athlete_level,
        quote: d.quote.trim() === "" ? null : d.quote.trim(),
      })
    },
    onSuccess: () => {
      toast.success("Perfil de atleta actualizado")
      queryClient.invalidateQueries({ queryKey: ["my-profile"] })
      queryClient.invalidateQueries({ queryKey: ["discoverable-members"] })
    },
    onError: (err) =>
      toast.error(err instanceof Error ? err.message : "Error al actualizar"),
  })

  return (
    <Card>
      <CardHeader className="pb-3">
        <CardTitle className="text-sm sm:text-base">Perfil de atleta</CardTitle>
      </CardHeader>
      <CardContent>
        <form
          onSubmit={handleSubmit((d) => mutation.mutate(d))}
          className="space-y-4"
        >
          <div className="space-y-1.5">
            <Label className="text-xs sm:text-sm">Género *</Label>
            <RadioGroup
              value={gender ?? ""}
              onValueChange={(v) => setValue("gender", v as "male" | "female", { shouldDirty: true })}
              className="flex gap-4"
            >
              {GENDER_OPTIONS.map((opt) => (
                <div key={opt.value} className="flex items-center gap-2">
                  <RadioGroupItem value={opt.value} id={`gender-${opt.value}`} />
                  <Label htmlFor={`gender-${opt.value}`} className="text-sm font-normal">
                    {opt.label}
                  </Label>
                </div>
              ))}
            </RadioGroup>
            <p className="text-[11px] text-muted-foreground">
              Necesario para aparecer en Descubrir.
            </p>
          </div>

          <div className="grid gap-4 sm:grid-cols-2">
            <div className="space-y-1.5">
              <Label htmlFor="birth_date" className="text-xs sm:text-sm">
                Fecha de nacimiento
              </Label>
              <Input id="birth_date" type="date" {...register("birth_date")} />
              {errors.birth_date && (
                <p className="text-xs text-destructive">{errors.birth_date.message}</p>
              )}
            </div>
            <div className="space-y-1.5">
              <Label htmlFor="athlete_since_month" className="text-xs sm:text-sm">
                Atleta desde
              </Label>
              <Input
                id="athlete_since_month"
                type="month"
                {...register("athlete_since_month")}
              />
              {errors.athlete_since_month && (
                <p className="text-xs text-destructive">{errors.athlete_since_month.message}</p>
              )}
            </div>
          </div>

          <div className="grid gap-4 sm:grid-cols-2">
            <div className="space-y-1.5">
              <Label htmlFor="weight_kg" className="text-xs sm:text-sm">Peso (kg)</Label>
              <Input
                id="weight_kg"
                type="number"
                step="0.1"
                min="30"
                max="250"
                {...register("weight_kg")}
              />
              {errors.weight_kg && (
                <p className="text-xs text-destructive">{errors.weight_kg.message}</p>
              )}
            </div>
            <div className="space-y-1.5">
              <Label htmlFor="height_cm" className="text-xs sm:text-sm">Altura (cm)</Label>
              <Input
                id="height_cm"
                type="number"
                min="100"
                max="220"
                {...register("height_cm")}
              />
              {errors.height_cm && (
                <p className="text-xs text-destructive">{errors.height_cm.message}</p>
              )}
            </div>
          </div>

          <div className="space-y-1.5">
            <Label className="text-xs sm:text-sm">Nivel</Label>
            <Select
              value={level ?? ""}
              onValueChange={(v) =>
                setValue("athlete_level", v as "rx" | "scaled" | "beginner", { shouldDirty: true })
              }
            >
              <SelectTrigger>
                <SelectValue placeholder="Selecciona tu nivel" />
              </SelectTrigger>
              <SelectContent>
                {ATHLETE_LEVEL_OPTIONS.map((opt) => (
                  <SelectItem key={opt.value} value={opt.value}>
                    {opt.label}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>

          <div className="space-y-1.5">
            <Label htmlFor="quote" className="text-xs sm:text-sm">
              Frase / lema (opcional)
            </Label>
            <Textarea
              id="quote"
              rows={2}
              maxLength={120}
              placeholder="Ej: Stronger every day."
              {...register("quote")}
            />
            <p className="text-[11px] text-muted-foreground">Máx 120 caracteres.</p>
          </div>

          <Button
            type="submit"
            className="w-full sm:w-auto"
            disabled={mutation.isPending}
          >
            {mutation.isPending && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
            <Save className="mr-2 h-4 w-4" />
            Guardar cambios
          </Button>
        </form>
      </CardContent>
    </Card>
  )
}
```

- [ ] **Step 2: Verificar que existen los componentes shadcn necesarios**

Ejecutar:
```bash
ls components/ui/textarea.tsx components/ui/select.tsx components/ui/radio-group.tsx
```

Si alguno falta:
```bash
npx shadcn@latest add textarea select radio-group
```

- [ ] **Step 3: Incrustar el form en `DatosTab.tsx`**

Editar `components/section-components/portal/perfil/DatosTab.tsx`. Importar al tope:

```ts
import { AthleteProfileForm } from "./AthleteProfileForm"
```

Y debajo de la Card de "Datos personales" (en el `<div className="space-y-4 sm:space-y-5 min-w-0">`), justo antes de la Card de Contraseña, añadir:

```tsx
<AthleteProfileForm
  initial={{
    gender: profile?.gender ?? null,
    birth_date: profile?.birth_date ?? null,
    weight_kg: profile?.weight_kg ?? null,
    height_cm: profile?.height_cm ?? null,
    athlete_since: profile?.athlete_since ?? null,
    athlete_level: profile?.athlete_level ?? null,
    quote: profile?.quote ?? null,
  }}
/>
```

- [ ] **Step 4: Smoke test**

Arrancar dev server. Ir a `/portal/perfil` → pestaña Datos. Verificar:
- Aparecen dos cards: "Datos personales" y "Perfil de atleta".
- En "Perfil de atleta": radios Hombre/Mujer, fecha nacimiento, atleta desde (mes/año), peso, altura, nivel (Rx/Scaled/Principiante), frase.
- Llenar todos → Guardar → toast "Perfil de atleta actualizado".
- Recargar la página → los valores persisten.
- Probar peso=10 → error "Number must be greater than or equal to 30".
- Probar altura=50 → error similar.
- Probar fecha nacimiento año 1900 → error "Fecha fuera de rango".

- [ ] **Step 5: Typecheck**

```bash
npx tsc --noEmit --skipLibCheck
```

Esperado: PASS.

- [ ] **Step 6: Commit**

```bash
git add components/section-components/portal/perfil/AthleteProfileForm.tsx components/section-components/portal/perfil/DatosTab.tsx
git commit -m "feat(perfil): card Perfil de atleta con formulario completo"
```

---

### Task 7: Banner home "Completa tu perfil"

**Files:**
- Create: `components/section-components/portal/home/CompletarPerfilBanner.tsx`
- Modify: `components/section-components/portal/home/PortalHomeMainComponent.tsx`

- [ ] **Step 1: Crear el banner**

```tsx
"use client"

import Link from "next/link"
import { UserCog } from "lucide-react"
import { Card, CardContent } from "@/components/ui/card"
import { Button } from "@/components/ui/button"

export function CompletarPerfilBanner() {
  return (
    <Card className="border-primary/30 bg-primary/5">
      <CardContent className="py-4 flex flex-col sm:flex-row sm:items-center justify-between gap-3">
        <div className="flex items-start gap-3 min-w-0">
          <div className="flex h-9 w-9 shrink-0 items-center justify-center rounded-full bg-primary/15 text-primary">
            <UserCog className="h-4 w-4" />
          </div>
          <div className="min-w-0">
            <p className="text-sm font-medium">Completa tu perfil de atleta</p>
            <p className="text-xs text-muted-foreground mt-0.5">
              Necesitas tu género para aparecer en Descubrir y compartir tu ficha.
            </p>
          </div>
        </div>
        <Link href="/portal/perfil" className="shrink-0">
          <Button size="sm" className="w-full sm:w-auto">
            Completar
          </Button>
        </Link>
      </CardContent>
    </Card>
  )
}
```

- [ ] **Step 2: Incrustar en `PortalHomeMainComponent.tsx`**

Importar al tope:

```ts
import { CompletarPerfilBanner } from "./CompletarPerfilBanner"
```

En el JSX, justo antes del primer Card del contenido (después del header de saludo), añadir:

```tsx
{!profile.gender && <CompletarPerfilBanner />}
```

(Si la estructura existente no tiene un header de saludo claro, ponerlo como primera cosa dentro del wrapper top-level del componente.)

- [ ] **Step 3: Smoke test**

Como miembro sin género, ir a `/portal`. Verificar que aparece el banner. Click "Completar" → navega a `/portal/perfil`. Llenar género en el form, guardar. Volver a `/portal`. El banner desaparece.

- [ ] **Step 4: Typecheck + commit**

```bash
npx tsc --noEmit --skipLibCheck
git add components/section-components/portal/home/CompletarPerfilBanner.tsx components/section-components/portal/home/PortalHomeMainComponent.tsx
git commit -m "feat(portal): banner home invita a completar perfil de atleta"
```

---

### Task 8: Descubrir con tabs Hombres/Mujeres

**Files:**
- Modify: `components/section-components/portal/descubrir/PortalDescubrirMainComponent.tsx`
- Modify: `components/section-components/portal/descubrir/RankingStrip.tsx`

- [ ] **Step 1: Reescribir `PortalDescubrirMainComponent.tsx`**

Reemplazar el archivo completo por:

```tsx
"use client"

import { useMemo, useState, useEffect } from "react"
import { useQuery } from "@tanstack/react-query"
import { Loader2, Search, Users } from "lucide-react"
import { Input } from "@/components/ui/input"
import { Card, CardContent } from "@/components/ui/card"
import { Tabs, TabsList, TabsTrigger, TabsContent } from "@/components/ui/tabs"
import { getDiscoverableMembers } from "@/lib/actions/records"
import { getMyProfile } from "@/lib/actions/portal"
import { RankingStrip } from "./RankingStrip"
import { MemberCard } from "./MemberCard"
import { MemberDetailModal } from "./MemberDetailModal"
import type { Gender } from "@/lib/constants/athlete"

export default function PortalDescubrirMainComponent() {
  const [search, setSearch] = useState("")
  const [selectedMemberId, setSelectedMemberId] = useState<string | null>(null)
  const [tab, setTab] = useState<Gender>("male")

  const { data: profile } = useQuery({
    queryKey: ["my-profile"],
    queryFn: getMyProfile,
    staleTime: 5 * 60 * 1000,
  })

  // Set default tab to user's own gender on first load
  useEffect(() => {
    if (profile?.gender === "male" || profile?.gender === "female") {
      setTab(profile.gender)
    }
  }, [profile?.gender])

  const { data: members = [], isLoading } = useQuery({
    queryKey: ["discoverable-members", tab],
    queryFn: () => getDiscoverableMembers({ gender: tab }),
    staleTime: 60 * 1000,
  })

  const filtered = useMemo(() => {
    if (!search.trim()) return members
    const q = search.trim().toLowerCase()
    return members.filter((m) => m.name.toLowerCase().includes(q))
  }, [members, search])

  const userHasNoGender = profile && !profile.gender

  return (
    <div className="space-y-5 sm:space-y-6">
      <div>
        <h1 className="text-xl sm:text-2xl font-bold">Descubrir</h1>
        <p className="text-muted-foreground text-xs sm:text-sm mt-0.5">
          Conoce a la comunidad de Madbox
        </p>
      </div>

      <Tabs value={tab} onValueChange={(v) => setTab(v as Gender)}>
        <TabsList className="grid w-full sm:w-auto grid-cols-2">
          <TabsTrigger value="male">Hombres</TabsTrigger>
          <TabsTrigger value="female">Mujeres</TabsTrigger>
        </TabsList>

        {(["male", "female"] as Gender[]).map((g) => (
          <TabsContent key={g} value={g} className="space-y-5 sm:space-y-6 mt-5 sm:mt-6">
            <RankingStrip gender={g} />

            {userHasNoGender && (
              <Card className="border-primary/30 bg-primary/5">
                <CardContent className="py-3 text-xs sm:text-sm text-muted-foreground">
                  Completa tu género en{" "}
                  <a className="text-primary underline" href="/portal/perfil">tu perfil</a>{" "}
                  para aparecer en Descubrir.
                </CardContent>
              </Card>
            )}

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

            {isLoading ? (
              <div className="flex justify-center py-10">
                <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" />
              </div>
            ) : filtered.length === 0 ? (
              <Card>
                <CardContent className="py-12 flex flex-col items-center gap-3 text-center">
                  <div className="flex h-12 w-12 items-center justify-center rounded-full bg-muted">
                    <Users className="h-6 w-6 text-muted-foreground" />
                  </div>
                  <p className="text-sm text-muted-foreground">
                    {search.trim()
                      ? "No se encontraron miembros con ese nombre."
                      : g === "male"
                        ? "Aún no hay hombres visibles en Descubrir."
                        : "Aún no hay mujeres visibles en Descubrir."}
                  </p>
                </CardContent>
              </Card>
            ) : (
              <div className="space-y-2">
                <p className="text-xs text-muted-foreground">
                  {g === "male" ? "Comunidad masculina" : "Comunidad femenina"} (
                  {filtered.length} {filtered.length === 1 ? "miembro" : "miembros"})
                </p>
                <div className="grid gap-3 sm:gap-4 sm:grid-cols-2 lg:grid-cols-3">
                  {filtered.map((m) => (
                    <MemberCard
                      key={m.id}
                      member={m}
                      gender={g}
                      onClick={() => setSelectedMemberId(m.id)}
                    />
                  ))}
                </div>
              </div>
            )}
          </TabsContent>
        ))}
      </Tabs>

      <MemberDetailModal
        memberId={selectedMemberId}
        onClose={() => setSelectedMemberId(null)}
      />
    </div>
  )
}
```

- [ ] **Step 2: Modificar `RankingStrip.tsx` para aceptar `gender`**

Reemplazar la firma y la lógica:

```tsx
"use client"

import { useQuery } from "@tanstack/react-query"
import { Trophy, Loader2 } from "lucide-react"
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar"
import { Card, CardContent } from "@/components/ui/card"
import { cn } from "@/lib/utils"
import { getTopByCategory } from "@/lib/actions/records"
import type { Gender } from "@/lib/constants/athlete"

const POSITION_STYLES = [
  { ring: "ring-yellow-400", bg: "bg-yellow-400/10", label: "1°", scale: "scale-110" },
  { ring: "ring-slate-300",  bg: "bg-slate-300/10",  label: "2°", scale: "" },
  { ring: "ring-amber-700",  bg: "bg-amber-700/10",  label: "3°", scale: "" },
]

interface Props {
  gender: Gender
}

export function RankingStrip({ gender }: Props) {
  const { data: top = [], isLoading } = useQuery({
    queryKey: ["discover-top", "grand", gender],
    queryFn: () => getTopByCategory("grand", gender),
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

  const title = gender === "male" ? "Top Grand Total — Masculino" : "Top Grand Total — Femenino"

  return (
    <Card>
      <CardContent className="py-4 sm:py-5">
        <div className="flex items-center gap-2 mb-4">
          <Trophy className="h-4 w-4 text-primary" />
          <p className="text-xs sm:text-sm font-semibold uppercase tracking-wide">
            {title}
          </p>
        </div>
        <div className="grid grid-cols-3 gap-2 sm:gap-3">
          {top.map((entry, i) => {
            const styles = POSITION_STYLES[i] ?? POSITION_STYLES[2]
            const initials = entry.name
              .split(" ").map((n) => n[0]).join("").slice(0, 2).toUpperCase()
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

- [ ] **Step 3: Smoke test**

`npm run dev`. Ir a `/portal/descubrir`. Verificar:
- Aparecen 2 tabs: Hombres y Mujeres.
- Si el usuario logueado es Hombre, abre por defecto Hombres.
- Cambiar a Mujeres → la lista cambia, el ranking dice "Top Grand Total — Femenino".
- Si no hay miembros aún en una tab, el empty-state correcto se muestra ("Aún no hay hombres/mujeres visibles").

Para probar: crear (o tocar la columna `gender` directamente vía SQL en supabase) al menos un miembro de cada género con marcas registradas.

- [ ] **Step 4: Typecheck**

```bash
npx tsc --noEmit --skipLibCheck
```

Esperado: PASS. Si MemberCard se queja por la prop `gender` que aún no acepta, no commitear todavía — Task 9 lo arregla.

- [ ] **Step 5: Commit (si typecheck pasa)**

```bash
git add components/section-components/portal/descubrir/PortalDescubrirMainComponent.tsx components/section-components/portal/descubrir/RankingStrip.tsx
git commit -m "feat(descubrir): tabs hombres/mujeres con ranking dividido"
```

(Si MemberCard rompe el typecheck, hacer Task 9 antes y commitear los 3 archivos juntos en su Step 5 final.)

---

### Task 9: MemberCard con ring de género

**Files:**
- Modify: `components/section-components/portal/descubrir/MemberCard.tsx`

- [ ] **Step 1: Aceptar prop `gender` y aplicar ring**

Reemplazar la firma y el render del Avatar:

```tsx
"use client"

import { Trophy } from "lucide-react"
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar"
import { Badge } from "@/components/ui/badge"
import { Card, CardContent } from "@/components/ui/card"
import { cn } from "@/lib/utils"
import { getMovement, type MovementId } from "@/lib/constants/movements"
import type { DiscoverableMember } from "@/lib/actions/records"
import type { Gender } from "@/lib/constants/athlete"

interface MemberCardProps {
  member: DiscoverableMember
  gender: Gender
  onClick: () => void
}

export function MemberCard({ member, gender, onClick }: MemberCardProps) {
  const initials = member.name
    .split(" ")
    .map((n) => n[0])
    .join("")
    .slice(0, 2)
    .toUpperCase()

  const ringClass = gender === "male" ? "ring-2 ring-blue-500/30" : "ring-2 ring-pink-500/30"

  return (
    <Card
      onClick={onClick}
      className="cursor-pointer transition-colors hover:border-primary/40"
    >
      <CardContent className="py-4 sm:py-5 space-y-3">
        <div className="flex items-center gap-3">
          <Avatar className={cn("h-12 w-12 sm:h-14 sm:w-14 shrink-0 border-2 border-primary/20", ringClass)}>
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

- [ ] **Step 2: Smoke test**

Recargar `/portal/descubrir`. Verificar que las cards en tab Hombres tienen un ring sutil azul, y en tab Mujeres uno rosa, ambos discretos.

- [ ] **Step 3: Typecheck + commit**

```bash
npx tsc --noEmit --skipLibCheck
git add components/section-components/portal/descubrir/MemberCard.tsx
git commit -m "feat(descubrir): ring de género sutil en MemberCard"
```

---

### Task 10: MemberDetailModal — sección "Datos del atleta"

**Files:**
- Modify: `components/section-components/portal/descubrir/MemberDetailModal.tsx`

- [ ] **Step 1: Añadir la sección entre el header y `TotalsStrip`**

Editar el archivo. Importar al tope:

```ts
import { ATHLETE_LEVEL_LABEL } from "@/lib/constants/athlete"
```

Localizar el bloque inmediatamente después del `<div className="flex items-start gap-4">` (header con avatar+nombre+badges) y antes de la condicional `{profile.totals === null ? ... : ...}`. Insertar este bloque (la condición exterior se deriva: si **algún** dato físico está disponible o hay quote, mostramos la sección — `show_body_metrics` ya filtró server-side):

```tsx
{(profile.age !== null ||
  profile.weight_kg !== null ||
  profile.height_cm !== null ||
  profile.athlete_level !== null ||
  profile.athlete_since_year !== null ||
  profile.quote) && (
  <div className="border rounded-lg p-3 sm:p-4 space-y-2">
    <h3 className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">
      Datos del atleta
    </h3>
    {(profile.age !== null ||
      profile.weight_kg !== null ||
      profile.height_cm !== null ||
      profile.athlete_level !== null) && (
      <div className="grid grid-cols-2 sm:grid-cols-4 gap-2 sm:gap-3 text-center">
        {profile.age !== null && (
          <div>
            <p className="text-[10px] uppercase text-muted-foreground tracking-wide">Edad</p>
            <p className="text-base font-semibold tabular-nums">{profile.age}</p>
            <p className="text-[10px] text-muted-foreground">años</p>
          </div>
        )}
        {profile.weight_kg !== null && (
          <div>
            <p className="text-[10px] uppercase text-muted-foreground tracking-wide">Peso</p>
            <p className="text-base font-semibold tabular-nums">{Number(profile.weight_kg).toLocaleString("es-VE")}</p>
            <p className="text-[10px] text-muted-foreground">kg</p>
          </div>
        )}
        {profile.height_cm !== null && (
          <div>
            <p className="text-[10px] uppercase text-muted-foreground tracking-wide">Altura</p>
            <p className="text-base font-semibold tabular-nums">{Number(profile.height_cm).toLocaleString("es-VE")}</p>
            <p className="text-[10px] text-muted-foreground">cm</p>
          </div>
        )}
        {profile.athlete_level !== null && (
          <div>
            <p className="text-[10px] uppercase text-muted-foreground tracking-wide">Nivel</p>
            <p className="text-base font-semibold">{ATHLETE_LEVEL_LABEL[profile.athlete_level]}</p>
          </div>
        )}
      </div>
    )}
    {profile.athlete_since_year !== null && (
      <p className="text-xs text-muted-foreground text-center">
        Atleta desde {profile.athlete_since_year}
      </p>
    )}
    {profile.quote && (
      <p className="text-sm italic text-center pt-1">&ldquo;{profile.quote}&rdquo;</p>
    )}
  </div>
)}
```

- [ ] **Step 2: Smoke test**

Como un usuario A con `show_body_metrics = true` y todos los datos llenos:
- Loguearse como un usuario B distinto.
- Ir a Descubrir → click en la card de A → ver sección "Datos del atleta" con edad, peso, altura, nivel, atleta desde y la quote.

Como un usuario A con `show_body_metrics = false`:
- Como B, abrir su modal → si A tiene quote, se ve solo la quote dentro de la sección. Si no tiene nada, la sección no aparece.

- [ ] **Step 3: Typecheck + commit**

```bash
npx tsc --noEmit --skipLibCheck
git add components/section-components/portal/descubrir/MemberDetailModal.tsx
git commit -m "feat(descubrir): sección Datos del atleta en modal de perfil público"
```

---

### Task 11: Server action `getMyAthleteCardData`

**Files:**
- Modify: `lib/actions/portal.ts`
- Modify: `lib/actions/records.ts` (sólo para reutilizar tipos si conviene; no requerido)

- [ ] **Step 1: Añadir `getMyAthleteCardData` al final de `lib/actions/portal.ts`**

Justo antes de la última función del archivo, añadir:

```ts
import { calculateTotals, MOVEMENTS, getMovement, type MovementId } from "@/lib/constants/movements"
import type { Gender, AthleteLevel } from "@/lib/constants/athlete"

export interface AthleteCardData {
  name: string
  avatarUrl: string | null
  planName: string | null
  gender: Gender
  age: number | null
  weightKg: number | null
  heightCm: number | null
  athleteSinceYear: number | null
  athleteLevel: AthleteLevel | null
  quote: string | null
  totals: { grand: number; olympic: number; squat: number; press: number }
  topRecords: Array<{ movement: MovementId; label: string; weightKg: number }>
}

export async function getMyAthleteCardData(): Promise<AthleteCardData> {
  const { member, supabase } = await getCurrentMember()

  if (!member.gender) {
    throw new Error("Completa tu género en el perfil para generar tu ficha.")
  }

  const { data: records, error: recError } = await supabase
    .from("personal_records")
    .select("movement, weight_kg")
    .eq("member_id", member.id)

  if (recError) throw recError
  if (!records || records.length === 0) {
    throw new Error("Registra al menos una marca para generar tu ficha.")
  }

  const recsMap: Record<string, number> = {}
  for (const r of records) recsMap[r.movement] = Number(r.weight_kg)

  const totals = calculateTotals(recsMap as Record<MovementId, number>)

  const topRecords = MOVEMENTS
    .map((mv) => ({
      movement: mv.id,
      label: mv.label,
      weightKg: recsMap[mv.id] ?? 0,
    }))
    .filter((r) => r.weightKg > 0)
    .sort((a, b) => b.weightKg - a.weightKg)
    .slice(0, 6)

  const planRow = member.plans as { name: string } | null
  const age = member.birth_date
    ? (() => {
        const d = new Date(member.birth_date + "T00:00:00")
        if (Number.isNaN(d.getTime())) return null
        const years = Math.floor((Date.now() - d.getTime()) / (1000 * 60 * 60 * 24 * 365.25))
        return years >= 0 && years <= 120 ? years : null
      })()
    : null

  return {
    name: member.name,
    avatarUrl: member.avatar_url ?? null,
    planName: planRow?.name ?? null,
    gender: member.gender as Gender,
    age,
    weightKg: member.weight_kg !== null && member.weight_kg !== undefined ? Number(member.weight_kg) : null,
    heightCm: member.height_cm !== null && member.height_cm !== undefined ? Number(member.height_cm) : null,
    athleteSinceYear: member.athlete_since
      ? new Date(member.athlete_since + "T00:00:00").getFullYear()
      : null,
    athleteLevel: (member.athlete_level as AthleteLevel | null) ?? null,
    quote: member.quote && member.quote.trim().length > 0 ? member.quote : null,
    totals,
    topRecords,
  }
}
```

(El `getMovement` import se queda en el archivo aunque no se use directamente — `MOVEMENTS` ya da los labels.)

- [ ] **Step 2: Typecheck**

```bash
npx tsc --noEmit --skipLibCheck
```

Esperado: PASS.

- [ ] **Step 3: Commit**

```bash
git add lib/actions/portal.ts
git commit -m "feat(perfil): server action getMyAthleteCardData"
```

---

### Task 12: Componente visual `AthleteCard` (template PNG)

**Files:**
- Create: `components/section-components/portal/perfil/AthleteCard.tsx`
- Add: SVG del logo en `public/madbox-logo.svg` (si no existe ya)

- [ ] **Step 1: Asegurar que existe un logo SVG**

```bash
ls public/madbox-logo.svg
```

Si **no** existe, crear `public/madbox-logo.svg` con un SVG simple del wordmark Madbox. Si ya existe en otro nombre (ej. `icon.svg`), usar ese path en el componente. Como mínimo, un placeholder limpio:

```svg
<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 320 80" width="320" height="80">
  <text x="0" y="55" font-family="Impact, 'Bebas Neue', sans-serif" font-size="56" font-weight="900" fill="#FACC15" letter-spacing="2">MADBOX</text>
</svg>
```

(El equipo de diseño puede sustituir este SVG por el logo real más tarde sin tocar el código del componente.)

- [ ] **Step 2: Crear `AthleteCard.tsx`**

```tsx
"use client"

import { ATHLETE_LEVEL_LABEL } from "@/lib/constants/athlete"
import type { AthleteCardData } from "@/lib/actions/portal"

interface Props {
  data: AthleteCardData
  /** ref al div raíz, lo usa el hook para capturar */
  innerRef?: React.RefObject<HTMLDivElement | null>
}

const COLORS = {
  bgFrom: "#0a0a0a",
  bgTo: "#171717",
  accent: "#FACC15",
  accentSoft: "rgba(250, 204, 21, 0.15)",
  text: "#fafafa",
  muted: "#a1a1aa",
  border: "rgba(250, 204, 21, 0.4)",
}

export function AthleteCard({ data, innerRef }: Props) {
  const initials = data.name
    .split(" ")
    .map((n) => n[0])
    .join("")
    .slice(0, 2)
    .toUpperCase()

  const subtitle = [
    data.planName ? data.planName.toUpperCase() : null,
    data.athleteSinceYear ? `ATLETA DESDE ${data.athleteSinceYear}` : null,
  ]
    .filter(Boolean)
    .join(" · ")

  return (
    <div
      ref={innerRef}
      style={{
        position: "fixed",
        left: "-99999px",
        top: 0,
        width: 1080,
        height: 1920,
        background: `linear-gradient(180deg, ${COLORS.bgFrom} 0%, ${COLORS.bgTo} 100%)`,
        color: COLORS.text,
        fontFamily: "'Inter', system-ui, -apple-system, sans-serif",
        padding: 64,
        boxSizing: "border-box",
        display: "flex",
        flexDirection: "column",
        alignItems: "center",
        pointerEvents: "none",
        zIndex: -1,
      }}
    >
      {/* Logo (img plano para evitar quirks de next/image en captura) */}
      <div style={{ width: "100%", display: "flex", alignItems: "center", justifyContent: "flex-start" }}>
        <img
          src="/madbox-logo.svg"
          alt="Madbox"
          width={240}
          height={60}
          crossOrigin="anonymous"
          style={{ display: "block" }}
        />
      </div>

      {/* Avatar */}
      <div style={{ marginTop: 80, width: 280, height: 280, borderRadius: "50%", border: `4px solid ${COLORS.accent}`, overflow: "hidden", display: "flex", alignItems: "center", justifyContent: "center", background: `linear-gradient(135deg, ${COLORS.accentSoft}, transparent)` }}>
        {data.avatarUrl ? (
          <img
            src={data.avatarUrl}
            alt={data.name}
            crossOrigin="anonymous"
            style={{ width: "100%", height: "100%", objectFit: "cover" }}
          />
        ) : (
          <span style={{ fontSize: 96, fontWeight: 900, color: COLORS.accent, fontFamily: "'Bebas Neue', Impact, sans-serif" }}>
            {initials}
          </span>
        )}
      </div>

      {/* Nombre */}
      <h1
        style={{
          marginTop: 40,
          fontSize: 76,
          fontWeight: 900,
          letterSpacing: 2,
          textAlign: "center",
          fontFamily: "'Bebas Neue', Impact, sans-serif",
          textTransform: "uppercase",
          margin: "40px 0 0 0",
        }}
      >
        {data.name}
      </h1>

      {/* Línea dorada */}
      <div style={{ width: 200, height: 2, background: COLORS.accent, marginTop: 16 }} />

      {/* Subtítulo */}
      {subtitle && (
        <p style={{ marginTop: 16, fontSize: 22, color: COLORS.muted, letterSpacing: 1.5, textAlign: "center" }}>
          {subtitle}
        </p>
      )}

      {/* Stats grid */}
      {(data.age !== null || data.weightKg !== null || data.heightCm !== null || data.athleteLevel !== null) && (
        <div
          style={{
            marginTop: 56,
            display: "grid",
            gridTemplateColumns: "repeat(4, 1fr)",
            gap: 16,
            width: "100%",
            maxWidth: 880,
          }}
        >
          {[
            { label: "EDAD", value: data.age, unit: "años" },
            { label: "PESO", value: data.weightKg, unit: "kg" },
            { label: "ALTURA", value: data.heightCm, unit: "cm" },
            {
              label: "NIVEL",
              value: data.athleteLevel ? ATHLETE_LEVEL_LABEL[data.athleteLevel] : null,
              unit: "",
            },
          ].map((stat, i) => (
            <div
              key={i}
              style={{
                border: `1px solid ${COLORS.border}`,
                borderRadius: 8,
                padding: "20px 12px",
                textAlign: "center",
                background: "rgba(0,0,0,0.3)",
              }}
            >
              <p style={{ fontSize: 14, color: COLORS.muted, letterSpacing: 2, margin: 0 }}>{stat.label}</p>
              <p
                style={{
                  fontSize: 44,
                  fontWeight: 800,
                  margin: "8px 0 4px 0",
                  fontFamily: "'Bebas Neue', Impact, sans-serif",
                  letterSpacing: 1,
                }}
              >
                {stat.value ?? "—"}
              </p>
              {stat.unit && (
                <p style={{ fontSize: 12, color: COLORS.muted, margin: 0 }}>{stat.unit}</p>
              )}
            </div>
          ))}
        </div>
      )}

      {/* Quote */}
      {data.quote && (
        <p
          style={{
            marginTop: 40,
            fontSize: 28,
            fontStyle: "italic",
            color: COLORS.text,
            textAlign: "center",
            maxWidth: 880,
            lineHeight: 1.4,
          }}
        >
          &ldquo;{data.quote}&rdquo;
        </p>
      )}

      {/* Records */}
      {data.topRecords.length > 0 && (
        <div style={{ marginTop: 56, width: "100%", maxWidth: 880 }}>
          <div style={{ display: "flex", alignItems: "center", gap: 16, marginBottom: 24 }}>
            <div style={{ flex: 1, height: 1, background: COLORS.border }} />
            <span
              style={{
                fontSize: 16,
                color: COLORS.muted,
                letterSpacing: 3,
                fontWeight: 600,
              }}
            >
              RECORDS PERSONALES
            </span>
            <div style={{ flex: 1, height: 1, background: COLORS.border }} />
          </div>
          <div style={{ display: "flex", flexDirection: "column", gap: 12 }}>
            {data.topRecords.map((r) => (
              <div
                key={r.movement}
                style={{
                  display: "flex",
                  alignItems: "center",
                  justifyContent: "space-between",
                  padding: "12px 20px",
                  background: "rgba(255,255,255,0.03)",
                  borderRadius: 6,
                }}
              >
                <span style={{ fontSize: 22, fontWeight: 600, letterSpacing: 1, textTransform: "uppercase" }}>
                  {r.label}
                </span>
                <span
                  style={{
                    fontSize: 26,
                    fontWeight: 800,
                    color: COLORS.accent,
                    fontFamily: "'Bebas Neue', Impact, sans-serif",
                    letterSpacing: 1,
                  }}
                >
                  {r.weightKg.toLocaleString("es-VE")} KG
                </span>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Grand Total */}
      {data.totals.grand > 0 && (
        <div
          style={{
            marginTop: "auto",
            border: `2px solid ${COLORS.accent}`,
            borderRadius: 8,
            padding: "24px 48px",
            textAlign: "center",
            background: COLORS.accentSoft,
            boxShadow: `0 0 30px ${COLORS.accentSoft}`,
            minWidth: 480,
          }}
        >
          <p style={{ fontSize: 18, color: COLORS.muted, letterSpacing: 4, fontWeight: 600, margin: 0 }}>
            GRAND TOTAL
          </p>
          <p
            style={{
              fontSize: 88,
              fontWeight: 900,
              color: COLORS.accent,
              fontFamily: "'Bebas Neue', Impact, sans-serif",
              letterSpacing: 3,
              margin: "8px 0 0 0",
            }}
          >
            {data.totals.grand.toLocaleString("es-VE")} KG
          </p>
        </div>
      )}

      {/* Footer */}
      <p
        style={{
          marginTop: 32,
          fontSize: 16,
          color: COLORS.muted,
          letterSpacing: 4,
          textTransform: "lowercase",
        }}
      >
        madbox · crossfit elite
      </p>
    </div>
  )
}
```

- [ ] **Step 3: Verificación visual temporal**

Para inspeccionar el componente sin compartir aún, hacer un test temporal: en `DatosTab.tsx`, después de los imports, importar `AthleteCard` y agregar dentro del JSX un render temporal con `style={{ position: 'static' }}` para verlo. Recargar `/portal/perfil`. Ver que se ve correcto. **Quitar este render temporal** antes del commit; el componente se monta solo desde el hook (Task 13).

Alternativa: verificar visualmente capturando una pantalla con DevTools en modo device emulation, ajustando temporalmente las posiciones a `static`.

- [ ] **Step 4: Typecheck + commit**

```bash
npx tsc --noEmit --skipLibCheck
git add components/section-components/portal/perfil/AthleteCard.tsx public/madbox-logo.svg
git commit -m "feat(perfil): componente AthleteCard 1080x1920 para ficha PNG"
```

---

### Task 13: Hook `use-share-athlete-card` + integración en DatosTab

**Files:**
- Install: `html-to-image`
- Create: `lib/hooks/use-share-athlete-card.ts`
- Create: `components/section-components/portal/perfil/ShareAthleteButton.tsx`
- Modify: `components/section-components/portal/perfil/DatosTab.tsx`

- [ ] **Step 1: Instalar `html-to-image`**

```bash
npm install html-to-image
```

Verificar que `package.json` ahora incluye `"html-to-image": "^1.x"`.

- [ ] **Step 2: Crear el hook**

`lib/hooks/use-share-athlete-card.ts`:

```ts
"use client"

import { useState } from "react"
import { useMutation } from "@tanstack/react-query"
import { toBlob } from "html-to-image"
import { toast } from "sonner"
import { getMyAthleteCardData, type AthleteCardData } from "@/lib/actions/portal"

function slugify(s: string): string {
  return s
    .toLowerCase()
    .normalize("NFD")
    .replace(/[̀-ͯ]/g, "")
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-|-$/g, "")
    .slice(0, 40)
}

async function waitForImagesLoaded(node: HTMLElement): Promise<void> {
  const imgs = Array.from(node.querySelectorAll("img"))
  await Promise.all(
    imgs.map((img) => {
      if (img.complete && img.naturalWidth > 0) return Promise.resolve()
      return new Promise<void>((resolve) => {
        img.onload = () => resolve()
        img.onerror = () => resolve() // no romper si una imagen falla
      })
    }),
  )
  // Pequeño delay para que las fonts terminen de aplicarse
  await new Promise((r) => setTimeout(r, 60))
}

export function useShareAthleteCard() {
  const [cardData, setCardData] = useState<AthleteCardData | null>(null)

  const fetchData = useMutation({
    mutationFn: getMyAthleteCardData,
  })

  async function captureAndShare(node: HTMLElement, name: string): Promise<void> {
    await waitForImagesLoaded(node)

    const blob = await toBlob(node, {
      pixelRatio: 2,
      cacheBust: true,
      backgroundColor: "#0a0a0a",
    })

    if (!blob) throw new Error("No se pudo generar la imagen")

    const filename = `madbox-ficha-${slugify(name) || "atleta"}.png`
    const file = new File([blob], filename, { type: "image/png" })

    const canShare = typeof navigator !== "undefined"
      && typeof (navigator as Navigator).canShare === "function"
      && (navigator as Navigator).canShare?.({ files: [file] })

    if (canShare) {
      try {
        await navigator.share({ files: [file], title: "Mi ficha Madbox" })
        toast.success("¡Compartido!")
        return
      } catch (e) {
        // Si el usuario cancela el share, no es error. Si falla, caemos a download.
        if (e instanceof Error && e.name === "AbortError") return
      }
    }

    // Fallback: descarga
    const url = URL.createObjectURL(blob)
    const a = document.createElement("a")
    a.href = url
    a.download = filename
    document.body.appendChild(a)
    a.click()
    document.body.removeChild(a)
    URL.revokeObjectURL(url)
    toast.success("Imagen descargada — compártela donde quieras")
  }

  return {
    cardData,
    fetchCardData: async () => {
      const d = await fetchData.mutateAsync()
      setCardData(d)
      return d
    },
    clearCardData: () => setCardData(null),
    captureAndShare,
    isFetching: fetchData.isPending,
  }
}
```

- [ ] **Step 3: Crear `ShareAthleteButton.tsx`**

```tsx
"use client"

import { useRef, useState } from "react"
import { Loader2, Share2 } from "lucide-react"
import { toast } from "sonner"
import { Button } from "@/components/ui/button"
import { useShareAthleteCard } from "@/lib/hooks/use-share-athlete-card"
import { AthleteCard } from "./AthleteCard"

interface Props {
  /** Si false, el botón aparece disabled con tooltip via title */
  enabled: boolean
  disabledReason?: string
}

export function ShareAthleteButton({ enabled, disabledReason }: Props) {
  const ref = useRef<HTMLDivElement>(null)
  const [busy, setBusy] = useState(false)
  const { cardData, fetchCardData, clearCardData, captureAndShare, isFetching } = useShareAthleteCard()

  async function handleClick() {
    if (busy) return
    setBusy(true)
    try {
      const data = await fetchCardData()
      // dejar que React monte el componente con la data nueva
      await new Promise((r) => requestAnimationFrame(() => r(null)))
      await new Promise((r) => requestAnimationFrame(() => r(null)))
      if (!ref.current) throw new Error("No se pudo preparar la ficha")
      await captureAndShare(ref.current, data.name)
    } catch (e) {
      toast.error(
        e instanceof Error
          ? e.message
          : "No pudimos generar la imagen. Intenta de nuevo.",
      )
    } finally {
      clearCardData()
      setBusy(false)
    }
  }

  return (
    <>
      <Button
        type="button"
        variant="default"
        size="sm"
        className="gap-2 w-full"
        onClick={handleClick}
        disabled={!enabled || busy || isFetching}
        title={!enabled ? disabledReason : undefined}
      >
        {busy || isFetching ? (
          <Loader2 className="h-4 w-4 animate-spin" />
        ) : (
          <Share2 className="h-4 w-4" />
        )}
        Compartir mi ficha
      </Button>
      {cardData && <AthleteCard data={cardData} innerRef={ref} />}
    </>
  )
}
```

- [ ] **Step 4: Integrar en `DatosTab.tsx`**

Importar al tope:

```ts
import { ShareAthleteButton } from "./ShareAthleteButton"
import { useQuery as useQueryRecords } from "@tanstack/react-query"
import { getMyRecords } from "@/lib/actions/records"
```

(Si `useQuery` ya está importado, no duplicar — solo añadir el segundo import si fuera necesario.)

Dentro del componente, añadir la query de records al lado de la de profile:

```ts
const { data: records = [] } = useQuery({
  queryKey: ["my-records"],
  queryFn: getMyRecords,
  staleTime: 5 * 60 * 1000,
})
```

(Si la queryKey `["my-records"]` ya se usa en otra parte, mantener el mismo nombre para que se comparta.)

Y dentro de la Card del avatar (la sticky de la izquierda), después del bloque que muestra el nombre y la nota "JPG, PNG o WebP · Máx 10MB", añadir:

```tsx
<div className="w-full pt-2">
  <ShareAthleteButton
    enabled={Boolean(profile?.gender) && records.length > 0}
    disabledReason={
      !profile?.gender
        ? "Completa tu género en el form de Perfil de atleta"
        : records.length === 0
          ? "Registra al menos una marca para generar tu ficha"
          : undefined
    }
  />
</div>
```

- [ ] **Step 5: Smoke test end-to-end**

Como un usuario con género, marcas, peso, altura, nivel:
1. Ir a `/portal/perfil` → Datos.
2. Verificar que aparece el botón "Compartir mi ficha" debajo del avatar.
3. Click → en desktop, debe descargar un PNG.
4. Abrir el PNG. Debe verse igual al diseño: fondo negro, logo, avatar con borde dorado, nombre, stats grid, quote, records, grand total, footer.
5. Como un usuario sin marcas: el botón aparece disabled.
6. Como un usuario sin género: el botón aparece disabled.

Probar en móvil (Android Chrome o iPhone Safari):
1. Repetir el flujo. En móvil con Web Share API, debe abrir el sheet de compartir nativo con la imagen ya adjunta.

- [ ] **Step 6: Typecheck**

```bash
npx tsc --noEmit --skipLibCheck
```

Esperado: PASS.

- [ ] **Step 7: Commit**

```bash
git add lib/hooks/use-share-athlete-card.ts components/section-components/portal/perfil/ShareAthleteButton.tsx components/section-components/portal/perfil/DatosTab.tsx package.json package-lock.json
git commit -m "feat(perfil): hook de captura PNG y botón Compartir mi ficha"
```

---

### Task 14: QA pass completo

**Files:** ninguno (solo verificación; cualquier fix se commitea aparte)

- [ ] **Step 1: Flujo feliz mujer**

Loguearse como una usuaria con género femenino, datos físicos llenos, `show_body_metrics = true`, y marcas registradas:
- `/portal/perfil` → Datos: ver las dos cards y el botón Compartir.
- Cambiar quote a una frase nueva, guardar, recargar, persiste.
- Ir a `/portal/descubrir`: tab por defecto = Mujeres. Ver ranking femenino y la grid.
- Click en la card de otra mujer: ver el modal con su sección "Datos del atleta" (si la tiene pública) y marcas.
- Volver a Datos → Compartir → verificar la PNG generada.

- [ ] **Step 2: Privacidad**

Como usuaria con `show_body_metrics = true`, registrar nota de los datos visibles. Cambiar a `show_body_metrics = false`. Loguearse como un segundo usuario. Abrir el modal de la primera: confirmar que NO se ven edad/peso/altura/nivel/atleta desde, pero sí nombre, género (en la tab) y quote (si la tiene).

- [ ] **Step 3: Validaciones**

En el form Perfil de atleta, probar valores fuera de rango:
- Peso 5 → error.
- Altura 50 → error.
- Fecha nacimiento 1900-01-01 → error.
- Quote con `<script>alert(1)</script>` → guarda sin los tags (sanitizado).

- [ ] **Step 4: Legacy (sin género)**

Loguearse como un miembro existente que aún no completó género:
- Ir a `/portal`: ver banner "Completa tu perfil de atleta".
- Click "Completar" → llega a `/portal/perfil`.
- En `/portal/descubrir`: NO aparece en ninguna tab (verificar con un segundo usuario que no se ve).
- Botón Compartir disabled con tooltip.

- [ ] **Step 5: Cambio de género**

Como un usuario que ya tiene género masculino, cambiarlo a femenino y guardar. Recargar `/portal/descubrir` desde otro usuario: el primero debe haber desaparecido de Hombres y aparecido en Mujeres.

- [ ] **Step 6: Share en iOS Safari real**

Probar en un iPhone real (Safari):
- `/portal/perfil` → tap "Compartir mi ficha".
- Debe aparecer el sheet nativo de Compartir con la imagen ya adjunta.
- Guardar en Fotos. Abrir la imagen: layout debe verse igual que en desktop, fuentes consistentes, colores correctos (dorado vivo, no opaco).
- Si algún elemento se ve roto (oklch leak, fuente fallback fea): anotar y crear un fix puntual.

- [ ] **Step 7: Dashboard admin no rompe**

Como admin, ir a `/dashboard/users`. Verificar que el listado de miembros sigue funcionando: filtros, edición. Los nuevos campos no son requeridos en ninguna pantalla del admin actual; solo asegurar que no haya errores en consola.

- [ ] **Step 8: Final typecheck**

```bash
npx tsc --noEmit --skipLibCheck
```

Esperado: PASS.

- [ ] **Step 9: Commit final si hubo fixes**

Si en este pase aparecieron fixes pequeños (ej. ajustar un margen del AthleteCard tras ver iOS), commitear con un mensaje descriptivo:

```bash
git add <archivos>
git commit -m "fix(perfil): ajustes post-QA en ficha compartible"
```

Si no hubo cambios, no commitear nada.

---

## Self-review post-plan

**Cobertura del spec:**
- ✅ Migración con 8 columnas → Task 1.
- ✅ Calculadora de edad → Task 2.
- ✅ `updateMyProfile` extendida con Zod → Task 3.
- ✅ `getMyVisibility` y `updateMyVisibility` con `show_body_metrics` → Task 3.
- ✅ Toggle Mostrar datos físicos → Task 5.
- ✅ Form Perfil de atleta en DatosTab → Task 6.
- ✅ Banner home si falta género → Task 7.
- ✅ Tabs Hombres/Mujeres en Descubrir → Task 8.
- ✅ Ranking dividido por género → Task 8.
- ✅ Ring de género en MemberCard → Task 9.
- ✅ Sección Datos del atleta en MemberDetailModal → Task 10.
- ✅ `getMyAthleteCardData` → Task 11.
- ✅ AthleteCard component 1080×1920 → Task 12.
- ✅ Hook captura + share + ShareAthleteButton → Task 13.
- ✅ QA en iOS Safari → Task 14.
- ✅ Edge cases (sin género, sin marcas, fallback download, sanitización quote) → distribuidos en Tasks 6, 11, 13, 14.

**Riesgos / decisiones que el implementador debe respetar:**
- En `AthleteCard.tsx` usar **inline styles con hex** y NO clases Tailwind con `oklch()` — esto es el pilar de B (html-to-image en iOS Safari).
- Avatar y logo deben tener `crossOrigin="anonymous"`.
- `pixelRatio: 2` en `toBlob` para output retina.
- Después de la migración, si `npx supabase gen types --linked` no funciona (proyecto no linkeado), usar el patrón que el proyecto ya use (puede requerir `--project-id <id>`). Si todo falla, regenerar manualmente añadiendo los campos al `members` Row/Insert/Update en `types/database.ts`.

---

## Execution

Plan listo y guardado en `docs/superpowers/plans/2026-05-04-portal-athlete-profile.md`.

Hay 14 tasks. Cada task termina en un commit verde (typecheck PASS + smoke test manual donde aplica). Si una task se rompe, no avanzar a la siguiente — diagnosticar antes.
