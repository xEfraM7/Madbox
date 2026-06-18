# Diseño: Pagos por abonos / cuotas de mensualidad

**Fecha:** 2026-06-17
**Estado:** Aprobado (pendiente de plan de implementación)
**Sección afectada:** Pagos, Clientes, Cierres (solo lectura)

---

## Problema

El administrador tiene clientes que no siempre pagan la mensualidad completa de una vez: quieren
**abonar por partes** (ej. un plan de $30 pagado en dos abonos de $15). El sistema actual no lo soporta:

- Cada pago registrado (`createPayment`) empuja la fecha de corte del miembro al `due_date` completo
  y lo marca `active`, sin importar si pagó el monto completo.
- No existe noción de "monto total del periodo" vs "abonado", ni de **saldo pendiente**.
- No hay forma de ver qué clientes quedaron debiendo.

## Decisiones de negocio (confirmadas con el usuario)

1. **Activación:** al **primer abono** el cliente queda **activo el mes completo**, con su **saldo pendiente
   marcado** y visible como deudor hasta cubrirlo. (Lo más común en gimnasios.)
2. **Esquema:** **abonos libres** — cualquier monto cuando el cliente pague, el sistema lleva el saldo
   (precio del plan − suma de abonos) hasta cubrirlo. Sin cuotas fijas predefinidas.
3. **Visibilidad de deudores:** **lista + indicadores** — badge "Debe $X" en listas de clientes y pagos,
   más una vista/sección de deudores con el total adeudado.
4. **Sobrepago:** **avisar y topar al saldo** — no se permite registrar más que el saldo restante.
5. **Modelo de datos:** **Enfoque 1** — saldo en el miembro (`balance_due`) + abonos marcados en `payments`.
   Mínimo cambio de esquema, reusa la lógica de fondos/cierres, consistente con el patrón actual de
   `funds.balance` (contador cacheado).

## Contexto del sistema actual (hallazgos de la exploración)

- `lib/actions/payments.ts → createPayment`: inserta el pago, copia `payment.due_date` a
  `members.payment_date`, marca `status: "active"`, y suma `amount` al fondo vía `addToFund(method, amount)`.
- `lib/actions/funds.ts`: `addToFund`/`subtractFromFund` mantienen `funds.balance` como contador cacheado
  (patrón incremental). Los reportes de fondos suman el `amount` **real** de cada pago `status = "paid"`.
- `lib/actions/closings.ts`: el cierre mensual y su preview suman el `amount` real de los pagos
  `status = "paid"` del mes. **No** asumen "1 pago = precio del plan".
- `lib/actions/members.ts → updateMemberStatuses`: marca `expired` si `payment_date < hoy` (no congelados),
  `active` si `payment_date >= hoy`. Ignora congelados.
- El precio del plan (`plans.price`) está en **USD**; un pago en Bs guarda `amount` en bolívares y
  (opcionalmente) `payment_rate`. **El saldo debe llevarse normalizado en USD.**
- El formulario de pago siempre fija `status: "paid"` y calcula `due_date` desde el día de corte.

**Consecuencia clave:** como fondos y cierres ya suman montos reales, registrar cada abono como un pago
normal con su monto real hace que **el dinero fluya correctamente sin doble conteo**. El trabajo se limita a:
(a) rastrear el saldo, (b) no re-avanzar la fecha de corte en abonos siguientes, (c) mostrar deudores.

---

## 1. Modelo de datos (migración Supabase)

**`members`** — nueva columna:
- `balance_due` `numeric NOT NULL DEFAULT 0` → saldo pendiente del periodo actual, **normalizado en USD**.

**`payments`** — nueva columna:
- `is_installment` `boolean NOT NULL DEFAULT false` → marca si la fila es un abono parcial
  (para badges/reportes).

Compatibilidad hacia atrás: las filas existentes quedan con `balance_due = 0` / `is_installment = false`;
nada cambia para los pagos completos actuales. Tras la migración se regenera `types/database.ts`.

## 2. Normalización a USD

Helper `toUsd(amount, method, payment_rate)`:

- Métodos en Bs (`Pago Movil`, `Efectivo bs`, `Transferencia BS`): `amount / payment_rate`.
  → **La tasa (`payment_rate`) pasa a ser obligatoria para abonos parciales en Bs** (sin ella no se puede
  convertir ni calcular el saldo correctamente).
- Métodos en USD (`Efectivo`, `USDT`, `Transferencia`): `amount` tal cual.

## 3. Lógica de negocio — `lib/actions/payments.ts`

### `createPayment` (ampliado)

1. Cargar el miembro (`balance_due`, `payment_date`, `frozen`, `plan_id`) y el precio del plan en USD.
   Calcular `abonoUsd = toUsd(amount, method, payment_rate)`.
2. **Caso "abre periodo"** (`balance_due <= 0`):
   - `tope = precioPlanUsd`. Si `abonoUsd > tope` → topar (defensa server; el form ya avisó).
   - `nuevoSaldo = max(0, precioPlanUsd − abonoUsd)`.
   - Actualizar miembro: `payment_date = payment.due_date`, `status = "active"` (si **no** congelado),
     `balance_due = nuevoSaldo`, `updated_at`.
   - `is_installment = nuevoSaldo > 0`.
3. **Caso "continúa periodo"** (`balance_due > 0`):
   - `tope = balance_due`. Si `abonoUsd > tope` → topar.
   - `nuevoSaldo = max(0, balance_due − abonoUsd)`.
   - Actualizar miembro: **no** cambiar `payment_date`; `balance_due = nuevoSaldo`, `updated_at`.
     (El status sigue `active`.)
   - `is_installment = true`.
4. Fondos: `addToFund(method, amount)` con el monto real (igual que hoy, **sin doble conteo**).
5. `logActivity` (`payment_registered`) incluyendo el saldo restante en `details`. `revalidatePath` igual.

### `deletePayment` (ajustado)

- Además de restar del fondo (comportamiento actual), si el pago borrado era abono (`is_installment`),
  restaurar el saldo: `balance_due += abonoUsd` del pago borrado (topado a `precioPlanUsd`).
- **No** revierte `payment_date` (consistente con el comportamiento actual: borrar un pago nunca
  des-avanzó la fecha de corte). Se documenta; el admin puede ajustar la fecha manualmente si hace falta.

### `updatePayment` (ajustado)

- Al editar `amount`/`method`/`payment_rate` de un abono, ajustar `balance_due` por la diferencia en USD
  (`oldAbonoUsd − newAbonoUsd`), topado a `[0, precioPlanUsd]`. Patrón incremental, consistente con fondos.

## 4. UI

### a) Modal de pago — `components/section-components/payments/modals/payment-form-modal.tsx`

- Si el miembro seleccionado tiene `balance_due > 0`, mostrar **"Saldo pendiente: $X"** (siempre en USD)
  destacado.
- Autollenado del campo monto:
  - Método en USD → autollenar con el saldo restante (`balance_due`) tal cual.
  - Método en Bs → autollenar con `balance_due * payment_rate` una vez ingresada la tasa; mientras no haya
    tasa, dejar el campo en blanco. (El saldo se muestra siempre en USD; el campo monto va en la moneda
    del método.)
- Texto de ayuda en vivo: **"Este abono dejará un saldo de $Y"**, con `Y = balance_due − toUsd(monto)`,
  calculado en USD según monto/método/tasa.
- Validación de **sobrepago**: si `abonoUsd` supera el saldo aplicable → advertencia (inline/toast) y topar
  el monto; no permitir guardar por encima.
- Abonos en Bs exigen `payment_rate`.

### b) Página de Pagos — `components/section-components/payments/PaymentsMainComponent.tsx`

- Nueva card **"Clientes con saldo pendiente"** (deudores), análoga a la card "Clientes con pago vencido":
  lista los miembros con `balance_due > 0`, muestra cuánto deben y un botón "Registrar abono".
  Filtra los `members` ya cargados en cliente (`members.filter(m => m.balance_due > 0)`), sin nueva query.
- Nueva KPI **"Deudores"** (conteo) junto a la card "Clientes Vencidos".
- Badge **"Abono"** en las filas del historial que sean parciales (`is_installment`).

### c) Lista de Clientes — `components/section-components/users/UsersMainComponent.tsx`

- Badge **"Debe $X"** junto al badge de estado (línea ~168) cuando `balance_due > 0`.
- Opción **"Deudores"** en el filtro de estado (`statusFilter`).

## 5. Casos especiales

- **"Solvencia sin ingreso"**: salda el periodo completo sin entrar a fondo
  (`balance_due = 0`, avanza `payment_date`, `is_installment = false`). No está en `PAYMENT_METHOD_TO_FUND`,
  así que `addToFund` ya retorna sin tocar fondos.
- **Miembro congelado (`frozen`)**: un abono actualiza `balance_due`/`payment_date` pero **no** descongela
  (el `status` sigue `frozen`).
- **Sobrepago**: topado al saldo (decisión 4).
- **Datos existentes**: `balance_due = 0` para todos; los pagos completos actuales no cambian de
  comportamiento.

## 6. Permisos y alcance

- Reutiliza permisos existentes: `payments.edit` (registrar abonos), `payments.view` (ver deudores).
  Sin permisos nuevos.
- `funds.ts`, `closings.ts` y dashboard **no requieren cambios de lógica**: ya suman montos reales y los
  abonos parciales entran naturalmente.

### Consideración abierta (cierres)

`membership_payments_count` del cierre mensual contará cada abono como un pago independiente
(antes ≈ 1 pago = 1 mensualidad completa). Es un cambio de semántica menor.
**Decisión por defecto:** aceptarlo. Alternativa si se prefiere: contar solo periodos filtrando
`is_installment = false` o contando miembros distintos. (Confirmar en revisión.)

---

## Criterios de aceptación

1. Registrar un abono menor al precio del plan deja al cliente `active` con `balance_due > 0` y suma el
   monto real al fondo correspondiente.
2. Un segundo abono que cubre el resto deja `balance_due = 0` sin volver a avanzar `payment_date` ni
   duplicar ingreso en fondos.
3. Intentar abonar más que el saldo restante muestra advertencia y topa el monto al saldo.
4. Un abono en Bs sin tasa no se puede registrar (la tasa es obligatoria para convertir a USD).
5. Los clientes con `balance_due > 0` aparecen en la sección de deudores y con badge "Debe $X" en la
   lista de clientes; el filtro "Deudores" los aísla.
6. "Solvencia sin ingreso" deja `balance_due = 0` y activa el periodo sin tocar fondos.
7. Un miembro congelado que abona sigue `frozen`.
8. Borrar un abono restaura el saldo del miembro y resta del fondo.
9. Fondos, cierres y dashboard siguen cuadrando con el dinero real recibido.
