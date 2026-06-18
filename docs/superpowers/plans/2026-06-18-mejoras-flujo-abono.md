# Mejoras al flujo de abono — Plan de implementación

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Añadir un toggle "Pago completo / Abono" al modal de pago (con bloqueo de montos parciales en "completo") y mostrar el saldo pendiente equivalente en bolívares en el modal y en la card de deudores.

**Architecture:** El saldo ya se lleva en USD (`members.balance_due`) y el servidor ya deriva `is_installment` del monto, así que el toggle es una guarda de UX (controla si el campo monto es editable) más una guarda server-side ligera. El equivalente en Bs es solo presentación, vía un helper `formatBs` y las tasas de cambio ya cargadas en cada pantalla.

**Tech Stack:** Next.js 16 (App Router, Server Actions), React 19, TanStack Query 5, shadcn/ui, TypeScript estricto.

## Global Constraints

- Idioma del proyecto: **español** (UI, comentarios relevantes, mensajes de log/commits).
- TypeScript estricto; sin `any` salvo lo ya presente en estos archivos (tipados sueltos de TanStack Query).
- **Sin migración de base de datos** (`balance_due` e `is_installment` ya existen).
- Acceso a Supabase solo desde Server Actions (`lib/actions/*.ts`); los Client Components consumen vía TanStack Query / invocación directa.
- **No hay test runner** en el proyecto. Verificación de cada tarea: `npx tsc --noEmit` (chequeo de tipos) + prueba manual en `npm run dev`. (`npm run lint` no es fiable en este entorno.)
- **Commits:** por política del proyecto (`CLAUDE.md`), **no commitear sin que el usuario lo pida**. Cada tarea incluye un comando de commit sugerido que se ejecuta **solo cuando el usuario lo autorice**.

---

## File Structure

| Archivo | Responsabilidad | Acción |
|---|---|---|
| `lib/utils.ts` | Helper `formatBs` para formato de bolívares | Modificar |
| `lib/actions/payments.ts` | Guarda `enforceFullPayment` en `createPayment` | Modificar |
| `components/section-components/payments/modals/payment-form-modal.tsx` | Toggle de tipo de pago + equivalentes en Bs | Modificar |
| `components/section-components/payments/PaymentsMainComponent.tsx` | Equivalente en Bs en la card de deudores | Modificar |

---

## Task 1: Helper `formatBs` en `lib/utils.ts`

**Files:**
- Modify: `lib/utils.ts` (añadir función al final, después de `calculateAge`)

**Interfaces:**
- Produces: `formatBs(amount: number): string` → cadena tipo `"Bs 7.830,00"`; `"Bs 0,00"` para montos no válidos o `<= 0`.

- [ ] **Step 1: Añadir el helper `formatBs`**

Añadir al final de `lib/utils.ts`:

```ts
/**
 * Formatea un monto en bolívares con el formato venezolano (Bs 7.830,00).
 * Devuelve "Bs 0,00" para montos no válidos o no positivos.
 */
export function formatBs(amount: number): string {
  if (!amount || amount <= 0 || Number.isNaN(amount)) return "Bs 0,00"
  return `Bs ${amount.toLocaleString("es-VE", {
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  })}`
}
```

- [ ] **Step 2: Verificar tipos**

Run: `npx tsc --noEmit`
Expected: sin errores nuevos.

- [ ] **Step 3: Commit (solo si el usuario lo autoriza)**

```bash
git add lib/utils.ts
git commit -m "feat(utils): helper formatBs para montos en bolivares"
```

---

## Task 2: Guarda `enforceFullPayment` en `createPayment`

**Files:**
- Modify: `lib/actions/payments.ts` (firma en línea 21; bloque `else` en líneas 60-65)

**Interfaces:**
- Consumes: `toUsd` (ya importado) y el `remaining` ya calculado en `createPayment`.
- Produces: `createPayment(payment: TablesInsert<"payments">, options?: { enforceFullPayment?: boolean })` → si `options.enforceFullPayment` es `true` y el monto convertido a USD no cubre el `remaining`, lanza `Error("El pago completo no cubre el total del periodo.")` antes de insertar.

- [ ] **Step 1: Ampliar la firma de `createPayment`**

Reemplazar la línea 21:

```ts
export async function createPayment(payment: TablesInsert<"payments">) {
```

por:

```ts
export async function createPayment(
  payment: TablesInsert<"payments">,
  options?: { enforceFullPayment?: boolean },
) {
```

- [ ] **Step 2: Añadir la guarda dentro del bloque `else`**

Reemplazar este bloque (líneas 56-65):

```ts
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
```

por:

```ts
    if (payment.method === "Solvencia sin ingreso") {
      // Salda el periodo completo sin entrar a fondo.
      newBalance = 0
      isInstallment = false
    } else {
      const abonoUsd = toUsd(Number(payment.amount), payment.method, payment.payment_rate)
      // Guarda de "pago completo": el monto debe cubrir el total restante del periodo.
      if (options?.enforceFullPayment && abonoUsd < remaining - 0.01) {
        throw new Error("El pago completo no cubre el total del periodo.")
      }
      const appliedUsd = Math.min(abonoUsd, remaining)
      newBalance = Math.max(0, remaining - appliedUsd)
      isInstallment = opensPeriod ? newBalance > 0 : true
    }
```

- [ ] **Step 3: Verificar tipos**

Run: `npx tsc --noEmit`
Expected: sin errores. Las llamadas existentes (`user-form-modal.tsx:87`, `payment-form-modal.tsx:222`) siguen válidas porque `options` es opcional.

- [ ] **Step 4: Commit (solo si el usuario lo autoriza)**

```bash
git add lib/actions/payments.ts
git commit -m "feat(pagos): guarda enforceFullPayment en createPayment"
```

---

## Task 3: Equivalente en Bs dentro del modal de pago

**Files:**
- Modify: `components/section-components/payments/modals/payment-form-modal.tsx` (import línea 19; badge líneas 330-337; texto de saldo resultante líneas 350-356)

**Interfaces:**
- Consumes: `formatBs` (Task 1); `activeRate`, `balanceDue`, `resultingBalanceUsd`, `isOverpay`, `remainingUsd` (ya existen en el componente).

- [ ] **Step 1: Importar `formatBs`**

Reemplazar la línea 19:

```ts
import { toUsd, BS_PAYMENT_METHODS } from "@/lib/utils"
```

por:

```ts
import { toUsd, BS_PAYMENT_METHODS, formatBs } from "@/lib/utils"
```

- [ ] **Step 2: Mostrar el saldo pendiente también en Bs**

Reemplazar el badge (líneas 330-337):

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

por:

```tsx
            {balanceDue > 0 && (
              <div className="rounded-md border border-yellow-500/30 bg-yellow-500/10 px-3 py-2">
                <p className="text-sm font-medium text-yellow-500">
                  Saldo pendiente: ${balanceDue.toFixed(2)}
                  {activeRate > 0 && (
                    <span className="font-normal text-yellow-500/80"> ≈ {formatBs(balanceDue * activeRate)}</span>
                  )}
                </p>
                <p className="text-xs text-muted-foreground">Este cliente está abonando su mensualidad por partes.</p>
              </div>
            )}
```

- [ ] **Step 3: Mostrar el saldo resultante también en Bs**

Reemplazar el texto de ayuda (líneas 350-356):

```tsx
                {remainingUsd > 0 && parseFloat(amount || "0") > 0 && (
                  <p className={`text-xs ${isOverpay ? "text-destructive" : "text-muted-foreground"}`}>
                    {isOverpay
                      ? `El abono supera el saldo de $${remainingUsd.toFixed(2)}`
                      : `Este abono dejará un saldo de $${resultingBalanceUsd.toFixed(2)}`}
                  </p>
                )}
```

por:

```tsx
                {remainingUsd > 0 && parseFloat(amount || "0") > 0 && (
                  <p className={`text-xs ${isOverpay ? "text-destructive" : "text-muted-foreground"}`}>
                    {isOverpay
                      ? `El abono supera el saldo de $${remainingUsd.toFixed(2)}`
                      : `Este abono dejará un saldo de $${resultingBalanceUsd.toFixed(2)}${
                          activeRate > 0 ? ` ≈ ${formatBs(resultingBalanceUsd * activeRate)}` : ""
                        }`}
                  </p>
                )}
```

- [ ] **Step 4: Verificar tipos**

Run: `npx tsc --noEmit`
Expected: sin errores.

- [ ] **Step 5: Prueba manual**

Run: `npm run dev` → abrir el modal de pago para un cliente con saldo pendiente.
Expected: el badge "Saldo pendiente: $X" muestra "≈ Bs Y"; al escribir un monto, el texto "dejará un saldo de $Z" muestra "≈ Bs W". Cambiar entre BCV y USDT (en métodos en Bs) recalcula los bolívares mostrados.

- [ ] **Step 6: Commit (solo si el usuario lo autoriza)**

```bash
git add components/section-components/payments/modals/payment-form-modal.tsx
git commit -m "feat(pagos): mostrar saldo equivalente en Bs en el modal de pago"
```

---

## Task 4: Toggle "Pago completo / Abono" en el modal

**Files:**
- Modify: `components/section-components/payments/modals/payment-form-modal.tsx` (estado nuevo; init `useEffect` líneas 130-173; `handleMemberChange` líneas 185-205; `createMutation` líneas 221-234; render del campo Monto líneas 339-373)

**Interfaces:**
- Consumes: `createPayment(payment, { enforceFullPayment })` (Task 2); `remainingUsd`, `activeRate`, `method`, `BS_PAYMENT_METHODS`, `isEditing` (ya existen).
- Produces: estado local `paymentType: "full" | "installment"` que decide si el campo Monto es editable; envía `enforceFullPayment` al crear.

- [ ] **Step 1: Añadir el estado `paymentType`**

Tras la línea 71 (`const [rateType, setRateType] = useState<"bcv" | "usdt">("bcv")`), añadir:

```tsx
  const [paymentType, setPaymentType] = useState<"full" | "installment">("full")
```

- [ ] **Step 2: Recalcular el monto bloqueado en modo "Pago completo"**

Tras el `useEffect` de sincronización de `payment_rate` (termina en línea 127, `}, [method, activeRate, setValue])`), añadir un nuevo `useEffect`:

```tsx
  // En "Pago completo" el monto se bloquea al total restante (en la moneda del método).
  useEffect(() => {
    if (isEditing || paymentType !== "full" || method === "Solvencia sin ingreso") return
    if (remainingUsd <= 0) return
    if (BS_PAYMENT_METHODS.includes(method)) {
      if (activeRate > 0) setValue("amount", (remainingUsd * activeRate).toFixed(2))
    } else {
      setValue("amount", remainingUsd.toFixed(2))
    }
  }, [paymentType, method, activeRate, remainingUsd, isEditing, setValue])
```

- [ ] **Step 3: Fijar el `paymentType` por defecto al inicializar el modal**

En el `useEffect` de inicialización (líneas 130-173), añadir el ajuste del `paymentType` justo antes de `initialized.current = true` (línea 171). Reemplazar:

```tsx
      } else {
        reset({
          member_id: "",
          plan_id: "",
          amount: "",
          method: "Efectivo",
          reference: "",
          payment_date: today,
          due_date: calculateDueDate(today),
          payment_rate: ""
        })
      }
      initialized.current = true
    }
  }, [open, members.length, plans.length, payment, isEditing, reset])
```

por:

```tsx
      } else {
        reset({
          member_id: "",
          plan_id: "",
          amount: "",
          method: "Efectivo",
          reference: "",
          payment_date: today,
          due_date: calculateDueDate(today),
          payment_rate: ""
        })
      }

      // Default del toggle: "Abono" si el cliente ya tiene saldo; si no, "Pago completo".
      const initialMember = payment?.member_id
        ? members.find((m: any) => m.id === payment.member_id)
        : null
      setPaymentType(Number(initialMember?.balance_due ?? 0) > 0 ? "installment" : "full")

      initialized.current = true
    }
  }, [open, members.length, plans.length, payment, isEditing, reset])
```

- [ ] **Step 4: Ajustar el `paymentType` al cambiar de cliente**

En `handleMemberChange` (líneas 185-205), añadir el ajuste del toggle. Reemplazar:

```tsx
  const handleMemberChange = (value: string) => {
    setValue("member_id", value)
    if (!isEditing) {
      const member = members.find((m: any) => m.id === value)
      if (member?.plan_id) {
        setValue("plan_id", member.plan_id)
      }
```

por:

```tsx
  const handleMemberChange = (value: string) => {
    setValue("member_id", value)
    if (!isEditing) {
      const member = members.find((m: any) => m.id === value)
      setPaymentType(Number(member?.balance_due ?? 0) > 0 ? "installment" : "full")
      if (member?.plan_id) {
        setValue("plan_id", member.plan_id)
      }
```

- [ ] **Step 5: Enviar `enforceFullPayment` al crear el pago**

En `createMutation` (líneas 221-234), reemplazar:

```tsx
  const createMutation = useMutation({
    mutationFn: (data: any) => createPayment(data),
```

por:

```tsx
  const createMutation = useMutation({
    mutationFn: (data: any) => createPayment(data, { enforceFullPayment: paymentType === "full" }),
```

- [ ] **Step 6: Renderizar el toggle y bloquear el campo Monto**

Reemplazar el bloque del grid Monto/Método (líneas 339-373):

```tsx
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              <div className="grid gap-2">
                <Label htmlFor="amount">Monto</Label>
                <Input
                  id="amount"
                  type="number"
                  step="0.01"
                  {...register("amount", { required: "El monto es requerido" })}
                  placeholder="0.00"
                />
                {errors.amount && <p className="text-sm text-destructive">{errors.amount.message}</p>}
                {remainingUsd > 0 && parseFloat(amount || "0") > 0 && (
```

por:

```tsx
            {!isEditing && method !== "Solvencia sin ingreso" && (
              <div className="grid gap-2">
                <Label>Tipo de pago</Label>
                <div className="flex gap-2">
                  <Button
                    type="button"
                    size="sm"
                    variant={paymentType === "full" ? "default" : "outline"}
                    className="flex-1"
                    onClick={() => setPaymentType("full")}
                  >
                    Pago completo
                  </Button>
                  <Button
                    type="button"
                    size="sm"
                    variant={paymentType === "installment" ? "default" : "outline"}
                    className="flex-1"
                    onClick={() => setPaymentType("installment")}
                  >
                    Abono
                  </Button>
                </div>
              </div>
            )}

            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              <div className="grid gap-2">
                <Label htmlFor="amount">Monto</Label>
                <Input
                  id="amount"
                  type="number"
                  step="0.01"
                  readOnly={!isEditing && paymentType === "full" && method !== "Solvencia sin ingreso"}
                  className={
                    !isEditing && paymentType === "full" && method !== "Solvencia sin ingreso"
                      ? "bg-muted/50"
                      : undefined
                  }
                  {...register("amount", { required: "El monto es requerido" })}
                  placeholder="0.00"
                />
                {errors.amount && <p className="text-sm text-destructive">{errors.amount.message}</p>}
                {remainingUsd > 0 && parseFloat(amount || "0") > 0 && (
```

> Nota: el resto del bloque (texto de saldo resultante, campo Método, etc.) queda intacto a partir de la línea ya existente `{remainingUsd > 0 && parseFloat(amount || "0") > 0 && (`.

- [ ] **Step 7: Verificar tipos**

Run: `npx tsc --noEmit`
Expected: sin errores.

- [ ] **Step 8: Prueba manual**

Run: `npm run dev`.
Expected:
- Cliente **sin** saldo → toggle arranca en "Pago completo"; el campo Monto está autollenado al total y es de **solo lectura**; cambiar método (USD ↔ Bs) o tasa (BCV/USDT) recalcula el monto bloqueado.
- Pasar a "Abono" → el campo Monto se vuelve **editable** y admite parciales.
- Cliente **con** saldo pendiente (o entrar por "Registrar abono" en la card de deudores) → toggle arranca en "Abono".
- Método "Solvencia sin ingreso" → el toggle **no aparece** y el monto es editable como hoy.
- En "Pago completo", registrar el pago salda el periodo (cliente queda sin saldo).

- [ ] **Step 9: Commit (solo si el usuario lo autoriza)**

```bash
git add components/section-components/payments/modals/payment-form-modal.tsx
git commit -m "feat(pagos): toggle Pago completo/Abono en el modal de pago"
```

---

## Task 5: Equivalente en Bs en la card de deudores

**Files:**
- Modify: `components/section-components/payments/PaymentsMainComponent.tsx` (import líneas 17-19; valor de tasa cerca de la línea 63; celda `Saldo` línea 325)

**Interfaces:**
- Consumes: `formatBs` (Task 1); `exchangeRates` (ya cargado vía `useQuery(["exchange-rates"])`).
- Produces: la celda `Saldo` de la card de deudores muestra el USD y, debajo, el equivalente en Bs (BCV) cuando hay tasa.

- [ ] **Step 1: Importar `formatBs`**

Tras la línea 19 (`import { getPaymentsFundsSummaryByMonth, getExchangeRates } from "@/lib/actions/funds"`), añadir:

```tsx
import { formatBs } from "@/lib/utils"
```

- [ ] **Step 2: Tasa BCV real para el equivalente en Bs**

`bcvRate` existente (línea 63) usa fallback `|| 1`, que no distingue "sin tasa" de "tasa 1". Añadir un valor dedicado para el display, justo después de la línea 65 (`const customRate = ...`):

```tsx
  const bcvRateForBs = Number(exchangeRates.find((r: any) => r.type === "BCV")?.rate ?? 0)
```

- [ ] **Step 3: Mostrar el saldo en Bs en la celda**

Reemplazar la celda `Saldo` (línea 325):

```tsx
                        <TableCell className="font-medium text-yellow-500">${Number(member.balance_due).toFixed(2)}</TableCell>
```

por:

```tsx
                        <TableCell className="font-medium text-yellow-500">
                          ${Number(member.balance_due).toFixed(2)}
                          {bcvRateForBs > 0 && (
                            <span className="block text-xs font-normal text-muted-foreground">
                              ≈ {formatBs(Number(member.balance_due) * bcvRateForBs)} (BCV)
                            </span>
                          )}
                        </TableCell>
```

- [ ] **Step 4: Verificar tipos**

Run: `npx tsc --noEmit`
Expected: sin errores.

- [ ] **Step 5: Prueba manual**

Run: `npm run dev` → ir a Pagos, ver la card "Clientes con saldo pendiente".
Expected: cada fila muestra el saldo en USD y, debajo, "≈ Bs Y (BCV)".

- [ ] **Step 6: Commit (solo si el usuario lo autoriza)**

```bash
git add components/section-components/payments/PaymentsMainComponent.tsx
git commit -m "feat(pagos): saldo equivalente en Bs en la card de deudores"
```

---

## Verificación final

- [ ] `npx tsc --noEmit` sin errores en todo el proyecto.
- [ ] `npm run build` completa sin errores.
- [ ] Recorrido manual end-to-end:
  1. Registrar un **pago completo** a un cliente sin saldo → no permite monto parcial; el cliente queda sin saldo.
  2. Cambiar a **Abono** y registrar un parcial → el cliente queda con saldo; el modal y la card de deudores muestran el saldo en USD y en Bs.
  3. Registrar un segundo abono que cubre el resto → saldo a 0, sin re-avanzar la fecha de corte.
  4. Cambiar BCV/USDT en el modal recalcula los bolívares mostrados y el monto bloqueado.
  5. "Solvencia sin ingreso" no muestra toggle y salda el periodo.
