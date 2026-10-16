-- =====================================================================
-- Autobil — atualização 004: acerto de contas
-- Rode depois da 003, em: Supabase > SQL Editor > New query.
-- Pode rodar de novo sem problema.
--
-- entries.paid_by   quem pagou (padrão: quem lançou)
-- entries.split     se o gasto entra na divisão (padrão: sim)
-- trips.participants quem divide os custos da viagem (vazio = todos do carro)
-- settlements       pagamentos entre pessoas para quitar o saldo
-- =====================================================================

alter table public.entries add column if not exists paid_by uuid references public.profiles (id) on delete set null;
alter table public.entries add column if not exists split boolean not null default true;
alter table public.entries alter column paid_by set default auth.uid();
update public.entries set paid_by = user_id where paid_by is null;

alter table public.trips add column if not exists participants uuid[] not null default '{}';

create table if not exists public.settlements (
  id uuid primary key default gen_random_uuid(),
  vehicle_id uuid not null references public.vehicles (id) on delete cascade,
  trip_id uuid references public.trips (id) on delete cascade,
  from_user uuid not null references public.profiles (id) on delete cascade,
  to_user uuid not null references public.profiles (id) on delete cascade,
  amount numeric not null check (amount > 0),
  date date not null default current_date,
  note text not null default '',
  created_by uuid default auth.uid() references public.profiles (id) on delete set null,
  created_at timestamptz not null default now(),
  check (from_user <> to_user)
);
create index if not exists settlements_vehicle_idx on public.settlements (vehicle_id, date desc);

alter table public.settlements enable row level security;

drop policy if exists settlements_all on public.settlements;
create policy settlements_all on public.settlements for all
  using (public.is_vehicle_member(vehicle_id))
  with check (public.is_vehicle_member(vehicle_id));

notify pgrst, 'reload schema';

-- ---------------------------------------------------------------------
-- Foto de perfil
-- ---------------------------------------------------------------------
alter table public.profiles add column if not exists avatar_url text;

-- Pasta pública "avatars": cada pessoa só mexe na própria subpasta (<id>/...)
insert into storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
values ('avatars', 'avatars', true, 2097152, array['image/jpeg', 'image/png', 'image/webp'])
on conflict (id) do update set public = true, file_size_limit = 2097152, allowed_mime_types = array['image/jpeg', 'image/png', 'image/webp'];

drop policy if exists avatars_read on storage.objects;
create policy avatars_read on storage.objects for select
  using (bucket_id = 'avatars');

drop policy if exists avatars_insert on storage.objects;
create policy avatars_insert on storage.objects for insert to authenticated
  with check (bucket_id = 'avatars' and (storage.foldername(name))[1] = auth.uid()::text);

drop policy if exists avatars_update on storage.objects;
create policy avatars_update on storage.objects for update to authenticated
  using (bucket_id = 'avatars' and (storage.foldername(name))[1] = auth.uid()::text);

drop policy if exists avatars_delete on storage.objects;
create policy avatars_delete on storage.objects for delete to authenticated
  using (bucket_id = 'avatars' and (storage.foldername(name))[1] = auth.uid()::text);

notify pgrst, 'reload schema';
