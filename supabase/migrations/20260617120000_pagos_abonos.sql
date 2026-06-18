-- Soporte para pagos por abonos / cuotas de mensualidad

-- Saldo pendiente del periodo actual del miembro, normalizado en USD.
alter table public.members
  add column if not exists balance_due numeric not null default 0;

-- Marca si una fila de pago es un abono parcial (no la mensualidad completa).
alter table public.payments
  add column if not exists is_installment boolean not null default false;

comment on column public.members.balance_due is 'Saldo pendiente del periodo actual en USD (abonos/cuotas).';
comment on column public.payments.is_installment is 'true si el pago es un abono parcial de la mensualidad.';
