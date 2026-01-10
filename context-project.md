# Madbox - Contexto del Proyecto

> **Objetivo**: Este archivo contiene todo el contexto necesario para trabajar en el proyecto sin necesidad de re-analizar la estructura cada vez.

---

## 🎯 Resumen del Proyecto

**Madbox** es un sistema completo de gestión de gimnasios desarrollado con Next.js 16 y Supabase. Permite administrar membresías, pagos, clases especiales y control financiero con soporte multi-moneda (Bolívares, USD y USDT).

---

## 🛠️ Stack Tecnológico

| Tecnología | Versión | Uso |
|------------|---------|-----|
| Next.js | 16 | Framework React con App Router y Server Actions |
| React | 19 | Biblioteca de UI |
| Supabase | 2.86+ | PostgreSQL, autenticación y storage |
| TailwindCSS | 4 | Framework de estilos (con tema oscuro amarillo/negro) |
| React Query | 5.90+ | Gestión de estado del servidor y caché |
| Shadcn/ui | - | Componentes de interfaz accesibles |
| React Hook Form | 7.68+ | Manejo de formularios |
| Zod | 3.25+ | Validación de esquemas |
| Lucide React | 0.454+ | Iconografía |
| Sonner | 1.7+ | Notificaciones toast |

---

## 📁 Estructura del Proyecto

```
madbox/
├── app/                              # App Router de Next.js
│   ├── layout.tsx                   # Layout principal
│   ├── page.tsx                     # Página raíz (redirige a /dashboard)
│   ├── globals.css                  # Estilos globales con tema amarillo/negro
│   ├── dashboard/                   # Panel de administración
│   │   ├── page.tsx                # Dashboard principal
│   │   ├── users/                  # Gestión de miembros
│   │   ├── plans/                  # Planes de membresía
│   │   ├── payments/               # Gestión de pagos
│   │   ├── classes/                # Clases especiales
│   │   ├── closings/               # Cierres mensuales
│   │   ├── roles/                  # Roles y permisos
│   │   └── settings/               # Configuración
│   ├── login/                       # Inicio de sesión
│   ├── forgot-password/            # Recuperación de contraseña
│   ├── reset-password/             # Restablecimiento de contraseña
│   └── auth/confirm/               # Confirmación de autenticación
│
├── components/
│   ├── section-components/          # Componentes por sección
│   │   ├── dashboard/              # Componentes del dashboard
│   │   ├── users/                  # Componentes de usuarios
│   │   ├── plans/                  # Componentes de planes
│   │   ├── payments/               # Componentes de pagos
│   │   ├── classes/                # Componentes de clases
│   │   ├── closings/               # Componentes de cierres
│   │   ├── roles/                  # Componentes de roles
│   │   ├── settings/               # Componentes de configuración
│   │   ├── login/                  # Componentes de login
│   │   ├── forgot-password/        # Componentes de recuperación
│   │   └── reset-password/         # Componentes de reset
│   ├── shared/                      # Componentes compartidos
│   │   ├── dashboard-layout.tsx    # Layout del dashboard con sidebar
│   │   ├── activity-log-modal.tsx  # Modal de actividad reciente
│   │   ├── exchange-rate-modal.tsx # Modal de tasas de cambio
│   │   └── payment-detail-modal.tsx# Modal de detalle de pago
│   ├── ui/                          # Componentes base (shadcn/ui)
│   └── providers/                   # Providers de React (QueryClient)
│
├── lib/
│   ├── actions/                     # Server Actions (lógica de negocio)
│   │   ├── activity.ts             # Registro de actividad
│   │   ├── auth.ts                 # Autenticación
│   │   ├── classes.ts              # Clases especiales
│   │   ├── closings.ts             # Cierres mensuales (19KB)
│   │   ├── dashboard.ts            # Estadísticas del dashboard
│   │   ├── email.ts                # Envío de emails
│   │   ├── funds.ts                # Gestión de fondos
│   │   ├── members.ts              # Gestión de miembros
│   │   ├── payments.ts             # Gestión de pagos
│   │   ├── plans.ts                # Planes de membresía
│   │   ├── renewal-notifications.ts# Notificaciones de renovación
│   │   ├── roles.ts                # Roles y permisos
│   │   └── settings.ts             # Configuración
│   ├── hooks/
│   │   └── use-permissions.ts      # Hook de permisos con React Query
│   └── utils.ts                    # Utilidades (cn, formatters)
│
├── types/
│   └── database.ts                  # Tipos TypeScript para Supabase
│
├── utils/supabase/                  # Configuración de Supabase
│   ├── admin.ts                    # Cliente admin (service_role)
│   ├── client.ts                   # Cliente del navegador
│   ├── middleware.ts               # Helpers para middleware
│   └── server.ts                   # Cliente del servidor
│
└── middleware.ts                    # Middleware de autenticación
```

---

## 🗄️ Modelo de Datos (Supabase)

### Tablas Principales

| Tabla | Descripción | Campos Clave |
|-------|-------------|--------------|
| `admins` | Administradores del sistema | id, email, name, role_id, auth_user_id, status |
| `members` | Clientes del gimnasio | id, name, email, phone, plan_id, status, frozen, payment_date, start_date |
| `plans` | Planes de membresía | id, name, price, duration, features[], active |
| `payments` | Pagos de membresías | id, member_id, plan_id, amount, method, status, payment_date, due_date, payment_rate, reference |
| `special_classes` | Clases especiales | id, name, instructor, schedule, price, capacity, enrolled |
| `special_class_payments` | Pagos de clases | id, class_id, member_id, amount, method, payment_date, payment_rate |
| `roles` | Roles con permisos | id, name, description, permissions[] |
| `gym_settings` | Configuración del gimnasio | id, name, email, phone, address, payment_methods[], currency |
| `gym_schedule` | Horarios de operación | id, day_of_week, open_time, close_time |
| `monthly_closings` | Cierres mensuales | id, period, revenues, members stats, funds, rates, notes |

### Relaciones

```
admins.role_id → roles.id
members.plan_id → plans.id
payments.member_id → members.id
payments.plan_id → plans.id
special_class_payments.class_id → special_classes.id
special_class_payments.member_id → members.id
monthly_closings.closed_by → admins.id
```

---

## 💱 Sistema de Pagos y Monedas

### Métodos de Pago

| Método | Moneda | Fondo Destino |
|--------|--------|---------------|
| Pago Móvil | Bolívares | BS |
| Efectivo Bs | Bolívares | BS |
| Transferencia BS | Bolívares | BS |
| Efectivo USD | Dólares | USD_CASH |
| USDT | Cripto | USDT |
| Transferencia USDT | Cripto | USDT |

### Tasas de Cambio

- **BCV**: Tasa oficial del Banco Central de Venezuela
- **USDT**: Tasa del mercado cripto
- **Personalizada**: Tasa definida por el usuario

---

## 🔐 Sistema de Permisos

### Permisos Disponibles

```typescript
// Dashboard
'dashboard.view'

// Usuarios/Miembros
'users.view' | 'users.edit' | 'users.delete'

// Planes
'plans.view' | 'plans.edit' | 'plans.delete'

// Pagos
'payments.view' | 'payments.edit' | 'payments.delete'

// Clases
'classes.view' | 'classes.edit' | 'classes.delete'

// Roles
'roles.view' | 'roles.edit' | 'roles.create' | 'roles.delete'

// Configuración
'settings.view' | 'settings.edit'

// Cierres
'closings.view' | 'closings.edit' | 'closings.delete'
```

### Hook de Permisos

```typescript
// Uso en componentes cliente
import { usePermissions } from "@/lib/hooks/use-permissions"

const { hasPermission, hasAnyPermission, isAdmin, isLoading } = usePermissions()

if (hasPermission('users.edit')) {
  // Mostrar botón de editar
}
```

---

## 🎨 Sistema de Diseño

### Tema

- **Modo**: Oscuro por defecto
- **Colores primarios**: Amarillo/Dorado (`oklch(0.7 0.2 95)`)
- **Fondo**: Negro/Gris oscuro (`oklch(0.1 0 0)`)

### Paleta de Colores por Tipo

| Color | Uso |
|-------|-----|
| 🔵 Azul | Miembros, Bolívares |
| 🟢 Verde | Ingresos, USD |
| 🟠 Naranja | USDT, Cripto |
| 🟣 Púrpura | Planes, Roles |
| 🟡 Amarillo | Primario, CTAs |

### Breakpoints

- Desktop: 1024px+
- Tablet: 768px - 1023px
- Mobile: < 768px

---

## 🔄 Patrones de Desarrollo

### Server Actions

```typescript
// Ubicación: lib/actions/*.ts
"use server"

import { createClient } from "@/utils/supabase/server"

export async function getMembers() {
  const supabase = await createClient()
  const { data, error } = await supabase.from('members').select('*')
  // ...
}
```

### Componentes de Sección

```typescript
// Patrón: components/section-components/[seccion]/
// - SectionMainComponent.tsx  (componente principal)
// - index.ts                  (exportaciones)
// - modals/                   (modales de la sección)
```

### React Query

```typescript
// Patrón común para queries
const { data, isLoading, refetch } = useQuery({
  queryKey: ['resource-name'],
  queryFn: serverActionFunction,
  staleTime: 5 * 60 * 1000, // 5 minutos
})
```

---

## 🌐 Variables de Entorno

```env
# Supabase
NEXT_PUBLIC_SUPABASE_URL=https://tu-proyecto.supabase.co
NEXT_PUBLIC_SUPABASE_ANON_KEY=tu_anon_key
SUPABASE_SERVICE_ROLE_KEY=tu_service_role_key

# App
NEXT_PUBLIC_SITE_URL=http://localhost:3000
```

---

## 📜 Scripts Disponibles

| Comando | Descripción |
|---------|-------------|
| `npm run dev` | Servidor de desarrollo en puerto 3000 |
| `npm run build` | Build de producción |
| `npm run start` | Iniciar servidor de producción |
| `npm run lint` | Ejecutar ESLint |

---

## 🔀 Rutas de la Aplicación

### Públicas

- `/login` - Inicio de sesión
- `/forgot-password` - Recuperar contraseña
- `/reset-password` - Restablecer contraseña
- `/auth/confirm` - Confirmación de email

### Protegidas (requieren autenticación)

- `/dashboard` - Dashboard principal
- `/dashboard/users` - Gestión de miembros
- `/dashboard/plans` - Planes de membresía
- `/dashboard/payments` - Gestión de pagos
- `/dashboard/classes` - Clases especiales
- `/dashboard/closings` - Cierres mensuales
- `/dashboard/roles` - Roles y permisos
- `/dashboard/settings` - Configuración

---

## ⚡ Actualizaciones en Tiempo Real

- Dashboard: cada 30 segundos
- Actividad reciente: cada 10 segundos
- Tasas de cambio: editables desde el header

---

## 📝 Notas Importantes

1. **Autenticación**: Manejada por Supabase Auth con middleware de Next.js
2. **RLS**: Row Level Security habilitado en todas las tablas
3. **Tipos**: Generados automáticamente desde Supabase en `types/database.ts`
4. **Fondos**: Se actualizan automáticamente según el método de pago usado
5. **Estados de Miembros**: `activo`, `vencido`, `congelado`
6. **Cierres Mensuales**: Consolidan toda la información financiera del mes

---

*Última actualización: Enero 2026*
*Proyecto privado - Madbox © 2024*
