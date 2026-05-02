# Horarios UX Ajustes — Plan de Implementación

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Tres ajustes de UX al admin de Horarios: ocultar planes en días cerrados, eliminar el toggle AM/PM redundante, y reemplazar el editor Markdown crudo por un editor multi-bloque WOD-aware.

**Architecture:** Issues 1 y 2 son cambios mecánicos en `DayColumn.tsx` y `ScheduleInline.tsx`. Issue 3 introduce una columna `blocks jsonb` en `routines`, con un editor estructurado de 10 tipos de bloque, render compartido en admin y portal miembro, e integración con WOD logging (auto-detect del primer bloque conditioning).

**Tech Stack:** Next.js 16, React 19, TypeScript estricto, Supabase (Postgres + RLS + JSONB), TanStack Query 5, shadcn/ui, React Hook Form + Zod, lucide-react.

**Spec:** [docs/superpowers/specs/2026-05-02-horarios-ux-ajustes-design.md](../specs/2026-05-02-horarios-ux-ajustes-design.md)

**Convenciones del proyecto:**
- Server actions con `"use server"`; UI nunca toca Supabase directamente.
- `revalidatePath` y `logActivity` después de mutaciones aplicables.
- TanStack Query: `queryKey` array, invalidar en `onSuccess`.
- Idioma español en UI; identificadores técnicos en inglés.
- Modo oscuro fijo. Yellow primary (`text-primary`).
- Verificación: `npx tsc --noEmit --skipLibCheck` + browser manual.
- Solo commiteamos código que compila sin errores.

---

## Estructura de archivos

**Crear:**
- `supabase/migrations/20260502160000_routines_blocks.sql`
- `lib/constants/routine-blocks.ts`
- `components/shared/routine-blocks/RoutineBlocks.tsx`
- `components/section-components/horarios/modals/block-editors.tsx`
- `components/section-components/horarios/modals/BlockPicker.tsx`
- `components/section-components/horarios/modals/RoutineBlockEditor.tsx`

**Modificar:**
- `lib/utils.ts` (helper `isDayClosed`)
- `types/database.ts` (regenerado)
- `components/section-components/horarios/DayColumn.tsx`
- `components/section-components/horarios/ScheduleInline.tsx`
- `components/section-components/horarios/modals/routine-form-modal.tsx`
- `components/section-components/horarios/modals/routine-preview-modal.tsx`
- `components/section-components/portal/home/TodayRoutineCard.tsx`
- `components/section-components/portal/wod/TodayWodHeader.tsx`
- `components/section-components/portal/descubrir/MemberDetailModal.tsx`
- `components/section-components/portal/wod/log-wod-modal.tsx`
- `lib/actions/routines.ts`
- `lib/actions/wod-logs.ts`

---

### Task 1: Issue 1 — Día cerrado oculta planes

**Files:**
- Modify: `lib/utils.ts`
- Modify: `components/section-components/horarios/DayColumn.tsx`
- Modify: `components/section-components/horarios/ScheduleInline.tsx`

- [ ] **Step 1: Agregar helper `isDayClosed` a `lib/utils.ts`**

Agregar al final de `lib/utils.ts`:

```ts
/**
 * Un día se considera cerrado cuando open_time === close_time.
 * La convención usada en el código es "00:00:00" === "00:00:00", pero
 * cualquier valor donde open === close cuenta. null/null no es "cerrado"
 * (sin definir).
 */
export function isDayClosed(openTime: string | null, closeTime: string | null): boolean {
  if (!openTime || !closeTime) return false
  return openTime === closeTime
}
```

- [ ] **Step 2: Reemplazar la función local de `ScheduleInline.tsx`**

En `components/section-components/horarios/ScheduleInline.tsx`, líneas 21-24, eliminar la función local:

```ts
function isClosed(open: string | null, close: string | null) {
  if (!open || !close) return false
  return open === close
}
```

Y agregar el import al tope (junto a los otros de `@/lib/utils`):

```ts
import { isDayClosed } from "@/lib/utils"
```

Reemplazar todos los usos de `isClosed(...)` por `isDayClosed(...)` en el mismo archivo (debe haber al menos uno alrededor de la línea 161).

- [ ] **Step 3: Modificar `DayColumn.tsx` para ocultar planes si día cerrado**

Reemplazar el contenido completo de `components/section-components/horarios/DayColumn.tsx` por:

```tsx
"use client"

import { Badge } from "@/components/ui/badge"
import { cn, isDayClosed } from "@/lib/utils"
import { ScheduleInline } from "./ScheduleInline"
import { RoutineCard } from "./RoutineCard"

interface DayColumnProps {
  scheduleRow: {
    id: string
    day_of_week: string
    open_time: string | null
    close_time: string | null
    afternoon_open: string | null
    afternoon_close: string | null
  }
  plans: Array<{ id: string; name: string }>
  routinesLibrary: Array<{ id: string; name: string }>
  assignmentsByPlan: Record<string, { id: string; name: string; content: string }>
  isToday: boolean
}

export function DayColumn({ scheduleRow, plans, routinesLibrary, assignmentsByPlan, isToday }: DayColumnProps) {
  const closed = isDayClosed(scheduleRow.open_time, scheduleRow.close_time)

  return (
    <div
      className={cn(
        "flex flex-col rounded-lg border bg-card p-3 gap-3 min-w-0",
        isToday && "border-primary/60 ring-2 ring-primary/30"
      )}
    >
      <div className="space-y-1">
        <div className="flex items-center justify-between gap-2">
          <h3 className="text-sm font-semibold uppercase tracking-wide">{scheduleRow.day_of_week}</h3>
          {isToday && <Badge className="bg-primary text-primary-foreground text-[10px] px-1.5 py-0">HOY</Badge>}
        </div>
        <ScheduleInline
          id={scheduleRow.id}
          open_time={scheduleRow.open_time}
          close_time={scheduleRow.close_time}
          afternoon_open={scheduleRow.afternoon_open}
          afternoon_close={scheduleRow.afternoon_close}
        />
      </div>

      {closed ? (
        <p className="text-xs text-muted-foreground italic text-center py-4">
          Sin actividad este día
        </p>
      ) : (
        <>
          <div className="border-t -mx-3" />
          <div className="space-y-2">
            {plans.length === 0 ? (
              <p className="text-xs text-muted-foreground italic">Sin planes activos</p>
            ) : (
              plans.map((plan) => (
                <div key={plan.id} className="space-y-1">
                  <p className="text-[10px] font-medium uppercase text-muted-foreground tracking-wide truncate">{plan.name}</p>
                  <RoutineCard
                    planId={plan.id}
                    planName={plan.name}
                    dayOfWeek={scheduleRow.day_of_week}
                    routine={assignmentsByPlan[plan.id] ?? null}
                    routinesLibrary={routinesLibrary}
                    highlight={isToday}
                  />
                </div>
              ))
            )}
          </div>
        </>
      )}
    </div>
  )
}
```

- [ ] **Step 4: Verificar TypeScript**

Run: `npx tsc --noEmit --skipLibCheck`
Expected: salida vacía.

- [ ] **Step 5: Commit**

```bash
git add lib/utils.ts components/section-components/horarios/DayColumn.tsx components/section-components/horarios/ScheduleInline.tsx
git commit -m "feat(horarios): ocultar planes cuando el día está cerrado

Co-Authored-By: Claude Opus 4.7 <noreply@anthropic.com>"
```

---

### Task 2: Issue 2 — AM/PM implícito por turno

**Files:**
- Modify: `components/section-components/horarios/ScheduleInline.tsx`

- [ ] **Step 1: Reescribir el archivo completo**

Reemplazar TODO el contenido de `components/section-components/horarios/ScheduleInline.tsx` por:

```tsx
"use client"

import { useEffect, useState } from "react"
import { useMutation, useQueryClient } from "@tanstack/react-query"
import { Switch } from "@/components/ui/switch"
import { Label } from "@/components/ui/label"
import { Button } from "@/components/ui/button"
import { Plus, X } from "lucide-react"
import { showToast } from "@/lib/sweetalert"
import { isDayClosed } from "@/lib/utils"
import { updateGymSchedule } from "@/lib/actions/settings"
import { usePermissions } from "@/lib/hooks/use-permissions"

interface ScheduleInlineProps {
  id: string
  open_time: string | null
  close_time: string | null
  afternoon_open: string | null
  afternoon_close: string | null
}

function toShort(t: string | null): string {
  if (!t) return ""
  return t.slice(0, 5)
}

function toFull(t: string): string | null {
  if (!t) return null
  return `${t}:00`
}

// ─── 12h time helpers (sin AM/PM toggle, period implícito) ────

type Period = "AM" | "PM"

/** Parsea "HH:MM" 24h a hora 12h (1-12) y minutos. */
function parse24To12(value: string): { hour: string; minute: string } {
  if (!value) return { hour: "", minute: "" }
  const [hStr = "", mStr = ""] = value.split(":")
  const h = parseInt(hStr, 10)
  const m = parseInt(mStr, 10)
  if (isNaN(h) || isNaN(m)) return { hour: "", minute: "" }
  let h12: number
  if (h === 0) h12 = 12             // 00:00 (medianoche) → 12 (raro pero lo soportamos)
  else if (h <= 12) h12 = h         // 1-12 → mismo número (12 en mañana = mediodía)
  else h12 = h - 12                 // 13-23 → 1-11 PM
  return { hour: String(h12), minute: String(m).padStart(2, "0") }
}

/** Formatea (hora 1-12, minuto, period) a "HH:MM" 24h.
 *  Convención: "12" siempre = mediodía (12:00) en cualquier sección.
 *  En AM (mañana): h12=12 → 12:00 (noon); h12 1-11 → 01:00-11:00.
 *  En PM (tarde): h12=12 → 12:00 (noon); h12 1-11 → 13:00-23:00.
 */
function format12To24(h12: number, minute: number, period: Period): string {
  let h: number
  if (h12 === 12) h = 12                          // 12 siempre = noon
  else h = period === "AM" ? h12 : h12 + 12       // 1-11 según período
  return `${String(h).padStart(2, "0")}:${String(minute).padStart(2, "0")}`
}

function formatLabel12(value: string | null): string {
  if (!value) return "—"
  const { hour, minute } = parse24To12(value.slice(0, 5))
  if (!hour || !minute) return "—"
  const [hStr] = value.split(":")
  const h = parseInt(hStr, 10)
  const period: Period = h < 12 || h === 24 ? "AM" : "PM"
  return `${hour}:${minute} ${period}`
}

function Time12h({
  value,
  period,
  onCommit,
  disabled,
}: {
  value: string
  period: Period
  onCommit: (next: string) => void
  disabled?: boolean
}) {
  const init = parse24To12(value)
  const [hour, setHour] = useState(init.hour)
  const [minute, setMinute] = useState(init.minute)

  useEffect(() => {
    const p = parse24To12(value)
    setHour(p.hour)
    setMinute(p.minute)
  }, [value])

  const commit = (h: string, m: string) => {
    const hn = parseInt(h, 10)
    const mn = parseInt(m, 10)
    if (isNaN(hn) || isNaN(mn) || hn < 1 || hn > 12 || mn < 0 || mn > 59) return
    onCommit(format12To24(hn, mn, period))
  }

  return (
    <div className="inline-flex items-center gap-0.5">
      <input
        type="number"
        inputMode="numeric"
        min={1}
        max={12}
        placeholder="hh"
        value={hour}
        onChange={(e) => setHour(e.target.value.replace(/\D/g, "").slice(0, 2))}
        onBlur={() => commit(hour, minute)}
        disabled={disabled}
        className="w-9 h-7 px-1 text-center text-xs bg-background border border-input rounded outline-none focus:ring-1 focus:ring-ring [&::-webkit-inner-spin-button]:appearance-none [&::-webkit-outer-spin-button]:appearance-none [appearance:textfield]"
      />
      <span className="text-xs text-muted-foreground">:</span>
      <input
        type="number"
        inputMode="numeric"
        min={0}
        max={59}
        placeholder="mm"
        value={minute}
        onChange={(e) => setMinute(e.target.value.replace(/\D/g, "").slice(0, 2))}
        onBlur={() => {
          const padded = minute && minute.length === 1 ? minute.padStart(2, "0") : minute
          if (padded !== minute) setMinute(padded)
          commit(hour, padded)
        }}
        disabled={disabled}
        className="w-9 h-7 px-1 text-center text-xs bg-background border border-input rounded outline-none focus:ring-1 focus:ring-ring [&::-webkit-inner-spin-button]:appearance-none [&::-webkit-outer-spin-button]:appearance-none [appearance:textfield]"
      />
      <span className="text-[10px] text-muted-foreground font-medium pl-0.5">{period}</span>
    </div>
  )
}

// ─── Main component ─────────────────────────────────────────

export function ScheduleInline({
  id,
  open_time,
  close_time,
  afternoon_open,
  afternoon_close,
}: ScheduleInlineProps) {
  const queryClient = useQueryClient()
  const { hasPermission } = usePermissions()
  const canEdit = hasPermission("schedule.edit")

  const [openVal, setOpenVal] = useState(toShort(open_time))
  const [closeVal, setCloseVal] = useState(toShort(close_time))
  const [pmOpenVal, setPmOpenVal] = useState(toShort(afternoon_open))
  const [pmCloseVal, setPmCloseVal] = useState(toShort(afternoon_close))
  const [closed, setClosed] = useState(isDayClosed(open_time, close_time))
  const [showPm, setShowPm] = useState(Boolean(afternoon_open && afternoon_close))

  useEffect(() => {
    setOpenVal(toShort(open_time))
    setCloseVal(toShort(close_time))
    setPmOpenVal(toShort(afternoon_open))
    setPmCloseVal(toShort(afternoon_close))
    setClosed(isDayClosed(open_time, close_time))
    setShowPm(Boolean(afternoon_open && afternoon_close))
  }, [open_time, close_time, afternoon_open, afternoon_close])

  const mutation = useMutation({
    mutationFn: (data: {
      open_time: string
      close_time: string
      afternoon_open: string | null
      afternoon_close: string | null
    }) => updateGymSchedule(id, data),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["gym-schedule"] })
      showToast.success("Horario actualizado", "Los cambios se guardaron.")
    },
    onError: () => showToast.error("Error", "No se pudo actualizar el horario."),
  })

  const persistMorning = (open: string, close: string) => {
    if (!open || !close) return
    mutation.mutate({
      open_time: `${open}:00`,
      close_time: `${close}:00`,
      afternoon_open: toFull(pmOpenVal),
      afternoon_close: toFull(pmCloseVal),
    })
  }

  const persistAfternoon = (pmOpen: string, pmClose: string) => {
    if (!openVal || !closeVal) return
    mutation.mutate({
      open_time: `${openVal}:00`,
      close_time: `${closeVal}:00`,
      afternoon_open: pmOpen ? `${pmOpen}:00` : null,
      afternoon_close: pmClose ? `${pmClose}:00` : null,
    })
  }

  const handleToggleClosed = (next: boolean) => {
    setClosed(next)
    if (next) {
      mutation.mutate({
        open_time: "00:00:00",
        close_time: "00:00:00",
        afternoon_open: null,
        afternoon_close: null,
      })
      setOpenVal("00:00")
      setCloseVal("00:00")
      setPmOpenVal("")
      setPmCloseVal("")
      setShowPm(false)
    } else {
      setOpenVal("")
      setCloseVal("")
    }
  }

  const handleRemoveAfternoon = () => {
    setShowPm(false)
    setPmOpenVal("")
    setPmCloseVal("")
    if (openVal && closeVal) {
      mutation.mutate({
        open_time: `${openVal}:00`,
        close_time: `${closeVal}:00`,
        afternoon_open: null,
        afternoon_close: null,
      })
    }
  }

  if (!canEdit) {
    if (closed) return <p className="text-xs text-muted-foreground">Cerrado</p>
    return (
      <div className="text-xs text-muted-foreground space-y-0.5">
        <p>{formatLabel12(openVal)} → {formatLabel12(closeVal)}</p>
        {pmOpenVal && pmCloseVal && (
          <p>{formatLabel12(pmOpenVal)} → {formatLabel12(pmCloseVal)}</p>
        )}
      </div>
    )
  }

  return (
    <div className="space-y-2">
      <div className="flex items-center gap-1.5">
        <Switch checked={closed} onCheckedChange={handleToggleClosed} id={`closed-${id}`} />
        <Label htmlFor={`closed-${id}`} className="text-xs">Cerrado</Label>
      </div>
      {!closed && (
        <>
          <div className="space-y-1">
            <span className="text-[10px] uppercase text-muted-foreground tracking-wide">Mañana</span>
            <div className="grid grid-cols-[auto_1fr] gap-x-1.5 gap-y-1 items-center">
              <span className="text-[10px] text-muted-foreground">Abre</span>
              <Time12h
                value={openVal}
                period="AM"
                onCommit={(next) => {
                  setOpenVal(next)
                  persistMorning(next, closeVal)
                }}
                disabled={mutation.isPending}
              />
              <span className="text-[10px] text-muted-foreground">Cierra</span>
              <Time12h
                value={closeVal}
                period="AM"
                onCommit={(next) => {
                  setCloseVal(next)
                  persistMorning(openVal, next)
                }}
                disabled={mutation.isPending}
              />
            </div>
          </div>
          {showPm ? (
            <div className="space-y-1">
              <div className="flex items-center justify-between">
                <span className="text-[10px] uppercase text-muted-foreground tracking-wide">Tarde</span>
                <button
                  type="button"
                  onClick={handleRemoveAfternoon}
                  className="text-[10px] text-muted-foreground hover:text-destructive flex items-center gap-0.5"
                  disabled={mutation.isPending}
                >
                  <X className="h-2.5 w-2.5" /> Quitar
                </button>
              </div>
              <div className="grid grid-cols-[auto_1fr] gap-x-1.5 gap-y-1 items-center">
                <span className="text-[10px] text-muted-foreground">Abre</span>
                <Time12h
                  value={pmOpenVal}
                  period="PM"
                  onCommit={(next) => {
                    setPmOpenVal(next)
                    persistAfternoon(next, pmCloseVal)
                  }}
                  disabled={mutation.isPending}
                />
                <span className="text-[10px] text-muted-foreground">Cierra</span>
                <Time12h
                  value={pmCloseVal}
                  period="PM"
                  onCommit={(next) => {
                    setPmCloseVal(next)
                    persistAfternoon(pmOpenVal, next)
                  }}
                  disabled={mutation.isPending}
                />
              </div>
            </div>
          ) : (
            <Button
              type="button"
              variant="ghost"
              size="sm"
              onClick={() => setShowPm(true)}
              className="h-7 text-[11px] px-2 gap-1 w-full justify-start text-muted-foreground hover:text-foreground"
            >
              <Plus className="h-3 w-3" /> Agregar turno tarde
            </Button>
          )}
        </>
      )}
    </div>
  )
}
```

> **Notas para el ejecutor:**
> - El componente `Time12h` ahora recibe `period` como prop fija. Internamente NO tiene state ni botón de AM/PM.
> - El badge `{period}` a la derecha de los inputs es solo informativo (label, no clickable).
> - La función `format12To24` aplica la regla "12 siempre = mediodía" — verificar que `12` en mañana → `12:00`, `6` en mañana → `06:00`, `12` en tarde → `12:00`, `5` en tarde → `17:00`.

- [ ] **Step 2: Verificar TypeScript**

Run: `npx tsc --noEmit --skipLibCheck`
Expected: salida vacía.

- [ ] **Step 3: QA visual rápido**

`npm run dev`. Loguearse como admin con `schedule.edit`. Ir a `/dashboard/horarios`:
- En cualquier día abierto: NO debe haber botón AM/PM clickeable; debe verse solo el label "AM" en mañana y "PM" en tarde.
- Tipear "6" en mañana abre, "12" en mañana cierra → guarda como `06:00:00` y `12:00:00`. La etiqueta en read-only debería leer "6:00 AM → 12:00 PM".
- Tipear "5" en tarde abre, "9" en tarde cierra → guarda como `17:00:00` y `21:00:00`.
- Tipear "12" en tarde abre, "6" en tarde cierra → guarda como `12:00:00` y `18:00:00`.

- [ ] **Step 4: Commit**

```bash
git add components/section-components/horarios/ScheduleInline.tsx
git commit -m "feat(horarios): AM/PM implícito por sección Mañana/Tarde

Co-Authored-By: Claude Opus 4.7 <noreply@anthropic.com>"
```

---

### Task 3: Migración DB — columna `blocks` en `routines`

**Files:**
- Create: `supabase/migrations/20260502160000_routines_blocks.sql`
- Modify: `types/database.ts` (regenerado)

- [ ] **Step 1: Crear el archivo de migración**

Crear `supabase/migrations/20260502160000_routines_blocks.sql` con:

```sql
-- Agregar columna blocks (jsonb) a routines y migrar contenido legacy

-- 1. Columna nueva
ALTER TABLE public.routines
  ADD COLUMN IF NOT EXISTS blocks jsonb NOT NULL DEFAULT '[]'::jsonb;

-- 2. Migración M1: convertir content existente a un único bloque tipo 'notes'
UPDATE public.routines
SET blocks = jsonb_build_array(
  jsonb_build_object(
    'id', gen_random_uuid()::text,
    'order', 0,
    'type', 'notes',
    'text', content
  )
)
WHERE content IS NOT NULL
  AND content <> ''
  AND blocks = '[]'::jsonb;

-- 3. La columna content se mantiene por compatibilidad. Una migración
--    posterior la dropeará cuando confirmemos que nada la lee.

-- 4. Índice GIN sobre blocks para queries futuras (no usado todavía pero útil)
CREATE INDEX IF NOT EXISTS routines_blocks_gin_idx ON public.routines USING gin (blocks);
```

- [ ] **Step 2: Aplicar la migración**

Run: `npx supabase db push`
Expected: "Applying migration 20260502160000_routines_blocks.sql..." y "Finished supabase db push."

- [ ] **Step 3: Regenerar types**

Run (Bash, no PowerShell, para evitar UTF-16): `npx supabase gen types typescript --linked > types/database.ts`

- [ ] **Step 4: Limpiar el archivo regenerado**

Editar `types/database.ts`:
- Eliminar primera línea `Initialising login role...` si existe (debe quedar `export type Json =` como primera línea).
- Eliminar última línea `<claude-code-hint v="1" type="plugin" value="supabase@claude-plugins-official" />` si existe.

Y al final del archivo (después del último `} as const`), volver a agregar las interfaces custom:

```ts

// Monthly Closing types
export interface MonthlyClosing {
  id: string
  period: string

  // Ingresos membresías
  membership_revenue_bs: number
  membership_revenue_usd_cash: number
  membership_revenue_usdt: number
  membership_payments_count: number

  // Ingresos clases
  class_revenue_bs: number
  class_revenue_usd_cash: number
  class_revenue_usdt: number
  class_payments_count: number

  // Total USD
  total_revenue_usd: number

  // Métricas miembros
  active_members: number
  new_members: number
  expired_members: number
  frozen_members: number
  total_members: number
  retention_rate: number

  // Fondos
  funds_bs: number
  funds_usd_cash: number
  funds_usdt: number
  funds_reset: boolean

  // Tasas
  rate_bcv: number
  rate_usdt: number
  rate_custom: number

  // Metadata
  closed_by: string | null
  closed_at: string
  notes: string | null
  created_at: string

  // Relaciones
  admin?: { name: string }
}

export interface MonthlyClosingPreview {
  period: string
  membership_revenue: { bs: number; usd_cash: number; usdt: number; count: number }
  class_revenue: { bs: number; usd_cash: number; usdt: number; count: number }
  total_revenue_usd: number
  members: { active: number; new: number; expired: number; frozen: number; total: number; retention: number }
  funds: { bs: number; usd_cash: number; usdt: number }
  rates: { bcv: number; usdt: number; custom: number }
}

export interface PendingPeriod {
  period: string
  label: string
  isOldest: boolean
}
```

- [ ] **Step 5: Verificar `blocks` en routines.Row**

Buscar en `types/database.ts` la sección `routines:` — debe existir el campo `blocks: Json`.

- [ ] **Step 6: Verificar TypeScript**

Run: `npx tsc --noEmit --skipLibCheck`
Expected: sin errores.

- [ ] **Step 7: Commit**

```bash
git add supabase/migrations/20260502160000_routines_blocks.sql types/database.ts
git commit -m "feat(horarios): migración blocks jsonb en routines + migrate legacy

Co-Authored-By: Claude Opus 4.7 <noreply@anthropic.com>"
```

---

### Task 4: Constantes y types de bloques

**Files:**
- Create: `lib/constants/routine-blocks.ts`

- [ ] **Step 1: Crear el archivo**

Crear `lib/constants/routine-blocks.ts`:

```ts
import {
  Activity, Dumbbell, Target,
  Infinity as InfinityIcon, Timer, Clock, Hash, RotateCw,
  Wind, StickyNote,
  type LucideIcon,
} from "lucide-react"
import type { ScoreType } from "./wod-score"

// ─── Types ───────────────────────────────────────────────

export type BlockType =
  | "warmup" | "strength" | "skill"
  | "amrap" | "emom" | "for_time" | "for_reps" | "rft"
  | "cooldown" | "notes"

export interface BlockBase {
  id: string
  order: number
  type: BlockType
}

export interface WarmupBlock extends BlockBase { type: "warmup"; text: string }
export interface CooldownBlock extends BlockBase { type: "cooldown"; text: string }
export interface NotesBlock extends BlockBase { type: "notes"; text: string }

export interface StrengthBlock extends BlockBase {
  type: "strength"
  exercise: string
  sets: number
  reps: string
  weight?: string
  notes?: string
}

export interface SkillBlock extends BlockBase {
  type: "skill"
  exercises: string[]
  notes?: string
}

export interface AmrapBlock extends BlockBase { type: "amrap"; minutes: number; movements: string[] }
export interface EmomBlock extends BlockBase { type: "emom"; minutes: number; movements: string[]; alternating: boolean }
export interface ForTimeBlock extends BlockBase { type: "for_time"; movements: string[]; time_cap_min?: number }
export interface ForRepsBlock extends BlockBase { type: "for_reps"; target_reps: number; movements: string[] }
export interface RftBlock extends BlockBase { type: "rft"; rounds: number; movements: string[] }

export type RoutineBlock =
  | WarmupBlock | CooldownBlock | NotesBlock
  | StrengthBlock | SkillBlock
  | AmrapBlock | EmomBlock | ForTimeBlock | ForRepsBlock | RftBlock

// ─── Metadata por tipo ───────────────────────────────────

export interface BlockMeta {
  label: string
  icon: LucideIcon
}

export const BLOCK_META: Record<BlockType, BlockMeta> = {
  warmup:   { label: "Warm-up",       icon: Activity },
  strength: { label: "Strength",      icon: Dumbbell },
  skill:    { label: "Skill",         icon: Target },
  amrap:    { label: "AMRAP",         icon: InfinityIcon },
  emom:     { label: "EMOM",          icon: Timer },
  for_time: { label: "For Time",      icon: Clock },
  for_reps: { label: "For Reps",      icon: Hash },
  rft:      { label: "Rounds For Time", icon: RotateCw },
  cooldown: { label: "Cool-down",     icon: Wind },
  notes:    { label: "Notas",         icon: StickyNote },
}

// Orden estable para el dropdown del BlockPicker
export const BLOCK_TYPE_ORDER: BlockType[] = [
  "warmup",
  "strength",
  "skill",
  "amrap",
  "emom",
  "for_time",
  "rft",
  "for_reps",
  "cooldown",
  "notes",
]

// ─── Mapeo bloque → score_type del WOD logging ───────────

export const CONDITIONING_SCORE_TYPE: Partial<Record<BlockType, ScoreType>> = {
  amrap: "amrap",
  for_time: "for_time",
  rft: "for_time",
  for_reps: "for_reps",
  strength: "weight",
}

/**
 * Devuelve el primer bloque de la rutina cuyo tipo mapea a un score_type
 * (es decir, "registrable" en el WOD logging). Si no hay → null.
 */
export function getPrimaryConditioningBlock(blocks: RoutineBlock[]): RoutineBlock | null {
  const sorted = [...blocks].sort((a, b) => a.order - b.order)
  for (const b of sorted) {
    if (CONDITIONING_SCORE_TYPE[b.type]) return b
  }
  return null
}

/** Score type derivado del bloque principal, o null si no es registrable. */
export function getScoreTypeForBlock(block: RoutineBlock | null): ScoreType | null {
  if (!block) return null
  return CONDITIONING_SCORE_TYPE[block.type] ?? null
}

// ─── Factory de bloques nuevos (con defaults sanos) ──────

export function createBlock(type: BlockType, order: number): RoutineBlock {
  const id = (typeof crypto !== "undefined" && "randomUUID" in crypto)
    ? crypto.randomUUID()
    : Math.random().toString(36).slice(2, 12)
  switch (type) {
    case "warmup":   return { id, order, type, text: "" }
    case "cooldown": return { id, order, type, text: "" }
    case "notes":    return { id, order, type, text: "" }
    case "strength": return { id, order, type, exercise: "", sets: 1, reps: "5", weight: "", notes: "" }
    case "skill":    return { id, order, type, exercises: [""], notes: "" }
    case "amrap":    return { id, order, type, minutes: 10, movements: [""] }
    case "emom":     return { id, order, type, minutes: 10, movements: [""], alternating: false }
    case "for_time": return { id, order, type, movements: [""], time_cap_min: undefined }
    case "for_reps": return { id, order, type, target_reps: 100, movements: [""] }
    case "rft":      return { id, order, type, rounds: 5, movements: [""] }
  }
}

// ─── Helpers JSON safe ───────────────────────────────────

/**
 * Toma el campo blocks del DB (jsonb → unknown) y lo valida superficialmente.
 * Si la forma no es válida, devuelve [].
 */
export function parseBlocks(raw: unknown): RoutineBlock[] {
  if (!Array.isArray(raw)) return []
  return raw.filter((b): b is RoutineBlock => {
    if (!b || typeof b !== "object") return false
    const t = (b as { type?: unknown }).type
    return typeof t === "string" && t in BLOCK_META
  })
}
```

- [ ] **Step 2: Verificar TypeScript**

Run: `npx tsc --noEmit --skipLibCheck`
Expected: sin errores.

- [ ] **Step 3: Commit**

```bash
git add lib/constants/routine-blocks.ts
git commit -m "feat(horarios): types y helpers de bloques de rutina

Co-Authored-By: Claude Opus 4.7 <noreply@anthropic.com>"
```

---

### Task 5: Componente compartido `<RoutineBlocks>` (render miembro)

**Files:**
- Create: `components/shared/routine-blocks/RoutineBlocks.tsx`

- [ ] **Step 1: Crear el componente**

Crear `components/shared/routine-blocks/RoutineBlocks.tsx`:

```tsx
"use client"

import { cn } from "@/lib/utils"
import {
  type RoutineBlock,
  type BlockType,
  BLOCK_META,
  parseBlocks,
} from "@/lib/constants/routine-blocks"

// ─── Subcomponentes por tipo ─────────────────────────────

function MovementsList({ items }: { items: string[] }) {
  const list = items.filter((m) => m.trim())
  if (list.length === 0) return <p className="text-xs text-muted-foreground italic">Sin movimientos</p>
  return (
    <ul className="space-y-0.5 text-sm">
      {list.map((m, i) => (
        <li key={i} className="flex gap-2">
          <span className="text-muted-foreground">•</span>
          <span>{m}</span>
        </li>
      ))}
    </ul>
  )
}

function FreeTextBody({ text }: { text: string }) {
  if (!text.trim()) return <p className="text-xs text-muted-foreground italic">Sin contenido</p>
  return (
    <div className="text-sm whitespace-pre-wrap">{text}</div>
  )
}

function BlockHeader({ type, headline }: { type: BlockType; headline?: string }) {
  const meta = BLOCK_META[type]
  const Icon = meta.icon
  return (
    <div className="flex items-center gap-2 mb-2">
      <Icon className="h-4 w-4 text-primary" />
      <h4 className="text-sm font-bold">
        {meta.label}
        {headline && <span className="text-muted-foreground font-normal ml-1.5">· {headline}</span>}
      </h4>
    </div>
  )
}

function BlockCard({ children }: { children: React.ReactNode }) {
  return (
    <div className="border rounded-lg p-3 sm:p-4 bg-card/50">
      {children}
    </div>
  )
}

function BlockBody(block: RoutineBlock): { headline?: string; content: React.ReactNode } {
  switch (block.type) {
    case "warmup":
    case "cooldown":
    case "notes":
      return { content: <FreeTextBody text={block.text} /> }

    case "strength": {
      const headline = block.exercise || "(sin ejercicio)"
      const setsReps = `${block.sets} × ${block.reps}`
      const weight = block.weight ? ` @ ${block.weight}` : ""
      return {
        headline,
        content: (
          <div className="space-y-1.5">
            <p className="text-sm font-semibold tabular-nums">{setsReps}{weight}</p>
            {block.notes && <p className="text-xs text-muted-foreground">{block.notes}</p>}
          </div>
        ),
      }
    }

    case "skill":
      return {
        content: (
          <div className="space-y-2">
            <MovementsList items={block.exercises} />
            {block.notes && <p className="text-xs text-muted-foreground">{block.notes}</p>}
          </div>
        ),
      }

    case "amrap":
      return {
        headline: `${block.minutes} min`,
        content: <MovementsList items={block.movements} />,
      }

    case "emom":
      return {
        headline: `${block.minutes} min${block.alternating ? " · alternando" : ""}`,
        content: <MovementsList items={block.movements} />,
      }

    case "for_time": {
      const cap = block.time_cap_min ? ` · cap ${block.time_cap_min} min` : ""
      return {
        headline: `${cap.trim() || ""}`.trim() || undefined,
        content: <MovementsList items={block.movements} />,
      }
    }

    case "for_reps":
      return {
        headline: `${block.target_reps} reps`,
        content: <MovementsList items={block.movements} />,
      }

    case "rft":
      return {
        headline: `${block.rounds} rounds`,
        content: <MovementsList items={block.movements} />,
      }
  }
}

// ─── Componente principal ────────────────────────────────

interface RoutineBlocksProps {
  blocks: unknown
  className?: string
  emptyMessage?: string
}

export function RoutineBlocks({ blocks, className, emptyMessage }: RoutineBlocksProps) {
  const list = parseBlocks(blocks).sort((a, b) => a.order - b.order)
  if (list.length === 0) {
    return (
      <p className="text-sm text-muted-foreground italic">
        {emptyMessage ?? "Sin contenido"}
      </p>
    )
  }
  return (
    <div className={cn("space-y-3", className)}>
      {list.map((b) => {
        const { headline, content } = BlockBody(b)
        return (
          <BlockCard key={b.id}>
            <BlockHeader type={b.type} headline={headline} />
            {content}
          </BlockCard>
        )
      })}
    </div>
  )
}
```

- [ ] **Step 2: Verificar TypeScript**

Run: `npx tsc --noEmit --skipLibCheck`
Expected: sin errores.

- [ ] **Step 3: Commit**

```bash
git add components/shared/routine-blocks/RoutineBlocks.tsx
git commit -m "feat(horarios): componente compartido RoutineBlocks (render miembro)

Co-Authored-By: Claude Opus 4.7 <noreply@anthropic.com>"
```

---

### Task 6: Editores de bloque (admin)

**Files:**
- Create: `components/section-components/horarios/modals/block-editors.tsx`

- [ ] **Step 1: Crear el archivo**

Crear `components/section-components/horarios/modals/block-editors.tsx`:

```tsx
"use client"

import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { Textarea } from "@/components/ui/textarea"
import { Switch } from "@/components/ui/switch"
import { Button } from "@/components/ui/button"
import { Plus, Trash2 } from "lucide-react"
import type { RoutineBlock } from "@/lib/constants/routine-blocks"

// ─── Helpers ─────────────────────────────────────────────

function MovementsEditor({
  values,
  onChange,
  placeholder,
}: {
  values: string[]
  onChange: (next: string[]) => void
  placeholder?: string
}) {
  return (
    <div className="space-y-1.5">
      <Label className="text-xs">Movimientos</Label>
      {values.map((v, i) => (
        <div key={i} className="flex items-center gap-1.5">
          <Input
            value={v}
            placeholder={placeholder ?? "Ej: 10 burpees"}
            onChange={(e) => {
              const next = [...values]
              next[i] = e.target.value
              onChange(next)
            }}
            className="text-sm"
          />
          <Button
            type="button"
            variant="ghost"
            size="icon"
            onClick={() => {
              if (values.length === 1) {
                onChange([""])
              } else {
                onChange(values.filter((_, idx) => idx !== i))
              }
            }}
            className="h-8 w-8 text-muted-foreground hover:text-destructive shrink-0"
          >
            <Trash2 className="h-3.5 w-3.5" />
          </Button>
        </div>
      ))}
      <Button
        type="button"
        variant="ghost"
        size="sm"
        onClick={() => onChange([...values, ""])}
        className="h-7 text-[11px] gap-1 text-muted-foreground"
      >
        <Plus className="h-3 w-3" /> Agregar movimiento
      </Button>
    </div>
  )
}

function NumberInput({
  id, label, value, onChange, min, placeholder,
}: {
  id: string
  label: string
  value: number
  onChange: (n: number) => void
  min?: number
  placeholder?: string
}) {
  return (
    <div className="space-y-1">
      <Label htmlFor={id} className="text-xs">{label}</Label>
      <Input
        id={id}
        type="number"
        inputMode="numeric"
        min={min ?? 0}
        value={value}
        placeholder={placeholder}
        onChange={(e) => {
          const n = Number(e.target.value)
          onChange(Number.isFinite(n) && n >= 0 ? n : 0)
        }}
        className="text-sm"
      />
    </div>
  )
}

function FreeTextEditor({
  value, onChange, placeholder, rows = 3,
}: {
  value: string
  onChange: (v: string) => void
  placeholder?: string
  rows?: number
}) {
  return (
    <Textarea
      value={value}
      onChange={(e) => onChange(e.target.value)}
      placeholder={placeholder}
      rows={rows}
      className="text-sm"
    />
  )
}

// ─── Editor por tipo ─────────────────────────────────────

interface EditorProps<B extends RoutineBlock> {
  block: B
  onChange: (next: B) => void
}

function WarmupEditor({ block, onChange }: EditorProps<RoutineBlock & { type: "warmup" }>) {
  return <FreeTextEditor value={block.text} onChange={(text) => onChange({ ...block, text })} placeholder="Ej: Movilidad de hombros 5 min, 3 rondas de 10 jumping jacks…" />
}

function CooldownEditor({ block, onChange }: EditorProps<RoutineBlock & { type: "cooldown" }>) {
  return <FreeTextEditor value={block.text} onChange={(text) => onChange({ ...block, text })} placeholder="Ej: Estiramiento isquios 2 min, foam roller espalda…" />
}

function NotesEditor({ block, onChange }: EditorProps<RoutineBlock & { type: "notes" }>) {
  return <FreeTextEditor value={block.text} onChange={(text) => onChange({ ...block, text })} placeholder="Notas del coach…" rows={4} />
}

function StrengthEditor({ block, onChange }: EditorProps<RoutineBlock & { type: "strength" }>) {
  return (
    <div className="space-y-2">
      <div className="space-y-1">
        <Label htmlFor={`ex-${block.id}`} className="text-xs">Ejercicio</Label>
        <Input
          id={`ex-${block.id}`}
          value={block.exercise}
          onChange={(e) => onChange({ ...block, exercise: e.target.value })}
          placeholder="Ej: Back Squat"
          className="text-sm"
        />
      </div>
      <div className="grid grid-cols-3 gap-2">
        <NumberInput id={`s-${block.id}`} label="Sets" value={block.sets} min={1} onChange={(sets) => onChange({ ...block, sets })} />
        <div className="space-y-1">
          <Label htmlFor={`r-${block.id}`} className="text-xs">Reps</Label>
          <Input id={`r-${block.id}`} value={block.reps} onChange={(e) => onChange({ ...block, reps: e.target.value })} placeholder="5 / 5-3-1 / AMRAP" className="text-sm" />
        </div>
        <div className="space-y-1">
          <Label htmlFor={`w-${block.id}`} className="text-xs">Peso/% (opc)</Label>
          <Input id={`w-${block.id}`} value={block.weight ?? ""} onChange={(e) => onChange({ ...block, weight: e.target.value })} placeholder="80 kg / 70%" className="text-sm" />
        </div>
      </div>
      <div className="space-y-1">
        <Label htmlFor={`n-${block.id}`} className="text-xs">Notas (opc)</Label>
        <Input id={`n-${block.id}`} value={block.notes ?? ""} onChange={(e) => onChange({ ...block, notes: e.target.value })} placeholder="Foco en técnica…" className="text-sm" />
      </div>
    </div>
  )
}

function SkillEditor({ block, onChange }: EditorProps<RoutineBlock & { type: "skill" }>) {
  return (
    <div className="space-y-2">
      <MovementsEditor
        values={block.exercises}
        onChange={(exercises) => onChange({ ...block, exercises })}
        placeholder="Ej: Double under × 50"
      />
      <div className="space-y-1">
        <Label htmlFor={`sn-${block.id}`} className="text-xs">Notas (opc)</Label>
        <Input id={`sn-${block.id}`} value={block.notes ?? ""} onChange={(e) => onChange({ ...block, notes: e.target.value })} placeholder="Tempo, foco, etc." className="text-sm" />
      </div>
    </div>
  )
}

function AmrapEditor({ block, onChange }: EditorProps<RoutineBlock & { type: "amrap" }>) {
  return (
    <div className="space-y-2">
      <NumberInput id={`m-${block.id}`} label="Minutos" value={block.minutes} min={1} onChange={(minutes) => onChange({ ...block, minutes })} />
      <MovementsEditor values={block.movements} onChange={(movements) => onChange({ ...block, movements })} />
    </div>
  )
}

function EmomEditor({ block, onChange }: EditorProps<RoutineBlock & { type: "emom" }>) {
  return (
    <div className="space-y-2">
      <NumberInput id={`m-${block.id}`} label="Minutos totales" value={block.minutes} min={1} onChange={(minutes) => onChange({ ...block, minutes })} />
      <MovementsEditor values={block.movements} onChange={(movements) => onChange({ ...block, movements })} placeholder="Ej: Min 1 - 10 KB swings; Min 2 - 5 burpees" />
      <div className="flex items-center justify-between gap-2 rounded-md border border-border p-2">
        <Label htmlFor={`alt-${block.id}`} className="text-xs">Alternando minutos (impar/par)</Label>
        <Switch id={`alt-${block.id}`} checked={block.alternating} onCheckedChange={(alternating) => onChange({ ...block, alternating })} />
      </div>
    </div>
  )
}

function ForTimeEditor({ block, onChange }: EditorProps<RoutineBlock & { type: "for_time" }>) {
  return (
    <div className="space-y-2">
      <MovementsEditor values={block.movements} onChange={(movements) => onChange({ ...block, movements })} />
      <div className="space-y-1">
        <Label htmlFor={`cap-${block.id}`} className="text-xs">Time cap (min, opc)</Label>
        <Input
          id={`cap-${block.id}`}
          type="number"
          inputMode="numeric"
          min={1}
          value={block.time_cap_min ?? ""}
          placeholder="Ej: 20"
          onChange={(e) => {
            const v = e.target.value
            const n = v === "" ? undefined : Number(v)
            onChange({ ...block, time_cap_min: typeof n === "number" && Number.isFinite(n) && n > 0 ? n : undefined })
          }}
          className="text-sm"
        />
      </div>
    </div>
  )
}

function ForRepsEditor({ block, onChange }: EditorProps<RoutineBlock & { type: "for_reps" }>) {
  return (
    <div className="space-y-2">
      <NumberInput id={`tr-${block.id}`} label="Reps objetivo" value={block.target_reps} min={1} onChange={(target_reps) => onChange({ ...block, target_reps })} />
      <MovementsEditor values={block.movements} onChange={(movements) => onChange({ ...block, movements })} />
    </div>
  )
}

function RftEditor({ block, onChange }: EditorProps<RoutineBlock & { type: "rft" }>) {
  return (
    <div className="space-y-2">
      <NumberInput id={`r-${block.id}`} label="Rounds" value={block.rounds} min={1} onChange={(rounds) => onChange({ ...block, rounds })} />
      <MovementsEditor values={block.movements} onChange={(movements) => onChange({ ...block, movements })} />
    </div>
  )
}

// ─── Dispatcher ──────────────────────────────────────────

export function BlockEditor({
  block,
  onChange,
}: {
  block: RoutineBlock
  onChange: (next: RoutineBlock) => void
}) {
  switch (block.type) {
    case "warmup":   return <WarmupEditor block={block} onChange={onChange} />
    case "cooldown": return <CooldownEditor block={block} onChange={onChange} />
    case "notes":    return <NotesEditor block={block} onChange={onChange} />
    case "strength": return <StrengthEditor block={block} onChange={onChange} />
    case "skill":    return <SkillEditor block={block} onChange={onChange} />
    case "amrap":    return <AmrapEditor block={block} onChange={onChange} />
    case "emom":     return <EmomEditor block={block} onChange={onChange} />
    case "for_time": return <ForTimeEditor block={block} onChange={onChange} />
    case "for_reps": return <ForRepsEditor block={block} onChange={onChange} />
    case "rft":      return <RftEditor block={block} onChange={onChange} />
  }
}
```

- [ ] **Step 2: Verificar TypeScript**

Run: `npx tsc --noEmit --skipLibCheck`
Expected: sin errores.

- [ ] **Step 3: Commit**

```bash
git add components/section-components/horarios/modals/block-editors.tsx
git commit -m "feat(horarios): editores de bloque por tipo (admin)

Co-Authored-By: Claude Opus 4.7 <noreply@anthropic.com>"
```

---

### Task 7: BlockPicker (dropdown "+ Agregar bloque")

**Files:**
- Create: `components/section-components/horarios/modals/BlockPicker.tsx`

- [ ] **Step 1: Crear el componente**

Crear `components/section-components/horarios/modals/BlockPicker.tsx`:

```tsx
"use client"

import { Plus } from "lucide-react"
import { Button } from "@/components/ui/button"
import {
  DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu"
import { BLOCK_META, BLOCK_TYPE_ORDER, type BlockType } from "@/lib/constants/routine-blocks"

interface BlockPickerProps {
  onPick: (type: BlockType) => void
  disabled?: boolean
}

export function BlockPicker({ onPick, disabled }: BlockPickerProps) {
  return (
    <DropdownMenu>
      <DropdownMenuTrigger asChild>
        <Button type="button" variant="outline" size="sm" disabled={disabled} className="gap-2 w-full sm:w-auto">
          <Plus className="h-4 w-4" /> Agregar bloque
        </Button>
      </DropdownMenuTrigger>
      <DropdownMenuContent align="start" className="w-56">
        {BLOCK_TYPE_ORDER.map((t) => {
          const meta = BLOCK_META[t]
          const Icon = meta.icon
          return (
            <DropdownMenuItem key={t} onClick={() => onPick(t)} className="gap-2">
              <Icon className="h-4 w-4 text-primary" />
              <span>{meta.label}</span>
            </DropdownMenuItem>
          )
        })}
      </DropdownMenuContent>
    </DropdownMenu>
  )
}
```

> **Nota:** El proyecto debe tener `components/ui/dropdown-menu.tsx` (shadcn). Si no existe, instalar con `npx shadcn@latest add dropdown-menu` (verificar con `Glob components/ui/dropdown-menu*`).

- [ ] **Step 2: Verificar TypeScript**

Run: `npx tsc --noEmit --skipLibCheck`
Expected: sin errores.

- [ ] **Step 3: Commit**

```bash
git add components/section-components/horarios/modals/BlockPicker.tsx
git commit -m "feat(horarios): BlockPicker dropdown para agregar bloques

Co-Authored-By: Claude Opus 4.7 <noreply@anthropic.com>"
```

---

### Task 8: RoutineBlockEditor (lista + reorder + add/remove)

**Files:**
- Create: `components/section-components/horarios/modals/RoutineBlockEditor.tsx`

- [ ] **Step 1: Crear el componente**

Crear `components/section-components/horarios/modals/RoutineBlockEditor.tsx`:

```tsx
"use client"

import { ChevronUp, ChevronDown, Trash2, GripVertical } from "lucide-react"
import { Button } from "@/components/ui/button"
import { cn } from "@/lib/utils"
import {
  type RoutineBlock,
  type BlockType,
  BLOCK_META,
  createBlock,
} from "@/lib/constants/routine-blocks"
import { BlockEditor } from "./block-editors"
import { BlockPicker } from "./BlockPicker"

interface RoutineBlockEditorProps {
  blocks: RoutineBlock[]
  onChange: (next: RoutineBlock[]) => void
  disabled?: boolean
}

function reorder(blocks: RoutineBlock[]): RoutineBlock[] {
  return blocks.map((b, i) => ({ ...b, order: i }))
}

export function RoutineBlockEditor({ blocks, onChange, disabled }: RoutineBlockEditorProps) {
  const sorted = [...blocks].sort((a, b) => a.order - b.order)

  const handleAdd = (type: BlockType) => {
    const next = [...sorted, createBlock(type, sorted.length)]
    onChange(reorder(next))
  }

  const handleRemove = (id: string) => {
    onChange(reorder(sorted.filter((b) => b.id !== id)))
  }

  const handleMove = (id: string, direction: "up" | "down") => {
    const idx = sorted.findIndex((b) => b.id === id)
    if (idx === -1) return
    const targetIdx = direction === "up" ? idx - 1 : idx + 1
    if (targetIdx < 0 || targetIdx >= sorted.length) return
    const next = [...sorted]
    ;[next[idx], next[targetIdx]] = [next[targetIdx], next[idx]]
    onChange(reorder(next))
  }

  const handleBlockChange = (id: string, updated: RoutineBlock) => {
    onChange(reorder(sorted.map((b) => (b.id === id ? updated : b))))
  }

  return (
    <div className="space-y-3">
      {sorted.length === 0 ? (
        <div className="border border-dashed rounded-lg p-6 text-center space-y-2">
          <p className="text-sm text-muted-foreground">Esta rutina aún no tiene bloques.</p>
          <p className="text-xs text-muted-foreground">Agrega el primero para empezar.</p>
        </div>
      ) : (
        sorted.map((b, i) => {
          const meta = BLOCK_META[b.type]
          const Icon = meta.icon
          const isFirst = i === 0
          const isLast = i === sorted.length - 1
          return (
            <div key={b.id} className="border rounded-lg bg-card overflow-hidden">
              <div className="flex items-center gap-2 px-3 py-2 bg-muted/30 border-b">
                <GripVertical className="h-4 w-4 text-muted-foreground/50 shrink-0" aria-hidden="true" />
                <Icon className="h-4 w-4 text-primary shrink-0" />
                <span className="text-sm font-semibold flex-1 truncate">{meta.label}</span>
                <span className="text-[10px] text-muted-foreground tabular-nums">
                  {i + 1} de {sorted.length}
                </span>
                <Button
                  type="button"
                  variant="ghost"
                  size="icon"
                  className="h-7 w-7"
                  onClick={() => handleMove(b.id, "up")}
                  disabled={isFirst || disabled}
                  aria-label="Subir bloque"
                >
                  <ChevronUp className="h-4 w-4" />
                </Button>
                <Button
                  type="button"
                  variant="ghost"
                  size="icon"
                  className="h-7 w-7"
                  onClick={() => handleMove(b.id, "down")}
                  disabled={isLast || disabled}
                  aria-label="Bajar bloque"
                >
                  <ChevronDown className="h-4 w-4" />
                </Button>
                <Button
                  type="button"
                  variant="ghost"
                  size="icon"
                  className={cn("h-7 w-7 text-muted-foreground hover:text-destructive")}
                  onClick={() => handleRemove(b.id)}
                  disabled={disabled}
                  aria-label="Eliminar bloque"
                >
                  <Trash2 className="h-4 w-4" />
                </Button>
              </div>
              <div className="p-3">
                <BlockEditor block={b} onChange={(updated) => handleBlockChange(b.id, updated)} />
              </div>
            </div>
          )
        })
      )}

      <BlockPicker onPick={handleAdd} disabled={disabled} />
    </div>
  )
}
```

- [ ] **Step 2: Verificar TypeScript**

Run: `npx tsc --noEmit --skipLibCheck`
Expected: sin errores.

- [ ] **Step 3: Commit**

```bash
git add components/section-components/horarios/modals/RoutineBlockEditor.tsx
git commit -m "feat(horarios): RoutineBlockEditor con reorder y add/remove

Co-Authored-By: Claude Opus 4.7 <noreply@anthropic.com>"
```

---

### Task 9: Reescribir routine-form-modal con el nuevo editor

**Files:**
- Modify: `components/section-components/horarios/modals/routine-form-modal.tsx`
- Modify: `lib/actions/routines.ts`

- [ ] **Step 1: Extender server actions para aceptar `blocks`**

`createRoutine` y `updateRoutine` ya aceptan `TablesInsert<"routines">` y `TablesUpdate<"routines">` que automáticamente incluyen `blocks` después de regenerar types. No hay cambio de signature requerido.

Solo verificar que `lib/actions/routines.ts` siga compilando. Run: `npx tsc --noEmit --skipLibCheck`. Si hay errores relacionados, reportar (no debería).

- [ ] **Step 2: Reescribir routine-form-modal.tsx**

Reemplazar TODO el contenido de `components/section-components/horarios/modals/routine-form-modal.tsx` por:

```tsx
"use client"

import { useEffect, useState } from "react"
import { useMutation, useQueryClient } from "@tanstack/react-query"
import {
  Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle,
} from "@/components/ui/dialog"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs"
import { Loader2, Save } from "lucide-react"
import { showToast } from "@/lib/sweetalert"
import { createRoutine, updateRoutine } from "@/lib/actions/routines"
import {
  type RoutineBlock,
  parseBlocks,
} from "@/lib/constants/routine-blocks"
import { RoutineBlockEditor } from "./RoutineBlockEditor"
import { RoutineBlocks } from "@/components/shared/routine-blocks/RoutineBlocks"

interface RoutineFormModalProps {
  open: boolean
  onOpenChange: (open: boolean) => void
  routine?: { id: string; name: string; blocks: unknown } | null
}

export function RoutineFormModal({ open, onOpenChange, routine }: RoutineFormModalProps) {
  const queryClient = useQueryClient()
  const isEdit = !!routine

  const [name, setName] = useState("")
  const [blocks, setBlocks] = useState<RoutineBlock[]>([])

  useEffect(() => {
    if (open) {
      setName(routine?.name ?? "")
      setBlocks(parseBlocks(routine?.blocks))
    }
  }, [open, routine])

  const mutation = useMutation({
    mutationFn: async () => {
      if (!name.trim()) throw new Error("La rutina necesita un nombre")
      if (isEdit && routine) {
        return updateRoutine(routine.id, { name: name.trim(), blocks: blocks as never })
      }
      return createRoutine({ name: name.trim(), blocks: blocks as never })
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["routines"] })
      queryClient.invalidateQueries({ queryKey: ["routine-assignments"] })
      showToast.success(isEdit ? "Rutina actualizada" : "Rutina creada", "Los cambios se guardaron correctamente.")
      onOpenChange(false)
    },
    onError: (e: Error) => {
      showToast.error("Error", e.message ?? "No se pudo guardar la rutina.")
    },
  })

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-2xl max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle>{isEdit ? "Editar rutina" : "Nueva rutina"}</DialogTitle>
          <DialogDescription>
            Define los bloques que componen la rutina (warm-up, strength, WOD, cool-down).
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-4">
          <div className="grid gap-2">
            <Label htmlFor="name">Nombre</Label>
            <Input
              id="name"
              placeholder="Ej: Metabólico Lunes A"
              value={name}
              onChange={(e) => setName(e.target.value)}
            />
          </div>

          <Tabs defaultValue="edit" className="w-full">
            <TabsList>
              <TabsTrigger value="edit">Editar bloques</TabsTrigger>
              <TabsTrigger value="preview">Vista previa</TabsTrigger>
            </TabsList>
            <TabsContent value="edit" className="mt-3">
              <RoutineBlockEditor
                blocks={blocks}
                onChange={setBlocks}
                disabled={mutation.isPending}
              />
            </TabsContent>
            <TabsContent value="preview" className="mt-3">
              <div className="border rounded-md p-4 min-h-[200px] bg-muted/30">
                <RoutineBlocks blocks={blocks} emptyMessage="Sin bloques aún. Agrega el primero." />
              </div>
            </TabsContent>
          </Tabs>
        </div>

        <DialogFooter>
          <Button type="button" variant="ghost" onClick={() => onOpenChange(false)}>
            Cancelar
          </Button>
          <Button
            type="button"
            onClick={() => mutation.mutate()}
            disabled={mutation.isPending}
            className="gap-2"
          >
            {mutation.isPending ? (
              <><Loader2 className="h-4 w-4 animate-spin" /> Guardando...</>
            ) : (
              <><Save className="h-4 w-4" /> {isEdit ? "Guardar cambios" : "Crear rutina"}</>
            )}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  )
}
```

> **Nota sobre `as never`:** `blocks` es `Json` en el tipo generado de Supabase. Casteamos `as never` (en vez de `as Json`) para evitar circular dependencies con `@/types/database`. Es seguro porque `parseBlocks` valida la forma al leer.

- [ ] **Step 3: Verificar TypeScript**

Run: `npx tsc --noEmit --skipLibCheck`
Expected: sin errores.

- [ ] **Step 4: Verificar callers de RoutineFormModal**

Buscar todos los usos del modal: `Grep "RoutineFormModal" --type tsx`. El modal anterior recibía `routine?: { id, name, content }`. El nuevo recibe `routine?: { id, name, blocks }`. Actualizar callers que lean `routine.content` para que pasen `routine.blocks`.

Si el caller es `routine-library-modal.tsx` o similar y usa `routines` que vienen del hook `useQuery(["routines"])`, el `routine` que se pasa al modal vendrá del shape de DB que ya incluye ambas columnas. Solo cambiar el destructuring/spread del objeto.

- [ ] **Step 5: Commit**

```bash
git add components/section-components/horarios/modals/routine-form-modal.tsx
# Si tuviste que tocar callers, agregarlos también:
git add components/section-components/horarios/modals/routine-library-modal.tsx
git commit -m "feat(horarios): editor de rutina con bloques tipados (multi-bloque)

Co-Authored-By: Claude Opus 4.7 <noreply@anthropic.com>"
```

---

### Task 10: Actualizar routine-preview-modal con `<RoutineBlocks>`

**Files:**
- Modify: `components/section-components/horarios/modals/routine-preview-modal.tsx`

- [ ] **Step 1: Reemplazar contenido**

Reemplazar TODO `components/section-components/horarios/modals/routine-preview-modal.tsx` por:

```tsx
"use client"

import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle } from "@/components/ui/dialog"
import { RoutineBlocks } from "@/components/shared/routine-blocks/RoutineBlocks"

interface RoutinePreviewModalProps {
  open: boolean
  onOpenChange: (open: boolean) => void
  routine: { name: string; blocks: unknown } | null
  context?: string
}

export function RoutinePreviewModal({ open, onOpenChange, routine, context }: RoutinePreviewModalProps) {
  if (!routine) return null

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-2xl max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle>{routine.name}</DialogTitle>
          {context && <DialogDescription>{context}</DialogDescription>}
        </DialogHeader>

        <div className="border rounded-md p-4 bg-muted/30">
          <RoutineBlocks blocks={routine.blocks} emptyMessage="Esta rutina aún no tiene contenido." />
        </div>
      </DialogContent>
    </Dialog>
  )
}
```

- [ ] **Step 2: Verificar callers de RoutinePreviewModal**

Buscar usos: `Grep "RoutinePreviewModal" --type tsx`. Asegurar que pasen `routine.blocks` en vez de `routine.content`. Si algún caller pasa el objeto entero (`{ name, content, ... }`), funcionará igual porque ignoramos los campos extra y solo leemos `name` y `blocks`.

- [ ] **Step 3: Verificar TypeScript**

Run: `npx tsc --noEmit --skipLibCheck`
Expected: sin errores.

- [ ] **Step 4: Commit**

```bash
git add components/section-components/horarios/modals/routine-preview-modal.tsx
git commit -m "feat(horarios): preview de rutina usa RoutineBlocks

Co-Authored-By: Claude Opus 4.7 <noreply@anthropic.com>"
```

---

### Task 11: Render de bloques en portal del miembro

**Files:**
- Modify: `components/section-components/portal/home/TodayRoutineCard.tsx`
- Modify: `components/section-components/portal/wod/TodayWodHeader.tsx`
- Modify: `components/section-components/portal/descubrir/MemberDetailModal.tsx`
- Modify: `lib/actions/routines.ts` — `getTodayRoutineForMember` debe retornar `blocks`

- [ ] **Step 1: Verificar que `getTodayRoutineForMember` retorna `blocks`**

Leer `lib/actions/routines.ts` función `getTodayRoutineForMember` (alrededor de línea 234). Cambiar el `.select` para incluir `blocks`:

Buscar:
```ts
    .select("day_of_week, routines (id, name, content)")
```

Reemplazar por:
```ts
    .select("day_of_week, routines (id, name, content, blocks)")
```

Y en el return statement, agregar `blocks` al objeto retornado:

```ts
  return {
    day_of_week: today,
    plan_name: (member as any).plans?.name ?? null,
    routine: routine as { id: string; name: string; content: string; blocks: unknown },
  }
```

(Tipar `blocks` como `unknown` está bien — los componentes consumidores usan `parseBlocks()` para validar.)

- [ ] **Step 2: Modificar TodayRoutineCard.tsx**

Reemplazar la sección que renderiza el contenido. Buscar:

```tsx
          {data.routine ? (
            <div className="prose prose-invert prose-sm max-w-none">
              <ReactMarkdown>{data.routine.content || "_Sin contenido._"}</ReactMarkdown>
            </div>
          ) : (
            <p className="text-sm text-muted-foreground">
              Tu coach aún no asignó la rutina de hoy.
            </p>
          )}
```

Reemplazar por:

```tsx
          {data.routine ? (
            <RoutineBlocks
              blocks={(data.routine as { blocks: unknown }).blocks}
              emptyMessage="Tu coach aún no completó esta rutina."
            />
          ) : (
            <p className="text-sm text-muted-foreground">
              Tu coach aún no asignó la rutina de hoy.
            </p>
          )}
```

Y en los imports al tope del archivo, eliminar:
```tsx
import ReactMarkdown from "react-markdown"
```

Y agregar:
```tsx
import { RoutineBlocks } from "@/components/shared/routine-blocks/RoutineBlocks"
```

- [ ] **Step 3: Modificar TodayWodHeader.tsx**

Igual cambio. En `components/section-components/portal/wod/TodayWodHeader.tsx`, buscar:

```tsx
          {routineToday.routine ? (
            <div className="prose prose-invert prose-sm max-w-none">
              <ReactMarkdown>{routineToday.routine.content || "_Sin contenido._"}</ReactMarkdown>
            </div>
          ) : (
```

Reemplazar por:

```tsx
          {routineToday.routine ? (
            <RoutineBlocks
              blocks={(routineToday.routine as { blocks: unknown }).blocks}
              emptyMessage="Tu coach aún no completó esta rutina."
            />
          ) : (
```

Eliminar import de `ReactMarkdown` y agregar:
```tsx
import { RoutineBlocks } from "@/components/shared/routine-blocks/RoutineBlocks"
```

- [ ] **Step 4: Verificar MemberDetailModal**

`MemberDetailModal.tsx` ya muestra los WODs recientes en una sección con score formateado, no rinde `content` Markdown. No necesita cambios. Verificar leyendo el archivo: `Read components/section-components/portal/descubrir/MemberDetailModal.tsx`. Si encuentras algún uso de `content` o `ReactMarkdown` para rutinas, reemplazar por `RoutineBlocks`.

- [ ] **Step 5: Verificar TypeScript**

Run: `npx tsc --noEmit --skipLibCheck`
Expected: sin errores.

- [ ] **Step 6: Commit**

```bash
git add lib/actions/routines.ts components/section-components/portal/home/TodayRoutineCard.tsx components/section-components/portal/wod/TodayWodHeader.tsx components/section-components/portal/descubrir/MemberDetailModal.tsx
git commit -m "feat(horarios): portal miembro renderiza rutinas como bloques

Co-Authored-By: Claude Opus 4.7 <noreply@anthropic.com>"
```

---

### Task 12: WOD logging usa el bloque principal

**Files:**
- Modify: `lib/actions/wod-logs.ts`
- Modify: `components/section-components/portal/wod/log-wod-modal.tsx`

- [ ] **Step 1: Modificar `getMyPlanRoutines` y `getTodayLeaderboard` para retornar `blocks`**

Leer `lib/actions/wod-logs.ts`. Buscar la query de `routine_assignments` en `getMyPlanRoutines` (alrededor de línea 467):

```ts
    .select("day_of_week, routines(id, name, content)")
```

Reemplazar por:
```ts
    .select("day_of_week, routines(id, name, content, blocks)")
```

Y en el `PlanRoutineForDay` interface (alrededor de línea 63), cambiar:
```ts
export interface PlanRoutineForDay {
  day_of_week: string
  routine: { id: string; name: string; content: string } | null
}
```

Por:
```ts
export interface PlanRoutineForDay {
  day_of_week: string
  routine: { id: string; name: string; content: string; blocks: unknown } | null
}
```

Y en el `.map` del retorno (línea 474), no necesita cambios — pasa el `routine` completo.

- [ ] **Step 2: En `getTodayLeaderboard`, agregar `blocks` a la query de routine**

Buscar la query del assignment para hoy (alrededor de línea 752):
```ts
    .select("routine_id, routines(id, name, content)")
```

Reemplazar por:
```ts
    .select("routine_id, routines(id, name, content, blocks)")
```

Y en `WodLeaderboardResult` interface, cambiar:
```ts
export interface WodLeaderboardResult {
  routine: { id: string; name: string; content: string } | null
  entries: WodLeaderboardEntry[]
}
```

Por:
```ts
export interface WodLeaderboardResult {
  routine: { id: string; name: string; content: string; blocks: unknown } | null
  entries: WodLeaderboardEntry[]
}
```

- [ ] **Step 3: Modificar `LogWodModal` para usar bloque principal**

Reemplazar TODO el contenido de `components/section-components/portal/wod/log-wod-modal.tsx`. El cambio principal: ya no hay selector de score type — se deriva del primer bloque conditioning.

```tsx
"use client"

import { useEffect, useMemo, useState } from "react"
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query"
import { toast } from "sonner"
import { Loader2, Save, Trash2 } from "lucide-react"
import {
  Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle,
} from "@/components/ui/dialog"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { Switch } from "@/components/ui/switch"
import { Textarea } from "@/components/ui/textarea"
import {
  upsertWodLog, deleteWodLog, getMyPlanRoutines,
  type WodLog,
} from "@/lib/actions/wod-logs"
import {
  type ScoreType,
  todayCaracasISO, getDayOfWeekLabel,
} from "@/lib/constants/wod-score"
import {
  parseBlocks,
  getPrimaryConditioningBlock,
  getScoreTypeForBlock,
  BLOCK_META,
  type RoutineBlock,
} from "@/lib/constants/routine-blocks"
import { WodScoreInputs, type WodScoreInputValues } from "./WodScoreInputs"

interface LogWodModalProps {
  open: boolean
  onOpenChange: (open: boolean) => void
  existingLog?: WodLog | null
  defaultDate?: string
  defaultRoutineId?: string
}

const EMPTY_VALUES: WodScoreInputValues = {
  score_type: "for_time",
  minutes: 0, seconds: 0,
  rounds: 0, reps_extra: 0,
  reps: 0, kg: 0,
}

function blockHeadline(block: RoutineBlock): string {
  switch (block.type) {
    case "amrap":    return `${BLOCK_META.amrap.label} ${block.minutes} min`
    case "for_time": return BLOCK_META.for_time.label + (block.time_cap_min ? ` · cap ${block.time_cap_min} min` : "")
    case "rft":      return `${BLOCK_META.rft.label} · ${block.rounds} rounds`
    case "for_reps": return `${BLOCK_META.for_reps.label} · ${block.target_reps} reps`
    case "strength": return `${BLOCK_META.strength.label}: ${block.exercise || "(sin ejercicio)"}`
    default:         return BLOCK_META[block.type].label
  }
}

export function LogWodModal({ open, onOpenChange, existingLog, defaultDate, defaultRoutineId }: LogWodModalProps) {
  const queryClient = useQueryClient()
  const today = todayCaracasISO()

  const [date, setDate] = useState<string>(defaultDate ?? today)
  const [values, setValues] = useState<WodScoreInputValues>(EMPTY_VALUES)
  const [rx, setRx] = useState<boolean>(false)
  const [notes, setNotes] = useState<string>("")
  const [errors, setErrors] = useState<Partial<Record<keyof WodScoreInputValues, string>>>({})

  const { data: planRoutines = [] } = useQuery({
    queryKey: ["my-plan-routines"],
    queryFn: getMyPlanRoutines,
    staleTime: 5 * 60 * 1000,
  })

  const dayLabel = getDayOfWeekLabel(date)
  const routineForDay = useMemo(
    () => planRoutines.find((p) => p.day_of_week === dayLabel)?.routine ?? null,
    [planRoutines, dayLabel],
  )

  const primaryBlock = useMemo<RoutineBlock | null>(() => {
    if (!routineForDay) return null
    return getPrimaryConditioningBlock(parseBlocks(routineForDay.blocks))
  }, [routineForDay])

  const scoreType: ScoreType | null = getScoreTypeForBlock(primaryBlock)

  // Reset al abrir
  useEffect(() => {
    if (!open) return
    if (existingLog) {
      setDate(existingLog.date)
      setRx(existingLog.rx)
      setNotes(existingLog.notes ?? "")
      const t = existingLog.score_type
      setValues({
        score_type: t,
        minutes: t === "for_time" ? Math.floor((existingLog.score_seconds ?? 0) / 60) : 0,
        seconds: t === "for_time" ? (existingLog.score_seconds ?? 0) % 60 : 0,
        rounds: t === "amrap" ? (existingLog.score_rounds ?? 0) : 0,
        reps_extra: t === "amrap" ? (existingLog.score_reps ?? 0) : 0,
        reps: t === "for_reps" ? (existingLog.score_reps ?? 0) : 0,
        kg: t === "weight" ? Number(existingLog.score_kg ?? 0) : 0,
      })
    } else {
      setDate(defaultDate ?? today)
      setRx(false)
      setNotes("")
      setValues(EMPTY_VALUES)
    }
    setErrors({})
  }, [open, existingLog, defaultDate, today])

  // Cuando cambia el scoreType derivado, actualiza el state local
  useEffect(() => {
    if (!open || existingLog) return
    if (scoreType) {
      setValues((prev) => ({ ...prev, score_type: scoreType }))
    }
  }, [open, existingLog, scoreType])

  const targetRoutineId = existingLog?.routine_id ?? defaultRoutineId ?? routineForDay?.id ?? null
  const effectiveScoreType: ScoreType = existingLog?.score_type ?? scoreType ?? values.score_type

  const upsertMutation = useMutation({
    mutationFn: async () => {
      if (!targetRoutineId) throw new Error("No hay rutina asignada para esa fecha")
      if (!effectiveScoreType) throw new Error("Esta rutina no tiene un bloque registrable")

      const errs: Partial<Record<keyof WodScoreInputValues, string>> = {}
      let payload: Parameters<typeof upsertWodLog>[0]
      switch (effectiveScoreType) {
        case "for_time": {
          const total = values.minutes * 60 + values.seconds
          if (total <= 0) errs.seconds = "Ingresa un tiempo válido"
          payload = {
            routine_id: targetRoutineId,
            date,
            score_type: "for_time",
            score_seconds: total,
            rx, notes: notes || null,
          }
          break
        }
        case "amrap": {
          if (values.rounds < 0) errs.rounds = "Inválido"
          if (values.reps_extra < 0) errs.reps_extra = "Inválido"
          payload = {
            routine_id: targetRoutineId,
            date,
            score_type: "amrap",
            score_rounds: values.rounds,
            score_reps: values.reps_extra,
            rx, notes: notes || null,
          }
          break
        }
        case "for_reps": {
          if (values.reps <= 0) errs.reps = "Debe ser > 0"
          payload = {
            routine_id: targetRoutineId,
            date,
            score_type: "for_reps",
            score_reps: values.reps,
            rx, notes: notes || null,
          }
          break
        }
        case "weight": {
          if (values.kg <= 0 || values.kg > 500) errs.kg = "Fuera de rango (0–500 kg)"
          payload = {
            routine_id: targetRoutineId,
            date,
            score_type: "weight",
            score_kg: values.kg,
            rx, notes: notes || null,
          }
          break
        }
      }
      if (Object.keys(errs).length > 0) {
        setErrors(errs)
        throw new Error("Corrige los errores")
      }
      setErrors({})
      return upsertWodLog(payload!)
    },
    onSuccess: () => {
      toast.success(existingLog ? "WOD actualizado" : "WOD registrado")
      queryClient.invalidateQueries({ queryKey: ["today-wod-log"] })
      queryClient.invalidateQueries({ queryKey: ["my-wod-history"] })
      queryClient.invalidateQueries({ queryKey: ["today-leaderboard"] })
      onOpenChange(false)
    },
    onError: (err) => {
      toast.error(err instanceof Error ? err.message : "Error al guardar")
    },
  })

  const deleteMutation = useMutation({
    mutationFn: async () => {
      if (!existingLog) return
      return deleteWodLog(existingLog.id)
    },
    onSuccess: () => {
      toast.success("WOD borrado")
      queryClient.invalidateQueries({ queryKey: ["today-wod-log"] })
      queryClient.invalidateQueries({ queryKey: ["my-wod-history"] })
      queryClient.invalidateQueries({ queryKey: ["today-leaderboard"] })
      onOpenChange(false)
    },
    onError: (err) => {
      toast.error(err instanceof Error ? err.message : "Error al borrar")
    },
  })

  // Sync values.score_type con effectiveScoreType para que WodScoreInputs muestre los inputs correctos
  const inputValues = { ...values, score_type: effectiveScoreType }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-md max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle>{existingLog ? "Editar WOD" : "Registrar WOD"}</DialogTitle>
          <DialogDescription>
            {primaryBlock
              ? <>Score: <span className="font-semibold">{blockHeadline(primaryBlock)}</span></>
              : <span className="text-destructive">No hay bloque registrable en esta rutina</span>}
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-4">
          <div className="space-y-1.5">
            <Label htmlFor="date" className="text-sm">Fecha</Label>
            <Input
              id="date"
              type="date"
              max={today}
              value={date}
              onChange={(e) => setDate(e.target.value)}
              className="scheme-dark"
            />
          </div>

          {effectiveScoreType ? (
            <WodScoreInputs values={inputValues} onChange={(v) => setValues(v)} errors={errors} />
          ) : (
            <p className="text-sm text-muted-foreground italic text-center py-4">
              Sin score asociado para esta rutina.
            </p>
          )}

          {effectiveScoreType && (
            <>
              <div className="flex items-center justify-between gap-3 rounded-md border border-border p-3">
                <div>
                  <Label htmlFor="rx" className="text-sm font-medium">Como Rx</Label>
                  <p className="text-xs text-muted-foreground">¿Hiciste el WOD como prescrito?</p>
                </div>
                <Switch id="rx" checked={rx} onCheckedChange={setRx} />
              </div>

              <div className="space-y-1.5">
                <Label htmlFor="notes" className="text-sm">Notas (opcional)</Label>
                <Textarea
                  id="notes"
                  placeholder="Ej: usé KB 16kg, partner Juan"
                  value={notes}
                  onChange={(e) => setNotes(e.target.value.slice(0, 500))}
                  rows={3}
                />
                <p className="text-[11px] text-muted-foreground">{notes.length} / 500</p>
              </div>
            </>
          )}
        </div>

        <DialogFooter className="gap-2 flex-col sm:flex-row mt-2">
          {existingLog && (
            <Button
              type="button"
              variant="outline"
              size="sm"
              onClick={() => deleteMutation.mutate()}
              disabled={deleteMutation.isPending || upsertMutation.isPending}
              className="gap-2 text-destructive hover:text-destructive sm:mr-auto"
            >
              {deleteMutation.isPending
                ? <Loader2 className="h-4 w-4 animate-spin" />
                : <Trash2 className="h-4 w-4" />
              }
              Borrar
            </Button>
          )}
          <Button
            type="button"
            onClick={() => upsertMutation.mutate()}
            disabled={upsertMutation.isPending || deleteMutation.isPending || !targetRoutineId || !effectiveScoreType}
            className="gap-2"
          >
            {upsertMutation.isPending
              ? <Loader2 className="h-4 w-4 animate-spin" />
              : <Save className="h-4 w-4" />
            }
            Guardar
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  )
}
```

> **Notas para el ejecutor:**
> - El selector de score type (los 4 botones for_time/amrap/for_reps/weight) **se eliminó** del modal.
> - El `effectiveScoreType` viene del bloque principal de la rutina (si existe). Si no hay bloque conditioning, el botón "Guardar" queda disabled y se muestra un mensaje.
> - Los inputs de score se muestran según el tipo derivado.
> - En modo edición (`existingLog`) usamos el `score_type` que ya quedó guardado, no el del bloque actual (por si la rutina cambió después).

- [ ] **Step 4: Modificar TodayRoutineCard y TodayWodHeader para ocultar botón si no hay bloque registrable**

Estos componentes ya rinden el botón "Registrar mi WOD" si `data.routine` existe. Después de los cambios anteriores, verificar:

En `components/section-components/portal/home/TodayRoutineCard.tsx`, después del bloque `{data.routine && (...)}` que tiene el botón, agregar lógica:

Buscar la condición que envuelve el botón:
```tsx
          {data.routine && (
            <div className="border-t pt-4">
```

Reemplazar por:
```tsx
          {data.routine && getPrimaryConditioningBlock(parseBlocks((data.routine as { blocks: unknown }).blocks)) !== null && (
            <div className="border-t pt-4">
```

Y agregar al tope de imports:
```tsx
import { getPrimaryConditioningBlock, parseBlocks } from "@/lib/constants/routine-blocks"
```

Repetir el mismo cambio en `components/section-components/portal/wod/TodayWodHeader.tsx`. Buscar:
```tsx
          {routineToday.routine && (
            <div className="border-t pt-4">
```

Reemplazar por:
```tsx
          {routineToday.routine && getPrimaryConditioningBlock(parseBlocks((routineToday.routine as { blocks: unknown }).blocks)) !== null && (
            <div className="border-t pt-4">
```

Y agregar al tope:
```tsx
import { getPrimaryConditioningBlock, parseBlocks } from "@/lib/constants/routine-blocks"
```

- [ ] **Step 5: Verificar TypeScript**

Run: `npx tsc --noEmit --skipLibCheck`
Expected: sin errores.

- [ ] **Step 6: Commit**

```bash
git add lib/actions/wod-logs.ts components/section-components/portal/wod/log-wod-modal.tsx components/section-components/portal/home/TodayRoutineCard.tsx components/section-components/portal/wod/TodayWodHeader.tsx
git commit -m "feat(horarios): WOD logging usa bloque principal de la rutina

Co-Authored-By: Claude Opus 4.7 <noreply@anthropic.com>"
```

---

### Task 13: QA manual end-to-end

**Files:** ninguno; solo testing.

- [ ] **Step 1: Build limpio**

Run: `npm run build`
Expected: build exitoso sin errores nuevos.

- [ ] **Step 2: Issue 1 — Cerrado oculta planes**

`npm run dev`. Loguearse como admin con permisos. Ir a `/dashboard/horarios`:
- [ ] En un día con horario definido (no cerrado): se ven los planes y sus rutinas como antes.
- [ ] Marcar "Cerrado" en un día → la sección de planes desaparece. Aparece "Sin actividad este día" centrado.
- [ ] Desmarcar "Cerrado" → vuelve la sección de planes (con horario vacío hasta que el admin lo defina).
- [ ] Día sin horario definido (`open_time = null`): se ven los planes (no se considera "cerrado").

- [ ] **Step 3: Issue 2 — AM/PM implícito**

- [ ] En un día abierto, sección "Mañana": NO hay botón AM/PM. Solo el label estático "AM" a la derecha de los inputs.
- [ ] Sección "Tarde": label estático "PM".
- [ ] Mañana: tipear `6` abre, `12` cierra → DB guarda `06:00:00` y `12:00:00`. Recargar página: read-only muestra "6:00 AM → 12:00 PM".
- [ ] Tarde: tipear `12` abre, `6` cierra → DB guarda `12:00:00` y `18:00:00`. Read-only: "12:00 PM → 6:00 PM".
- [ ] Tarde: tipear `5` abre, `9` cierra → DB guarda `17:00:00` y `21:00:00`.

- [ ] **Step 4: Issue 3 — Editor de rutinas (admin)**

Ir a `/dashboard/horarios` → "Biblioteca de rutinas" → "Nueva rutina":
- [ ] Modal abre. Campo Nombre. Tabs "Editar bloques" y "Vista previa". Empty state visible.
- [ ] Click "+ Agregar bloque" → dropdown muestra los 10 tipos (Warm-up, Strength, Skill, AMRAP, EMOM, For Time, RFT, For Reps, Cool-down, Notas).
- [ ] Agregar Warm-up → aparece bloque con textarea. Escribir "Movilidad 5 min". Botones ↑ (disabled), ↓ (disabled), 🗑 (habilitado).
- [ ] Agregar Strength → campos: Ejercicio, Sets, Reps, Peso, Notas. Llenar "Back Squat", 5, 5, 80 kg.
- [ ] Agregar AMRAP → campos: Minutos (default 10), Movimientos (1 input). Cambiar a 12. "+ Agregar movimiento" 2 veces. Llenar "10 burpees", "15 KB swings @ 24/16kg", "20 box jumps".
- [ ] Probar reorder: el bloque AMRAP aparece tercero. Click ↑ → sube a segundo. Click ↑ → sube a primero. ↓ ↓ → vuelve a tercero.
- [ ] Click 🗑 en uno de los movimientos del AMRAP → desaparece la línea.
- [ ] Tab "Vista previa" → 3 cards renderizadas en orden: Warm-up "Movilidad 5 min", Strength "Back Squat 5 × 5 @ 80 kg", AMRAP 12 con bullets.
- [ ] Volver a "Editar". Click "Guardar" → toast verde "Rutina creada". Modal cierra.
- [ ] La rutina aparece en la biblioteca. Click → preview modal usa `<RoutineBlocks>` y se ve idéntica al preview del editor.

- [ ] **Step 5: Issue 3 — Editar rutina existente con bloques**

- [ ] Click en la rutina creada → "Editar" → modal vuelve a abrir con los 3 bloques exactos. No hay pérdida de info.
- [ ] Cambiar nombre, modificar minutos del AMRAP a 15 → guardar → reload → cambios persisten.

- [ ] **Step 6: Issue 3 — Rutinas legacy (migración M1)**

Si había rutinas pre-existentes:
- [ ] Abrir una rutina vieja → debe tener UN solo bloque tipo "Notas" con el contenido Markdown viejo en texto plano (sin `**`, `#`, etc. interpretados — solo texto crudo).
- [ ] La preview muestra ese bloque como "Notas" con el texto.
- [ ] Editar: agregar nuevos bloques estructurados → guardar → la rutina tiene ahora 1 (legacy) + N (nuevos).

- [ ] **Step 7: Issue 3 — Render en el portal del miembro**

Loguear como miembro con plan que tenga la rutina creada en Step 4 asignada a algún día:
- [ ] `/portal` → `TodayRoutineCard` muestra los 3 bloques (Warm-up, Strength, AMRAP) como cards con icono y título. NO muestra Markdown crudo.
- [ ] `/portal/wod` → `TodayWodHeader` muestra los mismos 3 bloques.
- [ ] El botón "Registrar mi WOD" aparece (porque hay un bloque AMRAP, que es conditioning).

- [ ] **Step 8: Issue 3 — WOD logging con bloque principal**

- [ ] Click "Registrar mi WOD" → modal abre con `score_type` derivado del bloque principal. NO hay selector de tipo de score (los 4 botones for_time/amrap/etc. NO existen).
- [ ] Header del modal: "Score: AMRAP 12 min" (header derivado del bloque).
- [ ] Inputs: Rounds + Reps extra (porque AMRAP).
- [ ] Llenar 12 rounds, 5 reps, RX ON → guardar → toast "WOD registrado".
- [ ] El header muestra el score "12 + 5" RX y botón "Editar".
- [ ] Click "Editar" → modal abre, el `score_type` viene del log existente (no se re-deriva), valores pre-poblados.

- [ ] **Step 9: Issue 3 — Rutina sin bloque conditioning**

Crear una rutina que solo tenga Warm-up + Cool-down + Notas:
- [ ] Asignarla a un plan/día.
- [ ] Como miembro, ir a `/portal/wod` ese día.
- [ ] La rutina se renderiza, PERO el botón "Registrar mi WOD" NO aparece (no hay bloque registrable).
- [ ] El leaderboard tampoco muestra entradas (esa rutina no es scoreable).

- [ ] **Step 10: Issue 3 — Múltiples conditioning blocks**

Crear rutina con: Strength + AMRAP + For Time (3 conditioning):
- [ ] El primero por orden (Strength) es el que se loguea. Modal pide kg.
- [ ] Reordenar: AMRAP primero → ahora el modal pide rounds/reps_extra.
- [ ] Verificar leaderboard solo muestra scores del bloque principal actual.

- [ ] **Step 11: Final commit (si hubo fixes)**

Si encontraste bugs:
```bash
git add -p
git commit -m "fix(horarios): correcciones del QA manual

Co-Authored-By: Claude Opus 4.7 <noreply@anthropic.com>"
```

---

## Resumen de tasks

| # | Task | Files | Output |
|---|---|---|---|
| 1 | Cerrado oculta planes | 3 | DayColumn condiciona render |
| 2 | AM/PM implícito | 1 | Time12h sin toggle, period prop |
| 3 | Migración blocks jsonb | 2 | Schema + types |
| 4 | Constants + helpers | 1 | Types y BLOCK_META |
| 5 | RoutineBlocks (render) | 1 | Componente shared |
| 6 | Block editors | 1 | 10 editores en un archivo |
| 7 | BlockPicker | 1 | Dropdown |
| 8 | RoutineBlockEditor | 1 | Lista + reorder |
| 9 | routine-form-modal | 2 | Modal con nuevo editor |
| 10 | routine-preview-modal | 1 | Preview con RoutineBlocks |
| 11 | Render portal miembro | 4 | TodayCard + Header + actions |
| 12 | WOD logging bloque principal | 4 | Modal sin selector + queries con blocks |
| 13 | QA manual | 0 | Verificación end-to-end |
