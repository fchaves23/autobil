-- =====================================================================
-- Autobil — esquema do banco (Supabase / Postgres)
-- Rode este arquivo inteiro uma vez em: Supabase > SQL Editor > New query.
-- Pode rodar de novo sem problema: tudo usa "if not exists"/"or replace".
-- =====================================================================

create extension if not exists pgcrypto;

-- ---------------------------------------------------------------------
-- Perfis (um por usuário do Supabase Auth)
-- ---------------------------------------------------------------------
create table if not exists public.profiles (
  id uuid primary key references auth.users (id) on delete cascade,
  name text not null default '',
  email text not null default '',
  created_at timestamptz not null default now()
);

create or replace function public.handle_new_user()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  insert into public.profiles (id, name, email)
  values (
    new.id,
    coalesce(nullif(new.raw_user_meta_data ->> 'name', ''), split_part(new.email, '@', 1)),
    lower(coalesce(new.email, ''))
  )
  on conflict (id) do nothing;
  return new;
end;
$$;

drop trigger if exists on_auth_user_created on auth.users;
create trigger on_auth_user_created
  after insert on auth.users
  for each row execute function public.handle_new_user();

-- ---------------------------------------------------------------------
-- Veículos
-- ---------------------------------------------------------------------
create or replace function public.gen_invite_code()
returns text
language sql
volatile
as $$
  -- 6 caracteres sem letras/números que se confundem (0/O, 1/I/L)
  select string_agg(substr('ABCDEFGHJKMNPQRSTUVWXYZ23456789', (floor(random() * 31) + 1)::int, 1), '')
  from generate_series(1, 6);
$$;

create table if not exists public.vehicles (
  id uuid primary key default gen_random_uuid(),
  owner_id uuid not null default auth.uid() references public.profiles (id) on delete cascade,
  name text not null,
  brand text not null default '',
  model text not null default '',
  year int,
  plate text not null default '',
  fuel_type text not null default 'flex',
  initial_odometer numeric not null default 0,
  invite_code text not null unique default public.gen_invite_code(),
  created_at timestamptz not null default now()
);

-- Quem tem acesso a cada veículo (dono + motoristas)
create table if not exists public.vehicle_members (
  vehicle_id uuid not null references public.vehicles (id) on delete cascade,
  user_id uuid not null references public.profiles (id) on delete cascade,
  role text not null default 'driver' check (role in ('owner', 'driver')),
  created_at timestamptz not null default now(),
  primary key (vehicle_id, user_id)
);

-- Convites por e-mail (viram acesso quando a pessoa entra com esse e-mail)
create table if not exists public.vehicle_invites (
  id uuid primary key default gen_random_uuid(),
  vehicle_id uuid not null references public.vehicles (id) on delete cascade,
  email text not null,
  invited_by uuid not null default auth.uid() references public.profiles (id) on delete cascade,
  created_at timestamptz not null default now(),
  unique (vehicle_id, email)
);

-- ---------------------------------------------------------------------
-- Lançamentos: abastecimentos, despesas e serviços
-- ---------------------------------------------------------------------
create table if not exists public.entries (
  id uuid primary key default gen_random_uuid(),
  vehicle_id uuid not null references public.vehicles (id) on delete cascade,
  user_id uuid default auth.uid() references public.profiles (id) on delete set null,
  kind text not null check (kind in ('fuel', 'expense', 'service')),
  date date not null default current_date,
  odometer numeric,
  amount numeric not null default 0,
  liters numeric,
  price_per_liter numeric,
  fuel_type text,
  full_tank boolean not null default true,
  category text not null default '',
  description text not null default '',
  created_at timestamptz not null default now()
);
create index if not exists entries_vehicle_date_idx on public.entries (vehicle_id, date desc);

-- Lembretes de manutenção (por km e/ou por tempo)
create table if not exists public.reminders (
  id uuid primary key default gen_random_uuid(),
  vehicle_id uuid not null references public.vehicles (id) on delete cascade,
  title text not null,
  interval_km int,
  interval_months int,
  last_km numeric,
  last_date date,
  created_by uuid default auth.uid() references public.profiles (id) on delete set null,
  created_at timestamptz not null default now()
);

-- ---------------------------------------------------------------------
-- Funções auxiliares de acesso (security definer evita recursão no RLS)
-- ---------------------------------------------------------------------
create or replace function public.is_vehicle_member(vid uuid)
returns boolean
language sql
stable
security definer
set search_path = public
as $$
  select exists (
    select 1 from public.vehicle_members m
    where m.vehicle_id = vid and m.user_id = auth.uid()
  );
$$;

create or replace function public.is_vehicle_owner(vid uuid)
returns boolean
language sql
stable
security definer
set search_path = public
as $$
  select exists (
    select 1 from public.vehicles v
    where v.id = vid and v.owner_id = auth.uid()
  );
$$;

create or replace function public.shares_vehicle_with(other uuid)
returns boolean
language sql
stable
security definer
set search_path = public
as $$
  select exists (
    select 1
    from public.vehicle_members a
    join public.vehicle_members b on a.vehicle_id = b.vehicle_id
    where a.user_id = auth.uid() and b.user_id = other
  );
$$;

-- Dono vira membro automaticamente ao cadastrar um veículo
create or replace function public.handle_new_vehicle()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  insert into public.vehicle_members (vehicle_id, user_id, role)
  values (new.id, new.owner_id, 'owner')
  on conflict do nothing;
  return new;
end;
$$;

drop trigger if exists on_vehicle_created on public.vehicles;
create trigger on_vehicle_created
  after insert on public.vehicles
  for each row execute function public.handle_new_vehicle();

-- ---------------------------------------------------------------------
-- RPCs usadas pelo app
-- ---------------------------------------------------------------------

-- Motorista entra num carro digitando o código de convite
create or replace function public.join_vehicle_by_code(code text)
returns uuid
language plpgsql
security definer
set search_path = public
as $$
declare
  vid uuid;
begin
  if auth.uid() is null then
    raise exception 'Faça login para entrar num carro.';
  end if;
  select id into vid from public.vehicles where invite_code = upper(trim(code));
  if vid is null then
    raise exception 'Código não encontrado. Confira as letras com o dono do carro.';
  end if;
  insert into public.vehicle_members (vehicle_id, user_id, role)
  values (vid, auth.uid(), 'driver')
  on conflict do nothing;
  return vid;
end;
$$;

-- Ao entrar no app, aceita convites feitos para o e-mail do usuário
create or replace function public.accept_pending_invites()
returns int
language plpgsql
security definer
set search_path = public
as $$
declare
  my_email text;
  n int := 0;
begin
  select lower(email) into my_email from auth.users where id = auth.uid();
  if my_email is null then
    return 0;
  end if;
  with accepted as (
    delete from public.vehicle_invites i
    where lower(i.email) = my_email
    returning i.vehicle_id
  ), ins as (
    insert into public.vehicle_members (vehicle_id, user_id, role)
    select vehicle_id, auth.uid(), 'driver' from accepted
    on conflict do nothing
    returning 1
  )
  select count(*) into n from ins;
  return n;
end;
$$;

-- Dono gera um novo código (o antigo deixa de valer)
create or replace function public.regenerate_invite_code(vid uuid)
returns text
language plpgsql
security definer
set search_path = public
as $$
declare
  new_code text;
begin
  if not public.is_vehicle_owner(vid) then
    raise exception 'Só o dono do carro pode trocar o código.';
  end if;
  loop
    new_code := public.gen_invite_code();
    exit when not exists (select 1 from public.vehicles where invite_code = new_code);
  end loop;
  update public.vehicles set invite_code = new_code where id = vid;
  return new_code;
end;
$$;

-- ---------------------------------------------------------------------
-- Row Level Security
-- ---------------------------------------------------------------------
alter table public.profiles enable row level security;
alter table public.vehicles enable row level security;
alter table public.vehicle_members enable row level security;
alter table public.vehicle_invites enable row level security;
alter table public.entries enable row level security;
alter table public.reminders enable row level security;

-- profiles: vejo o meu e de quem divide carro comigo; edito só o meu
drop policy if exists profiles_select on public.profiles;
create policy profiles_select on public.profiles for select
  using (id = auth.uid() or public.shares_vehicle_with(id));
drop policy if exists profiles_update on public.profiles;
create policy profiles_update on public.profiles for update
  using (id = auth.uid()) with check (id = auth.uid());

-- vehicles: membros veem e editam; qualquer usuário cadastra o seu; só o dono exclui
drop policy if exists vehicles_select on public.vehicles;
create policy vehicles_select on public.vehicles for select
  using (public.is_vehicle_member(id) or owner_id = auth.uid());
drop policy if exists vehicles_insert on public.vehicles;
create policy vehicles_insert on public.vehicles for insert
  with check (owner_id = auth.uid());
drop policy if exists vehicles_update on public.vehicles;
create policy vehicles_update on public.vehicles for update
  using (public.is_vehicle_member(id))
  with check (public.is_vehicle_member(id));
drop policy if exists vehicles_delete on public.vehicles;
create policy vehicles_delete on public.vehicles for delete
  using (owner_id = auth.uid());

-- Motorista não pode trocar o dono nem o código pela edição comum
create or replace function public.protect_vehicle_fields()
returns trigger
language plpgsql
as $$
begin
  new.owner_id := old.owner_id;
  new.invite_code := old.invite_code;
  return new;
end;
$$;
drop trigger if exists protect_vehicle_fields on public.vehicles;
create trigger protect_vehicle_fields
  before update on public.vehicles
  for each row
  when (current_user = 'authenticated')
  execute function public.protect_vehicle_fields();

-- vehicle_members: membros veem a lista; dono remove qualquer um, motorista sai sozinho
drop policy if exists members_select on public.vehicle_members;
create policy members_select on public.vehicle_members for select
  using (public.is_vehicle_member(vehicle_id));
drop policy if exists members_delete on public.vehicle_members;
create policy members_delete on public.vehicle_members for delete
  using (
    (public.is_vehicle_owner(vehicle_id) and role <> 'owner')
    or (user_id = auth.uid() and role <> 'owner')
  );

-- vehicle_invites: só o dono gerencia
drop policy if exists invites_all on public.vehicle_invites;
create policy invites_all on public.vehicle_invites for all
  using (public.is_vehicle_owner(vehicle_id))
  with check (public.is_vehicle_owner(vehicle_id));

-- entries e reminders: todos os membros do carro leem e escrevem
drop policy if exists entries_all on public.entries;
create policy entries_all on public.entries for all
  using (public.is_vehicle_member(vehicle_id))
  with check (public.is_vehicle_member(vehicle_id));

drop policy if exists reminders_all on public.reminders;
create policy reminders_all on public.reminders for all
  using (public.is_vehicle_member(vehicle_id))
  with check (public.is_vehicle_member(vehicle_id));

-- Permissões das RPCs
grant execute on function public.join_vehicle_by_code(text) to authenticated;
grant execute on function public.accept_pending_invites() to authenticated;
grant execute on function public.regenerate_invite_code(uuid) to authenticated;

-- Depois deste arquivo, rode também, em ordem, os arquivos da pasta supabase/migrations/
-- (002_donos.sql: vários donos por carro e permissões de motorista).
