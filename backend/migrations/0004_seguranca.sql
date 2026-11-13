-- =====================================================================
-- FIRE Agent Command Center — LAB-004 (REAL CONNECTIVITY & SECURE BACKEND)
-- Migração 0004 — "seguranca"
--
-- Endurecimento de segurança identificado na auditoria do LAB-003/CTO:
--   1. Imutabilidade dos registros de auditoria (append-only).
--   2. Eventos de execução append-only.
--   3. Proteção contra escalada de privilégio (troca indevida de papel) e
--      contra movimentação de usuário entre organizações.
--   4. Integridade das referências entre tenants (nenhuma referência pode
--      apontar para outra organização).
--   5. Grants de menor privilégio e revogação de acesso anônimo.
--   6. search_path seguro em TODAS as funções do schema app.
--
-- A identidade continua vindo exclusivamente de auth.uid() (ver 0002_rls.sql).
--
-- !!! NÃO APLIQUE SEM AUTORIZAÇÃO (a guarda abaixo bloqueia por padrão) !!!
-- =====================================================================

do $$
begin
  if coalesce(current_setting('fire.allow_migrations', true), '') <> 'authorized' then
    raise exception
      'Migração 0004 bloqueada: defina fire.allow_migrations = ''authorized'' apenas em ambiente autorizado.';
  end if;
end
$$;

-- ---------------------------------------------------------------------
-- 1. Auditoria imutável (append-only)
-- ---------------------------------------------------------------------
create or replace function app.auditoria_imutavel() returns trigger
language plpgsql as $$
begin
  raise exception 'Registros de auditoria são imutáveis (tentativa de %).', tg_op;
end
$$;

drop trigger if exists audit_log_imutavel on public.audit_log;
create trigger audit_log_imutavel
  before update or delete on public.audit_log
  for each row execute function app.auditoria_imutavel();

-- ---------------------------------------------------------------------
-- 2. Eventos de execução append-only
-- ---------------------------------------------------------------------
drop trigger if exists run_eventos_imutavel on public.run_eventos;
create trigger run_eventos_imutavel
  before update or delete on public.run_eventos
  for each row execute function app.auditoria_imutavel();

-- ---------------------------------------------------------------------
-- 3. Proteção de usuários: sem troca indevida de papel; sem troca de tenant.
-- ---------------------------------------------------------------------
create or replace function app.protege_usuario() returns trigger
language plpgsql security definer set search_path = public, pg_temp as $$
begin
  if new.organizacao_id is distinct from old.organizacao_id then
    raise exception 'Alteração de organizacao_id de usuário é proibida.';
  end if;

  if new.papel is distinct from old.papel
     and coalesce(current_setting('fire.service_role', true), '') <> 'authorized'
     and coalesce(app.papel_atual(), '') <> 'proprietario' then
    raise exception 'Somente o proprietário pode alterar o papel de um usuário.';
  end if;

  return new;
end
$$;

drop trigger if exists usuarios_protege on public.usuarios;
create trigger usuarios_protege
  before update on public.usuarios
  for each row execute function app.protege_usuario();

-- ---------------------------------------------------------------------
-- 4. Integridade das referências entre tenants
-- ---------------------------------------------------------------------
create or replace function app.validar_tenant() returns trigger
language plpgsql security definer set search_path = public, pg_temp as $$
declare
  org uuid := new.organizacao_id;
  ref_org uuid;
begin
  if org is null then
    return new;
  end if;

  if tg_table_name = 'projetos' then
    if new.responsavel_id is not null then
      select organizacao_id into ref_org from public.agentes where id = new.responsavel_id;
      if ref_org is distinct from org then
        raise exception 'Referência cruzada entre organizações (projetos.responsavel_id).';
      end if;
    end if;

  elsif tg_table_name = 'missoes' then
    if new.agente_id is not null then
      select organizacao_id into ref_org from public.agentes where id = new.agente_id;
      if ref_org is distinct from org then
        raise exception 'Referência cruzada entre organizações (missoes.agente_id).';
      end if;
    end if;
    if new.projeto_id is not null then
      select organizacao_id into ref_org from public.projetos where id = new.projeto_id;
      if ref_org is distinct from org then
        raise exception 'Referência cruzada entre organizações (missoes.projeto_id).';
      end if;
    end if;

  elsif tg_table_name = 'mission_runs' then
    if new.missao_id is not null then
      select organizacao_id into ref_org from public.missoes where id = new.missao_id;
      if ref_org is distinct from org then
        raise exception 'Referência cruzada entre organizações (mission_runs.missao_id).';
      end if;
    end if;
    if new.agente_id is not null then
      select organizacao_id into ref_org from public.agentes where id = new.agente_id;
      if ref_org is distinct from org then
        raise exception 'Referência cruzada entre organizações (mission_runs.agente_id).';
      end if;
    end if;

  elsif tg_table_name = 'evidencias' then
    if new.missao_id is not null then
      select organizacao_id into ref_org from public.missoes where id = new.missao_id;
      if ref_org is distinct from org then
        raise exception 'Referência cruzada entre organizações (evidencias.missao_id).';
      end if;
    end if;

  elsif tg_table_name = 'aprovacoes' then
    if new.missao_id is not null then
      select organizacao_id into ref_org from public.missoes where id = new.missao_id;
      if ref_org is distinct from org then
        raise exception 'Referência cruzada entre organizações (aprovacoes.missao_id).';
      end if;
    end if;

  elsif tg_table_name = 'usage_metrics' then
    if new.missao_id is not null then
      select organizacao_id into ref_org from public.missoes where id = new.missao_id;
      if ref_org is distinct from org then
        raise exception 'Referência cruzada entre organizações (usage_metrics.missao_id).';
      end if;
    end if;
  end if;

  return new;
end
$$;

do $$
declare
  tabela text;
begin
  foreach tabela in array array['projetos', 'missoes', 'mission_runs', 'evidencias', 'aprovacoes', 'usage_metrics'] loop
    execute format('drop trigger if exists %I on public.%I', tabela || '_tenant', tabela);
    execute format(
      'create trigger %I before insert or update on public.%I for each row execute function app.validar_tenant()',
      tabela || '_tenant', tabela
    );
  end loop;
end
$$;

-- ---------------------------------------------------------------------
-- 5. Aprovação de operações críticas: decidir só por aprovadores
-- ---------------------------------------------------------------------
create or replace function app.protege_aprovacao() returns trigger
language plpgsql security definer set search_path = public, pg_temp as $$
begin
  if new.decisao is distinct from old.decisao
     and coalesce(current_setting('fire.service_role', true), '') <> 'authorized'
     and not app.pode_aprovar() then
    raise exception 'Somente aprovadores podem decidir uma aprovação.';
  end if;
  return new;
end
$$;

drop trigger if exists aprovacoes_protege on public.aprovacoes;
create trigger aprovacoes_protege
  before update on public.aprovacoes
  for each row execute function app.protege_aprovacao();

-- ---------------------------------------------------------------------
-- 6. search_path seguro em TODAS as funções do schema app
-- ---------------------------------------------------------------------
do $$
declare
  r record;
begin
  for r in
    select p.oid::regprocedure as sig
      from pg_proc p
      join pg_namespace n on n.oid = p.pronamespace
     where n.nspname = 'app'
  loop
    execute format('alter function %s set search_path = public, pg_temp', r.sig);
    execute format('revoke all on function %s from public', r.sig);
  end loop;
end
$$;

-- ---------------------------------------------------------------------
-- 7. Grants de menor privilégio (somente quando os papéis existirem)
-- ---------------------------------------------------------------------
do $$
begin
  revoke create on schema public from public;

  if exists (select 1 from pg_roles where rolname = 'authenticated') then
    grant usage on schema public to authenticated;
    grant usage on schema app to authenticated;
    grant execute on all functions in schema app to authenticated;
    grant select, insert, update on all tables in schema public to authenticated;
  end if;

  if exists (select 1 from pg_roles where rolname = 'anon') then
    revoke all on all tables in schema public from anon;
    revoke all on all functions in schema public from anon;
    revoke all on schema app from anon;
  end if;
end
$$;

insert into public.schema_migrations (versao, nome)
values ('0004', 'seguranca')
on conflict (versao) do nothing;
