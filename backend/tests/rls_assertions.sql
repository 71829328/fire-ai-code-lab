-- =====================================================================
-- FIRE Agent Command Center — LAB-004
-- Testes RLS de isolamento, identidade e integridade (banco LOCAL/descartável)
--
-- Executados por backend/scripts/rls-local.sh contra um cluster PostgreSQL
-- efêmero. NÃO roda em banco real.
--
-- Regra central: a identidade vem de auth.uid() → request.jwt.claim.sub.
-- O teste 4 comprova que o antigo app.usuario_id NÃO concede identidade.
-- =====================================================================

-- ---------------------------------------------------------------------
-- Seed (executado como owner; RLS não se aplica ao owner)
-- ---------------------------------------------------------------------
insert into public.organizacoes (id, nome, ambiente) values
  ('11111111-1111-1111-1111-111111111111', 'Org A', 'homologacao'),
  ('22222222-2222-2222-2222-222222222222', 'Org B', 'homologacao')
on conflict (id) do nothing;

insert into public.usuarios (id, organizacao_id, nome, email, papel, ativo) values
  ('aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa', '11111111-1111-1111-1111-111111111111', 'Prop A',  'prop.a@example.invalid',  'proprietario',  true),
  ('aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaab', '11111111-1111-1111-1111-111111111111', 'Admin A', 'admin.a@example.invalid', 'administrador', true),
  ('aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaac', '11111111-1111-1111-1111-111111111111', 'Op A',    'op.a@example.invalid',    'operador',      true),
  ('aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaad', '11111111-1111-1111-1111-111111111111', 'Rev A',   'rev.a@example.invalid',   'revisor',       true),
  ('bbbbbbbb-bbbb-bbbb-bbbb-bbbbbbbbbbbb', '22222222-2222-2222-2222-222222222222', 'Prop B',  'prop.b@example.invalid',  'proprietario',  true)
on conflict (id) do nothing;

insert into public.agentes (id, organizacao_id, nome) values
  ('a1a1a1a1-a1a1-a1a1-a1a1-a1a1a1a1a1a1', '11111111-1111-1111-1111-111111111111', 'Agente A'),
  ('b1b1b1b1-b1b1-b1b1-b1b1-b1b1b1b1b1b1', '22222222-2222-2222-2222-222222222222', 'Agente B')
on conflict (id) do nothing;

insert into public.missoes (id, organizacao_id, codigo, titulo) values
  ('c1c1c1c1-c1c1-c1c1-c1c1-c1c1c1c1c1c1', '11111111-1111-1111-1111-111111111111', 'MSN-A', 'Missão A'),
  ('d1d1d1d1-d1d1-d1d1-d1d1-d1d1d1d1d1d1', '22222222-2222-2222-2222-222222222222', 'MSN-B', 'Missão B')
on conflict (id) do nothing;

-- ---------------------------------------------------------------------
-- Papel de teste (não-owner, sem BYPASSRLS) — para que a RLS seja aplicada.
-- ---------------------------------------------------------------------
do $$
begin
  if not exists (select 1 from pg_roles where rolname = 'app_teste') then
    create role app_teste nologin;
  end if;
end
$$;

create schema if not exists teste;

create or replace function teste.igual_int(rotulo text, consulta text, esperado bigint) returns void
language plpgsql as $$
declare obtido bigint;
begin
  execute consulta into obtido;
  if obtido is distinct from esperado then
    raise exception 'FALHA  % — esperado %, obtido %', rotulo, esperado, obtido;
  end if;
  raise notice 'PASS  %', rotulo;
end
$$;

create or replace function teste.igual_texto(rotulo text, consulta text, esperado text) returns void
language plpgsql as $$
declare obtido text;
begin
  execute consulta into obtido;
  if obtido is distinct from esperado then
    raise exception 'FALHA  % — esperado %, obtido %', rotulo, esperado, obtido;
  end if;
  raise notice 'PASS  %', rotulo;
end
$$;

create or replace function teste.deve_falhar(rotulo text, comando text) returns void
language plpgsql as $$
begin
  begin
    execute comando;
  exception when others then
    raise notice 'PASS  %  (bloqueado: %)', rotulo, sqlerrm;
    return;
  end;
  raise exception 'FALHA  % — a operação NÃO foi bloqueada.', rotulo;
end
$$;

create or replace function teste.deve_passar(rotulo text, comando text) returns void
language plpgsql as $$
begin
  begin
    execute comando;
  exception when others then
    raise exception 'FALHA  % — erro inesperado: %', rotulo, sqlerrm;
  end;
  raise notice 'PASS  %', rotulo;
end
$$;

grant usage on schema public, app, teste, auth to app_teste;
grant select, insert, update, delete on all tables in schema public to app_teste;
grant execute on all functions in schema app to app_teste;
grant execute on all functions in schema teste to app_teste;

-- =====================================================================
-- TESTES
-- =====================================================================
set role app_teste;

-- 1) Isolamento: identidade da Org A vê apenas a própria organização.
select set_config('request.jwt.claim.sub', 'aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa', false);
select teste.igual_int('isolamento A: vê apenas 1 agente', 'select count(*) from public.agentes', 1);
select teste.igual_int('isolamento A: vê apenas 1 missão', 'select count(*) from public.missoes', 1);
select teste.igual_texto('organizacao_atual é a Org A',
  'select app.organizacao_atual()::text', '11111111-1111-1111-1111-111111111111');

-- 2) Escrita em outra organização é bloqueada pela política WITH CHECK.
select teste.deve_falhar(
  'insert de agente em outra organização é bloqueado',
  $$insert into public.agentes (organizacao_id, nome) values ('22222222-2222-2222-2222-222222222222', 'Invasor')$$
);

-- 3) Referência cruzada entre tenants é bloqueada por gatilho de integridade.
select teste.deve_falhar(
  'referência cruzada entre organizações é bloqueada',
  $$insert into public.projetos (organizacao_id, nome, responsavel_id) values ('11111111-1111-1111-1111-111111111111', 'Projeto inválido', 'b1b1b1b1-b1b1-b1b1-b1b1-b1b1b1b1b1b1')$$
);

-- 4) CORREÇÃO DO CTO: app.usuario_id NÃO concede identidade.
select set_config('app.usuario_id', 'bbbbbbbb-bbbb-bbbb-bbbb-bbbbbbbbbbbb', false);
select teste.igual_texto('app.usuario_id não falsifica a identidade (continua Org A)',
  'select app.organizacao_atual()::text', '11111111-1111-1111-1111-111111111111');
select teste.igual_int('app.usuario_id não amplia a visibilidade (ainda 1 agente)',
  'select count(*) from public.agentes', 1);
select set_config('app.usuario_id', '', false);

-- 5) Identidade da Org B: isolamento simétrico.
select set_config('request.jwt.claim.sub', 'bbbbbbbb-bbbb-bbbb-bbbb-bbbbbbbbbbbb', false);
select teste.igual_int('isolamento B: vê apenas 1 agente', 'select count(*) from public.agentes', 1);
select teste.igual_texto('organizacao_atual é a Org B',
  'select app.organizacao_atual()::text', '22222222-2222-2222-2222-222222222222');

-- 6) Sem identidade: nada é visível.
select set_config('request.jwt.claim.sub', '', false);
select teste.igual_int('sem identidade: nenhum agente visível', 'select count(*) from public.agentes', 0);
select teste.igual_texto('sem identidade: organizacao_atual nula',
  $$select coalesce(app.organizacao_atual()::text, '(nulo)')$$, '(nulo)');

-- 7) Usuário inativo perde acesso.
select set_config('request.jwt.claim.sub', 'aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaac', false);
reset role;
update public.usuarios set ativo = false where id = 'aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaac';
set role app_teste;
select teste.igual_int('usuário inativo: nenhum agente visível', 'select count(*) from public.agentes', 0);
reset role;
update public.usuarios set ativo = true where id = 'aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaac';
set role app_teste;

-- 8) Auditoria é imutável (append-only).
select set_config('request.jwt.claim.sub', 'aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa', false);
select teste.deve_passar('inserção de auditoria é permitida ao usuário',
  $$insert into public.audit_log (organizacao_id, usuario_id, acao, recurso, resultado)
    values ('11111111-1111-1111-1111-111111111111', 'aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa', 'teste', 'audit', 'info')$$);
-- A RLS não concede política de UPDATE/DELETE ao usuário; além disso o gatilho
-- torna o registro imutável até para o owner (defesa em profundidade).
reset role;
select teste.deve_falhar('auditoria não pode ser alterada (update bloqueado)',
  $$update public.audit_log set detalhe = 'adulterado'$$);
select teste.deve_falhar('auditoria não pode ser removida (delete bloqueado)',
  $$delete from public.audit_log$$);
set role app_teste;

-- 9) Escalada de privilégio: administrador não pode se tornar proprietário.
select set_config('request.jwt.claim.sub', 'aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaab', false);
select teste.deve_falhar('administrador não eleva o próprio papel',
  $$update public.usuarios set papel = 'proprietario' where id = 'aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaab'$$);

-- 10) Troca de tenant: usuário não muda de organização.
select set_config('request.jwt.claim.sub', 'aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa', false);
select teste.deve_falhar('usuário não pode mudar de organização',
  $$update public.usuarios set organizacao_id = '22222222-2222-2222-2222-222222222222' where id = 'aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaac'$$);

-- 11) Aprovação: operador não decide; revisor decide.
reset role;
insert into public.aprovacoes (id, organizacao_id, missao_id, criticidade, decisao)
values ('e1e1e1e1-e1e1-e1e1-e1e1-e1e1e1e1e1e1', '11111111-1111-1111-1111-111111111111',
        'c1c1c1c1-c1c1-c1c1-c1c1-c1c1c1c1c1c1', 'critica', 'pendente');
set role app_teste;

select set_config('request.jwt.claim.sub', 'aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaac', false); -- operador
select teste.deve_passar('operador executa update (RLS restringe às linhas permitidas)',
  $$update public.aprovacoes set decisao = 'aprovado', decidido_em = now() where id = 'e1e1e1e1-e1e1-e1e1-e1e1-e1e1e1e1e1e1'$$);
select teste.igual_texto('operador NÃO alterou a decisão (segue pendente)',
  $$select decisao::text from public.aprovacoes where id = 'e1e1e1e1-e1e1-e1e1-e1e1-e1e1e1e1e1e1'$$, 'pendente');

select set_config('request.jwt.claim.sub', 'aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaad', false); -- revisor
select teste.deve_passar('revisor decide a aprovação',
  $$update public.aprovacoes set decisao = 'aprovado', decidido_em = now() where id = 'e1e1e1e1-e1e1-e1e1-e1e1-e1e1e1e1e1e1'$$);
select teste.igual_texto('revisor alterou a decisão para aprovado',
  $$select decisao::text from public.aprovacoes where id = 'e1e1e1e1-e1e1-e1e1-e1e1-e1e1e1e1e1e1'$$, 'aprovado');

-- 12) Eventos de execução são append-only.
select set_config('request.jwt.claim.sub', 'aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa', false);
select teste.deve_passar('usuário cria execução (gera evento inicial automaticamente)',
  $$insert into public.mission_runs (organizacao_id, missao_id, missao_codigo, chave_idempotencia)
    values ('11111111-1111-1111-1111-111111111111', 'c1c1c1c1-c1c1-c1c1-c1c1-c1c1c1c1c1c1', 'MSN-A', 'teste-evento')$$);
select teste.igual_int('evento inicial da execução foi registrado',
  $$select count(*) from public.run_eventos e join public.mission_runs r on r.id = e.run_id where r.chave_idempotencia = 'teste-evento'$$, 1);
reset role;
select teste.deve_falhar('eventos de execução não podem ser alterados',
  $$update public.run_eventos set descricao = 'adulterado'$$);
set role app_teste;

reset role;
select set_config('request.jwt.claim.sub', '', false);

\echo 'RLS: TODAS AS ASSERÇÕES PASSARAM'
