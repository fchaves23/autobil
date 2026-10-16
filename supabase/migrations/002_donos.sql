-- =====================================================================
-- Autobil — atualização 002: vários donos por carro e permissões
-- Rode este arquivo inteiro uma vez em: Supabase > SQL Editor > New query.
-- Pode rodar de novo sem problema.
--
-- Dono:      edita o carro, convida/remove pessoas, muda papéis, exclui o carro.
-- Motorista: vê tudo e lança/edita gastos e lembretes, mas não mexe no carro.
-- =====================================================================

-- "Dono" agora é quem tem papel owner no carro (pode haver vários)
create or replace function public.is_vehicle_owner(vid uuid)
returns boolean
language sql
stable
security definer
set search_path = public
as $$
  select exists (
    select 1 from public.vehicle_members m
    where m.vehicle_id = vid and m.user_id = auth.uid() and m.role = 'owner'
  );
$$;

-- Carro: só donos editam e excluem
drop policy if exists vehicles_update on public.vehicles;
create policy vehicles_update on public.vehicles for update
  using (public.is_vehicle_owner(id))
  with check (public.is_vehicle_owner(id));

drop policy if exists vehicles_delete on public.vehicles;
create policy vehicles_delete on public.vehicles for delete
  using (public.is_vehicle_owner(id));

-- Pessoas do carro: dono remove qualquer um; cada pessoa pode sair sozinha
drop policy if exists members_delete on public.vehicle_members;
create policy members_delete on public.vehicle_members for delete
  using (public.is_vehicle_owner(vehicle_id) or user_id = auth.uid());

-- Sempre sobra pelo menos um dono (exceto quando o carro inteiro é excluído)
create or replace function public.keep_one_owner()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  if old.role <> 'owner' then
    return coalesce(new, old);
  end if;
  if tg_op = 'UPDATE' and new.role = 'owner' then
    return new;
  end if;
  if not exists (select 1 from public.vehicles where id = old.vehicle_id) then
    return coalesce(new, old); -- carro sendo excluído
  end if;
  if not exists (
    select 1 from public.vehicle_members
    where vehicle_id = old.vehicle_id and role = 'owner' and user_id <> old.user_id
  ) then
    raise exception 'O carro precisa de pelo menos um dono. Torne outra pessoa dono antes.';
  end if;
  return coalesce(new, old);
end;
$$;

drop trigger if exists keep_one_owner on public.vehicle_members;
create trigger keep_one_owner
  before update or delete on public.vehicle_members
  for each row execute function public.keep_one_owner();

-- Dono muda o papel de alguém (owner <-> driver)
create or replace function public.set_member_role(vid uuid, uid uuid, new_role text)
returns void
language plpgsql
security definer
set search_path = public
as $$
begin
  if not public.is_vehicle_owner(vid) then
    raise exception 'Só um dono do carro pode mudar quem é dono.';
  end if;
  if new_role not in ('owner', 'driver') then
    raise exception 'Papel inválido.';
  end if;
  update public.vehicle_members set role = new_role
  where vehicle_id = vid and user_id = uid;
  if not found then
    raise exception 'Essa pessoa não está neste carro.';
  end if;
end;
$$;

grant execute on function public.set_member_role(uuid, uuid, text) to authenticated;
