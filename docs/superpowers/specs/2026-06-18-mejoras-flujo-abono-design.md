# Diseño: Mejoras al flujo de abono (toggle + saldo en Bs)

**Fecha:** 2026-06-18
**Estado:** Aprobado (pendiente de plan de implementación)
**Sección afectada:** Pagos (modal de registro, card de deudores)
**Base:** Extiende el sistema de abonos descrito en `2026-06-17-pagos-por-abonos-design.md`.

---

## Problema

Dos mejoras al flujo de abono ya existente:

1. **Elegir explícitamente** si un pago se registra como **abono** (parcial) o como **pago completo**.
   Hoy el sistema lo **infiere** del monto (si no cubre el precio del plan → abono); no hay control manual,
   y se puede registrar un parcial por error cuando se quería un pago completo.
2. **Visibilidad del saldo en bolívares.** El saldo ya se lleva normalizado en **USD** (`members.balance_due`),
   y al registrar el siguiente pago en Bs el monto se recalcula con la tasa del día — **esto ya funciona
   correctamente**. Lo que falta es **mostrar** ese saldo también en Bs a la tasa de hoy, para que el
   administrador vea cuántos bolívares cobrar sin calcular a mano.

> Ejemplo confirmado: plan $30. Día 1, tasa 590 → abona 10.000 Bs (≈ 16,95 $), saldo = **13,05 $**.
> Día 2, tasa 600 → el modal pide 13,05 × 600 = **7.830 Bs**. El saldo se guarda en USD y se reconvierte
> a Bs con la tasa del día. Correcto; solo hay que hacerlo visible.

## Decisiones de negocio (confirmadas con el usuario)

1. **Toggle abono/completo:** en modo "Pago completo" **no se permite un monto parcial** — el campo se
   autollena al total y queda de solo lectura. El parcial solo se admite en modo "Abono".
2. **Punto #2 es solo visibilidad:** el cálculo en USD ya es correcto; se añade el equivalente en Bs.
3. **Alcance del equivalente en Bs:** **modal de pago + card "Clientes con saldo pendiente"**.
   (No se toca el badge "Debe $X" de la lista de Clientes.)
4. **Tasa por defecto:** **BCV**, editable con los botones BCV/USDT existentes.

## Contexto del sistema actual (hallazgos de la exploración)

- `members.balance_due` (numeric) guarda el **saldo en USD**. `payments.is_installment` (boolean) marca abonos.
  **Ambas columnas ya existen → no hay migración.**
- `lib/actions/payments.ts → createPayment`: deriva `is_installment` y el nuevo saldo a partir del monto:
  - "abre periodo" (`balance_due <= 0`): `remaining = precioPlanUsd`; `is_installment = nuevoSaldo > 0`.
  - "continúa periodo" (`balance_due > 0`): `remaining = balance_due`; `is_installment = true`.
  - Topa el sobrepago al `remaining`; suma el monto real al fondo; respeta `frozen`.
- `lib/utils.ts → toUsd(amount, method, rate)`: Bs → `amount/rate`; USD/USDT → `amount`.
  `BS_PAYMENT_METHODS = ["Pago Movil", "Efectivo bs", "Transferencia BS"]`.
- Modal `payment-form-modal.tsx`:
  - Estado `rateType` ("bcv" | "usdt"); `activeRate` = tasa elegida; sincroniza `payment_rate` por `useEffect`.
  - `remainingUsd = balanceDue > 0 ? balanceDue : planPriceUsd`.
  - Autollena el monto a `remainingUsd * activeRate` (Bs) o `remainingUsd` (USD) en varios handlers.
  - Badge "Saldo pendiente: $X" (cuando `balanceDue > 0`) y texto "dejará un saldo de $Y".
  - Valida sobrepago (topa al saldo) y exige tasa para métodos en Bs.
- `PaymentsMainComponent.tsx`: card "Clientes con saldo pendiente" con columna `Saldo` = `$balance_due`
  y botón "Registrar abono". **No** carga `getExchangeRates` actualmente.

**Consecuencia:** como el servidor ya deriva `is_installment` y el saldo del monto, el toggle es
principalmente una **guarda de UX** (controla si el campo monto es editable). El punto #2 es **solo
presentación**. No hay cambios en fondos, cierres ni dashboard.

---

## 1. Toggle "Pago completo / Abono" — `payment-form-modal.tsx`

- **Control:** segmentado de dos botones (mismo patrón visual que los botones BCV/USDT existentes) con
  estado local `paymentType: "full" | "installment"`. Se ubica encima del campo Monto.
- **Visibilidad:** solo al **registrar** (`!isEditing`). En edición no se muestra (la ruta de edición ya
  tiene su propio ajuste de saldo en `updatePayment`).
- **Default:** `installment` si el miembro seleccionado tiene `balance_due > 0`; si no, `full`.
  Se recalcula al cambiar de miembro.
- **Modo "full" (Pago completo):**
  - El campo Monto se autollena al total restante en la moneda del método
    (`remainingUsd * activeRate` para Bs, `remainingUsd` para USD/USDT) y queda **`readOnly`**.
  - Se recalcula cuando cambian: método, tipo de tasa (BCV/USDT), valor de la tasa, plan o miembro.
  - El resultado en el servidor: salda el periodo (`balance_due = 0`, `is_installment = false`).
- **Modo "installment" (Abono):**
  - El campo Monto queda **editable** (comportamiento actual), con el tope de sobrepago vigente.
- **Método "Solvencia sin ingreso":** el toggle se **oculta** (siempre salda el periodo; el servidor ya
  pone `balance_due = 0`, `is_installment = false`, sin tocar fondos).
- **Envío:** `onSubmit` incluye `enforceFullPayment: paymentType === "full"` para la guarda server-side.

## 2. Guarda server-side — `lib/actions/payments.ts → createPayment`

- Firma ampliada: `createPayment(payment, options?: { enforceFullPayment?: boolean })`.
- Si `options.enforceFullPayment === true` y `payment.method !== "Solvencia sin ingreso"`:
  calcular `abonoUsd = toUsd(amount, method, payment_rate)` y `remaining` (igual que la lógica actual:
  `balance_due > 0 ? balance_due : precioPlanUsd`). Si `abonoUsd < remaining - 0.01` → `throw new Error(...)`
  ("El pago completo no cubre el total del periodo."). No persiste nada.
- El resto de la lógica de `createPayment` **no cambia**. `options` es opcional → llamadas existentes
  (otras secciones) siguen funcionando sin tocarse.

## 3. Equivalente en Bs

### Helper `lib/utils.ts → formatBs(amount: number): string`

- Formatea con `Intl.NumberFormat("es-VE", { minimumFractionDigits: 2, maximumFractionDigits: 2 })`
  y prefijo `Bs ` → ej. `Bs 7.830,00`. Devuelve `Bs 0,00` para valores no válidos / `<= 0`.

### a) Modal — `payment-form-modal.tsx`

- Badge "Saldo pendiente: $X" → añadir `≈ {formatBs(balanceDue * activeRate)}` (cuando `activeRate > 0`).
- Texto "Este abono dejará un saldo de $Y" → añadir `≈ {formatBs(resultingBalanceUsd * activeRate)}`.
- Usa la `activeRate` ya existente (BCV por defecto; cambia con los botones BCV/USDT).

### b) Card de deudores — `PaymentsMainComponent.tsx`

- Añadir query `useQuery({ queryKey: ["exchange-rates"], queryFn: getExchangeRates })` (misma key que el
  modal → comparte caché). Obtener `bcvRate = rates.find(r => r.type === "BCV")?.rate`.
- En la columna `Saldo`: bajo el `$balance_due` mostrar, en texto pequeño, `≈ {formatBs(balance_due * bcvRate)}`
  con etiqueta "(BCV)" cuando `bcvRate > 0`. Si no hay tasa, solo el USD.

---

## Casos especiales

- **"Solvencia sin ingreso":** sin toggle; sin guarda de pago completo; comportamiento de saldo intacto.
- **Edición de pago (`isEditing`):** sin toggle; `updatePayment` no cambia.
- **Miembro congelado (`frozen`):** sin cambios (el toggle/visibilidad no afectan el estado).
- **Sin tasa cargada:** el equivalente en Bs no se muestra (o se omite); el toggle "full" en método Bs
  ya depende de la tasa, igual que hoy.
- **Llamadas a `createPayment` desde otras secciones:** `options` opcional → sin impacto.

## Permisos y alcance

- Reutiliza `payments.edit` (registrar) y `payments.view` (ver deudores). Sin permisos nuevos.
- Sin migración de base de datos. Sin cambios en `funds.ts`, `closings.ts`, dashboard ni en el badge
  "Debe $X" de la lista de Clientes.

---

## Criterios de aceptación

1. En "Pago completo", el campo Monto está autollenado al total y es de solo lectura; no se puede registrar
   un parcial. Cambiar método/tasa/plan recalcula el monto bloqueado.
2. En "Abono", el campo Monto es editable y admite parciales (con el tope de sobrepago existente).
3. El toggle arranca en "Abono" si el cliente tiene `balance_due > 0`, y en "Pago completo" si no.
4. Si se evade la UI y se envía un "pago completo" con monto insuficiente, `createPayment` lo rechaza.
5. El modal muestra el saldo pendiente y el saldo resultante con su equivalente en Bs a la tasa activa
   (BCV por defecto, recalculado al cambiar a USDT).
6. La card "Clientes con saldo pendiente" muestra el saldo en USD y su equivalente en Bs (BCV).
7. El saldo sigue almacenándose en USD; el equivalente en Bs refleja la tasa del día (ya existente).
8. "Solvencia sin ingreso" no muestra el toggle y salda el periodo como hoy.
9. Editar un pago no muestra el toggle y conserva el comportamiento actual de `updatePayment`.
10. Fondos, cierres y dashboard siguen cuadrando; las llamadas a `createPayment` desde otras secciones
    no se rompen.
