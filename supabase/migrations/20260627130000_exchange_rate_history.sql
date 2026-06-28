-- Histórico diario de tasas de cambio: un snapshot por tipo por día.
create table if not exists public.exchange_rate_history (
  date date not null,
  type text not null,
  rate numeric not null,
  primary key (date, type)
);
comment on table public.exchange_rate_history is 'Snapshot diario de tasas; ultima escritura del dia gana. Alimentada por trigger desde exchange_rates.';

-- Captura automatica: cada cambio de rate en exchange_rates guarda/actualiza el dia actual (hora Venezuela).
-- ponytail: la captura vive en la BD (trigger), no en la app; cualquier UPDATE de tasa queda historiado sin tocar codigo.
create or replace function public.record_rate_history() returns trigger
language plpgsql security definer set search_path = public as $$
begin
  insert into public.exchange_rate_history (date, type, rate)
  values ((now() at time zone 'America/Caracas')::date, new.type, new.rate)
  on conflict (date, type) do update set rate = excluded.rate;
  return new;
end;
$$;

drop trigger if exists trg_record_rate_history on public.exchange_rates;
create trigger trg_record_rate_history
  after insert or update of rate on public.exchange_rates
  for each row execute function public.record_rate_history();

-- RLS: lectura publica (igual que exchange_rates); escritura solo via trigger (definer).
alter table public.exchange_rate_history enable row level security;
drop policy if exists "Allow read exchange_rate_history" on public.exchange_rate_history;
create policy "Allow read exchange_rate_history" on public.exchange_rate_history for select using (true);

-- Semilla: registrar las tasas actuales como snapshot de hoy.
insert into public.exchange_rate_history (date, type, rate)
select (now() at time zone 'America/Caracas')::date, type, rate from public.exchange_rates
on conflict (date, type) do update set rate = excluded.rate;
