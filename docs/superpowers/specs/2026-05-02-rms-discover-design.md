# RMs y Descubrir — Diseño

**Fecha:** 2026-05-02
**Estado:** Aprobado para writing-plans
**Spec relacionada (futura):** WOD logging (separada)

## Contexto y motivación

Los miembros del gimnasio (clientes del portal `/portal`) llevan registro mental o en cuadernos de sus marcas personales (Personal Records / PRs / RMs) en movimientos clásicos de halterofilia y CrossFit. Queremos:

1. Centralizar el registro de RMs en su perfil del portal.
2. Calcular automáticamente totales por familia para ver progreso global.
3. Habilitar una sección "Descubrir" donde los miembros vean a otros, fomentando comunidad y competencia sana.
4. Respetar privacidad con toggles granulares (un miembro puede esconderse, ocultar su plan, su avatar, o sus RMs sin desaparecer del todo).

**Restricciones del contexto:**
- Modo oscuro fijo + amarillo primario (sistema de diseño existente).
- Idioma español en UI; nombres de movimientos en inglés (estándar CrossFit).
- Acceso solo desde el portal (`/portal/*`); admins no necesitan UI nueva (acceso vía DB si se requiere moderación).

## Decisiones de scope

- **Solo RMs (records achievados)**, no metas/objetivos. Si en el futuro quieren targets, se agrega sin romper.
- **Lista predefinida fija** de 17 movimientos. No se permiten custom para mantener Discover comparable entre miembros.
- **Peso + fecha (opcional)** por RM. Sin historial — actualizar sobrescribe el PR vigente.
- **4 totales calculados automáticamente**: Olympic, Squat, Press, Grand. (Sin "CrossFit Total" oficial porque pediste quitar Strict Press.)
- **Visible por defecto** + 4 toggles granulares por miembro.
- **Modal** para ver detalle de otros miembros (no página dedicada — no necesitamos deep linking).

## Lista de movimientos (17)

Organizados por familia. Los `id` son la clave en DB (text + CHECK), los `label` son el display en UI.

### Halterofilia / Olympic
| id | label | Olympic Total |
|---|---|---|
| `snatch` | Snatch | ✓ |
| `power_snatch` | Power Snatch | |
| `hang_squat_snatch` | Hang Squat Snatch | |
| `hang_power_snatch` | Hang Power Snatch | |
| `clean` | Clean | |
| `power_clean` | Power Clean | |
| `hang_squat_clean` | Hang Squat Clean | |
| `hang_power_clean` | Hang Power Clean | |
| `clean_and_jerk` | Clean & Jerk | ✓ |

### Squats
| id | label | Squat Total |
|---|---|---|
| `back_squat` | Back Squat | ✓ |
| `front_squat` | Front Squat | ✓ |
| `overhead_squat` | Overhead Squat | ✓ |

### Presses & Jerks
| id | label | Press Total |
|---|---|---|
| `push_press` | Push Press | ✓ |
| `push_jerk` | Push Jerk | ✓ |
| `split_jerk` | Split Jerk | ✓ |

### Pulls
| id | label |
|---|---|
| `deadlift` | Deadlift |

### Hybrid
| id | label |
|---|---|
| `thruster` | Thruster |

## Totales

Calculados sobre la marcha al renderizar (no se cachean en DB en esta versión).

- **Olympic Total** = `snatch` + `clean_and_jerk`
- **Squat Total** = `back_squat` + `front_squat` + `overhead_squat`
- **Press Total** = `push_press` + `push_jerk` + `split_jerk`
- **Grand Total** = suma de los 17 RMs

Faltantes cuentan como 0 en cualquier total. Si un miembro no tiene ningún RM en una categoría, su total para esa categoría es 0 (no se muestra como N/A).

## Modelo de datos

### Tabla nueva: `personal_records`

```sql
CREATE TABLE public.personal_records (
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

CREATE INDEX personal_records_member_id_idx ON public.personal_records(member_id);
```

### ALTER `members`

```sql
ALTER TABLE public.members
  ADD COLUMN IF NOT EXISTS discoverable boolean NOT NULL DEFAULT true,
  ADD COLUMN IF NOT EXISTS show_plan boolean NOT NULL DEFAULT true,
  ADD COLUMN IF NOT EXISTS show_avatar boolean NOT NULL DEFAULT true,
  ADD COLUMN IF NOT EXISTS show_rms boolean NOT NULL DEFAULT true;

CREATE INDEX IF NOT EXISTS members_discoverable_idx ON public.members(discoverable) WHERE discoverable = true;
```

Defaults `true` para miembros existentes (consent implícito; se asume cultura de gym + comunicación al lanzar).

### RLS

**`personal_records`:**

```sql
ALTER TABLE public.personal_records ENABLE ROW LEVEL SECURITY;

-- SELECT: propio O admin (las lecturas cross-member van vía admin client en server actions)
CREATE POLICY "personal_records_self_or_admin_select" ON public.personal_records
  FOR SELECT TO authenticated
  USING (
    EXISTS (SELECT 1 FROM public.admins WHERE auth_user_id = auth.uid())
    OR member_id IN (SELECT id FROM public.members WHERE auth_user_id = auth.uid())
  );

-- WRITE: solo propio
CREATE POLICY "personal_records_own_write" ON public.personal_records
  FOR ALL TO authenticated
  USING (member_id IN (SELECT id FROM public.members WHERE auth_user_id = auth.uid()))
  WITH CHECK (member_id IN (SELECT id FROM public.members WHERE auth_user_id = auth.uid()));
```

**`members`:** **NO se agregan policies nuevas.** Se mantienen las existentes (propio + admin). Las lecturas cross-member para Discover corren vía `@/utils/supabase/admin` (service role) dentro del server action, que aplica:

1. Verificación de auth: `supabase.auth.getUser()` antes de cualquier query.
2. Filtro de columnas explícito: el `select()` solo pide `id, name, avatar_url, plan_id, start_date, discoverable, show_plan, show_avatar, show_rms` — nunca `email`, `phone`, `payment_date`, `due_date`, etc.

Esto concentra el "bypass de RLS" en las 2 server actions controladas (`getDiscoverableMembers`, `getMemberPublicProfile`) en vez de exponer toda la tabla a cualquier query autenticado.

## Server actions

Archivo: `lib/actions/records.ts`

```ts
"use server"

// Movement constants
export type MovementId = 'snatch' | 'power_snatch' | ... // los 17

// Mis records
export async function getMyRecords(): Promise<PersonalRecord[]>
export async function upsertRecord(input: {
  movement: MovementId
  weight_kg: number
  achieved_at?: string | null
}): Promise<PersonalRecord>
export async function deleteRecord(movement: MovementId): Promise<void>

// Visibilidad
export async function getMyVisibility(): Promise<{
  discoverable: boolean
  show_plan: boolean
  show_avatar: boolean
  show_rms: boolean
}>
export async function updateMyVisibility(input: {
  discoverable?: boolean
  show_plan?: boolean
  show_avatar?: boolean
  show_rms?: boolean
}): Promise<void>

// Discover
export async function getDiscoverableMembers(search?: string): Promise<DiscoverableMember[]>
export async function getMemberPublicProfile(memberId: string): Promise<MemberPublicProfile>
export async function getTopByCategory(
  category: 'grand' | 'olympic' | 'squat' | 'press'
): Promise<RankingEntry[]>  // top 3
```

**Tipos compartidos** (en mismo archivo o `lib/types/records.ts`):

```ts
type DiscoverableMember = {
  id: string
  name: string
  avatar_url: string | null  // null si show_avatar=false
  plan_name: string | null   // null si show_plan=false o sin plan
  totals: {                  // todos null si show_rms=false
    grand: number
    olympic: number
    squat: number
    press: number
  } | null
  top_records: Array<{ movement: MovementId, weight_kg: number }>  // 2-3 mejores; vacío si show_rms=false
}

type MemberPublicProfile = DiscoverableMember & {
  start_date: string | null    // siempre visible si discoverable
  records: PersonalRecord[]    // todos, ordenados por familia y movement; vacío si show_rms=false
}
```

**Importante:** Estas funciones jamás devuelven `email`, `phone`, `payment_date`, `due_date`, ni cualquier otro dato privado. Aún si el query trae todo, el server action solo expone los campos arriba listados.

**Logging:**
- `upsertRecord` → `logActivity({ action: 'pr_updated', entityType: 'personal_record', ... })`
- `deleteRecord` → `logActivity({ action: 'pr_deleted', ... })`
- Cambios de visibilidad: NO se loguean (sería ruido).

Extender `lib/actions/activity.ts`:
- `ActivityAction` += `'pr_updated' | 'pr_deleted'`
- `EntityType` += `'personal_record'`

### Constantes

Archivo: `lib/constants/movements.ts`

```ts
export type MovementFamily = 'olympic' | 'squat' | 'press' | 'pull' | 'hybrid'

export interface Movement {
  id: MovementId
  label: string                    // display en UI
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
```

## UI / Componentes

### Portal Layout — agregar item al nav

`app/portal/layout.tsx`:
```ts
import { Compass } from "lucide-react"

const nav = [
  { name: "Inicio", href: "/portal", icon: Home },
  { name: "Descubrir", href: "/portal/descubrir", icon: Compass },  // NEW
  { name: "Clases", href: "/portal/clases", icon: Calendar },
  { name: "Pagos", href: "/portal/pagos", icon: CreditCard },
  { name: "Perfil", href: "/portal/perfil", icon: User },
]
```

### Mi Perfil con tabs

`PortalPerfilMainComponent.tsx` se reorganiza con `<Tabs>`:

```
<Tabs defaultValue="datos">
  <TabsList>
    <TabsTrigger value="datos">Datos</TabsTrigger>
    <TabsTrigger value="marcas">Marcas</TabsTrigger>
    <TabsTrigger value="privacidad">Privacidad</TabsTrigger>
  </TabsList>
  <TabsContent value="datos"><DatosTab /></TabsContent>
  <TabsContent value="marcas"><MarcasTab /></TabsContent>
  <TabsContent value="privacidad"><PrivacidadTab /></TabsContent>
</Tabs>
```

Componentes nuevos:
- `components/section-components/portal/perfil/DatosTab.tsx` — extrae el contenido actual (avatar + form + cambiar contraseña)
- `components/section-components/portal/perfil/MarcasTab.tsx`
- `components/section-components/portal/perfil/PrivacidadTab.tsx`
- `components/section-components/portal/perfil/edit-record-modal.tsx` — modal pequeño para editar un PR

### MarcasTab

Layout:
- **Strip de totales** arriba (4 cards horizontales en mobile / 4 cols en desktop): Grand · Olympic · Squat · Press
- **Lista por familia** debajo: cada familia un Card con header de family, body con filas de movimiento
- Cada fila: nombre del movimiento + peso (o "—") + fecha en gris pequeño + ✎ al hover
- Click en fila → `EditRecordModal` con peso (input number) + fecha (date input, opcional, default hoy) + botones Guardar / Borrar (si existe)
- Toast de confirmación al guardar/borrar
- Invalidación de query `['my-records']` y `['portal-today-routine']` (este último no aplica, ignorar)

### PrivacidadTab

4 toggles con descripción cada uno:
- "Aparecer en Descubrir" (master)
- "Mostrar avatar"
- "Mostrar plan"
- "Mostrar mis RMs"

Si master OFF: los otros 3 quedan visualmente deshabilitados (`opacity-50 pointer-events-none`) con texto "Activa Aparecer en Descubrir primero". El estado del toggle se mantiene (no se fuerza OFF) para que cuando reactiven master, vuelva a su estado previo.

Mutación en `onCheckedChange` con debounce de 300ms para evitar spam si el user toquetea. Toast de éxito.

### Página /portal/descubrir

`app/portal/descubrir/page.tsx`:
```tsx
import PortalDescubrirMainComponent from "@/components/section-components/portal/descubrir/PortalDescubrirMainComponent"
export default function Page() { return <PortalDescubrirMainComponent /> }
```

`PortalDescubrirMainComponent.tsx`:
- Header con h1 "Descubrir" + subtítulo
- `RankingStrip`: top 3 de Grand Total con podio visual (1° más grande, 2° y 3° flanqueando)
- Search input (filtro client-side por `name.includes(query)`)
- Grid de `MemberCard`s: 1 col mobile, 2 cols `sm:`, 3 cols `lg:`
- Empty state si no hay miembros discoverable

`MemberCard.tsx`:
- Avatar grande arriba (o iniciales si `show_avatar=false`)
- Nombre + plan (si `show_plan`)
- Grand Total grande
- Lista de top 2-3 PRs (movimientos con mayor peso, si `show_rms`)
- Click → abre `MemberDetailModal` con `memberId`

`MemberDetailModal.tsx`:
- `<Dialog>` de shadcn
- Header: avatar + nombre + plan + miembro desde
- Strip de 4 totales
- Lista completa de RMs por familia (igual que MarcasTab pero solo lectura)
- Si `show_rms=false`: mensaje "Este miembro optó por no mostrar sus marcas"
- Cargar via `getMemberPublicProfile(id)` con `useQuery({ queryKey: ['member-public', id] })`

`RankingStrip.tsx`:
- Solo Grand Total por ahora (3 podio cards)
- Si menos de 3 miembros tienen Grand Total > 0: mostrar 1 o 2 cards (no forzar 3)
- Cada card: posición + avatar + nombre + total

## Seguridad / privacidad

**Patrón general:** las 3 server actions de cross-member read (`getDiscoverableMembers`, `getMemberPublicProfile`, `getTopByCategory`) usan `@/utils/supabase/admin` (service role), pero antes verifican autenticación:

```ts
const supabase = await createClient()
const { data: { user } } = await supabase.auth.getUser()
if (!user) throw new Error("Unauthorized")

const admin = createAdminClient()
const { data } = await admin
  .from('members')
  .select('id, name, avatar_url, plan_id, start_date, discoverable, show_plan, show_avatar, show_rms, plans(name)')  // allowlist explícito
  .eq('discoverable', true)
  // ...
```

**Reglas firmes:**
- `getMemberPublicProfile` valida que el `memberId` solicitado tenga `discoverable=true`. Si no: throw `Error("Member not found")` (no revelar que existe pero está oculto).
- Las server actions **nunca** devuelven `email`, `phone`, `payment_date`, `due_date`. Sí devuelven `start_date` (info benigna, ya visible en cards).
- Si `show_rms=false`: el server action devuelve `records: []` y `totals: null` para ese miembro. El cliente no necesita filtrar nada.
- Si `show_avatar=false`: `avatar_url=null` en la respuesta.
- Si `show_plan=false`: `plan_name=null` en la respuesta.
- **El cliente NO debe poder reconstruir info oculta haciendo queries directas:** RLS estricto en `members` y `personal_records` lo bloquea. Solo los 3 server actions de admin client tienen acceso cross-member, y filtran en origen.

## Validaciones

- Cliente (Zod):
  - `weight_kg`: number, > 0, ≤ 500, hasta 2 decimales
  - `achieved_at`: optional date, no futura
  - `movement`: enum de los 17 ids
- Servidor (Postgres CHECK constraints): mismas reglas, defensa en profundidad.

## Activity logging

Extender `lib/actions/activity.ts`:
- `ActivityAction` += `'pr_updated' | 'pr_deleted'`
- `EntityType` += `'personal_record'`

`upsertRecord` y `deleteRecord` llaman `logActivity` con `entityName` = label del movimiento.

## Migración de la DB

Archivo: `supabase/migrations/<timestamp>_personal_records_setup.sql`

Contiene:
1. CREATE TABLE personal_records + indexes
2. RLS + policies (`personal_records_self_or_admin_select` + `personal_records_own_write`)
3. ALTER members ADD discoverable, show_plan, show_avatar, show_rms (default true)
4. INDEX parcial en `members(discoverable) WHERE discoverable = true`

Aplicar con `supabase db push` y regenerar types con `supabase gen types typescript --linked > types/database.ts`.

## Out of scope (esta spec)

- WOD logging (spec separada — siguiente)
- Historial de PRs / gráfica de progreso temporal
- Metas/targets aspiracionales
- Compartir RMs externamente
- Photos/videos de lifts
- Filtros de Discover por plan
- Comparar miembros lado a lado
- Notificaciones de PRs rotos
- Toggle kg/lb
- Página dedicada `/portal/descubrir/[id]` (modal por ahora)

## Checklist de implementación (de alto nivel)

1. Migración DB + types regen
2. `lib/constants/movements.ts`
3. `lib/actions/records.ts` (server actions + tipos)
4. Activity types extension
5. `EditRecordModal`
6. `MarcasTab`
7. `PrivacidadTab`
8. Refactor `PortalPerfilMainComponent` con tabs (DatosTab + Marcas + Privacidad)
9. `RankingStrip`, `MemberCard`, `MemberDetailModal`
10. `PortalDescubrirMainComponent` + página
11. Agregar item "Descubrir" al nav del portal
12. QA manual end-to-end (incl. casos de privacidad)
