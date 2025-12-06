# Estructura del Proyecto

## Patrón de Secciones del Dashboard

Cada sección del dashboard sigue esta estructura:

### En `app/dashboard/[seccion]/`
```
app/dashboard/[seccion]/
├── page.tsx      → Solo importa y renderiza el MainComponent
└── loading.tsx   → Estado de carga (opcional)
```

El `page.tsx` debe ser mínimo:
```tsx
import SectionMainComponent from "@/components/section-components/[seccion]/SectionMainComponent"

export default function SectionPage() {
  return <SectionMainComponent />
}
```

### En `components/section-components/[seccion]/`
```
components/section-components/[seccion]/
├── SectionMainComponent.tsx  → Toda la lógica y UI de la sección
├── index.ts                  → Barrel exports
└── modals/                   → Modales específicos de la sección
    └── [nombre]-modal.tsx
```

## Secciones Existentes

- `dashboard` → Panel principal
- `classes` → Clases especiales
- `payments` → Gestión de pagos
- `users` → Gestión de usuarios
- `plans` → Planes de mensualidad
- `roles` → Roles y permisos
- `settings` → Configuración
- `login` → Autenticación

## Componentes Compartidos

Los componentes que se usan en múltiples secciones van en `components/shared/`:
- `dashboard-layout.tsx` → Layout principal del dashboard (sidebar, header, etc.)

## Rutas del Dashboard

Las rutas usan nombres en inglés:
- `/dashboard` → Panel principal
- `/dashboard/classes` → Clases
- `/dashboard/payments` → Pagos
- `/dashboard/users` → Usuarios
- `/dashboard/plans` → Planes
- `/dashboard/roles` → Roles
- `/dashboard/settings` → Configuración

## Principios

1. **DRY**: No repetir código. Extraer componentes reutilizables.
2. **Clean Code**: Nombres descriptivos, funciones pequeñas, responsabilidad única.
3. **Separación de responsabilidades**: Las páginas solo renderizan, los componentes manejan la lógica.
