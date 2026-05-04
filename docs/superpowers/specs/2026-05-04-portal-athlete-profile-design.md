# Portal — Perfil de atleta, separación por género y ficha compartible

**Fecha:** 2026-05-04
**Sección afectada:** Portal de miembros (`/portal/perfil`, `/portal/descubrir`)
**Estado:** Diseño aprobado, pendiente plan de implementación

---

## Contexto

El portal de miembros ya tiene una sección **Descubrir** funcional con avatar, plan, RMs y ranking Top Grand Total, y un modal con la ficha pública del miembro (`MemberDetailModal`). Lo que falta:

1. Enriquecer la ficha pública con datos de atleta (edad, peso, altura, nivel, atleta desde, frase).
2. Separar a hombres y mujeres en Descubrir (tabs + rankings divididos).
3. Permitir que cada miembro complete su perfil de atleta desde Mi Perfil.
4. Generar una ficha visual compartible (PNG) con branding Madbox para redes sociales.

Estas mejoras suben la percepción de la plataforma de "gestión de gym" a "comunidad CrossFit elite", que es el posicionamiento de Madbox.

## Objetivos

- Cualquier miembro autenticado puede ver la ficha técnica de otro miembro (ya funciona) **enriquecida** con datos de atleta cuando los tenga públicos.
- Los miembros pueden filtrar Descubrir por género (tabs Hombres / Mujeres) y los rankings se calculan separados.
- Cada miembro completa fecha de nacimiento, peso, altura, atleta desde, nivel, género y frase desde su perfil.
- Cada miembro genera una ficha PNG (formato Stories 9:16) con su data + branding y la comparte vía Web Share API o descarga.

## Fuera de alcance

- Ranking competitivo por categoría/edad (solo dividimos por género).
- OG preview de la ficha (URL pública compartible) — la imagen es el artefacto, no un link.
- Compartir fichas ajenas desde Descubrir (solo se puede compartir la propia).
- Edición de datos de atleta de otros miembros desde el dashboard admin (ese flujo no se toca, solo la ficha del miembro logueado).
- Lesiones / notas médicas / objetivos personales (privados, fuera de scope inicial).

---

## Arquitectura

### Modelo de datos

Migración nueva: `supabase/migrations/<YYYYMMDDHHMMSS>_athlete_profile_setup.sql` (mismo formato que las migraciones existentes, ej. `20260504120000_athlete_profile_setup.sql`).

```sql
ALTER TABLE public.members
  ADD COLUMN IF NOT EXISTS gender text CHECK (gender IN ('male','female')),
  ADD COLUMN IF NOT EXISTS birth_date date,
  ADD COLUMN IF NOT EXISTS weight_kg numeric(5,2),
  ADD COLUMN IF NOT EXISTS height_cm numeric(5,1),
  ADD COLUMN IF NOT EXISTS athlete_since date,
  ADD COLUMN IF NOT EXISTS athlete_level text CHECK (athlete_level IN ('rx','scaled','beginner')),
  ADD COLUMN IF NOT EXISTS quote text,
  ADD COLUMN IF NOT EXISTS show_body_metrics boolean DEFAULT false NOT NULL;
```

Decisiones:

- `gender` es nullable. Los miembros legacy verán un nudge para completarlo. Sin `gender`, no aparecen en Descubrir.
- `gender` es siempre público — necesario para tabs y rankings divididos. Si está completo, se ve.
- `show_body_metrics` agrupa la visibilidad pública de **edad, peso, altura, nivel y atleta desde**. Default `false` (privacidad por defecto).
- `quote` es público cuando está lleno (mismo trato que `name`).
- `birth_date` se almacena exacta pero **nunca** se expone públicamente — solo se calcula y publica la edad en años.
- `athlete_level` describe con qué se entrena, no es un ranking competitivo.
- Después de la migración: `npx supabase gen types typescript --local > types/database.ts` para regenerar tipos.

### RLS

Los nuevos campos heredan las políticas existentes de `members` (`members_select_own`, `members_update_own`). Las acciones que devuelven perfil público de otros miembros usan `createAdminClient()` (igual que el patrón existente en `lib/actions/records.ts`) y aplican el filtro de visibilidad **server-side** antes de devolver datos al cliente.

---

## Componentes y flujos

### 1. Mi Perfil → pestaña Datos

**Archivo:** `components/section-components/portal/perfil/DatosTab.tsx`

Se agrega una **segunda Card** debajo de "Datos personales" titulada "Perfil de atleta", con su propio formulario (RHF + zodResolver, mismo patrón que la card existente).

Layout (mobile-first, 1 col → 2 cols en sm):

```
┌──────────────────────────────────────────────────────┐
│  Perfil de atleta                                    │
├──────────────────────────────────────────────────────┤
│  Género *           [○ Hombre  ○ Mujer]             │
│  Fecha de nacimiento  [📅 dd/mm/aaaa]               │
│  Peso (kg)            [—]    Altura (cm)  [—]       │
│  Atleta desde         [📅 mes/año]                  │
│  Nivel              [▼ Rx / Scaled / Principiante]  │
│  Frase / lema (opcional)                            │
│  [textarea, máx 120 chars]                          │
│              [Guardar cambios]                       │
└──────────────────────────────────────────────────────┘
```

Validaciones (Zod, cliente y server):

| Campo            | Regla                                                     |
| ---------------- | --------------------------------------------------------- |
| `gender`         | `z.enum(['male','female'])`. Obligatorio para Descubrir.  |
| `birth_date`     | año entre 1940 y hoy; edad ≥ 8.                           |
| `weight_kg`      | `z.coerce.number().min(30).max(250)`. Hasta 1 decimal.    |
| `height_cm`      | `z.coerce.number().int().min(100).max(220)`.              |
| `athlete_since`  | no futura, ≥ 2010. UI: mes+año; persistido como primer día del mes (`YYYY-MM-01`). |
| `athlete_level`  | `z.enum(['rx','scaled','beginner'])`.                     |
| `quote`          | `z.string().trim().max(120)`. Sanitizar tags HTML.        |

Si el usuario aún no tiene `gender`, mostrar un alert sutil arriba del form: *"Completa tu género para aparecer en Descubrir."*

**Botón "Compartir mi ficha"** se ubica dentro de la card del avatar (la sticky de la izquierda en desktop), justo debajo del nombre. Solo visible si:
- `gender !== null`,
- existe al menos un `personal_records` row para el miembro.

Si no cumple, mostrar el botón **disabled** con tooltip explicando el motivo.

### 2. Mi Perfil → pestaña Privacidad

**Archivo:** `components/section-components/portal/perfil/PrivacidadTab.tsx`

Se agrega un toggle nuevo entre "Mostrar mis RMs" y "Mostrar mis WODs":

- **Mostrar datos físicos** — *"Otros verán tu edad, peso, altura, nivel y desde cuándo entrenas. Tu fecha de nacimiento exacta nunca se muestra."*

El toggle reusa el patrón master/slave existente: si `discoverable = false`, este toggle aparece atenuado.

### 3. Server actions

**Archivo:** `lib/actions/portal.ts`

Extender:

- `getMyProfile()` — ya devuelve la fila completa, con la migración los campos nuevos vienen automáticamente.
- `updateMyProfile(data)` — extender el payload con todos los nuevos campos. Validar el body con un schema Zod local antes de pasarlo a Supabase. Llamar `revalidatePath('/portal/perfil')`, `revalidatePath('/portal')`, `revalidatePath('/portal/descubrir')`.
- `getMyAthleteCardData()` (nueva) — devuelve un payload denso para la ficha compartible:
  ```ts
  {
    name: string
    avatarUrl: string | null
    planName: string | null
    gender: 'male' | 'female'
    age: number | null            // calculada server-side
    weightKg: number | null
    heightCm: number | null
    athleteSinceYear: number | null
    athleteLevel: 'rx' | 'scaled' | 'beginner' | null
    quote: string | null
    totals: { grand: number; olympic: number; squat: number; press: number }
    topRecords: Array<{ movement: MovementId; label: string; weightKg: number }>  // top 6 ordenados por peso
  }
  ```
  Lanza error si `gender === null` o si no hay records (defensa server-side; el cliente ya bloquea el botón).

**Archivo:** `lib/actions/records.ts`

Extender:

- `getMyVisibility()` y `updateMyVisibility()` — agregar `show_body_metrics` al tipo `VisibilitySettings`.
- `getDiscoverableMembers(filters: { gender: 'male' | 'female'; search?: string })` — cambiar la firma. Filtra por `gender` además de `discoverable = true`. Excluye miembros con `gender = null`.
- `getMemberPublicProfile(memberId)` — devuelve adicionalmente `gender`, `quote` (siempre que estén llenos) y, **solo si `show_body_metrics = true`**: `age` (calculada), `weightKg`, `heightCm`, `athleteLevel`, `athleteSinceYear`.
- `getTopByCategory(category, gender)` — añadir parámetro `gender`. Filtra `members` por `gender = $1` además de `discoverable = true` y `show_rms = true`.

Helper `calculateAge(birthDate: string)` en `lib/utils.ts` para reusar el cálculo año-redondeado entre server y client.

### 4. Descubrir con tabs

**Archivo:** `components/section-components/portal/descubrir/PortalDescubrirMainComponent.tsx`

Layout nuevo:

```
┌────────────────────────────────────────────────────┐
│  Descubrir                                         │
│  Conoce a la comunidad de Madbox                   │
│                                                    │
│  ┌────────────┬────────────┐                       │
│  │ 👨 Hombres │ 👩 Mujeres │  ← Tabs (shadcn)     │
│  └────────────┴────────────┘                       │
│                                                    │
│  ┌──────────────────────────────────┐             │
│  │ 🏆 Top Grand Total — Masculino   │             │
│  │ [1°][2°][3°]                     │             │
│  └──────────────────────────────────┘             │
│                                                    │
│  🔍 Buscar miembro...                              │
│                                                    │
│  Comunidad masculina (12 miembros)                 │
│  [card] [card] [card]                              │
└────────────────────────────────────────────────────┘
```

- Tab por defecto: la del **mismo género del usuario logueado**. Si el usuario no tiene género (legacy), default Hombres + un nudge inline *"Completa tu perfil para aparecer en Descubrir"*.
- `RankingStrip` recibe prop `gender` y refleja el título "Top Masculino" / "Top Femenino" + queryKey `['discover-top', 'grand', gender]`.
- `getDiscoverableMembers` se llama con `{ gender }`. queryKey `['discoverable-members', gender]`.

**Archivo:** `components/section-components/portal/descubrir/MemberCard.tsx`

Cambios mínimos: el avatar gana un `ring` sutil de color según `gender` para reforzar la separación visual sin saturar (azul fino `ring-blue-500/30` para hombre, rosa fino `ring-pink-500/30` para mujer). Si no hay género, sin ring.

**Archivo:** `components/section-components/portal/descubrir/MemberDetailModal.tsx`

Sección nueva "Datos del atleta" entre el header del miembro y `TotalsStrip`:

```
┌──────────────────────────────────────────────┐
│  Datos del atleta                            │
│  Edad     Peso     Altura     Nivel          │
│  28 años  78 kg    182 cm     Rx             │
│  Atleta desde Mar 2023                       │
│  "Stronger every day."                       │
└──────────────────────────────────────────────┘
```

- Solo se muestra si `show_body_metrics = true` o si hay `quote`.
- Si solo hay `quote`, se muestra sola en italics.
- Si `show_body_metrics = false` y no hay `quote`, se omite la sección entera.

### 5. Banner home

**Archivo:** `components/section-components/portal/home/PortalHomeMainComponent.tsx`

Si el `member` cargado tiene `gender === null`, mostrar un Card sutil de aviso arriba del contenido principal:

> "Completa tu perfil de atleta para aparecer en Descubrir y compartir tu ficha." [Botón → /portal/perfil]

No bloqueante, dismissible no es necesario (desaparece al completar el género).

### 6. Ficha compartible (AthleteCard PNG)

**Decisión técnica:** generación **client-side** con `html-to-image` (npm). Se asume el riesgo de quirks en iOS Safari y se mitiga con las medidas listadas abajo.

**Componente:** `components/section-components/portal/perfil/AthleteCard.tsx`

- Renderizado en un `div` **fuera de pantalla** (`position: fixed; left: -99999px; top: 0; pointer-events: none; z-index: -1`) con dimensiones fijas **1080×1920px** (ratio 9:16, óptimo para Stories).
- No se monta hasta que el usuario aprieta "Compartir mi ficha".
- Recibe la data ya lista del hook `useShareAthleteCard`.

Diseño visual:

```
╔══════════════════════════════════════════════╗
║  [logo MADBOX dorado, esquina sup. izq.]    ║
║                                              ║
║              ╭──────────╮                    ║
║              │  AVATAR  │  ← 280px           ║
║              ╰──────────╯                    ║
║                                              ║
║          NOMBRE COMPLETO                     ║
║          ━━━━━━━━━━━━━ (línea dorada)         ║
║          PLAN PREMIUM · ATLETA DESDE 2023    ║
║                                              ║
║    ┌──────┬──────┬──────┬──────┐            ║
║    │ EDAD │ PESO │ ALTURA│ NIVEL│            ║
║    │  28  │  78  │  182  │  RX  │            ║
║    │ AÑOS │  KG  │  CM   │      │            ║
║    └──────┴──────┴──────┴──────┘            ║
║                                              ║
║       "Stronger every day."                  ║
║                                              ║
║    ─────  RECORDS PERSONALES  ─────          ║
║                                              ║
║    BACK SQUAT      ─────  140 KG             ║
║    DEADLIFT        ─────  180 KG             ║
║    SNATCH          ─────   85 KG             ║
║    CLEAN & JERK    ─────  110 KG             ║
║    BENCH PRESS     ─────   95 KG             ║
║    STRICT PRESS    ─────   60 KG             ║
║                                              ║
║         ╔═══════════════════════╗           ║
║         ║   GRAND TOTAL         ║           ║
║         ║      670 KG           ║           ║
║         ╚═══════════════════════╝            ║
║                                              ║
║        madbox · crossfit elite               ║
╚══════════════════════════════════════════════╝
```

Especificaciones de estilo:

- Fondo: gradiente `#0a0a0a` → `#171717` (de arriba a abajo).
- Acento primario: `#FACC15` (Tailwind yellow-400, hex). **No usar `oklch()` en este componente** — html-to-image en iOS Safari falla con esa función.
- Texto principal: `#fafafa`. Labels secundarios: `#a1a1aa`.
- Tipografía: **Inter** (variable, ya disponible vía `next/font`) para texto y números. **Bebas Neue** o **Oswald** para "GRAND TOTAL", el nombre y los headers de sección — fuente condensada típica de gimnasios. Cargar con `next/font/google` y embebida vía `@font-face` antes de capturar.
- Logo: **SVG inline** del logo Madbox, no remoto. Si hoy el logo es PNG, importarlo desde `public/` y embebido como `<img>` con `crossOrigin="anonymous"`.
- Avatar: viene de Cloudinary (CORS-safe). En el `<img>`, agregar `crossOrigin="anonymous"`.
- Detalles: línea fina dorada bajo el nombre (1px), grid de stats con borde dorado fino (1px), Grand Total dentro de un box con borde dorado más grueso (2px) y leve glow `box-shadow: 0 0 30px rgba(250,204,21,0.15)`. Sin sombras pesadas.

**Hook:** `lib/hooks/use-share-athlete-card.ts`

```ts
export function useShareAthleteCard() {
  // 1. Fetch data: useMutation que llama getMyAthleteCardData()
  // 2. Mount AthleteCard offscreen con la data
  // 3. await Promise.all(images loaded) — incluye avatar y logo
  // 4. await new Promise(r => setTimeout(r, 50)) — let fonts settle
  // 5. const blob = await toBlob(node, { pixelRatio: 2, cacheBust: true })
  // 6. Build File: new File([blob], `madbox-${slug(name)}.png`, { type: 'image/png' })
  // 7. if (navigator.canShare?.({ files: [file] }))
  //      → await navigator.share({ files: [file], title: 'Mi ficha Madbox' })
  //    else
  //      → trigger <a download> con URL.createObjectURL
  // 8. Unmount AthleteCard
  // 9. Toast de éxito o error
}
```

Caveats blindados:

- Reemplazar TODOS los colores `oklch()` por hex en `AthleteCard.tsx` (no afecta al resto del portal — solo este componente puntual).
- `crossOrigin="anonymous"` en avatar y logo `<img>`.
- Logo SVG inline preferible. Si es PNG, debe estar en `public/` (mismo origen).
- Cloudinary devuelve header `Access-Control-Allow-Origin: *` por default, ya está bien.
- Esperar a que las imágenes hayan cargado (`img.decode()` o `onload`) antes de llamar `toBlob`.
- `pixelRatio: 2` para que la imagen final sea 2160×3840 (retina).
- En iOS, si Web Share API rechaza el File (algunas versiones), fallback a download con `<a>`.

---

## Privacidad — matriz pública

| Campo                                         | Visible para otros si...                           |
| --------------------------------------------- | -------------------------------------------------- |
| `name`                                        | Siempre (ya hoy)                                   |
| `avatar_url`                                  | `show_avatar = true` (ya hoy)                      |
| `plan.name`                                   | `show_plan = true` (ya hoy)                        |
| Marcas, totales, ranking                      | `show_rms = true` (ya hoy)                         |
| WODs recientes                                | `show_wods = true` (ya hoy)                        |
| `gender`                                      | Siempre, si está lleno                             |
| `quote`                                       | Siempre, si está lleno                             |
| Edad, peso, altura, nivel, atleta desde       | `show_body_metrics = true`                         |
| `birth_date` exacta                           | **Nunca** públicamente — solo se computa edad      |

Las server actions que sirven datos públicos (`getDiscoverableMembers`, `getMemberPublicProfile`, `getTopByCategory`) son las únicas responsables de aplicar este filtrado. **No** se devuelven los campos crudos al cliente para filtrar allá.

---

## Edge cases

1. **Miembros legacy sin género** — no aparecen en ninguna tab de Descubrir hasta completar `gender`. Banner en home + alert en perfil.
2. **Miembro sin marcas** — botón "Compartir mi ficha" disabled con tooltip *"Registra al menos una marca para generar tu ficha"*.
3. **Avatar nulo** — la ficha compartible muestra fallback con iniciales sobre fondo dorado degradado.
4. **Web Share API no disponible** (desktop, navegadores viejos) — fallback a descarga directa. Toast: *"Imagen descargada — compártela donde quieras"*.
5. **Captura falla** — toast de error claro: *"No pudimos generar la imagen. Intenta de nuevo o contacta a un admin."* No romper la app.
6. **Cambio de género posterior** — permitido. Re-validamos `/portal/descubrir` y queries TanStack tras el update.
7. **Tab por defecto sin género** — Hombres por defecto + nudge.
8. **Quote con caracteres especiales** — sanitizar tags HTML server-side. En la ficha compartible, truncar visualmente a 80-100 chars con ellipsis si llegara a desbordar.

---

## Re-validación e invalidaciones

Después de `updateMyProfile`:

- `revalidatePath('/portal/perfil')`
- `revalidatePath('/portal')`
- `revalidatePath('/portal/descubrir')`

TanStack Query (en `onSuccess` de mutations):

- `['my-profile']`
- `['my-visibility']`
- `['discoverable-members', gender]`
- `['discover-top', 'grand', gender]`
- `['member-public', memberId]` (si aplica)

---

## Plan de testing manual

1. **Flujo feliz** — completar perfil de atleta, ver tab Mujeres en Descubrir, click en otra atleta, ver ficha enriquecida, generar mi ficha PNG, compartir.
2. **Privacidad** — desactivar `show_body_metrics`, abrir el perfil con un segundo usuario y verificar que NO ve edad/peso/altura/nivel/atleta desde, pero sí nombre, marcas (si aplica), género y quote.
3. **Discover gender filter** — crear 2 miembros ficticios (uno hombre, uno mujer) con marcas, verificar que cada tab solo muestra los suyos y los rankings se computan separados.
4. **Validaciones** — peso 5, altura 50, fecha año 1900, quote con `<script>` → debe rechazar/sanitizar.
5. **Legacy** — miembro existente entra a `/portal`: ve banner, no aparece en Descubrir hasta completar género.
6. **Share card en iOS Safari real** — captura debe verse idéntica a desktop. Probar también Android Chrome.
7. **Sin marcas** — botón Compartir disabled con tooltip.
8. **Permisos admin** — desde el dashboard admin (`/dashboard/users`), verificar que los nuevos campos NO rompen el listado de miembros (probablemente toque un pequeño ajuste si se muestran columnas adicionales).
9. **Cambio de email + perfil de atleta a la vez** — confirmar que ambas mutations se aplican y la verificación de email sigue saliendo.

---

## Riesgos

- **Render con `html-to-image` en iOS Safari** (riesgo aceptado al elegir B). Mitigación: hex en vez de oklch, fuentes embebidas, logo SVG inline, prueba real en iPhone como gate de QA antes de merge.
- **Tipos desincronizados** — olvidar regenerar `types/database.ts` tras la migración rompería compilación. Incluir el comando como paso explícito del plan de implementación.
- **Performance Descubrir** — con cientos de miembros, `getDiscoverableMembers` ya hace un `.in('member_id', memberIds)` para records. Por género se reduce a la mitad, no es un problema. No requiere índices nuevos por ahora.
