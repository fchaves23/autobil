-- =====================================================================
-- Autobil — ZERAR TODOS OS DADOS E USUÁRIOS
-- ATENÇÃO: apaga contas, carros, lançamentos, viagens, lembretes, convites
-- e pagamentos. NÃO TEM VOLTA. A estrutura (tabelas, regras, funções) e a
-- lista de administradores (app_admins) continuam.
-- =====================================================================

truncate table
  public.settlements,
  public.entries,
  public.reminders,
  public.trips,
  public.vehicle_invites,
  public.vehicle_members,
  public.vehicles,
  public.profiles
cascade;

delete from auth.users;

-- Confere: tudo deve aparecer zerado
select
  (select count(*) from auth.users) as usuarios,
  (select count(*) from public.vehicles) as carros,
  (select count(*) from public.entries) as lancamentos,
  (select count(*) from public.app_admins) as administradores;
