# Tasa automática para pagos en Bs — Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Eliminar el campo manual de tasa Bs/USD en el modal de pago y reemplazarlo por un selector automático (BCV / USDT) que usa las tasas ya cargadas en el sistema, habilitando también el autollenado del monto en Bs.

**Architecture:** El modal `payment-form-modal.tsx` añade un `useQuery` para `exchange_rates` (cache compartido con `PaymentsMainComponent`, sin nueva request real), un estado `rateType: "bcv" | "usdt"`, y sincroniza el campo `payment_rate` del formulario con la tasa activa mediante un `useEffect`. El campo de texto manual de tasa desaparece y se reemplaza por dos botones toggle. El autollenado de monto en Bs ahora funciona para todos los casos (antes estaba bloqueado por falta de tasa). No hay cambios en el esquema de BD ni en las Server Actions.

**Tech Stack:** Next.js 16, React 19, TypeScript 5, TanStack Query 5, React Hook Form 7, shadcn/ui, Supabase.

## Global Constraints

- Idioma del proyecto: **español** (mensajes de UI, commits). — verbatim de CLAUDE.md.
- Sin `any` salvo APIs externas. Sin `console.log` ni código muerto.
- Todo acceso a Supabase desde `lib/actions/*.ts`. Los Client Components consumen Server Actions vía TanStack Query.
- **Verificación:** `npx tsc --noEmit` (sin errores nuevos) + prueba manual con `npm run dev`. `npm run lint` no es confiable en este entorno.
- **No commits** sin que el usuario lo pida — excepto el commit final de esta tarea, que es parte del plan.

---

## File Structure

| Archivo | Acción | Responsabilidad |
|---|---|---|
| `components/section-components/payments/modals/payment-form-modal.tsx` | Modificar | Único archivo afectado: añadir query de tasas, estado `rateType`, selector BCV/USDT, autollenado en Bs, simplificar validación de tasa |

Sin cambios de esquema, sin nuevas migraciones, sin modificaciones en `lib/actions/`.

---

### Task 1: Tasa automática BCV/USDT en el modal de pago

**Files:**
- Modify: `components/section-components/payments/modals/payment-form-modal.tsx`

**Interfaces:**
- Consumes:
  - `getExchangeRates(): Promise<Array<{ type: string; rate: number; ... }>>` de `@/lib/actions/funds` (tipos BCV, USDT, CUSTOM).
  - `BS_PAYMENT_METHODS: readonly string[]` de `@/lib/utils` (ya importado).
  - `toUsd(amount, method, rate)` de `@/lib/utils` (ya importado).
- Produces: el formulario ya no muestra un campo de texto para la tasa; en su lugar muestra dos botones BCV/USDT cuando el método es Bs. El `payment_rate` del payload sigue siendo un número (la tasa elegida).

- [ ] **Step 1: Añadir import de `getExchangeRates` y `useState`**

En `payment-form-modal.tsx`, modificar la línea 3 y la línea 17:

```ts
import { useEffect, useRef, useState } from "react"
```

Y después de la línea de imports de actions (`getPlans`):

```ts
import { getExchangeRates } from "@/lib/actions/funds"
```

El bloque de imports completo queda:

```ts
"use client"

import { useEffect, useRef, useState } from "react"
import { useForm } from "react-hook-form"
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query"
import { showToast } from "@/lib/sweetalert"
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle, DialogFooter } from "@/components/ui/dialog"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select"
import { MemberSearchSelect } from "@/components/ui/member-search-select"
import { DateInput } from "@/components/ui/date-input"
import { Loader2 } from "lucide-react"
import { createPayment, updatePayment } from "@/lib/actions/payments"
import { getMembers } from "@/lib/actions/members"
import { getPlans } from "@/lib/actions/plans"
import { getExchangeRates } from "@/lib/actions/funds"
import { toUsd, BS_PAYMENT_METHODS } from "@/lib/utils"
```

- [ ] **Step 2: Añadir estado `rateType` y query de tasas**

Dentro de `PaymentFormModal`, justo después de `const initialized = useRef(false)` (línea 69), añadir el estado:

```ts
const [rateType, setRateType] = useState<"bcv" | "usdt">("bcv")
```

Y después de `const { data: plans = [] } = useQuery(...)` (bloque de planes, línea ~87-91), añadir el query de tasas:

```ts
const { data: exchangeRates = [] } = useQuery({
  queryKey: ["exchange-rates"],
  queryFn: getExchangeRates,
  enabled: open,
})

const bcvRate = Number(exchangeRates.find((r: any) => r.type === "BCV")?.rate ?? 0)
const usdtRate = Number(exchangeRates.find((r: any) => r.type === "USDT")?.rate ?? 0)
const activeRate = rateType === "bcv" ? bcvRate : usdtRate
```

- [ ] **Step 3: Sincronizar `payment_rate` con la tasa activa**

Después de los cálculos de `isOverpay` (línea ~104) y antes de `const isEditing`, añadir el `useEffect` que mantiene el campo `payment_rate` sincronizado cuando el método cambia a/desde Bs o cuando cambia la tasa del sistema:

```ts
useEffect(() => {
  if (BS_PAYMENT_METHODS.includes(method) && activeRate > 0) {
    setValue("payment_rate", activeRate.toFixed(2))
  } else if (!BS_PAYMENT_METHODS.includes(method)) {
    setValue("payment_rate", "")
  }
}, [method, activeRate, setValue])
```

> Este efecto garantiza que si el admin cambia el método a Bs (o de Bs a USD), `payment_rate` siempre refleja la tasa del sistema. `setValue` de React Hook Form es estable y no provoca re-renders infinitos.

- [ ] **Step 4: Añadir `handleRateTypeChange`**

Dentro de `PaymentFormModal`, después del `useEffect` anterior y antes de `const isEditing`:

```ts
const handleRateTypeChange = (newType: "bcv" | "usdt") => {
  const newRate = newType === "bcv" ? bcvRate : usdtRate
  setRateType(newType)
  setValue("payment_rate", newRate.toFixed(2))
  // Recalcular el monto en Bs si hay un saldo/precio base disponible
  if (!isEditing && remainingUsd > 0 && newRate > 0) {
    setValue("amount", (remainingUsd * newRate).toFixed(2))
  }
}
```

- [ ] **Step 5: Corregir `handleMemberChange` para autollenar monto en Bs**

Reemplazar la función completa `handleMemberChange` (actual líneas ~154-173):

```ts
const handleMemberChange = (value: string) => {
  setValue("member_id", value)
  if (!isEditing) {
    const member = members.find((m: any) => m.id === value)
    if (member?.plan_id) {
      setValue("plan_id", member.plan_id)
    }
    const memberPlan = plans.find((p: any) => p.id === member?.plan_id)
    const pendingUsd = Number(member?.balance_due ?? 0)
    const baseUsd = pendingUsd > 0 ? pendingUsd : Number(memberPlan?.price ?? 0)
    if (baseUsd > 0) {
      if (BS_PAYMENT_METHODS.includes(method) && activeRate > 0) {
        setValue("amount", (baseUsd * activeRate).toFixed(2))
      } else if (!BS_PAYMENT_METHODS.includes(method)) {
        setValue("amount", baseUsd.toFixed(2))
      }
    } else {
      setValue("amount", "")
    }
  }
}
```

- [ ] **Step 6: Corregir `handlePlanChange` para autollenar monto en Bs**

Reemplazar `handlePlanChange` (actual líneas ~175-184):

```ts
const handlePlanChange = (value: string) => {
  setValue("plan_id", value)
  if (!isEditing) {
    const plan = plans.find((p: any) => p.id === value)
    if (!plan) return
    if (BS_PAYMENT_METHODS.includes(method) && activeRate > 0) {
      setValue("amount", (Number(plan.price) * activeRate).toFixed(2))
    } else {
      setValue("amount", plan.price.toString())
    }
  }
}
```

- [ ] **Step 7: Simplificar la validación de tasa en `onSubmit`**

Reemplazar el bloque de validación de tasa en `onSubmit` (líneas ~219-223):

```ts
// Era: "Abono en Bs requiere tasa para poder convertir el saldo a USD."
// if (BS_PAYMENT_METHODS.includes(data.method) && (!rateNum || rateNum <= 0)) { ... }

// Ahora: la tasa viene automática del sistema; solo fallaría si las tasas no cargaron.
if (BS_PAYMENT_METHODS.includes(data.method) && (!rateNum || rateNum <= 0)) {
  showToast.error("Tasa no disponible", "No se pudo obtener la tasa de cambio. Intenta de nuevo en un momento.")
  return
}
```

El mensaje cambia de "Ingresa la tasa" a "No se pudo obtener la tasa" — refleja que es un problema del sistema, no del admin.

- [ ] **Step 8: Reemplazar el campo manual de tasa por el selector BCV/USDT en el JSX**

Localizar el bloque (actual líneas ~351-363):

```tsx
{METHODS_IN_BS.includes(method) && (
  <div className="grid gap-2">
    <Label htmlFor="payment_rate">Tasa del pago (opcional)</Label>
    <Input
      id="payment_rate"
      type="number"
      step="0.01"
      {...register("payment_rate")}
      placeholder="Ej: 45.50"
    />
    <p className="text-xs text-muted-foreground">Tasa Bs/USD al momento del pago</p>
  </div>
)}
```

Reemplazarlo por:

```tsx
{BS_PAYMENT_METHODS.includes(method) && (
  <div className="grid gap-2">
    <Label>Tasa de conversión</Label>
    <div className="flex gap-2">
      <Button
        type="button"
        size="sm"
        variant={rateType === "bcv" ? "default" : "outline"}
        className="flex-1"
        onClick={() => handleRateTypeChange("bcv")}
      >
        BCV {bcvRate > 0 ? `Bs. ${bcvRate.toFixed(2)}` : "—"}
      </Button>
      <Button
        type="button"
        size="sm"
        variant={rateType === "usdt" ? "default" : "outline"}
        className="flex-1"
        onClick={() => handleRateTypeChange("usdt")}
      >
        USDT {usdtRate > 0 ? `Bs. ${usdtRate.toFixed(2)}` : "—"}
      </Button>
    </div>
    <p className="text-xs text-muted-foreground">
      Tasa aplicada: {activeRate > 0 ? `${activeRate.toFixed(2)} Bs/USD` : "Sin tasa disponible"}
    </p>
  </div>
)}
```

> El `input` oculto de `payment_rate` ya no es necesario en el JSX — el valor se maneja exclusivamente por `setValue` desde el `useEffect` y `handleRateTypeChange`. El campo `payment_rate` sigue registrado en el formulario (vía `FormData`), así que `data.payment_rate` en `onSubmit` sigue funcionando.

- [ ] **Step 9: Verificar que el archivo no tiene referencias colgantes a `register("payment_rate")`**

Verificar que el único `register("payment_rate")` que quedaba estaba en el bloque eliminado en Step 8. El campo `payment_rate` sigue en `FormData` y en `defaultValues` — eso es correcto y necesario para que `watch("payment_rate")` funcione.

Run: `grep -n "register.*payment_rate" components/section-components/payments/modals/payment-form-modal.tsx`
Expected: sin resultados (el `register` del input se eliminó en Step 8).

- [ ] **Step 10: Verificar tipos**

Run: `npx tsc --noEmit`
Expected: sin errores nuevos.

- [ ] **Step 11: Verificación manual**

Run: `npm run dev` → Pagos → Registrar Pago.

Casos a probar:
1. Seleccionar método "Pago Móvil" → aparece el selector BCV/USDT con la tasa del sistema visible. El campo de texto manual ya no existe.
2. Seleccionar un cliente con `balance_due > 0` y método Bs → el monto se autollena en Bs (`saldo_usd × tasa`).
3. Cambiar de BCV a USDT → el monto se recalcula automáticamente.
4. Seleccionar un cliente sin deuda → el monto se autollena con `precio_plan × tasa`.
5. Registrar el pago → verificar en Supabase que `payment_rate` guardó la tasa BCV o USDT elegida.
6. Cambiar método a "Efectivo" → el selector BCV/USDT desaparece y el monto se autollena en USD.
7. Editar un pago en Bs existente → el selector aparece con la tasa actual del sistema.

- [ ] **Step 12: Commit**

```bash
git add components/section-components/payments/modals/payment-form-modal.tsx
git commit -m "feat(pagos): tasa automática BCV/USDT para pagos en Bs, elimina campo manual"
```

---

## Self-Review

**Spec coverage:**
- ✅ Eliminar campo manual de tasa → Steps 8-9 lo reemplazan con selector.
- ✅ Autollenado de monto en Bs → Steps 5, 6, y el efecto del Step 3 lo habilitan.
- ✅ Selector BCV/USDT → Step 8 JSX + Step 4 handler.
- ✅ La tasa se sigue guardando en `payments.payment_rate` → sin cambios en el payload de `onSubmit`.
- ✅ Fondos/saldo siguen funcionando → `toUsd()` sigue recibiendo `payment_rate` numérico, sin cambios en lógica de abonos.

**Placeholder scan:** ninguno encontrado — todos los steps contienen código completo.

**Type consistency:**
- `rateType: "bcv" | "usdt"` — usado consistentemente en Steps 2, 4, 8.
- `activeRate: number` — derivado en Step 2, usado en Steps 3, 4, 5, 6, 8.
- `handleRateTypeChange(newType: "bcv" | "usdt")` — definido en Step 4, invocado en Step 8.
- `bcvRate`, `usdtRate` — definidos en Step 2, usados en Steps 4 y 8.
