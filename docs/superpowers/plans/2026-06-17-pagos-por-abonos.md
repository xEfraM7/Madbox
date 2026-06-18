# Pagos por abonos / cuotas de mensualidad — Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Permitir que un cliente abone la mensualidad por partes (cuotas), activándose al primer abono con un saldo pendiente visible que se reduce con cada abono hasta cubrir el precio del plan.

**Architecture:** Enfoque 1 del spec — el saldo pendiente vive en `members.balance_due` (USD) y cada abono es una fila normal en `payments` marcada con `is_installment`. La lógica vive en `lib/actions/payments.ts`; el saldo se normaliza a USD con un helper puro en `lib/utils.ts`. Fondos y cierres no cambian (ya suman montos reales). La UI muestra saldo, deudores e indicadores.

**Tech Stack:** Next.js 16 (App Router, Server Actions), React 19, TypeScript 5 (strict), Supabase (Postgres + migraciones SQL), TanStack Query 5, React Hook Form 7, shadcn/ui, sonner/sweetalert2, lucide-react.

## Global Constraints

- Idioma del proyecto: **español** (UI, comentarios relevantes, acciones de log, commits). — verbatim de CLAUDE.md.
- Todo acceso a Supabase vive en `lib/actions/*.ts` con `"use server"`. Los Client Components consumen Server Actions vía TanStack Query. — verbatim de CLAUDE.md.
- Después de mutar: `revalidatePath("/dashboard/...")` en rutas afectadas y `logActivity(...)` cuando aplique. Lanzar `throw error` en errores de Supabase.
- TypeScript estricto. **Sin `any`** salvo cuando lo exige una API externa (documentar el porqué). No dejar `console.log` ni código muerto.
- Tipos de tabla desde `@/types/database`: `Tables<"...">`, `TablesInsert<"...">`, `TablesUpdate<"...">`.
- Fechas: parsear strings ISO (`YYYY-MM-DD`) con `new Date(s + "T00:00:00")`.
- **Saldo siempre normalizado en USD.** El precio del plan (`plans.price`) está en USD; un pago en Bs guarda `amount` en bolívares + `payment_rate`.
- **Verificación (este proyecto NO tiene framework de tests):** cada tarea se valida con `npx tsc --noEmit` (sin errores nuevos), `npm run build` donde se indique, y prueba manual con `npm run dev`. `npm run lint` no es confiable en este entorno (ver memoria del proyecto); no depender de él.
- **Commits:** hacer commit al final de cada tarea (el plan lo indica). El usuario ya autorizó la implementación de esta feature.

## Métodos de pago y monedas (referencia)

| Método (`method`) | Moneda | Fondo |
|---|---|---|
| `Pago Movil`, `Efectivo bs`, `Transferencia BS` | Bs | `BS` |
| `Efectivo` | USD efectivo | `USD_CASH` |
| `USDT`, `Transferencia` | USDT | `USDT` |
| `Solvencia sin ingreso` | — (no entra a fondo) | — |

---

## File Structure

| Archivo | Responsabilidad | Acción |
|---|---|---|
| `supabase/migrations/20260617120000_pagos_abonos.sql` | Agrega `members.balance_due` y `payments.is_installment` | Crear |
| `types/database.ts` | Tipos generados: añadir las 2 columnas | Modificar |
| `lib/utils.ts` | Helper puro `toUsd()` + constante `BS_PAYMENT_METHODS` | Modificar |
| `lib/actions/payments.ts` | Lógica de abonos en `createPayment`/`deletePayment`/`updatePayment` | Modificar |
| `components/section-components/payments/modals/payment-form-modal.tsx` | Saldo, autollenado, validación sobrepago, tasa obligatoria Bs, texto en vivo | Modificar |
| `components/section-components/payments/PaymentsMainComponent.tsx` | Card de deudores + KPI + badge "Abono" | Modificar |
| `components/section-components/users/UsersMainComponent.tsx` | Badge "Debe $X" + filtro "Deudores" | Modificar |

Orden: Task 1 (esquema+tipos) → Task 2 (helper) → Task 3 (lógica) → Task 4 (modal) → Task 5 (página pagos) → Task 6 (lista clientes). Cada tarea es independientemente verificable.

---

### Task 1: Migración de esquema y tipos

**Files:**
- Create: `supabase/migrations/20260617120000_pagos_abonos.sql`
- Modify: `types/database.ts` (bloque `members` ~190-276; bloque `payments` ~388-430)

**Interfaces:**
- Produces: columna `members.balance_due numeric NOT NULL DEFAULT 0` (USD); columna `payments.is_installment boolean NOT NULL DEFAULT false`. En tipos: `Tables<"members">.balance_due: number`, `Tables<"payments">.is_installment: boolean`.

- [ ] **Step 1: Crear el archivo de migración SQL**

Create `supabase/migrations/20260617120000_pagos_abonos.sql`:

```sql
-- Soporte para pagos por abonos / cuotas de mensualidad

-- Saldo pendiente del periodo actual del miembro, normalizado en USD.
alter table public.members
  add column if not exists balance_due numeric not null default 0;

-- Marca si una fila de pago es un abono parcial (no la mensualidad completa).
alter table public.payments
  add column if not exists is_installment boolean not null default false;

comment on column public.members.balance_due is 'Saldo pendiente del periodo actual en USD (abonos/cuotas).';
comment on column public.payments.is_installment is 'true si el pago es un abono parcial de la mensualidad.';
```

- [ ] **Step 2: Aplicar la migración a Supabase**

Opción A (Supabase MCP, preferida en este entorno): aplicar con la herramienta `mcp__supabase__apply_migration` usando `name: "pagos_abonos"` y el SQL del Step 1.

Opción B (CLI, si el proyecto está linkeado): `npx supabase db push`

Expected: la migración corre sin error y las columnas existen. Verificar con `mcp__supabase__list_tables` (o en el panel de Supabase) que `members` tiene `balance_due` y `payments` tiene `is_installment`.

- [ ] **Step 3: Añadir `balance_due` a los tipos de `members`**

En `types/database.ts`, dentro de `members`, añadir la propiedad en los tres bloques, en orden alfabético (después de `avatar_url`, antes de `birth_date`):

En `members.Row` (después de `avatar_url: string | null`):
```ts
          balance_due: number
```
En `members.Insert` (después de `avatar_url?: string | null`):
```ts
          balance_due?: number
```
En `members.Update` (después de `avatar_url?: string | null`):
```ts
          balance_due?: number
```

- [ ] **Step 4: Añadir `is_installment` a los tipos de `payments`**

En `types/database.ts`, dentro de `payments`, añadir la propiedad en los tres bloques, en orden alfabético (después de `id`, antes de `member_id`):

En `payments.Row` (después de `id: string`):
```ts
          is_installment: boolean
```
En `payments.Insert` (después de `id?: string`):
```ts
          is_installment?: boolean
```
En `payments.Update` (después de `id?: string`):
```ts
          is_installment?: boolean
```

> Alternativa a Steps 3-4: si el Supabase CLI está linkeado, regenerar todo con
> `npx supabase gen types typescript --linked > types/database.ts` y verificar que el diff contiene solo estas dos columnas.

- [ ] **Step 5: Verificar tipos**

Run: `npx tsc --noEmit`
Expected: sin errores nuevos relacionados con `balance_due` / `is_installment`.

- [ ] **Step 6: Commit**

```bash
git add supabase/migrations/20260617120000_pagos_abonos.sql types/database.ts
git commit -m "feat(pagos): esquema para abonos parciales (balance_due, is_installment)"
```

---

### Task 2: Helper de normalización a USD

**Files:**
- Modify: `lib/utils.ts`

**Interfaces:**
- Produces:
  - `export const BS_PAYMENT_METHODS: readonly string[]` — métodos cuyo `amount` está en Bs.
  - `export function toUsd(amount: number, method: string | null | undefined, rate: number | null | undefined): number` — convierte el monto del abono a USD. Bs → `amount / rate` (0 si falta tasa). USD → `amount`. `<= 0` → `0`.

- [ ] **Step 1: Añadir la constante y el helper a `lib/utils.ts`**

Al final de `lib/utils.ts`, añadir:

```ts
/**
 * Métodos de pago cuyo monto se registra en bolívares (Bs).
 * Su `amount` debe convertirse a USD usando la tasa del pago para llevar el saldo.
 */
export const BS_PAYMENT_METHODS: readonly string[] = ["Pago Movil", "Efectivo bs", "Transferencia BS"]

/**
 * Convierte el monto de un abono a USD para llevar el saldo del miembro de forma homogénea.
 * - Métodos en Bs: se dividen por la tasa del pago. Si no hay tasa válida, retorna 0
 *   (no se puede convertir; la UI exige la tasa para abonos en Bs).
 * - Métodos en USD: se devuelven tal cual.
 */
export function toUsd(
  amount: number,
  method: string | null | undefined,
  rate: number | null | undefined,
): number {
  if (!amount || amount <= 0) return 0
  if (method && BS_PAYMENT_METHODS.includes(method)) {
    if (!rate || rate <= 0) return 0
    return amount / rate
  }
  return amount
}
```

- [ ] **Step 2: Verificación manual de la lógica (sanity check)**

Abrir una terminal y razonar/comprobar los casos (no hay test runner; validar mentalmente y con `tsc`):
- `toUsd(15, "Efectivo", null)` → `15` (USD pasa directo).
- `toUsd(600, "Pago Movil", 40)` → `15` (600/40).
- `toUsd(600, "Pago Movil", null)` → `0` (Bs sin tasa).
- `toUsd(0, "USDT", null)` → `0`.

- [ ] **Step 3: Verificar tipos**

Run: `npx tsc --noEmit`
Expected: sin errores.

- [ ] **Step 4: Commit**

```bash
git add lib/utils.ts
git commit -m "feat(pagos): helper toUsd para normalizar abonos a USD"
```

---

### Task 3: Lógica de abonos en Server Actions

**Files:**
- Modify: `lib/actions/payments.ts` (`createPayment` ~20-68, `updatePayment` ~70-82, `deletePayment` ~111-139)

**Interfaces:**
- Consumes: `toUsd`, `BS_PAYMENT_METHODS` de `@/lib/utils`; `addToFund`, `subtractFromFund` de `./funds`; `logActivity` de `./activity`.
- Produces: `createPayment` ahora calcula `is_installment` y `balance_due`; `deletePayment` restaura saldo de abonos; `updatePayment` ajusta saldo al editar abonos. Firmas públicas **sin cambios** (`createPayment(payment: TablesInsert<"payments">)`, etc.).

- [ ] **Step 1: Importar el helper en `lib/actions/payments.ts`**

Modificar el bloque de imports (líneas 1-7) para añadir `toUsd`:

```ts
"use server"

import { createClient } from "@/utils/supabase/server"
import { revalidatePath } from "next/cache"
import type { TablesInsert, TablesUpdate } from "@/types/database"
import { addToFund, subtractFromFund } from "./funds"
import { logActivity } from "./activity"
import { toUsd } from "@/lib/utils"
```

- [ ] **Step 2: Reescribir `createPayment`**

Reemplazar la función `createPayment` completa (líneas 20-68) por:

```ts
export async function createPayment(payment: TablesInsert<"payments">) {
  const supabase = await createClient()

  // --- Calcular saldo del periodo (lógica de abonos) ---
  // El saldo se lleva en USD. El primer abono (balance_due <= 0) abre el periodo
  // y avanza la fecha de corte; los siguientes solo reducen el saldo.
  let isInstallment = false
  let newBalance = 0
  let opensPeriod = true
  let memberFrozen = false

  if (payment.member_id) {
    const { data: member } = await supabase
      .from("members")
      .select("balance_due, frozen, plan_id")
      .eq("id", payment.member_id)
      .single()

    memberFrozen = member?.frozen ?? false
    const currentBalance = Number(member?.balance_due ?? 0)
    opensPeriod = currentBalance <= 0

    const planId = payment.plan_id || member?.plan_id || null
    let planPriceUsd = 0
    if (planId) {
      const { data: plan } = await supabase
        .from("plans")
        .select("price")
        .eq("id", planId)
        .single()
      planPriceUsd = Number(plan?.price ?? 0)
    }

    const remaining = opensPeriod ? planPriceUsd : currentBalance

    if (payment.method === "Solvencia sin ingreso") {
      // Salda el periodo completo sin entrar a fondo.
      newBalance = 0
      isInstallment = false
    } else {
      const abonoUsd = toUsd(Number(payment.amount), payment.method, payment.payment_rate)
      const appliedUsd = Math.min(abonoUsd, remaining)
      newBalance = Math.max(0, remaining - appliedUsd)
      isInstallment = opensPeriod ? newBalance > 0 : true
    }
  }

  // --- Insertar el pago con la marca de abono ---
  const { data, error } = await supabase
    .from("payments")
    .insert({ ...payment, is_installment: isInstallment })
    .select()
    .single()

  if (error) throw error

  // --- Actualizar el miembro ---
  if (payment.member_id) {
    if (opensPeriod) {
      // Abre periodo: avanza la fecha de corte y activa (respetando congelado).
      const updates: TablesUpdate<"members"> = {
        balance_due: newBalance,
        updated_at: new Date().toISOString(),
      }
      if (payment.due_date) {
        updates.payment_date = payment.due_date
        updates.status = memberFrozen ? "frozen" : "active"
      }
      await supabase.from("members").update(updates).eq("id", payment.member_id)
    } else {
      // Continúa periodo: solo reduce el saldo, no toca la fecha de corte.
      await supabase
        .from("members")
        .update({ balance_due: newBalance, updated_at: new Date().toISOString() })
        .eq("id", payment.member_id)
    }
  }

  // Agregar al fondo correspondiente si el pago está pagado (monto real, sin doble conteo)
  if (payment.status === "paid" && payment.method && payment.amount) {
    await addToFund(payment.method, payment.amount)
  }

  // Obtener nombre del miembro para el log
  const { data: member } = await supabase
    .from("members")
    .select("name")
    .eq("id", payment.member_id)
    .single()

  await logActivity({
    action: "payment_registered",
    entityType: "payment",
    entityId: data.id,
    entityName: member?.name,
    details: {
      amount: payment.amount,
      method: payment.method,
      is_installment: isInstallment,
      balance_due: newBalance,
    },
  })

  revalidatePath("/dashboard/payments")
  revalidatePath("/dashboard/users")
  revalidatePath("/dashboard")
  return data
}
```

- [ ] **Step 3: Ajustar `updatePayment` para reajustar el saldo de abonos**

Reemplazar `updatePayment` (líneas 70-82) por:

```ts
export async function updatePayment(id: string, payment: TablesUpdate<"payments">) {
  const supabase = await createClient()

  // Estado previo del pago para reajustar el saldo si era un abono y cambió el monto.
  const { data: prev } = await supabase
    .from("payments")
    .select("amount, method, payment_rate, is_installment, member_id, plan_id")
    .eq("id", id)
    .single()

  const { data, error } = await supabase
    .from("payments")
    .update({ ...payment, updated_at: new Date().toISOString() })
    .eq("id", id)
    .select()
    .single()

  if (error) throw error

  if (prev?.is_installment && prev.member_id) {
    const oldUsd = toUsd(Number(prev.amount), prev.method, prev.payment_rate)
    const newUsd = toUsd(Number(data.amount), data.method, data.payment_rate)
    const delta = oldUsd - newUsd // abono más chico => sube el saldo

    const { data: member } = await supabase
      .from("members")
      .select("balance_due, plan_id")
      .eq("id", prev.member_id)
      .single()

    const planId = data.plan_id || prev.plan_id || member?.plan_id || null
    let planPriceUsd = Number.POSITIVE_INFINITY
    if (planId) {
      const { data: plan } = await supabase
        .from("plans")
        .select("price")
        .eq("id", planId)
        .single()
      planPriceUsd = Number(plan?.price ?? Number.POSITIVE_INFINITY)
    }

    const adjusted = Math.min(
      planPriceUsd,
      Math.max(0, Number(member?.balance_due ?? 0) + delta),
    )
    await supabase
      .from("members")
      .update({ balance_due: adjusted, updated_at: new Date().toISOString() })
      .eq("id", prev.member_id)
  }

  revalidatePath("/dashboard/payments")
  revalidatePath("/dashboard/users")
  return data
}
```

> Nota: editar el monto de un pago **no** ajusta los fondos (gap preexistente, fuera de alcance). Solo se ajusta el saldo del miembro.

- [ ] **Step 4: Ajustar `deletePayment` para restaurar el saldo**

Reemplazar `deletePayment` (líneas 111-139) por:

```ts
export async function deletePayment(id: string) {
  const supabase = await createClient()

  // Obtener el pago antes de eliminarlo para restar del fondo y restaurar saldo
  const { data: payment } = await supabase
    .from("payments")
    .select("method, amount, status, member_id, payment_rate, is_installment, plan_id, members(name)")
    .eq("id", id)
    .single()

  const { error } = await supabase.from("payments").delete().eq("id", id)
  if (error) throw error

  // Restar del fondo si el pago estaba pagado
  if (payment?.status === "paid" && payment.method && payment.amount) {
    await subtractFromFund(payment.method, payment.amount)
  }

  // Restaurar el saldo del miembro si el pago era un abono parcial
  if (payment?.is_installment && payment.member_id) {
    const abonoUsd = toUsd(Number(payment.amount), payment.method, payment.payment_rate)

    const { data: member } = await supabase
      .from("members")
      .select("balance_due, plan_id")
      .eq("id", payment.member_id)
      .single()

    const planId = payment.plan_id || member?.plan_id || null
    let planPriceUsd = Number.POSITIVE_INFINITY
    if (planId) {
      const { data: plan } = await supabase
        .from("plans")
        .select("price")
        .eq("id", planId)
        .single()
      planPriceUsd = Number(plan?.price ?? Number.POSITIVE_INFINITY)
    }

    const restored = Math.min(planPriceUsd, Number(member?.balance_due ?? 0) + abonoUsd)
    await supabase
      .from("members")
      .update({ balance_due: restored, updated_at: new Date().toISOString() })
      .eq("id", payment.member_id)
  }

  await logActivity({
    action: "payment_deleted",
    entityType: "payment",
    entityId: id,
    entityName: (payment as { members?: { name?: string } } | null)?.members?.name,
    details: { amount: payment?.amount },
  })

  revalidatePath("/dashboard/payments")
  revalidatePath("/dashboard/users")
  revalidatePath("/dashboard")
}
```

- [ ] **Step 5: Verificar tipos**

Run: `npx tsc --noEmit`
Expected: sin errores.

- [ ] **Step 6: Verificación manual del flujo (servidor)**

Run: `npm run dev`. Con un plan de $30 y un cliente:
1. Registrar abono de $15 (Efectivo). Esperado: cliente queda activo, `balance_due = 15`, fondo USD_CASH +15.
2. Registrar segundo abono de $15. Esperado: `balance_due = 0`, fecha de corte sin re-avanzar, fondo +15 (total 30).
Verificar en Supabase (`members.balance_due`, `payments.is_installment`).

- [ ] **Step 7: Commit**

```bash
git add lib/actions/payments.ts
git commit -m "feat(pagos): lógica de abonos parciales con saldo en USD"
```

---

### Task 4: Modal de pago — saldo, autollenado y validación

**Files:**
- Modify: `components/section-components/payments/modals/payment-form-modal.tsx`

**Interfaces:**
- Consumes: `toUsd`, `BS_PAYMENT_METHODS` de `@/lib/utils`; `members[].balance_due`, `plans[].price`.
- Produces: el formulario muestra saldo pendiente, autollena el monto con el saldo restante, valida sobrepago (topa + avisa), exige tasa para abonos en Bs y muestra el saldo resultante en vivo.

- [ ] **Step 1: Importar helpers y `showToast`**

En `payment-form-modal.tsx`, añadir a los imports (ya existe `showToast` import en la línea 6; confirmar). Añadir tras la línea 17 (`import { getPlans } ...`):

```ts
import { toUsd, BS_PAYMENT_METHODS } from "@/lib/utils"
```

- [ ] **Step 2: Calcular saldo, precio y saldo resultante**

Después de `const method = watch("method")` (línea ~76), añadir:

```ts
  const amount = watch("amount")
  const payment_rate = watch("payment_rate")

  const selectedMember = members.find((m: any) => m.id === member_id)
  const selectedPlan = plans.find((p: any) => p.id === plan_id)

  // El saldo se lleva en USD. Si el miembro tiene saldo, ese es el restante;
  // si no, el restante es el precio del plan (abre periodo).
  const balanceDue = Number(selectedMember?.balance_due ?? 0)
  const planPriceUsd = Number(selectedPlan?.price ?? 0)
  const remainingUsd = balanceDue > 0 ? balanceDue : planPriceUsd

  const abonoUsd = toUsd(parseFloat(amount || "0"), method, parseFloat(payment_rate || "0"))
  const resultingBalanceUsd = Math.max(0, remainingUsd - abonoUsd)
  const isBsMethod = BS_PAYMENT_METHODS.includes(method)
  const isOverpay = abonoUsd > remainingUsd + 0.01
```

- [ ] **Step 3: Autollenar el monto con el saldo restante cuando el miembro tiene deuda**

Reemplazar `handleMemberChange` (líneas ~139-151) por una versión que considere el saldo:

```ts
  // Auto-fill cuando el usuario selecciona un miembro manualmente
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
      // Para métodos en USD autollenamos directo; para Bs dejamos que el admin ingrese
      // monto+tasa (el monto va en Bs y no podemos convertir sin tasa).
      if (!BS_PAYMENT_METHODS.includes(method) && baseUsd > 0) {
        setValue("amount", baseUsd.toFixed(2))
      } else {
        setValue("amount", "")
      }
    }
  }
```

- [ ] **Step 4: Mostrar el saldo pendiente y el saldo resultante en el formulario**

Justo después del bloque del `<Select>` de Plan (después de su `</div>` de cierre, línea ~248, antes del grid de Monto/Método), insertar:

```tsx
            {balanceDue > 0 && (
              <div className="rounded-md border border-yellow-500/30 bg-yellow-500/10 px-3 py-2">
                <p className="text-sm font-medium text-yellow-500">
                  Saldo pendiente: ${balanceDue.toFixed(2)}
                </p>
                <p className="text-xs text-muted-foreground">Este cliente está abonando su mensualidad por partes.</p>
              </div>
            )}
```

- [ ] **Step 5: Mostrar el saldo resultante en vivo bajo el campo Monto**

Dentro del `div` del campo Monto (después del bloque de `errors.amount`, línea ~260), añadir:

```tsx
                {remainingUsd > 0 && parseFloat(amount || "0") > 0 && (
                  <p className={`text-xs ${isOverpay ? "text-destructive" : "text-muted-foreground"}`}>
                    {isOverpay
                      ? `El abono supera el saldo de $${remainingUsd.toFixed(2)}`
                      : `Este abono dejará un saldo de $${resultingBalanceUsd.toFixed(2)}`}
                  </p>
                )}
```

- [ ] **Step 6: Validar tasa obligatoria en Bs y sobrepago en `onSubmit`**

Reemplazar el inicio de `onSubmit` (líneas ~193-205) por:

```ts
  const onSubmit = (data: FormData) => {
    const amountNum = parseFloat(data.amount)
    const rateNum = data.payment_rate ? parseFloat(data.payment_rate) : null

    // Abono en Bs requiere tasa para poder convertir el saldo a USD.
    if (BS_PAYMENT_METHODS.includes(data.method) && (!rateNum || rateNum <= 0)) {
      showToast.error("Falta la tasa", "Ingresa la tasa Bs/USD para registrar un abono en bolívares.")
      return
    }

    // Sobrepago: avisar y topar al saldo (no se permite guardar de más).
    const thisAbonoUsd = toUsd(amountNum, data.method, rateNum)
    if (data.method !== "Solvencia sin ingreso" && remainingUsd > 0 && thisAbonoUsd > remainingUsd + 0.01) {
      const cappedAmount = BS_PAYMENT_METHODS.includes(data.method) && rateNum
        ? remainingUsd * rateNum
        : remainingUsd
      setValue("amount", cappedAmount.toFixed(2))
      showToast.error(
        "Monto mayor al saldo",
        `El saldo pendiente es $${remainingUsd.toFixed(2)}. Ajustamos el monto al máximo permitido.`,
      )
      return
    }

    const paymentData = {
      member_id: data.member_id,
      plan_id: data.plan_id,
      amount: amountNum,
      method: data.method,
      reference: METHODS_WITH_REFERENCE.includes(data.method) ? data.reference : null,
      status: "paid",
      payment_date: data.payment_date || null,
      due_date: data.due_date,
      payment_rate: METHODS_IN_BS.includes(data.method) && data.payment_rate ? parseFloat(data.payment_rate) : null,
    }

    if (isEditing) {
      updateMutation.mutate(paymentData)
    } else {
      createMutation.mutate(paymentData)
    }
  }
```

- [ ] **Step 7: Verificar tipos y build**

Run: `npx tsc --noEmit`
Expected: sin errores.
Run: `npm run build`
Expected: build exitoso.

- [ ] **Step 8: Verificación manual del modal**

Run: `npm run dev` → Pagos → Registrar Pago. Con un cliente con saldo:
1. Verificar que aparece "Saldo pendiente: $X" y el monto se autollena (método USD).
2. Escribir un monto y ver el texto "Este abono dejará un saldo de $Y".
3. Intentar un monto mayor al saldo → aviso y el monto se topa.
4. Método Bs sin tasa → bloquea con aviso "Falta la tasa".

- [ ] **Step 9: Commit**

```bash
git add components/section-components/payments/modals/payment-form-modal.tsx
git commit -m "feat(pagos): saldo, autollenado y validación de sobrepago en el modal de pago"
```

---

### Task 5: Página de Pagos — deudores e indicadores

**Files:**
- Modify: `components/section-components/payments/PaymentsMainComponent.tsx`

**Interfaces:**
- Consumes: `members[].balance_due`, `payments[].is_installment` (ya disponibles vía `getMembers`/`getPayments`).
- Produces: card "Clientes con saldo pendiente", KPI "Deudores", badge "Abono" en el historial.

- [ ] **Step 1: Calcular la lista de deudores**

Después de `const expiredMembers = members.filter((m: any) => m.status === "expired")` (línea ~112), añadir:

```ts
  const debtors = members.filter((m: any) => Number(m.balance_due) > 0)

  const filteredDebtors = debtors.filter((member: any) =>
    member.name?.toLowerCase().includes(searchTerm.toLowerCase()) ||
    member.email?.toLowerCase().includes(searchTerm.toLowerCase()),
  )
```

- [ ] **Step 2: Añadir la KPI "Deudores"**

Cambiar la clase del grid de KPIs (línea ~163) de `lg:grid-cols-5` a `lg:grid-cols-6`:

```tsx
        <div className="grid gap-4 grid-cols-2 md:grid-cols-3 lg:grid-cols-6">
```

Y después de la card "Clientes Vencidos" (cierre `</Card>` en línea ~222), añadir:

```tsx
          <Card className="border-yellow-500/20 bg-yellow-500/5">
            <CardHeader className="flex flex-row items-center justify-between pb-2">
              <CardTitle className="text-sm font-medium text-muted-foreground">Deudores</CardTitle>
              <AlertCircle className="h-4 w-4 text-yellow-500" />
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold text-yellow-500">{debtors.length}</div>
            </CardContent>
          </Card>
```

- [ ] **Step 3: Añadir la card "Clientes con saldo pendiente"**

Después del bloque `{filteredExpiredMembers.length > 0 && (...)}` (cierre en línea ~279), insertar:

```tsx
        {filteredDebtors.length > 0 && (
          <Card className="border-yellow-500/40">
            <CardHeader>
              <div className="flex items-center gap-3">
                <AlertCircle className="h-5 w-5 text-yellow-500" />
                <div>
                  <CardTitle className="text-lg">Clientes con saldo pendiente ({filteredDebtors.length})</CardTitle>
                  <CardDescription>Estos clientes están abonando su mensualidad por partes</CardDescription>
                </div>
              </div>
            </CardHeader>
            <CardContent>
              <div className="rounded-md border">
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead>Cliente</TableHead>
                      <TableHead className="hidden sm:table-cell">Plan</TableHead>
                      <TableHead>Saldo</TableHead>
                      <TableHead className="text-right">Acción</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {filteredDebtors.map((member: any) => (
                      <TableRow key={member.id}>
                        <TableCell>
                          <p className="font-medium">{member.name}</p>
                        </TableCell>
                        <TableCell className="hidden sm:table-cell"><Badge variant="outline">{member.plans?.name || "Sin plan"}</Badge></TableCell>
                        <TableCell className="font-medium text-yellow-500">${Number(member.balance_due).toFixed(2)}</TableCell>
                        <TableCell className="text-right">
                          <Button size="sm" onClick={() => { setSelectedPayment({ member_id: member.id, plan_id: member.plan_id }); setIsModalOpen(true) }}>
                            <Plus className="mr-2 h-4 w-4 hidden sm:inline" /><span className="hidden sm:inline">Registrar abono</span><span className="sm:hidden">Abonar</span>
                          </Button>
                        </TableCell>
                      </TableRow>
                    ))}
                  </TableBody>
                </Table>
              </div>
            </CardContent>
          </Card>
        )}
```

- [ ] **Step 4: Badge "Abono" en el historial de pagos**

En la celda del cliente del historial (línea ~312-317), añadir el badge cuando el pago es abono. Reemplazar ese `<TableCell>` por:

```tsx
                          <TableCell>
                            <div>
                              <div className="flex items-center gap-2">
                                <p className="font-medium">{payment.members?.name || "Sin cliente"}</p>
                                {payment.is_installment && <Badge variant="outline" className="border-yellow-500/40 text-yellow-500">Abono</Badge>}
                              </div>
                              <p className="text-xs text-muted-foreground sm:hidden">{payment.method}</p>
                            </div>
                          </TableCell>
```

- [ ] **Step 5: Verificar tipos y build**

Run: `npx tsc --noEmit`
Expected: sin errores.
Run: `npm run build`
Expected: build exitoso.

- [ ] **Step 6: Verificación manual**

Run: `npm run dev` → Pagos. Con un cliente con saldo:
1. La KPI "Deudores" muestra el conteo.
2. Aparece la card "Clientes con saldo pendiente" con el monto y botón "Registrar abono".
3. Los pagos parciales muestran el badge "Abono" en el historial.

- [ ] **Step 7: Commit**

```bash
git add components/section-components/payments/PaymentsMainComponent.tsx
git commit -m "feat(pagos): sección de deudores, KPI y badge de abono"
```

---

### Task 6: Lista de Clientes — badge de deuda y filtro

**Files:**
- Modify: `components/section-components/users/UsersMainComponent.tsx`

**Interfaces:**
- Consumes: `clients[].balance_due` (vía `getMembers`).
- Produces: badge "Debe $X" junto al estado; opción "Deudores" en el filtro de estado.

- [ ] **Step 1: Añadir el filtro "Deudores" a la lógica**

Localizar el cálculo de `matchesStatus` (línea ~82):

```ts
    const matchesStatus = statusFilter === "all" || client.status === statusFilter
```

Reemplazar por:

```ts
    const matchesStatus =
      statusFilter === "all"
        ? true
        : statusFilter === "debtors"
          ? Number(client.balance_due) > 0
          : client.status === statusFilter
```

- [ ] **Step 2: Añadir la opción "Deudores" al Select de estado**

En el `<SelectContent>` del filtro de estado (alrededor de la línea ~108-115), añadir un `<SelectItem value="debtors">Deudores</SelectItem>` junto a las demás opciones. Ejemplo del bloque resultante (ajustar a las opciones existentes):

```tsx
              <Select value={statusFilter} onValueChange={setStatusFilter}>
                <SelectTrigger className="w-full sm:w-[160px]"><SelectValue placeholder="Estado" /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">Todos</SelectItem>
                  <SelectItem value="active">Activo</SelectItem>
                  <SelectItem value="expired">Vencido</SelectItem>
                  <SelectItem value="frozen">Congelado</SelectItem>
                  <SelectItem value="debtors">Deudores</SelectItem>
                </SelectContent>
              </Select>
```

> Verificar las opciones reales presentes y solo **agregar** `debtors` sin borrar las existentes.

- [ ] **Step 3: Añadir el badge "Debe $X" junto al estado**

Localizar la celda de estado (línea ~168):

```tsx
                          <TableCell><Badge variant={statusConfig[client.status as keyof typeof statusConfig]?.variant || "secondary"}>{statusConfig[client.status as keyof typeof statusConfig]?.label || client.status}</Badge></TableCell>
```

Reemplazar por:

```tsx
                          <TableCell>
                            <div className="flex flex-wrap items-center gap-1">
                              <Badge variant={statusConfig[client.status as keyof typeof statusConfig]?.variant || "secondary"}>{statusConfig[client.status as keyof typeof statusConfig]?.label || client.status}</Badge>
                              {Number(client.balance_due) > 0 && (
                                <Badge variant="outline" className="border-yellow-500/40 text-yellow-500">Debe ${Number(client.balance_due).toFixed(2)}</Badge>
                              )}
                            </div>
                          </TableCell>
```

- [ ] **Step 4: Verificar tipos y build**

Run: `npx tsc --noEmit`
Expected: sin errores.
Run: `npm run build`
Expected: build exitoso.

- [ ] **Step 5: Verificación manual**

Run: `npm run dev` → Clientes.
1. Un cliente con saldo muestra el badge "Debe $X" junto a su estado.
2. El filtro "Deudores" aísla solo a los clientes con saldo > 0.

- [ ] **Step 6: Commit**

```bash
git add components/section-components/users/UsersMainComponent.tsx
git commit -m "feat(clientes): badge de deuda y filtro de deudores"
```

---

## Self-Review (cobertura del spec)

| Requisito del spec | Tarea |
|---|---|
| `members.balance_due` + `payments.is_installment` (migración + tipos) | Task 1 |
| Normalización a USD (`toUsd`) | Task 2 |
| `createPayment`: abre/continúa periodo, activa, marca abono, fondos sin doble conteo | Task 3 |
| `deletePayment`: restaura saldo de abonos | Task 3 |
| `updatePayment`: ajuste incremental del saldo | Task 3 |
| Congelado sigue congelado al abonar | Task 3 (Step 2, `memberFrozen`) |
| "Solvencia sin ingreso" salda sin fondo | Task 3 (Step 2) |
| Modal: saldo pendiente, autollenado, texto en vivo | Task 4 |
| Sobrepago: avisar + topar | Task 4 (Step 6) |
| Tasa obligatoria para abonos en Bs | Task 4 (Step 6) |
| Card de deudores + KPI + badge "Abono" | Task 5 |
| Badge "Debe $X" + filtro "Deudores" | Task 6 |
| Fondos/cierres/dashboard sin cambios de lógica | (sin tarea — verificado en exploración) |

**Criterios de aceptación del spec (1-9):** cubiertos por Tasks 3-6 y sus pasos de verificación manual. El criterio 9 (fondos/cierres cuadran) se valida en Task 3 Step 6 y Task 5 Step 6.

**Consideración abierta del spec (conteo en cierres):** decisión por defecto = aceptar que `membership_payments_count` cuente abonos. No requiere tarea. Si se quisiera contar solo mensualidades completas, sería un cambio futuro en `lib/actions/closings.ts` filtrando `is_installment = false`.
