# Madbox - Sistema de Gestión de Gimnasio

Sistema completo de administración para gimnasios desarrollado con Next.js 16 y Supabase. Diseñado para gestionar membresías, pagos, clases especiales y control financiero con soporte multi-moneda (Bolívares, USD y USDT).

## 🎯 Características Principales

### Dashboard
- Panel principal con estadísticas en tiempo real
- Visualización de ingresos mensuales con gráficos
- Monitoreo de miembros activos y tasa de retención
- Actividad reciente y próximos vencimientos
- Fondos consolidados con conversión automática de monedas

### Gestión de Clientes
- Registro y edición de miembros
- Asignación de planes de membresía
- Estados automáticos (activo, vencido, congelado)
- Historial de pagos por cliente
- Congelamiento temporal de membresías

### Planes de Membresía
- Creación de planes con precios en USD
- Duración configurable (mensual, trimestral, anual)
- Características personalizables por plan
- Activación/desactivación de planes

### Sistema de Pagos
- Múltiples métodos de pago:
  - Pago Móvil (Bs)
  - Efectivo Bolívares
  - Transferencia Bolívares
  - Efectivo USD
  - USDT
  - Transferencia USDT
- Registro automático de fecha de vencimiento
- Historial completo de transacciones
- Gestión de fondos por tipo de moneda

### Clases Especiales
- Programación de clases adicionales
- Control de capacidad e inscripciones
- Pagos independientes por clase
- Asignación de instructores

### Roles y Permisos
- Sistema granular de permisos
- Roles personalizables (Super Admin, Admin, Básico)
- Invitación de nuevos administradores por email
- Control de acceso por sección

### Tasas de Cambio
- Tasa BCV (Banco Central de Venezuela)
- Tasa USDT
- Tasa personalizada
- Conversión automática en dashboard

### Configuración
- Datos del gimnasio
- Horarios de operación
- Métodos de pago habilitados

## 🛠️ Stack Tecnológico

| Tecnología | Uso |
|------------|-----|
| **Next.js 16** | Framework React con App Router y Server Actions |
| **React 19** | Biblioteca de UI |
| **Supabase** | Base de datos PostgreSQL, autenticación y storage |
| **TailwindCSS 4** | Framework de estilos |
| **React Query** | Gestión de estado del servidor y caché |
| **Shadcn/ui** | Componentes de interfaz accesibles |
| **React Hook Form** | Manejo de formularios |
| **Zod** | Validación de esquemas |
| **Sonner** | Notificaciones toast |
| **Lucide React** | Iconografía |

## 📁 Estructura del Proyecto

```
├── app/                          # App Router de Next.js
│   ├── dashboard/               # Páginas del panel de administración
│   │   ├── classes/            # Clases especiales
│   │   ├── payments/           # Gestión de pagos
│   │   ├── plans/              # Planes de membresía
│   │   ├── roles/              # Roles y permisos
│   │   ├── settings/           # Configuración
│   │   └── users/              # Gestión de clientes
│   ├── auth/confirm/           # Confirmación de autenticación
│   ├── login/                  # Inicio de sesión
│   ├── forgot-password/        # Recuperación de contraseña
│   └── reset-password/         # Restablecimiento de contraseña
│
├── components/
│   ├── section-components/     # Componentes principales por sección
│   │   ├── [seccion]/
│   │   │   ├── SectionMainComponent.tsx
│   │   │   ├── index.ts
│   │   │   └── modals/
│   ├── shared/                 # Componentes compartidos
│   │   ├── dashboard-layout.tsx
│   │   ├── activity-log-modal.tsx
│   │   ├── exchange-rate-modal.tsx
│   │   └── payment-detail-modal.tsx
│   ├── ui/                     # Componentes base (shadcn/ui)
│   └── providers/              # Providers de React
│
├── lib/
│   ├── actions/                # Server Actions (Supabase)
│   │   ├── activity.ts        # Registro de actividad
│   │   ├── auth.ts            # Autenticación
│   │   ├── classes.ts         # Clases especiales
│   │   ├── dashboard.ts       # Estadísticas del dashboard
│   │   ├── funds.ts           # Gestión de fondos
│   │   ├── members.ts         # Gestión de miembros
│   │   ├── payments.ts        # Gestión de pagos
│   │   ├── plans.ts           # Planes de membresía
│   │   ├── roles.ts           # Roles y permisos
│   │   └── settings.ts        # Configuración
│   ├── hooks/                  # Custom hooks
│   └── utils.ts               # Utilidades
│
├── types/
│   └── database.ts            # Tipos de TypeScript para Supabase
│
└── utils/supabase/            # Configuración de Supabase
    ├── admin.ts               # Cliente admin (service_role)
    ├── client.ts              # Cliente del navegador
    ├── middleware.ts          # Middleware de autenticación
    └── server.ts              # Cliente del servidor
```

## 🗄️ Modelo de Datos

### Tablas Principales

- **members**: Clientes del gimnasio
- **plans**: Planes de membresía disponibles
- **payments**: Pagos de membresías
- **special_classes**: Clases especiales
- **special_class_payments**: Pagos de clases especiales
- **admins**: Administradores del sistema
- **roles**: Roles con permisos
- **gym_settings**: Configuración del gimnasio
- **gym_schedule**: Horarios de operación
- **exchange_rates**: Tasas de cambio
- **funds**: Fondos por tipo de moneda

## 🚀 Instalación

### Prerrequisitos

- Node.js 18+
- Cuenta en Supabase
- npm o yarn

### Pasos

1. **Clonar el repositorio**
```bash
git clone <url-del-repo>
cd madbox
```

2. **Instalar dependencias**
```bash
npm install
```

3. **Configurar variables de entorno**
```bash
cp .env.example .env
```

Editar `.env` con tus credenciales:
```env
NEXT_PUBLIC_SUPABASE_URL=https://tu-proyecto.supabase.co
NEXT_PUBLIC_SUPABASE_ANON_KEY=tu_anon_key
SUPABASE_SERVICE_ROLE_KEY=tu_service_role_key
NEXT_PUBLIC_SITE_URL=http://localhost:3000
```

4. **Configurar base de datos en Supabase**
   - Crear las tablas según el esquema en `types/database.ts`
   - Configurar Row Level Security (RLS)
   - Crear el primer usuario administrador

5. **Ejecutar en desarrollo**
```bash
npm run dev
```

6. **Abrir en el navegador**
```
http://localhost:3000
```

## 📜 Scripts Disponibles

| Comando | Descripción |
|---------|-------------|
| `npm run dev` | Inicia el servidor de desarrollo |
| `npm run build` | Genera el build de producción |
| `npm run start` | Inicia el servidor de producción |
| `npm run lint` | Ejecuta el linter (ESLint) |

## 🔐 Sistema de Permisos

Los permisos disponibles son:

- `dashboard.view` - Ver dashboard
- `users.view` / `users.edit` / `users.delete` - Gestión de clientes
- `plans.view` / `plans.edit` / `plans.delete` - Gestión de planes
- `payments.view` / `payments.edit` / `payments.delete` - Gestión de pagos
- `classes.view` / `classes.edit` / `classes.delete` - Gestión de clases
- `roles.view` / `roles.edit` / `roles.create` / `roles.delete` - Gestión de roles
- `settings.view` / `settings.edit` - Configuración

## 💱 Métodos de Pago Soportados

| Método | Moneda | Fondo |
|--------|--------|-------|
| Pago Móvil | Bolívares | BS |
| Efectivo Bs | Bolívares | BS |
| Transferencia BS | Bolívares | BS |
| Efectivo USD | Dólares | USD_CASH |
| USDT | Cripto | USDT |
| Transferencia USDT | Cripto | USDT |

## 🎨 Tema

La aplicación usa tema oscuro por defecto con colores personalizados para cada tipo de información:
- 🔵 Azul: Miembros, Bolívares
- 🟢 Verde: Ingresos, USD
- 🟠 Naranja: USDT, Cripto
- 🟣 Púrpura: Planes, Roles

## 📱 Responsive

La interfaz está optimizada para:
- Desktop (1024px+)
- Tablet (768px - 1023px)
- Mobile (< 768px)

## 🔄 Actualizaciones en Tiempo Real

- Dashboard se actualiza cada 30 segundos
- Actividad reciente cada 10 segundos
- Tasas de cambio editables desde el header

## 📄 Licencia

Proyecto privado - Madbox © 2024
