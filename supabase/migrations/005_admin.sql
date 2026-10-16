-- =====================================================================
-- Autobil — atualização 005: painel do administrador
-- Rode depois da 004, em: Supabase > SQL Editor > New query.
-- Pode rodar de novo sem problema.
--
-- Administradores ficam na tabela app_admins (por e-mail). Só eles conseguem
-- usar as funções admin_* abaixo; para todo o resto elas recusam.
-- =====================================================================

create table if not exists public.app_admins (
  email text primary key,
  created_at timestamptz not null default now()
);
alter table public.app_admins enable row level security; -- sem políticas: ninguém lê pela API

insert into public.app_admins (email) values ('agoravaitrip@gmail.com') on conflict do nothing;

create or replace function public.is_app_admin()
returns boolean
language sql
stable
security definer
set search_path = public
as $$
  select exists (
    select 1 from public.app_admins a
    join auth.users u on lower(u.email) = lower(a.email)
    where u.id = auth.uid()
  );
$$;

-- Números gerais
create or replace function public.admin_overview()
returns json
language plpgsql
stable
security definer
set search_path = public
as $$
begin
  if not public.is_app_admin() then raise exception 'Acesso só para administradores.'; end if;
  return json_build_object(
    'users', (select count(*) from auth.users),
    'users_30d', (select count(*) from auth.users where created_at > now() - interval '30 days'),
    'active_7d', (select count(*) from auth.users where last_sign_in_at > now() - interval '7 days'),
    'vehicles', (select count(*) from public.vehicles),
    'entries', (select count(*) from public.entries),
    'entries_30d', (select count(*) from public.entries where created_at > now() - interval '30 days'),
    'trips', (select count(*) from public.trips),
    'total_spent', (select coalesce(sum(amount), 0) from public.entries)
  );
end;
$$;

-- Lista de usuários
create or replace function public.admin_users()
returns table (
  id uuid, name text, email text, avatar_url text, created_at timestamptz, last_sign_in_at timestamptz,
  disabled boolean, is_admin boolean, vehicles bigint, entries bigint
)
language plpgsql
stable
security definer
set search_path = public
as $$
begin
  if not public.is_app_admin() then raise exception 'Acesso só para administradores.'; end if;
  return query
    select u.id, coalesce(p.name, ''), u.email::text, p.avatar_url, u.created_at, u.last_sign_in_at,
      (u.banned_until is not null and u.banned_until > now()),
      exists (select 1 from public.app_admins a where lower(a.email) = lower(u.email)),
      (select count(*) from public.vehicle_members m where m.user_id = u.id),
      (select count(*) from public.entries e where e.user_id = u.id)
    from auth.users u
    left join public.profiles p on p.id = u.id
    order by u.created_at desc;
end;
$$;

-- Lista de carros
create or replace function public.admin_vehicles()
returns table (
  id uuid, name text, plate text, brand text, model text, created_at timestamptz,
  owners text, people bigint, entries bigint, total_spent numeric, last_entry date
)
language plpgsql
stable
security definer
set search_path = public
as $$
begin
  if not public.is_app_admin() then raise exception 'Acesso só para administradores.'; end if;
  return query
    select v.id, v.name, v.plate, v.brand, v.model, v.created_at,
      coalesce((select string_agg(coalesce(nullif(p.name, ''), p.email), ', ')
                from public.vehicle_members m join public.profiles p on p.id = m.user_id
                where m.vehicle_id = v.id and m.role = 'owner'), ''),
      (select count(*) from public.vehicle_members m where m.vehicle_id = v.id),
      (select count(*) from public.entries e where e.vehicle_id = v.id),
      (select coalesce(sum(e.amount), 0) from public.entries e where e.vehicle_id = v.id),
      (select max(e.date) from public.entries e where e.vehicle_id = v.id)
    from public.vehicles v
    order by v.created_at desc;
end;
$$;

-- Desativar / reativar uma conta (a pessoa não consegue mais entrar)
create or replace function public.admin_set_user_disabled(uid uuid, disabled boolean)
returns void
language plpgsql
security definer
set search_path = public
as $$
begin
  if not public.is_app_admin() then raise exception 'Acesso só para administradores.'; end if;
  if uid = auth.uid() then raise exception 'Você não pode desativar a própria conta.'; end if;
  update auth.users set banned_until = case when disabled then 'infinity'::timestamptz else null end where id = uid;
end;
$$;

-- Excluir uma conta. Carros em que ela é a única dona são excluídos junto.
create or replace function public.admin_delete_user(uid uuid)
returns void
language plpgsql
security definer
set search_path = public
as $$
begin
  if not public.is_app_admin() then raise exception 'Acesso só para administradores.'; end if;
  if uid = auth.uid() then raise exception 'Você não pode excluir a própria conta por aqui.'; end if;
  -- Carros com outro dono passam a pertencer a ele, para não sumirem
  update public.vehicles v set owner_id = (
    select m.user_id from public.vehicle_members m
    where m.vehicle_id = v.id and m.role = 'owner' and m.user_id <> uid
    limit 1
  )
  where v.owner_id = uid and exists (
    select 1 from public.vehicle_members m where m.vehicle_id = v.id and m.role = 'owner' and m.user_id <> uid
  );
  delete from public.vehicles v where v.owner_id = uid;
  delete from auth.users where id = uid;
end;
$$;

revoke all on function public.admin_overview() from public, anon;
revoke all on function public.admin_users() from public, anon;
revoke all on function public.admin_vehicles() from public, anon;
revoke all on function public.admin_set_user_disabled(uuid, boolean) from public, anon;
revoke all on function public.admin_delete_user(uuid) from public, anon;
grant execute on function public.is_app_admin() to authenticated;
grant execute on function public.admin_overview() to authenticated;
grant execute on function public.admin_users() to authenticated;
grant execute on function public.admin_vehicles() to authenticated;
grant execute on function public.admin_set_user_disabled(uuid, boolean) to authenticated;
grant execute on function public.admin_delete_user(uuid) to authenticated;

notify pgrst, 'reload schema';
