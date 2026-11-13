-- =====================================================================
-- FIRE Agent Command Center — LAB-003 (OPERATIONAL CORE)
-- Migração 0002 — "rls"
--
-- Objetivo: Row Level Security + isolamento entre organizações + autorização
-- por papel (proprietário, administrador, operador, revisor, observador).
--
-- Modelo de identidade (ENDURECIDO no LAB-004):
--   - app.usuario_atual()      → uuid do usuário autenticado, SEMPRE via auth.uid().
--   - app.organizacao_atual()  → organização do usuário autenticado.
--   - app.papel_atual()        → papel do usuário autenticado.
--
-- CORREÇÃO OBRIGATÓRIA (LAB-004): a versão anterior aceitava
-- current_setting('app.usuario_id', true) como identidade ALTERNATIVA. Isso
-- permitia FALSIFICAÇÃO DE IDENTIDADE por qualquer sessão capaz de ajustar esse
-- parâmetro — escalada de privilégio e quebra do isolamento entre organizações.
-- Esse caminho foi REMOVIDO do código de produção: a identidade vem
-- exclusivamente de auth.uid(), preenchido pelo Supabase a partir do JWT
-- verificado (não controlável pelo usuário).
-- Identidades de teste existem SOMENTE em ambiente local isolado
-- (backend/migrations/local/0000_auth_stub_local.sql), que nunca é aplicado em
-- banco real/homologação/produção.
--
-- !!! NÃO APLIQUE SEM AUTORIZAÇÃO (a guarda abaixo bloqueia por padrão) !!!
-- =====================================================================

do $$
begin
  if coalesce(current_setting('fire.allow_migrations', true), '') <> 'authorized' then
    raise exception
      'Migração 0002 bloqueada: defina fire.allow_migrations = ''authorized'' apenas em ambiente autorizado.';
  end if;
end
$$;

create schema if not exists app;

-- ---------------------------------------------------------------------
-- Funções auxiliares de identidade
-- ---------------------------------------------------------------------
-- Identidade autenticada confiável. auth.uid() resolve o "sub" do JWT
-- verificado (request.jwt.claim.sub). NÃO existe caminho alternativo por GUC —
-- essa era exatamente a falha corrigida no LAB-004.
create or replace function app.usuario_atual() returns uuid
language sql stable as $$
  select auth.uid();
$$;

create or replace function app.organizacao_atual() returns uuid
language sql stable security definer set search_path = public, pg_temp as $$
  select organizacao_id
    from public.usuarios
   where id = app.usuario_atual()
     and ativo
   limit 1;
$$;

create or replace function app.papel_atual() returns text
language sql stable security definer set search_path = public, pg_temp as $$
  select papel::text
    from public.usuarios
   where id = app.usuario_atual()
     and ativo
   limit 1;
$$;

-- Papéis com poder de leitura ampla e de gestão dentro da organização.
create or replace function app.papel_tem_acesso_total() returns boolean
language sql stable as $$
  select app.papel_atual() in ('proprietario', 'administrador');
$$;

create or replace function app.pode_registrar() returns boolean
language sql stable as $$
  select app.papel_atual() in ('proprietario', 'administrador', 'operador', 'revisor');
$$;

create or replace function app.pode_verificar() returns boolean
language sql stable as $$
  select app.papel_atual() in ('proprietario', 'administrador', 'revisor');
$$;

create or replace function app.pode_aprovar() returns boolean
language sql stable as $$
  select app.papel_atual() in ('proprietario', 'administrador', 'revisor');
$$;

-- ---------------------------------------------------------------------
-- Ativação de RLS em todas as tabelas de dados
-- ---------------------------------------------------------------------
alter table public.organizacoes       enable row level security;
alter table public.usuarios           enable row level security;
alter table public.agentes            enable row level security;
alter table public.projetos           enable row level security;
alter table public.missoes            enable row level security;
alter table public.missao_dependencias enable row level security;
alter table public.mission_runs       enable row level security;
alter table public.run_attempts       enable row level security;
alter table public.run_eventos        enable row level security;
alter table public.evidencias         enable row level security;
alter table public.aprovacoes         enable row level security;
alter table public.audit_log          enable row level security;
alter table public.usage_metrics      enable row level security;

-- ---------------------------------------------------------------------
-- Organizações: o usuário só enxerga a própria organização.
-- ---------------------------------------------------------------------
drop policy if exists organizacoes_isolamento on public.organizacoes;
create policy organizacoes_isolamento on public.organizacoes
  for select using (id = app.organizacao_atual());

-- ---------------------------------------------------------------------
-- Usuários: mesma organização; escrita apenas por gestores.
-- ---------------------------------------------------------------------
drop policy if exists usuarios_leitura on public.usuarios;
create policy usuarios_leitura on public.usuarios
  for select using (organizacao_id = app.organizacao_atual());

drop policy if exists usuarios_escrita on public.usuarios;
create policy usuarios_escrita on public.usuarios
  for all using (
    organizacao_id = app.organizacao_atual() and app.papel_tem_acesso_total()
  ) with check (
    organizacao_id = app.organizacao_atual() and app.papel_tem_acesso_total()
  );

-- ---------------------------------------------------------------------
-- Tabelas com coluna organizacao_id direta: isolamento por organização.
-- Padrão: leitura para membros; escrita para gestores (acesso total).
-- ---------------------------------------------------------------------
do $$
declare
  tabela text;
  com_escrita_gestor text[] := array[
    'agentes', 'projetos', 'missoes'
  ];
begin
  foreach tabela in array array['agentes', 'projetos', 'missoes', 'evidencias'] loop
    execute format('drop policy if exists %I on public.%I', tabela || '_leitura', tabela);
    execute format(
      'create policy %I on public.%I for select using (organizacao_id = app.organizacao_atual())',
      tabela || '_leitura', tabela
    );
  end loop;

  -- Escrita de cadastros estruturais apenas por gestores.
  foreach tabela in array com_escrita_gestor loop
    execute format('drop policy if exists %I on public.%I', tabela || '_escrita', tabela);
    execute format(
      'create policy %I on public.%I for all using (organizacao_id = app.organizacao_atual() and app.papel_tem_acesso_total()) with check (organizacao_id = app.organizacao_atual() and app.papel_tem_acesso_total())',
      tabela || '_escrita', tabela
    );
  end loop;
end
$$;

-- Evidências: registro por papéis operacionais; verificação por revisores.
drop policy if exists evidencias_registro on public.evidencias;
create policy evidencias_registro on public.evidencias
  for insert with check (
    organizacao_id = app.organizacao_atual() and app.pode_registrar()
  );

drop policy if exists evidencias_atualizacao on public.evidencias;
create policy evidencias_atualizacao on public.evidencias
  for update using (
    organizacao_id = app.organizacao_atual() and app.pode_verificar()
  ) with check (
    organizacao_id = app.organizacao_atual()
  );

-- ---------------------------------------------------------------------
-- Execuções do motor: isolamento por organização; escrita operacional.
-- ---------------------------------------------------------------------
drop policy if exists mission_runs_leitura on public.mission_runs;
create policy mission_runs_leitura on public.mission_runs
  for select using (organizacao_id = app.organizacao_atual());

drop policy if exists mission_runs_escrita on public.mission_runs;
create policy mission_runs_escrita on public.mission_runs
  for all using (organizacao_id = app.organizacao_atual() and app.pode_registrar())
  with check (organizacao_id = app.organizacao_atual() and app.pode_registrar());

-- Filhas de runs: acesso derivado do run pai (subquery respeita RLS do pai).
drop policy if exists run_attempts_acesso on public.run_attempts;
create policy run_attempts_acesso on public.run_attempts
  for all using (
    exists (select 1 from public.mission_runs r where r.id = run_id)
  ) with check (
    exists (select 1 from public.mission_runs r where r.id = run_id)
  );

drop policy if exists run_eventos_acesso on public.run_eventos;
create policy run_eventos_acesso on public.run_eventos
  for all using (
    exists (select 1 from public.mission_runs r where r.id = run_id)
  ) with check (
    exists (select 1 from public.mission_runs r where r.id = run_id)
  );

-- Dependências de missão: derivadas das missões visíveis.
drop policy if exists missao_dependencias_acesso on public.missao_dependencias;
create policy missao_dependencias_acesso on public.missao_dependencias
  for all using (
    exists (select 1 from public.missoes m where m.id = missao_id)
  ) with check (
    exists (select 1 from public.missoes m where m.id = missao_id)
  );

-- ---------------------------------------------------------------------
-- Aprovações: leitura para membros; decisão apenas por aprovadores.
-- ---------------------------------------------------------------------
drop policy if exists aprovacoes_leitura on public.aprovacoes;
create policy aprovacoes_leitura on public.aprovacoes
  for select using (organizacao_id = app.organizacao_atual());

drop policy if exists aprovacoes_solicitacao on public.aprovacoes;
create policy aprovacoes_solicitacao on public.aprovacoes
  for insert with check (
    organizacao_id = app.organizacao_atual() and app.pode_registrar()
  );

drop policy if exists aprovacoes_decisao on public.aprovacoes;
create policy aprovacoes_decisao on public.aprovacoes
  for update using (
    organizacao_id = app.organizacao_atual() and app.pode_aprovar()
  ) with check (organizacao_id = app.organizacao_atual());

-- ---------------------------------------------------------------------
-- Auditoria: leitura para membros; inserção operacional; sem exclusão.
-- ---------------------------------------------------------------------
drop policy if exists audit_log_leitura on public.audit_log;
create policy audit_log_leitura on public.audit_log
  for select using (organizacao_id = app.organizacao_atual());

drop policy if exists audit_log_insercao on public.audit_log;
create policy audit_log_insercao on public.audit_log
  for insert with check (organizacao_id = app.organizacao_atual());

-- ---------------------------------------------------------------------
-- Consumo: leitura por membros; escrita por papéis operacionais.
-- ---------------------------------------------------------------------
drop policy if exists usage_metrics_leitura on public.usage_metrics;
create policy usage_metrics_leitura on public.usage_metrics
  for select using (organizacao_id = app.organizacao_atual());

drop policy if exists usage_metrics_escrita on public.usage_metrics;
create policy usage_metrics_escrita on public.usage_metrics
  for insert with check (
    organizacao_id = app.organizacao_atual() and app.pode_registrar()
  );

insert into public.schema_migrations (versao, nome)
values ('0002', 'rls')
on conflict (versao) do nothing;
