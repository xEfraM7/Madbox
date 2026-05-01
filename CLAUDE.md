# Madbox — Guía para Claude

Sistema de gestión de gimnasio: miembros, planes, pagos, clases especiales, cierres mensuales y control financiero multi-moneda (Bs / USD / USDT).

> Idioma del proyecto: **español**. Mensajes de UI, comentarios relevantes, nombres de acciones de log y commits se escriben en español.

---

## Stack

- **Next.js 16** (App Router, Server Actions, Server Components por defecto)
- **React 19**
- **TypeScript 5** (strict)
- **Supabase** (`@supabase/ssr` + `@supabase/supabase-js`) — Postgres, Auth, RLS
- **TanStack Query 5** para estado de servidor en cliente
- **Tailwind CSS 4** + **shadcn/ui** (Radix) + `tw-animate-css`
- **React Hook Form 7** + **Zod 3** para formularios
- **Sonner** para toasts; **SweetAlert2** para confirmaciones destructivas
- **date-fns 4**, **lucide-react**, **recharts**, **nodemailer**

---

## Estructura de carpetas

```
app/                     # Rutas (App Router). Páginas finas que renderizan SectionMainComponent.
  dashboard/<seccion>/   # Rutas protegidas
  login | forgot-password | reset-password | auth/confirm/

components/
  section-components/<seccion>/
    <Seccion>MainComponent.tsx   # Componente cliente principal de la sección
    modals/                      # Modales propios de la sección
    index.ts                     # Re-exporta el main
  shared/                # Layout del dashboard, modales globales, exchange-rate
  providers/             # QueryProvider (TanStack Query)
  ui/                    # shadcn/ui (no editar a mano salvo necesidad)

lib/
  actions/               # Server Actions ("use server"): TODA la lógica de negocio
  hooks/                 # Hooks de cliente (use-permissions, etc.)
  utils.ts               # cn(), getNextMonthDate(), calculateDueDate()

types/database.ts        # Tipos generados de Supabase (no editar a mano)

utils/supabase/
  client.ts              # Cliente para Client Components
  server.ts              # Cliente SSR (cookies)
  admin.ts               # service_role (solo server, nunca exponer)
  middleware.ts          # Helper de middleware

middleware.ts            # Auth gate de Next: redirige a /login si no hay user
```

---

## Reglas de arquitectura

### 1. Server Actions son la única vía a la base de datos
- Todo acceso a Supabase vive en `lib/actions/*.ts` con `"use server"` al tope.
- Los Client Components **nunca** importan `@/utils/supabase/client` para CRUD de negocio; consumen Server Actions vía TanStack Query o invocaciones directas.
- Después de mutar, llamar `revalidatePath("/dashboard/...")` en las rutas afectadas y registrar con `logActivity(...)` cuando aplique.
- Lanzar `throw error` en errores de Supabase para que TanStack Query los capture.

### 2. Páginas finas, componentes gordos
- Cada `app/dashboard/<seccion>/page.tsx` solo renderiza `<SeccionMainComponent />`.
- La lógica de UI, estado y queries vive en `components/section-components/<seccion>/`.

### 3. Cliente de Supabase correcto según contexto
- **Server Action / Route Handler / Server Component** → `createClient()` de `@/utils/supabase/server`.
- **Client Component** → solo si es Auth puro (login/logout); el resto pasa por Server Actions.
- **Tareas administrativas que requieren bypass de RLS** → `@/utils/supabase/admin` (service_role). Usar con cuidado, nunca importar desde código que pueda llegar al cliente.

### 4. Permisos
- Server-side: validar con la función equivalente a `getCurrentAdminPermissions()` en `lib/actions/roles.ts` antes de mutar.
- Client-side: usar `usePermissions()` de `@/lib/hooks/use-permissions`.
  - Patrón: `if (!hasPermission('payments.edit')) ocultar/disabled`.
  - El admin con flag `isAdmin` tiene todos los permisos.
- Permisos disponibles: `dashboard.view`, `users.{view,edit,delete}`, `plans.{view,edit,delete}`, `payments.{view,edit,delete}`, `classes.{view,edit,delete}`, `roles.{view,create,edit,delete}`, `settings.{view,edit}`, `closings.{view,edit,delete}`.

### 5. TanStack Query
- `QueryProvider` ya está montado en `app/layout.tsx` con `staleTime: 60s` y `refetchOnWindowFocus: false`.
- Convención de `queryKey`: array con el recurso y los filtros: `['members']`, `['payments', { month, year }]`.
- Permisos: `staleTime: 5 * 60 * 1000` (5 min).
- Después de mutaciones: `queryClient.invalidateQueries({ queryKey: [...] })` en `onSuccess`.

### 6. Formularios
- React Hook Form + `zodResolver` (`@hookform/resolvers/zod`).
- Schemas Zod conviven con el componente de formulario o en un `schema.ts` cercano.
- Inputs usan `components/ui/*` de shadcn.

### 7. Tipos
- Importar tipos de tabla desde `@/types/database`: `Tables<"members">`, `TablesInsert<"payments">`, `TablesUpdate<"plans">`.
- No redefinir manualmente formas de filas; si falta un tipo, regenerar `types/database.ts` desde Supabase.

---

## Modelo de datos (resumen)

| Tabla | Notas |
|---|---|
| `admins` | FK `role_id → roles.id`, `auth_user_id → auth.users.id` |
| `members` | FK `plan_id → plans.id`. Estados: `active`, `expired`, `frozen` |
| `plans` | `price`, `duration`, `features[]`, `active` |
| `payments` | FK `member_id`, `plan_id`. Campos: `amount`, `method`, `status`, `payment_date`, `due_date`, `payment_rate`, `reference` |
| `special_classes` | Clases con `instructor`, `schedule`, `price`, `capacity`, `enrolled` |
| `special_class_payments` | FK `class_id`, `member_id` |
| `roles` | `permissions[]` (string[] con los permisos listados arriba) |
| `gym_settings` | Singleton de configuración |
| `gym_schedule` | Horarios por `day_of_week` |
| `monthly_closings` | Snapshot mensual: ingresos, miembros, fondos, tasas, notas |

**Estado de miembros**: `getMembers()` ejecuta `updateMemberStatuses()` antes de leer — marca `expired`/`active` según `payment_date` vs hoy, ignorando `frozen`.

**Vencimiento**: usar `calculateDueDate(paymentDate)` de `lib/utils.ts`. Maneja correctamente día 31 → último día válido del mes siguiente.

---

## Sistema de pagos y monedas

| Método | Moneda | Fondo |
|---|---|---|
| Pago Móvil, Efectivo Bs, Transferencia BS | Bolívares | `BS` |
| Efectivo USD | USD | `USD_CASH` |
| USDT, Transferencia USDT | USDT | `USDT` |

Tasas: **BCV**, **USDT** (mercado), o **personalizada**. Se guardan junto al pago en `payment_rate` para preservar histórico. Al registrar un pago, el fondo correspondiente se actualiza automáticamente (ver `lib/actions/funds.ts`).

---

## Auth y rutas

- `middleware.ts` permite: `/`, `/login`, `/forgot-password`, `/reset-password`, `/auth/*`.
- Cualquier `/dashboard/**` exige sesión; sin user → redirige a `/login`.
- Si hay user y entra a `/login` o `/forgot-password` → redirige a `/dashboard`.
- Auth gestionada por Supabase Auth + cookies SSR.

---

## Sistema de diseño

- **Modo oscuro fijo**: `<html lang="es" className="dark">` en el root layout. No hay theme switcher.
- **Color primario**: amarillo/dorado `oklch(0.7 0.2 95)` sobre fondo negro `oklch(0.1 0 0)`.
- **Paleta semántica**:
  - 🔵 Azul → Miembros, Bolívares
  - 🟢 Verde → Ingresos, USD
  - 🟠 Naranja → USDT / cripto
  - 🟣 Púrpura → Planes, Roles
  - 🟡 Amarillo → CTAs primarios
- **Toasts**: `sonner` (`toast.success`, `toast.error`).
- **Confirmaciones destructivas**: `sweetalert2` con tema oscuro.
- **Iconos**: solo `lucide-react`.
- **Animaciones**: `tw-animate-css` y `tailwindcss-animate`.

---

## Convenciones de código

- TypeScript estricto. Sin `any` salvo cuando lo exige una API externa (documentar el porqué).
- Comentarios solo cuando el "porqué" no es obvio. No describir el "qué".
- Nombres de archivos:
  - Componentes: `PascalCase.tsx` cuando son main components (`UsersMainComponent.tsx`).
  - Componentes shadcn/secundarios: `kebab-case.tsx`.
  - Acciones, hooks, utils: `kebab-case.ts`.
- Imports con alias `@/*` (configurado en `tsconfig.json`).
- `cn(...)` de `lib/utils.ts` para combinar clases Tailwind.
- Errores de fechas: parsear strings ISO (`YYYY-MM-DD`) con `new Date(s + "T00:00:00")` para evitar drift de zona horaria.

---

## Variables de entorno

```
NEXT_PUBLIC_SUPABASE_URL=
NEXT_PUBLIC_SUPABASE_ANON_KEY=
SUPABASE_SERVICE_ROLE_KEY=
NEXT_PUBLIC_SITE_URL=
# Email (nodemailer) — credenciales SMTP según configuración actual
```

`SUPABASE_SERVICE_ROLE_KEY` solo se usa desde `utils/supabase/admin.ts`. Nunca exponer al cliente.

---

## Scripts

| Comando | Uso |
|---|---|
| `npm run dev` | Dev server en puerto 3000 |
| `npm run build` | Build de producción |
| `npm run start` | Server de producción |
| `npm run lint` | ESLint (config en `eslint.config.mjs`) |

---

## Antes de dar una tarea por terminada

1. Tipos compilan (sin errores en el editor / `tsc`).
2. Si tocaste rutas o Server Actions: probaste el flujo en el navegador con `npm run dev`.
3. Si tocaste mutaciones: verifica que se llama `revalidatePath` y `logActivity` cuando corresponde.
4. Si tocaste permisos: revisaste tanto la guarda server-side como la condicional client-side.
5. No dejaste `console.log` ni código muerto.
6. No creaste archivos `*.md` nuevos a menos que el usuario lo pidiera.

---

## Qué NO hacer

- Acceder a Supabase desde Client Components (excepto Auth).
- Saltarse RLS sin razón clara — y si se hace, solo desde `utils/supabase/admin.ts`.
- Crear nuevos archivos cuando puedes editar uno existente.
- Inventar permisos o estados — usar los listados arriba.
- Romper el contrato de fondos: cada pago debe alimentar su fondo correspondiente.
- Hacer commits sin que el usuario lo pida explícitamente.

---

*Para contexto extendido (descripciones de cada acción, paleta detallada, etc.) ver `context-project.md`.*
