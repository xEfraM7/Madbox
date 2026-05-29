# Madbox — Sistema de Gestión de Gimnasio

Plataforma completa de administración para gimnasios construida con **Next.js 16** y **Supabase**. Gestiona miembros, planes, pagos, rutinas, clases especiales y cierres mensuales con soporte multi-moneda (**Bolívares**, **USD** y **USDT**) e incluye un portal independiente para los miembros.

---

## 🎯 Características Principales

### Panel de Administración (`/dashboard`)

#### Dashboard
- Estadísticas en tiempo real (miembros activos, vencidos, congelados).
- Ingresos del mes con gráficos y comparativos.
- Fondos consolidados por moneda con conversión automática.
- Actividad reciente y próximos vencimientos.
- Editor rápido de tasas de cambio desde el header.

#### Gestión de Miembros
- Alta, edición y baja de clientes.
- Asignación de plan y cálculo automático de vencimiento.
- Estados automáticos: **activo**, **vencido**, **congelado**.
- Carga de avatar (hasta 30 MB) vía Cloudinary.
- Vinculación con `auth.users` para acceso al portal del miembro.
- Migración masiva e historial completo por miembro.

#### Planes de Membresía
- Creación con precio en USD y duración configurable.
- Lista de características personalizables.
- Activación/desactivación sin perder histórico.

#### Pagos
- Múltiples métodos: **Pago Móvil**, **Efectivo Bs**, **Transferencia Bs**, **Efectivo USD**, **USDT**, **Transferencia USDT**.
- Cálculo automático de fecha de vencimiento (incluye casos día 31).
- Snapshot de la tasa aplicada (`payment_rate`) para preservar histórico.
- Actualización automática del fondo correspondiente.
- Filtros por mes/año y referencia.

#### Rutinas (WOD)
- Programación de una rutina por fecha en formato **Markdown**.
- Relación M2M con planes (una rutina puede aplicar a varios planes).
- Registros de WOD por miembro con puntuaciones y slots configurables.
- Tracking de logs históricos por usuario.

#### Clases Especiales
- Programación de clases adicionales (horario, instructor, precio, capacidad).
- Control de inscripciones y pagos independientes por clase.

#### Cierres Mensuales
- Snapshot mensual: ingresos totales, miembros activos, fondos, tasas y notas.
- Inmutables una vez generados para auditoría.

#### Roles y Permisos
- Roles personalizables con permisos granulares por sección.
- Invitación de administradores por email (Resend).
- Flag `isAdmin` que otorga todos los permisos.

#### Configuración
- Datos del gimnasio, horarios y métodos de pago habilitados.
- Recordatorios de renovación por email.

### Portal del Miembro (`/portal`)

Experiencia independiente para usuarios finales autenticados:

- **Inicio** — resumen de su membresía, vencimiento y rutina del día.
- **Rutinas** — visualización de la rutina diaria según su plan, con renderizado de Markdown + GFM.
- **WOD** — registro de scores personales y vista de logs históricos.
- **Pagos** — historial de pagos propios y próximas fechas de vencimiento.
- **Clases** — inscripción a clases especiales.
- **Perfil** — edición de datos personales y avatar.
- **Descubrir** — sección informativa del gimnasio.
- **Cambiar contraseña** — autogestión de credenciales.

### Tasas de Cambio Multi-Moneda
- **Tasa BCV** (Banco Central de Venezuela).
- **Tasa USDT** (consultada vía Binance P2P).
- **Tasa personalizada** definida por el administrador.

---

## 🛠️ Stack Tecnológico

| Tecnología | Versión | Uso |
|---|---|---|
| **Next.js** | 16 | App Router, Server Actions, Server Components |
| **React** | 19 | UI |
| **TypeScript** | 5 | Tipado estricto |
| **Supabase** | `@supabase/ssr` 0.8 · `supabase-js` 2.86 | Postgres, Auth, RLS |
| **TanStack Query** | 5 | Estado de servidor en cliente |
| **Tailwind CSS** | 4 | Estilos utility-first |
| **shadcn/ui (Radix)** | — | Componentes accesibles |
| **React Hook Form** | 7 | Formularios |
| **Zod** | 3 | Validación de esquemas |
| **date-fns** | 4 | Manejo de fechas |
| **Sonner** | 1.7 | Toasts |
| **SweetAlert2** | 11 | Confirmaciones destructivas |
| **recharts** | 2.15 | Gráficos |
| **lucide-react** | — | Iconografía |
| **Cloudinary** | 2 | Almacenamiento de avatares |
| **Resend** | 6 | Envío de correos transaccionales |
| **react-markdown + remark-gfm** | — | Render de rutinas |

---

## 📁 Estructura del Proyecto

```
app/                              # App Router
├── dashboard/                    # Panel admin (protegido)
│   ├── users/                    # Miembros
│   ├── plans/                    # Planes
│   ├── payments/                 # Pagos
│   ├── rutinas/                  # Rutinas / WOD admin
│   ├── classes/ · clases/        # Clases especiales
│   ├── closings/                 # Cierres mensuales
│   ├── roles/                    # Roles y permisos
│   └── settings/                 # Configuración
├── portal/                       # Portal del miembro (protegido)
│   ├── page.tsx                  # Inicio
│   ├── rutinas/ · wod/
│   ├── pagos/ · clases/
│   ├── perfil/ · descubrir/
│   └── cambiar-contrasena/
├── auth/confirm/                 # Confirmación de email
├── login/ · forgot-password/ · reset-password/
└── page.tsx                      # Landing → redirige a /dashboard

components/
├── section-components/           # Componentes principales por sección
│   ├── <seccion>/
│   │   ├── <Seccion>MainComponent.tsx
│   │   ├── modals/
│   │   └── index.ts
│   └── portal/<seccion>/         # Equivalentes para el portal
├── shared/                       # Layout dashboard, modales globales
├── providers/                    # QueryProvider (TanStack Query)
└── ui/                           # shadcn/ui (no editar a mano)

lib/
├── actions/                      # Server Actions ("use server")
│   ├── members.ts · plans.ts · payments.ts
│   ├── routines.ts · wod-logs.ts · records.ts
│   ├── classes.ts · closings.ts · funds.ts
│   ├── roles.ts · settings.ts · auth.ts
│   ├── dashboard.ts · activity.ts · migration.ts
│   ├── portal.ts · email.ts · renewal-notifications.ts
│   └── binance.ts                # Consulta tasa USDT
├── hooks/                        # Hooks de cliente (use-permissions, ...)
└── utils.ts                      # cn(), getNextMonthDate(), calculateDueDate()

types/database.ts                 # Tipos generados desde Supabase

utils/supabase/
├── client.ts                     # Client Components (solo Auth)
├── server.ts                     # SSR (cookies)
├── admin.ts                      # service_role (solo servidor)
└── middleware.ts                 # Helper de middleware

middleware.ts                     # Auth gate global
```

---

## 🗄️ Modelo de Datos

| Tabla | Descripción |
|---|---|
| `members` | Clientes del gimnasio (FK `plan_id`) |
| `plans` | Planes de membresía (`price`, `duration`, `features[]`) |
| `payments` | Pagos (`amount`, `method`, `payment_rate`, `due_date`, …) |
| `routine_schedules` | Rutinas por fecha (markdown) |
| `routine_schedule_plans` | Puente M2M rutina ↔ planes |
| `wod_logs` | Registros de WOD por miembro |
| `records` | Récords personales |
| `special_classes` | Clases especiales |
| `special_class_payments` | Pagos de clases especiales |
| `monthly_closings` | Snapshots mensuales |
| `admins` | Administradores (FK `role_id`, `auth_user_id`) |
| `roles` | Roles con `permissions[]` |
| `gym_settings` | Configuración (singleton) |
| `funds` | Fondos por moneda |
| `activity_logs` | Auditoría de acciones |

---

## 🔐 Sistema de Permisos

Permisos disponibles (string keys consumidos por `usePermissions()` y la guarda server-side):

- `dashboard.view`
- `users.{view, edit, delete}`
- `plans.{view, edit, delete}`
- `payments.{view, edit, delete}`
- `classes.{view, edit, delete}`
- `roles.{view, create, edit, delete}`
- `settings.{view, edit}`
- `closings.{view, edit, delete}`
- `routines.{view, edit, delete}`

El flag `isAdmin` otorga todos los permisos automáticamente.

---

## 💱 Métodos de Pago

| Método | Moneda | Fondo |
|---|---|---|
| Pago Móvil | Bolívares | `BS` |
| Efectivo Bs | Bolívares | `BS` |
| Transferencia BS | Bolívares | `BS` |
| Efectivo USD | Dólares | `USD_CASH` |
| USDT | Cripto | `USDT` |
| Transferencia USDT | Cripto | `USDT` |

Cada pago guarda la tasa aplicada (`payment_rate`) y alimenta automáticamente el fondo correspondiente.

---

## 🚀 Instalación

### Prerrequisitos
- **Node.js** 20+
- Cuenta en **Supabase**
- Cuenta en **Cloudinary** (avatares)
- Cuenta en **Resend** (emails transaccionales)

### Pasos

```bash
# 1. Clonar
git clone <url-del-repo>
cd Madbox

# 2. Instalar dependencias
npm install

# 3. Configurar variables de entorno
cp .env.example .env
```

Editar `.env`:

```env
NEXT_PUBLIC_SUPABASE_URL=https://tu-proyecto.supabase.co
NEXT_PUBLIC_SUPABASE_ANON_KEY=tu_anon_key
SUPABASE_SERVICE_ROLE_KEY=tu_service_role_key
NEXT_PUBLIC_SITE_URL=http://localhost:3000

# Cloudinary
CLOUDINARY_CLOUD_NAME=
CLOUDINARY_API_KEY=
CLOUDINARY_API_SECRET=

# Resend
RESEND_API_KEY=
```

> ⚠️ `SUPABASE_SERVICE_ROLE_KEY` solo se usa desde `utils/supabase/admin.ts`. **Nunca** debe llegar al cliente.

```bash
# 4. Levantar el dev server
npm run dev
# → http://localhost:3000
```

---

## 📜 Scripts

| Comando | Descripción |
|---|---|
| `npm run dev` | Servidor de desarrollo (puerto 3000) |
| `npm run build` | Build de producción |
| `npm run start` | Servidor de producción |
| `npm run lint` | ESLint |

---

## 🏗️ Reglas de Arquitectura

1. **Server Actions son la única vía a la base de datos.** Los Client Components nunca acceden directamente a Supabase salvo para Auth puro.
2. **Páginas finas, componentes gordos.** Cada `page.tsx` solo renderiza su `<SeccionMainComponent />`.
3. Tras cada mutación: `revalidatePath()` + `logActivity()` cuando aplique.
4. Validación de permisos **server-side** antes de mutar y **client-side** para ocultar/desactivar UI.
5. TanStack Query con `staleTime: 60s` por defecto, `5 min` para permisos. Invalidación explícita en `onSuccess`.
6. Tipos siempre desde `@/types/database`: `Tables<"...">`, `TablesInsert<"...">`, `TablesUpdate<"...">`.

---

## 🎨 Sistema de Diseño

- **Modo oscuro fijo** (`<html className="dark">`).
- **Color primario:** amarillo/dorado `oklch(0.7 0.2 95)` sobre fondo negro `oklch(0.1 0 0)`.
- **Paleta semántica:**
  - 🔵 Azul → Miembros, Bolívares
  - 🟢 Verde → Ingresos, USD
  - 🟠 Naranja → USDT, cripto
  - 🟣 Púrpura → Planes, Roles
  - 🟡 Amarillo → CTAs primarios
- **Toasts:** Sonner. **Confirmaciones destructivas:** SweetAlert2 con tema oscuro.
- **Animaciones:** `tw-animate-css` + `tailwindcss-animate`.

---

## 📱 Responsive

Optimizado para:
- **Desktop** (≥ 1024 px)
- **Tablet** (768 – 1023 px)
- **Mobile** (< 768 px)

---

## 📄 Licencia

Proyecto privado — Madbox © 2026
