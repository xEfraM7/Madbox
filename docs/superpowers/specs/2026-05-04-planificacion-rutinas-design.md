# Planificación de rutinas — Diseño

**Fecha:** 2026-05-04
**Estado:** Aprobado por el usuario, listo para escribir plan de implementación
**Ruta destino admin:** `/dashboard/rutinas`
**Ruta destino portal:** `/portal/rutinas`

---

## 1. Contexto y motivación

La sección actual `/dashboard/horarios` mezcla dos cosas: el horario operativo del gym (apertura/cierre por día de semana) y la asignación de rutinas semanales por `(plan, día_de_semana)`. El modelo actual no permite programar rutinas para fechas concretas; se asume que cada semana se repite lo mismo, lo cual no refleja la operación real.

El usuario quiere reemplazar la sección por una **planificación de rutinas por fecha**, donde el administrador:

1. Elige la fecha exacta de la rutina.
2. Elige a qué planes pertenece esa rutina (uno o varios).
3. Escribe la rutina en formato Markdown.

El horario del gym (`gym_schedule`) se elimina porque no se está usando. La biblioteca de rutinas reutilizables y el modelo de asignaciones por día de semana (`routines`, `routine_assignments`) se eliminan también: cada rutina vive ligada a una fecha y se redacta por separado.

Los `wod_logs` actuales referencian `routines.id`. Por petición del usuario, los logs históricos se borran y el flujo de "registrar WOD" en el portal se desactiva temporalmente; se retomará en un alcance posterior.

---

## 2. Decisiones de producto cerradas en brainstorming

| Decisión | Resultado |
|---|---|
| Tipo de cambio | Reemplazo total del modelo (no evolución) |
| Multi-plan por rutina | Sí, una rutina puede asignarse a múltiples planes |
| Unicidad | Máximo una rutina por `(fecha, plan)`. Conflicto se resuelve con "reemplazar" |
| Horario del gym | Se elimina (tabla `gym_schedule` y UI asociada) |
| WOD logs | Tabla truncada, registro deshabilitado por ahora |
| Vista miembro | Hoy + calendario para navegar fechas pasadas y futuras (lectura) |
| Vista admin | Lista cronológica agrupada por fecha (no calendario) |
| Crear/editar/eliminar | Editar y eliminar libres sin restricción de fecha. Crear bloqueado para fechas pasadas. Sin botón "duplicar" |
| Renombrar ruta | `/dashboard/horarios` → `/dashboard/rutinas` |
| Renombrar permisos | `schedule.{view,edit,delete}` → `routines.{view,edit,delete}` |
| Wizard de creación | Modal con stepper de 3 pasos (consistente con resto de la app) |

---

## 3. Modelo de datos

### 3.1 Tablas eliminadas

- `routines`
- `routine_assignments`
- `gym_schedule`

### 3.2 `wod_logs`

Tabla **truncada** (no eliminada). Su FK `routine_id` se redirige a `routine_schedules(id)` para que quede coherente cuando se reactive el flujo de logs en un alcance futuro.

### 3.3 Tablas nuevas

#### `routine_schedules`

| Columna | Tipo | Notas |
|---|---|---|
| `id` | `uuid` PK, `gen_random_uuid()` | |
| `date` | `date` NOT NULL | Fecha de la rutina (sin hora) |
| `name` | `text` | Nombre opcional ("Push Day", "AMRAP 20") |
| `content` | `text` NOT NULL DEFAULT `''` | Markdown |
| `created_at` | `timestamptz` DEFAULT `now()` | |
| `updated_at` | `timestamptz` DEFAULT `now()` | |

Índice: `idx_routine_schedules_date` sobre `(date)`.

#### `routine_schedule_plans`

| Columna | Tipo | Notas |
|---|---|---|
| `schedule_id` | `uuid` FK → `routine_schedules(id)` ON DELETE CASCADE | |
| `plan_id` | `uuid` FK → `plans(id)` ON DELETE CASCADE | |
| PK compuesta | `(schedule_id, plan_id)` | |

Índice: `idx_rsp_plan` sobre `(plan_id)`.

### 3.4 Integridad de unicidad `(fecha, plan)`

Validación **server-side** en cada `create`/`update`. Si el `plan_id` ya tiene rutina para esa fecha, el server action lanza un error tipado `CONFLICT` con la lista de planes en conflicto. El frontend muestra advertencia y permite continuar con `replace_conflicts: true`, que elimina las rutinas conflictivas en transacción antes de insertar la nueva.

Se descartó usar trigger + columna desnormalizada porque agrega complejidad innecesaria para un sistema con un único administrador escribiendo a la vez.

### 3.5 RLS

`routine_schedules` y `routine_schedule_plans`:
- `SELECT` permitido a `authenticated`.
- `INSERT/UPDATE/DELETE` restringido al `service_role` (las server actions usan el cliente SSR autenticado, pero la lógica de permisos se enforce en código vía `getCurrentAdminPermissions`).

---

## 4. Server actions

Archivo: `lib/actions/routines.ts` (mismo path, contenido completamente reescrito).

```ts
// Lectura
getRoutineSchedules({ from?: string; to?: string })
  // → cronológico, con planes anidados, filtrable por rango ISO

getRoutineSchedule(id: string)
  // → una rutina con sus planes

checkRoutineConflicts({ date: string, plan_ids: string[], excludeId?: string })
  // → string[] de plan_ids con rutina ya programada esa fecha
  //   (excludeId permite ignorar la propia rutina al editar)

// Escritura (admin)
createRoutineSchedule({
  date: string,
  name?: string,
  content: string,
  plan_ids: string[],
  replace_conflicts?: boolean,
})
  // 1. Permiso routines.edit
  // 2. Validar date >= hoy (zona Caracas)
  // 3. Validar plan_ids[] no vacío y planes activos
  // 4. Detectar conflictos sobre routine_schedule_plans
  //    Si hay y replace_conflicts !== true → throw { code: "CONFLICT", planIds }
  // 5. Si replace_conflicts === true → borrar conflictos y crear nueva en una transacción
  // 6. logActivity("routine_scheduled")
  // 7. revalidatePath('/dashboard/rutinas') y rutas del portal afectadas

updateRoutineSchedule(id, partial)
  // 1. Permiso routines.edit
  // 2. Si cambia date o plan_ids: revalidar conflictos excluyéndose a sí misma
  // 3. NO bloquea fechas pasadas en update
  // 4. logActivity("routine_schedule_updated")

deleteRoutineSchedule(id)
  // 1. Permiso routines.delete
  // 2. Cascada borra filas de routine_schedule_plans
  // 3. logActivity("routine_schedule_deleted")

// Portal
getRoutineForMemberOnDate(date: string)
  // Devuelve la rutina del plan del miembro en esa fecha o null

getMemberRoutineDatesInRange(from: string, to: string)
  // Devuelve fechas (YYYY-MM-DD) con rutina para el plan del miembro
```

### 4.1 Patrón de conflictos

```ts
const { data: conflicts } = await supabase
  .from("routine_schedule_plans")
  .select("plan_id, schedule_id, routine_schedules!inner(date)")
  .in("plan_id", plan_ids)
  .eq("routine_schedules.date", date)

if (conflicts && conflicts.length > 0 && !replace_conflicts) {
  const err: any = new Error("Hay rutinas en conflicto")
  err.code = "CONFLICT"
  err.planIds = [...new Set(conflicts.map(c => c.plan_id))]
  throw err
}
```

### 4.2 WOD logs deshabilitados

`lib/actions/wod-logs.ts`: las funciones de escritura (`logWod`, `updateWodLog`, etc.) se mantienen exportadas pero su cuerpo es `throw new Error("Registro de WOD deshabilitado")`. Las funciones de lectura pueden devolver listas vacías para evitar romper componentes que aún las llamen durante la transición.

---

## 5. Migración SQL

Archivo: `supabase/migrations/<timestamp>_rutinas_planificacion.sql`

```sql
-- 1. Limpiar wod_logs antes de drop por FK
TRUNCATE TABLE wod_logs CASCADE;

DROP TABLE IF EXISTS routine_assignments CASCADE;
DROP TABLE IF EXISTS routines CASCADE;
DROP TABLE IF EXISTS gym_schedule CASCADE;

-- 2. Tablas nuevas
CREATE TABLE routine_schedules (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  date date NOT NULL,
  name text,
  content text NOT NULL DEFAULT '',
  created_at timestamptz DEFAULT now(),
  updated_at timestamptz DEFAULT now()
);
CREATE INDEX idx_routine_schedules_date ON routine_schedules(date);

CREATE TABLE routine_schedule_plans (
  schedule_id uuid REFERENCES routine_schedules(id) ON DELETE CASCADE,
  plan_id uuid REFERENCES plans(id) ON DELETE CASCADE,
  PRIMARY KEY (schedule_id, plan_id)
);
CREATE INDEX idx_rsp_plan ON routine_schedule_plans(plan_id);

-- 3. Re-vincular wod_logs al nuevo modelo (queda vacía por TRUNCATE)
ALTER TABLE wod_logs
  DROP CONSTRAINT IF EXISTS wod_logs_routine_id_fkey,
  ADD CONSTRAINT wod_logs_routine_schedule_id_fkey
    FOREIGN KEY (routine_id) REFERENCES routine_schedules(id) ON DELETE CASCADE;

-- 4. Renombrar permisos
UPDATE roles
SET permissions = ARRAY(
  SELECT CASE
    WHEN p = 'schedule.view'   THEN 'routines.view'
    WHEN p = 'schedule.edit'   THEN 'routines.edit'
    WHEN p = 'schedule.delete' THEN 'routines.delete'
    ELSE p
  END
  FROM unnest(permissions) AS p
);

-- 5. RLS
ALTER TABLE routine_schedules ENABLE ROW LEVEL SECURITY;
ALTER TABLE routine_schedule_plans ENABLE ROW LEVEL SECURITY;

CREATE POLICY "auth read routine_schedules"
  ON routine_schedules FOR SELECT TO authenticated USING (true);
CREATE POLICY "auth read routine_schedule_plans"
  ON routine_schedule_plans FOR SELECT TO authenticated USING (true);
-- INSERT/UPDATE/DELETE solo via service_role (no se crea política,
-- el cliente SSR usa el contexto del usuario y las server actions
-- enforce permisos en código)
```

Después de aplicar la migración, regenerar `types/database.ts` con el MCP `mcp__supabase__generate_typescript_types`.

---

## 6. UI Admin

### 6.1 Estructura de archivos

```
app/dashboard/rutinas/page.tsx
  → renderiza <RutinasMainComponent/>

components/section-components/rutinas/
  RutinasMainComponent.tsx
  RoutinesList.tsx
  RoutineDayGroup.tsx
  RoutineCard.tsx
  index.ts
  modals/
    routine-wizard-modal.tsx
    routine-preview-modal.tsx
```

### 6.2 `RutinasMainComponent`

- `useQuery(['routine-schedules', { from, to, planFilter }])` → `getRoutineSchedules`.
- Filtros: rango de fechas (default hoy → +30 días) y filtro multi-plan opcional.
- Header: título "Rutinas" + descripción "Programa rutinas por fecha y plan" + botón principal **+ Crear rutina**.
- Botón abre `RoutineWizardModal` en modo `create`.

### 6.3 `RoutinesList` y `RoutineDayGroup`

- Agrupa por `date`, ordenado cronológicamente ascendente.
- Cada grupo encabezado con fecha legible en español: "Lunes, 5 de mayo de 2026" + chip "Hoy" si aplica.
- Stack vertical de `RoutineCard`. Si vacío: estado vacío con CTA al wizard.

### 6.4 `RoutineCard`

- Título: nombre de la rutina (o "Rutina sin nombre" si no tiene).
- Chips con nombres de los planes asignados (color por plan según paleta semántica).
- Preview corto del `content` (primeras ~120 caracteres, sin sintaxis markdown visible).
- Acciones: 👁️ vista previa, ✏️ editar, 🗑️ eliminar.
- `usePermissions('routines.edit'|'routines.delete')` controla la visibilidad de cada botón.
- Eliminar usa SweetAlert2 con tema oscuro.

### 6.5 `routine-wizard-modal`

Props: `mode: 'create' | 'edit'`, `routine?: RoutineSchedule`.

Estado con `react-hook-form` + `zodResolver`:

```ts
const schema = z.object({
  date: z.string().refine(d => mode === 'edit' || d >= todayCaracas, 'Fecha pasada no permitida'),
  plan_ids: z.array(z.string().uuid()).min(1, 'Selecciona al menos un plan'),
  name: z.string().max(100).optional(),
  content: z.string().min(1, 'El contenido es requerido'),
})
```

Layout:
- Header con stepper visual 1→2→3, paso activo en color primary, pasos completados con check.
- Body cambia según paso actual (estado local `step`).
- Footer: `Atrás` (oculto en paso 1), `Siguiente` (paso 1 y 2), `Crear rutina` o `Guardar cambios` (paso 3).

**Paso 1 — Fecha:** `<Calendar mode="single">` de shadcn. `disabled={{ before: hoy }}` en `create`. En `edit` se permite la fecha actual de la rutina aunque sea pasada.

**Paso 2 — Planes:** lista de planes activos (`getPlans`) con checkboxes. Al pulsar `Siguiente` se llama una server action `checkRoutineConflicts(date, plan_ids)` que devuelve los `plan_ids` en conflicto. Si hay conflicto: alerta inline con mensaje "Plan X y Plan Y ya tienen rutina ese día" y dos opciones — `Reemplazar` (avanza al paso 3 y guarda con `replace_conflicts: true`) o `Cambiar selección` (vuelve al paso 2). Si no hay conflicto, avanza directo al paso 3.

**Paso 3 — Contenido:** input opcional para `name` (placeholder "Nombre de la rutina, opcional"). Tabs `Editar | Vista previa`:
- Editar: textarea grande (~16 filas), font monoespaciada.
- Vista previa: render con `react-markdown` + `remark-gfm`.
- Footer: `Crear rutina` / `Guardar cambios`.

Al submit:
- Cliente: `react-hook-form` + zod valida.
- Server: server action revalida y maneja conflictos (race condition).
- Éxito: `toast.success("Rutina programada")`, `queryClient.invalidateQueries(['routine-schedules'])`, cierra modal.
- Error CONFLICT inesperado: re-mostrar paso 2 con conflictos.

### 6.6 `routine-preview-modal`

Modal de solo lectura. Header con fecha + nombre + chips de planes. Body con markdown renderizado (mismo render del paso 3 vista previa).

---

## 7. UI Portal del miembro

### 7.1 `/portal/home` — `TodayRoutineCard.tsx`

Reescritura del componente existente:
- Server action: `getRoutineForMemberOnDate(todayCaracas)`.
- Render: tarjeta con nombre + preview del markdown renderizado.
- Estado vacío: "Sin rutina programada para hoy".
- CTA: "Ver todas mis rutinas" → navega a `/portal/rutinas`.

### 7.2 `/portal/rutinas` (ruta nueva)

```
app/portal/rutinas/page.tsx
  → <PortalRutinasMainComponent/>

components/section-components/portal/rutinas/
  PortalRutinasMainComponent.tsx
  RutinaCalendar.tsx
  RutinaViewer.tsx
  index.ts
```

#### `PortalRutinasMainComponent`

- Estado local: `selectedDate` (default = hoy en Caracas).
- Queries:
  - `useQuery(['member-routine-dates', { from, to }])` → `getMemberRoutineDatesInRange` (ventana mes actual ± 1 mes; refresca al cambiar de mes en el calendario).
  - `useQuery(['member-routine', selectedDate])` → `getRoutineForMemberOnDate`.
- Layout:
  - Desktop: 2 columnas — calendario izquierda (~360px), viewer derecha (resto).
  - Mobile: stack vertical — calendario arriba, viewer abajo.

#### `RutinaCalendar`

- `<Calendar mode="single">` con `selected={selectedDate}` y `onSelect`.
- `modifiers={{ hasRoutine: fechasConRutina }}` con estilo destacado (punto debajo del número o background sutil amarillo).
- Sin restricción de rango.

#### `RutinaViewer`

- Header: fecha legible + nombre (si tiene).
- Body: markdown renderizado.
- Estados: skeleton (loading), vacío ("No hay rutina para esta fecha"), error.
- **Sin botón de "Loggear WOD"** mientras WOD logs estén desactivados.

### 7.3 Sidebar del portal

Agregar item "Rutinas" con icono `CalendarDays`, ruta `/portal/rutinas`, debajo de "Inicio".

### 7.4 `/portal/wod`

La ruta se mantiene pero `PortalWodMainComponent` renderiza un estado "Sección en construcción" con copy explicativo. Las queries existentes a `wod_logs` se eliminan o quedan condicionales para no romper el build.

---

## 8. Permisos

Renombrar en código y datos:

- `schedule.view` → `routines.view`
- `schedule.edit` → `routines.edit`
- `schedule.delete` → `routines.delete`

Cambios a aplicar:
- `lib/hooks/use-permissions.ts`: tipo de permisos disponibles.
- `lib/actions/routines.ts`: usa `routines.edit` / `routines.delete`.
- Componentes admin: `usePermissions('routines.*')` en lugar de `usePermissions('schedule.*')`.
- `roles.permissions[]`: actualizado por la migración SQL (paso 4 del script).
- `CLAUDE.md`: actualizar lista de permisos disponibles y modelo de datos.

---

## 9. Resumen de cambios en el repo

### Crear
- `supabase/migrations/<ts>_rutinas_planificacion.sql`
- `app/dashboard/rutinas/page.tsx`
- `components/section-components/rutinas/{RutinasMainComponent,RoutinesList,RoutineDayGroup,RoutineCard,index}.tsx`
- `components/section-components/rutinas/modals/{routine-wizard-modal,routine-preview-modal}.tsx`
- `app/portal/rutinas/page.tsx`
- `components/section-components/portal/rutinas/{PortalRutinasMainComponent,RutinaCalendar,RutinaViewer,index}.tsx`

### Reescribir
- `lib/actions/routines.ts` (nuevas server actions)
- `components/section-components/portal/home/TodayRoutineCard.tsx`
- `lib/actions/wod-logs.ts` (escrituras lanzan "deshabilitado")
- `lib/hooks/use-permissions.ts` (nombres de permisos)
- `types/database.ts` (regenerado)

### Eliminar
- `app/dashboard/horarios/` (carpeta)
- `components/section-components/horarios/` (carpeta)
- `components/section-components/portal/wod/log-wod-modal.tsx` (o desimportar)
- Funciones `getGymSchedule` y similares en `lib/actions/settings.ts`

### Modificar
- Sidebar admin (`components/shared/dashboard-sidebar.tsx` o equivalente): item "Horarios" → "Rutinas".
- Sidebar portal: agregar item "Rutinas".
- `next.config.ts`: redirect 308 `/dashboard/horarios` → `/dashboard/rutinas`.
- `CLAUDE.md`: modelo de datos y lista de permisos.

### Dependencias
- Verificar `react-markdown` y `remark-gfm` en `package.json`. Si no están, añadirlos.

---

## 10. Plan de pruebas manuales

1. Crear rutina con fecha hoy y 1 plan → aparece en lista admin y en portal home del miembro de ese plan.
2. Crear rutina con fecha futura y 3 planes → aparece para los 3 planes.
3. Intentar crear segunda rutina mismo día con plan ya ocupado → ver advertencia de conflicto y probar `Reemplazar`.
4. Editar rutina (cambiar fecha, planes, contenido) → cambios reflejados, conflicto re-evaluado.
5. Eliminar rutina → desaparece de admin y portal.
6. Como miembro, navegar el calendario → fechas con rutina marcadas, click muestra contenido, día sin rutina muestra estado vacío.
7. Probar con rol que tiene solo `routines.view` → no ve botones de crear/editar/eliminar; sí ve la lista.
8. Verificar que `/portal/wod` no rompe (estado "en construcción").

---

## 11. Fuera de alcance

- Botón "Duplicar rutina".
- Reactivar registro de WOD logs y leaderboard.
- Calendario en vista admin.
- Restricción de edición/eliminación por fecha.
- Biblioteca de rutinas reutilizables.
- Notificaciones a miembros cuando se publica una rutina nueva.
