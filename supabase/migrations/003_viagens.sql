-- =====================================================================
-- Autobil — atualização 003: viagens
-- Rode depois da 002, em: Supabase > SQL Editor > New query.
-- Pode rodar de novo sem problema.
--
-- Cada viagem pertence a um carro. Os lançamentos podem apontar para uma
-- viagem (trip_id); eles continuam contando nos números gerais do carro.
-- Todas as pessoas do carro (donos e motoristas) criam e editam viagens.
-- =====================================================================

create table if not exists public.trips (
  id uuid primary key default gen_random_uuid(),
  vehicle_id uuid not null references public.vehicles (id) on delete cascade,
  name text not null,
  start_date date not null default current_date,
  end_date date,
  notes text not null default '',
  created_by uuid default auth.uid() references public.profiles (id) on delete set null,
  created_at timestamptz not null default now()
);
create index if not exists trips_vehicle_idx on public.trips (vehicle_id, start_date desc);

alter table public.entries add column if not exists trip_id uuid references public.trips (id) on delete set null;
create index if not exists entries_trip_idx on public.entries (trip_id);

alter table public.trips enable row level security;

drop policy if exists trips_all on public.trips;
create policy trips_all on public.trips for all
  using (public.is_vehicle_member(vehicle_id))
  with check (public.is_vehicle_member(vehicle_id));

-- Um lançamento só pode apontar para uma viagem do mesmo carro
create or replace function public.check_entry_trip()
returns trigger
language plpgsql
as $$
begin
  if new.trip_id is not null and not exists (
    select 1 from public.trips t where t.id = new.trip_id and t.vehicle_id = new.vehicle_id
  ) then
    raise exception 'Essa viagem é de outro carro.';
  end if;
  return new;
end;
$$;

drop trigger if exists check_entry_trip on public.entries;
create trigger check_entry_trip
  before insert or update on public.entries
  for each row execute function public.check_entry_trip();
