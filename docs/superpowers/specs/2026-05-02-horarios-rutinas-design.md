# Horarios y Rutinas — Diseño

**Fecha:** 2026-05-02
**Estado:** Aprobado, listo para plan de implementación

## Contexto

Hoy los horarios del gym viven como pestaña dentro de `/dashboard/settings` (`SettingsMainComponent.tsx`), apoyados por la tabla `gym_schedule`. La UI es funcional pero tediosa: una lista de 7 filas con dos inputs de tipo `time` cada una, sin contexto visual del día actual y sin manera de gestionar el contenido que toca cada día.

El gym entrega rutinas (en su mayoría CrossFit) que cambian por día y por plan. Hoy esas rutinas se comunican fuera del sistema (verbal, WhatsApp, etc.) y los miembros no las ven en su portal.

## Objetivos

1. Sacar los horarios de `Settings` a una sección propia del dashboard.
2. Mejorar el UX para que cambiar/editar horarios sea menos tedioso.
3. Añadir gestión de rutinas asignables por día y por plan.
4. Permitir que una misma rutina sea reutilizada por múltiples (plan, día).
5. Mostrar al miembro la rutina de hoy según su plan en `/portal`.

## No objetivos

- Modelar ejercicios estructurados (series/reps/peso). Las rutinas se guardan como Markdown libre.
- Overrides por fecha exacta (ej: "este lunes 5 de mayo distinto al lunes pasado"). Si el admin se equivoca, edita la asignación o el contenido.
- Tracking de asistencia o cumplimiento por miembro.
- Histórico de rutinas anteriores.
- Notificaciones a miembros cuando cambia la rutina.

---

## Arquitectura

### Modelo de datos

Se reutiliza `gym_schedule` tal cual está (no requiere cambios). Se añaden dos tablas nuevas.

```sql
-- Biblioteca de rutinas reutilizables
create table routines (
  id uuid primary key default gen_random_uuid(),
  name text not null,
  content text not null default '',  -- Markdown
  created_at timestamptz default now(),
  updated_at timestamptz default now()
);

-- Asignación: una rutina por (plan, día-de-semana)
create table routine_assignments (
  id uuid primary key default gen_random_uuid(),
  plan_id uuid not null references plans(id) on delete cascade,
  routine_id uuid not null references routines(id) on delete cascade,
  day_of_week text not null check (day_of_week in
    ('Lunes','Martes','Miércoles','Jueves','Viernes','Sábado','Domingo')),
  created_at timestamptz default now(),
  updated_at timestamptz default now(),
  unique (plan_id, day_of_week)
);

create index on routine_assignments (plan_id);
create index on routine_assignments (routine_id);
create index on routine_assignments (day_of_week);
```

**Notas de modelo:**
- `on delete cascade`: borrar un plan o una rutina elimina sus asignaciones automáticamente. La UI confirma con SweetAlert antes de borrar una rutina con asignaciones.
- `day_of_week` como texto en español, consistente con `gym_schedule.day_of_week` actual.
- `updated_at`: se actualiza desde la server action en cada `update`/`upsert` (mismo patrón que `gym_settings`/`plans` actuales).

### RLS

- `routines`:
  - `select`: `authenticated` (admins listan biblioteca; miembros leen indirectamente vía join al recibir su rutina del día).
  - `insert/update/delete`: solo admins (validado en server action via `getCurrentAdminPermissions()`; las policies bloquean al rol `authenticated` puro).
- `routine_assignments`:
  - `select`: una sola policy que admite ambos casos con `OR` — `(es admin)` OR `(plan_id = (select plan_id from members where auth_user_id = auth.uid()))`. Así admins ven todas, miembros solo las de su plan.
  - `insert/update/delete`: solo admins.

Para detectar "es admin" en policies: `exists (select 1 from admins where auth_user_id = auth.uid())`. Patrón ya usado en migraciones existentes.

### Server Actions (`lib/actions/routines.ts`)

```ts
// Biblioteca
getRoutines(): Promise<Routine[]>
getRoutine(id: string): Promise<RoutineWithUsage>  // incluye count de asignaciones
createRoutine({ name, content }): Promise<Routine>
updateRoutine(id, { name?, content? }): Promise<Routine>
deleteRoutine(id): Promise<void>

// Asignaciones
getRoutineAssignments(): Promise<AssignmentWithJoin[]>  // join a plans + routines
upsertRoutineAssignment({ plan_id, day_of_week, routine_id }): Promise<void>
deleteRoutineAssignment({ plan_id, day_of_week }): Promise<void>

// Portal
getTodayRoutineForMember(): Promise<TodayRoutine | null>
```

**Convenciones:**
- Cada mutación valida permisos vía `getCurrentAdminPermissions()` antes de tocar la BD.
- Cada mutación llama `revalidatePath("/dashboard/horarios")` y `logActivity(...)` con acción en español.
- Errores de Supabase con `throw error` para que TanStack Query los capture.
- `getTodayRoutineForMember` calcula el día con `new Date().toLocaleDateString("es-VE", { weekday: "long" })` server-side y normaliza a las strings que usa `gym_schedule` (`Lunes`...`Domingo`, primera mayúscula).

`lib/actions/settings.ts` no cambia. `getGymSchedule`/`updateGymSchedule` se siguen usando, ahora desde la nueva sección.

---

## UI del Dashboard

### Ruta y navegación

- Nueva ruta: `app/dashboard/horarios/page.tsx` → renderiza `<HorariosMainComponent />`.
- Sidebar: nuevo item entre "Cierres" y "Configuración" con icono `CalendarClock` y `permissions: ["schedule.view"]`.
- Se elimina la pestaña "Horarios" de `SettingsMainComponent.tsx`. Settings queda con tabs General / Cuenta / Portal.

### Estructura de archivos

```
components/section-components/horarios/
  HorariosMainComponent.tsx       # Cliente principal
  WeekGrid.tsx                    # Grilla semanal (7 columnas)
  DayColumn.tsx                   # Columna: header día + horario + cards de planes
  ScheduleInline.tsx              # Inputs apertura/cierre + toggle "Cerrado"
  RoutineCard.tsx                 # Card por (plan, día)
  modals/
    routine-assign-modal.tsx      # Asignar/cambiar/quitar rutina en una celda
    routine-form-modal.tsx        # Crear/editar rutina (textarea + preview)
    routine-library-sheet.tsx     # Sheet lateral con CRUD de rutinas
    routine-preview-modal.tsx     # Solo lectura del Markdown
  index.ts
```

### Layout principal (Enfoque 1 — Vista semanal unificada)

```
┌──────────────────────────────────────────────────────────────────┐
│ Horarios y Rutinas              [📚 Biblioteca de Rutinas]       │
│ Define el horario del gym y las rutinas por día y plan           │
├──────┬──────┬──────┬──────┬──────┬──────┬──────────────────────┤
│ LUN  │ MAR  │ MIÉ  │ JUE  │ VIE  │ SÁB  │ DOM                  │
│ 🟡HOY│      │      │      │      │      │                      │
│ 6:00 │ 6:00 │ ...  │ ...  │ ...  │ ...  │ Cerrado              │
│ 22:00│ 22:00│      │      │      │      │                      │
├──────┼──────┼──────┼──────┼──────┼──────┼──────────────────────┤
│ Plan WOD                                                        │
│ Metab│ Forz │  —   │ EMOM │ AMRAP│ Open │  —                   │
│ A [✎]│ B [✎]│ [+]  │ A [✎]│ A [✎]│ Box  │ [+]                  │
├──────┼──────┼──────┼──────┼──────┼──────┼──────────────────────┤
│ Plan Élite                                                      │
│ ...  │ ...  │ ...  │ ...  │ ...  │ ...  │ ...                  │
└──────┴──────┴──────┴──────┴──────┴──────┴──────────────────────┘
```

**Detalles:**
- "Hoy" resaltado con `border-primary` + badge "Hoy" en el header del día.
- Header del día: nombre + dos inputs `time` (apertura/cierre) + toggle "Cerrado". Convención: si `open_time === close_time`, el día se considera cerrado y se ocultan las horas. Guardar "Cerrado" persiste `open_time = close_time = "00:00:00"`. Reabrir un día cerrado restaura inputs vacíos para que el admin escriba los horarios; no se persiste hasta que ingrese ambos valores válidos.
- Filas por plan: una fila por plan activo (`plans.active = true`). Inactivos no se muestran.
- Celda de rutina:
  - Si hay rutina asignada: nombre truncado + botón `[✎]` que abre `routine-assign-modal`. Click en el nombre abre `routine-preview-modal`.
  - Si no hay rutina: botón `[+] Asignar`.

### Biblioteca de Rutinas

Botón "Biblioteca de Rutinas" arriba a la derecha → abre `routine-library-sheet` (Sheet lateral):
- Lista de todas las rutinas con buscador por nombre.
- Cada item: nombre + count de asignaciones + botones Editar / Duplicar / Borrar.
- Botón "Nueva rutina" → abre `routine-form-modal` vacío.
- Borrar con asignaciones: SweetAlert con detalle ("Esta rutina está asignada a X días, se quitarán las asignaciones").

### Editor de rutina (`routine-form-modal`)

- Input `name` (requerido).
- Textarea `content` con monospace, soporta pegar Markdown crudo.
- Tabs internas: "Editar" y "Vista previa". Vista previa renderiza con `react-markdown`.
- Botones: Cancelar / Guardar.

### Móvil

- Grilla colapsa a stack vertical: una `Card` grande por día, en orden Lunes → Domingo.
- Hoy resaltado y scrolleado al tope al cargar.
- Cada card: header con día/horario, debajo lista de planes con sus rutinas, mismas acciones.

### Estados

- **Loading inicial**: skeletons por columna.
- **Sin planes activos**: empty state "Crea un plan primero" con link a `/dashboard/plans`.
- **Sin rutinas en biblioteca**: al abrir "Asignar" muestra CTA "Crea tu primera rutina" que abre el form modal directamente.
- **Errores**: `showToast.error` con mensaje legible en español.

### TanStack Query

- `useQuery(["gym-schedule"], getGymSchedule)`
- `useQuery(["routines"], getRoutines)`
- `useQuery(["routine-assignments"], getRoutineAssignments)`
- Mutaciones invalidan las queries afectadas en `onSuccess`.

---

## Portal del miembro

### Ubicación

`PortalHomeMainComponent` (`/portal`) muestra una nueva tarjeta `<TodayRoutineCard />`. No se crea ruta nueva.

### Componente

```
components/section-components/portal/home/
  TodayRoutineCard.tsx
```

Consume `useQuery(["portal-today-routine"], getTodayRoutineForMember)` con `staleTime: 5 * 60 * 1000`.

### Layout de la card

```
┌──────────────────────────────────────────────┐
│ 📅  Rutina de hoy · Lunes                    │
│ Plan WOD · Metabólico Lunes A                │
├──────────────────────────────────────────────┤
│  Metabólico condition                         │
│                                                │
│  Amrap 7'                                      │
│  • 10 dead lift 100 kg                         │
│  • 6 bar muscle up                             │
│  ...                                           │
└──────────────────────────────────────────────┘
```

- Render del `content` con `react-markdown`, clases `prose prose-invert` ajustadas al tema oscuro.

### Estados

- **Sin rutina hoy**: card con icono y mensaje suave "Tu coach aún no asignó la rutina de hoy".
- **Sin plan asignado al miembro**: oculta la card.
- **Día cerrado** (`gym_schedule` con `open_time === close_time`): card muestra "Hoy el gym está cerrado" + la rutina si existe.
- **Loading**: skeleton.

---

## Permisos

Tres permisos nuevos, siguiendo la convención `recurso.acción`:

```ts
'schedule.view'      // ver la sección Horarios y Rutinas
'schedule.edit'      // editar horarios, asignaciones, rutinas
'schedule.delete'    // borrar rutinas / desasignar
```

Decisión de granularidad: un solo `schedule.edit` cubre horarios + rutinas + asignaciones porque en este negocio quien gestiona uno gestiona los otros. Si se necesita partir en el futuro (`routines.*` separado de `schedule.*`), se hace entonces.

| Punto de control | Permiso |
|---|---|
| Sidebar muestra "Horarios" | `schedule.view` |
| Acceso a `/dashboard/horarios` | `schedule.view` (server-side guard) |
| Editar horarios apertura/cierre | `schedule.edit` |
| Asignar/cambiar rutina en celda | `schedule.edit` |
| Crear/editar rutina | `schedule.edit` |
| Borrar rutina o desasignar | `schedule.delete` |
| Ver biblioteca de rutinas | `schedule.view` |
| Portal del miembro (rutina hoy) | autenticado como miembro |

**Server-side:** cada server action valida con `getCurrentAdminPermissions()` antes de mutar.

**Client-side:**
```ts
const { hasPermission } = usePermissions()
const canEdit = hasPermission('schedule.edit')
const canDelete = hasPermission('schedule.delete')
```
Inputs/botones se renderizan `disabled` u ocultos si no hay permiso. Admin con `isAdmin: true` tiene todo.

**Roles existentes:** los nuevos permisos quedan disponibles en `/dashboard/roles` para que el usuario los asigne manualmente a los roles que correspondan. No se modifican roles automáticamente.

`CLAUDE.md` se actualiza para listar `schedule.{view,edit,delete}` entre los permisos disponibles.

---

## Migración y rollout

### Migración de DB

Un solo archivo: `supabase/migrations/<timestamp>_routines_setup.sql`.

Contenido:
1. `create table routines (...)`
2. `create table routine_assignments (...)` con FKs e índices
3. RLS habilitado en ambas tablas
4. Policies de `select` / `insert` / `update` / `delete`
5. Trigger `updated_at` en ambas tablas (siguiendo patrón existente)

Aplicación: `mcp__supabase__apply_migration` al proyecto remoto. Después: `mcp__supabase__generate_typescript_types` para regenerar `types/database.ts`.

### Cambios de UI / cleanup

1. Crear `app/dashboard/horarios/page.tsx` y los componentes en `components/section-components/horarios/`.
2. Añadir item al sidebar en `components/shared/dashboard-layout.tsx`.
3. Quitar `<TabsTrigger value="schedule">` y `<TabsContent value="schedule">` de `SettingsMainComponent.tsx`.
4. Quitar imports/queries de `getGymSchedule`/`updateGymSchedule` de `SettingsMainComponent.tsx`. Las funciones siguen viviendo en `lib/actions/settings.ts`; las consume el nuevo componente.
5. Añadir `<TodayRoutineCard />` al `PortalHomeMainComponent`.
6. Actualizar `CLAUDE.md` con los nuevos permisos.

### Datos iniciales

- No hay seeding. La biblioteca arranca vacía.
- `gym_schedule` ya tiene los 7 días con sus horarios actuales — se siguen mostrando.

### Backward compatibility

No hay deep-links a la pestaña "Horarios" de Settings en el código actual, así que se elimina sin redirect.

### Dependencias nuevas

- `react-markdown` (versión compatible con React 19) para render del Markdown en preview admin y portal.

### Logs de actividad

`logActivity` con acciones en español:
- `"Creó rutina"`, `"Editó rutina"`, `"Borró rutina"`
- `"Asignó rutina al lunes"`, `"Cambió rutina del lunes"`, `"Quitó rutina del lunes"`
- `"Actualizó horario del gym"`

### Checklist de testing manual

- [ ] Migración aplicada, types regenerados, build limpia
- [ ] Crear rutina desde la biblioteca
- [ ] Asignar rutina a (Plan X, Lunes)
- [ ] Asignar la misma rutina a (Plan Y, Martes) — confirma reuso
- [ ] Editar contenido de la rutina → ver cambio en ambas asignaciones
- [ ] Borrar rutina con asignaciones → confirmación + cascade
- [ ] Editar horario del gym desde la nueva sección
- [ ] Toggle "Cerrado" y reapertura
- [ ] Pestaña "Horarios" desaparece de Settings
- [ ] Como miembro: login al portal → ver rutina del día
- [ ] Día sin rutina asignada → empty state suave
- [ ] Día cerrado → mensaje "Hoy el gym está cerrado"
- [ ] Permisos: rol sin `schedule.view` no ve la sección
- [ ] Permisos: rol con `schedule.view` pero sin `schedule.edit` ve la sección en solo-lectura
- [ ] Móvil: grilla colapsa a stack, hoy resaltado

---

## Riesgos y consideraciones

- **Tamaño del componente principal**: si `HorariosMainComponent` crece, separar la grilla y la biblioteca en componentes con su propio estado de queries. El diseño ya prevé esto al particionar en `WeekGrid`, `DayColumn`, `RoutineCard`.
- **Render de Markdown no confiable**: `react-markdown` no ejecuta HTML por defecto, así que el contenido es seguro. Si en el futuro se quiere permitir HTML embebido, hay que añadir sanitización (`rehype-sanitize`).
- **Zona horaria del miembro**: el cálculo del "día de hoy" se hace server-side en zona horaria de Venezuela. Si el miembro está fuera del país, podría ver una rutina desfasada. Aceptable para v1; el negocio es local.
- **Rutina muy larga**: se renderiza tal cual con scroll si excede; no se trunca en el portal. La card crece según contenido.
