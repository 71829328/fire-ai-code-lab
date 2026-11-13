-- =====================================================================
-- FIRE Agent Command Center — LAB-003 (OPERATIONAL CORE)
-- Migração 0001 — "init"
--
-- Objetivo: schema PostgreSQL de referência para o núcleo operacional
-- (organizações, usuários, agentes, projetos, missões, dependências,
-- execuções, tentativas, eventos, evidências, aprovações, auditoria e
-- métricas de consumo).
--
-- !!! ATENÇÃO !!!
-- Esta migração NÃO deve ser aplicada em nenhum banco real sem autorização
-- específica do proprietário. A aplicação automática está bloqueada tanto no
-- código (src/platform/migrations.ts → aplicarMigracoes) quanto, de forma
-- defensiva, no início deste arquivo (guarda abaixo).
--
-- Dialeto: PostgreSQL 14+ / compatível com Supabase.
-- =====================================================================

-- ---------------------------------------------------------------------
-- Guarda de segurança: exige liberação explícita para executar.
-- Em Supabase/psql: SET fire.allow_migrations = 'authorized';
-- ---------------------------------------------------------------------
do $$
begin
  if coalesce(current_setting('fire.allow_migrations', true), '') <> 'authorized' then
    raise exception
      'Migração 0001 bloqueada: defina fire.allow_migrations = ''authorized'' apenas em ambiente autorizado.';
  end if;
end
$$;

create extension if not exists "pgcrypto";

-- ---------------------------------------------------------------------
-- Tipos enumerados (idempotentes)
-- ---------------------------------------------------------------------
do $$ begin
  create type ambiente_organizacao as enum ('demonstracao', 'homologacao', 'producao');
exception when duplicate_object then null; end $$;

do $$ begin
  create type papel_usuario as enum ('proprietario', 'administrador', 'operador', 'revisor', 'observador');
exception when duplicate_object then null; end $$;

do $$ begin
  create type origem_registro as enum ('demonstrativo', 'cadastrado');
exception when duplicate_object then null; end $$;

do $$ begin
  create type conexao_agente as enum ('desconectado', 'verificado');
exception when duplicate_object then null; end $$;

do $$ begin
  create type prioridade as enum ('alta', 'media', 'baixa');
exception when duplicate_object then null; end $$;

do $$ begin
  create type status_projeto as enum ('planejado', 'em_andamento', 'pausado', 'concluido');
exception when duplicate_object then null; end $$;

do $$ begin
  create type status_missao as enum ('pendente', 'execucao_manual', 'aguardando_aprovacao', 'concluida', 'bloqueada');
exception when duplicate_object then null; end $$;

do $$ begin
  create type run_status as enum (
    'enfileirada', 'aguardando_dependencia', 'aguardando_aprovacao',
    'executando', 'concluida', 'falhou', 'cancelada', 'expirada'
  );
exception when duplicate_object then null; end $$;

do $$ begin
  create type criticidade as enum ('normal', 'critica');
exception when duplicate_object then null; end $$;

do $$ begin
  create type decisao_aprovacao as enum ('pendente', 'aprovado', 'rejeitado');
exception when duplicate_object then null; end $$;

do $$ begin
  create type resultado_auditoria as enum ('permitido', 'negado', 'info');
exception when duplicate_object then null; end $$;

do $$ begin
  create type origem_dado as enum ('informado_agente', 'informado_operador', 'verificado_independente');
exception when duplicate_object then null; end $$;

do $$ begin
  create type evidence_kind as enum (
    'repositorio', 'branch', 'commit', 'pull_request', 'deployment',
    'teste', 'captura', 'relatorio', 'arquivo', 'bloqueio'
  );
exception when duplicate_object then null; end $$;

do $$ begin
  create type attempt_status as enum ('executando', 'sucesso', 'falha', 'timeout');
exception when duplicate_object then null; end $$;

-- ---------------------------------------------------------------------
-- Controle de versão das migrações
-- ---------------------------------------------------------------------
create table if not exists public.schema_migrations (
  versao      text primary key,
  nome        text not null,
  aplicada_em timestamptz not null default now()
);

-- ---------------------------------------------------------------------
-- Organizações e usuários
-- ---------------------------------------------------------------------
create table if not exists public.organizacoes (
  id         uuid primary key default gen_random_uuid(),
  nome       text not null,
  ambiente   ambiente_organizacao not null default 'demonstracao',
  criado_em  timestamptz not null default now()
);

create table if not exists public.usuarios (
  id             uuid primary key default gen_random_uuid(),
  organizacao_id uuid not null references public.organizacoes(id) on delete cascade,
  nome           text not null,
  email          text not null,
  papel          papel_usuario not null default 'observador',
  ativo          boolean not null default true,
  criado_em      timestamptz not null default now(),
  unique (organizacao_id, email)
);

-- ---------------------------------------------------------------------
-- Agentes e projetos
-- ---------------------------------------------------------------------
create table if not exists public.agentes (
  id                uuid primary key default gen_random_uuid(),
  organizacao_id    uuid not null references public.organizacoes(id) on delete cascade,
  nome              text not null,
  papel             text not null default '',
  status            text not null default 'inativo',
  modelo            text not null default '',
  proficiencia      integer not null default 0 check (proficiencia between 0 and 100),
  tarefas_concluidas integer not null default 0,
  descricao         text not null default '',
  origem            origem_registro not null default 'cadastrado',
  conexao           conexao_agente not null default 'desconectado',
  provedor_id       text,
  -- Só pode existir quando a conexão é comprovada (verificado).
  verificado_em     timestamptz,
  criado_em         timestamptz not null default now(),
  constraint agentes_conexao_coerente check (
    (conexao = 'desconectado' and verificado_em is null) or
    (conexao = 'verificado' and verificado_em is not null)
  )
);

create table if not exists public.projetos (
  id             uuid primary key default gen_random_uuid(),
  organizacao_id uuid not null references public.organizacoes(id) on delete cascade,
  nome           text not null,
  descricao      text not null default '',
  status         status_projeto not null default 'planejado',
  responsavel_id uuid references public.agentes(id) on delete set null,
  progresso      integer not null default 0 check (progresso between 0 and 100),
  prioridade     prioridade not null default 'media',
  prazo          timestamptz,
  origem         origem_registro not null default 'cadastrado',
  criado_em      timestamptz not null default now()
);

-- ---------------------------------------------------------------------
-- Missões e dependências
-- ---------------------------------------------------------------------
create table if not exists public.missoes (
  id                uuid primary key default gen_random_uuid(),
  organizacao_id    uuid not null references public.organizacoes(id) on delete cascade,
  codigo            text not null,
  titulo            text not null,
  objetivo          text not null default '',
  instrucoes        text not null default '',
  status            status_missao not null default 'pendente',
  prioridade        prioridade not null default 'media',
  agente_id         uuid references public.agentes(id) on delete set null,
  projeto_id        uuid references public.projetos(id) on delete set null,
  criterios_aceite  text[] not null default '{}',
  criado_em         timestamptz not null default now(),
  atualizado_em     timestamptz not null default now(),
  unique (organizacao_id, codigo)
);

create table if not exists public.missao_dependencias (
  missao_id      uuid not null references public.missoes(id) on delete cascade,
  depende_de_id  uuid not null references public.missoes(id) on delete cascade,
  primary key (missao_id, depende_de_id),
  constraint dependencia_nao_self check (missao_id <> depende_de_id)
);

-- ---------------------------------------------------------------------
-- Execuções do motor (runs), tentativas e eventos
-- ---------------------------------------------------------------------
create table if not exists public.mission_runs (
  id                 uuid primary key default gen_random_uuid(),
  organizacao_id     uuid not null references public.organizacoes(id) on delete cascade,
  missao_id          uuid not null references public.missoes(id) on delete cascade,
  missao_codigo      text not null,
  agente_id          uuid references public.agentes(id) on delete set null,
  prioridade         prioridade not null default 'media',
  criticidade        criticidade not null default 'normal',
  status             run_status not null default 'enfileirada',
  chave_idempotencia text not null,
  tentativa_atual    integer not null default 0,
  resultado          jsonb,
  erro               text,
  criado_em          timestamptz not null default now(),
  atualizado_em      timestamptz not null default now(),
  iniciado_em        timestamptz,
  finalizado_em      timestamptz
);

-- Idempotência: só pode existir UMA execução não terminal por chave/org.
create unique index if not exists mission_runs_idempotencia_idx
  on public.mission_runs (organizacao_id, chave_idempotencia)
  where status in ('enfileirada', 'aguardando_dependencia', 'aguardando_aprovacao', 'executando');

create table if not exists public.run_attempts (
  id        uuid primary key default gen_random_uuid(),
  run_id    uuid not null references public.mission_runs(id) on delete cascade,
  numero    integer not null,
  inicio    timestamptz not null default now(),
  fim       timestamptz,
  status    attempt_status not null default 'executando',
  erro      text,
  resultado jsonb,
  unique (run_id, numero)
);

create table if not exists public.run_eventos (
  id         uuid primary key default gen_random_uuid(),
  run_id     uuid not null references public.mission_runs(id) on delete cascade,
  status     run_status not null,
  descricao  text not null default '',
  timestamp  timestamptz not null default now()
);

-- ---------------------------------------------------------------------
-- Evidências
-- ---------------------------------------------------------------------
create table if not exists public.evidencias (
  id              uuid primary key default gen_random_uuid(),
  organizacao_id  uuid not null references public.organizacoes(id) on delete cascade,
  missao_id       uuid references public.missoes(id) on delete set null,
  run_id          uuid references public.mission_runs(id) on delete set null,
  tipo            evidence_kind not null,
  referencia      text not null,
  descricao       text not null default '',
  valor           text not null default '',
  origem_dado     origem_dado not null default 'informado_agente',
  registrado_por  uuid references public.usuarios(id) on delete set null,
  verificado_por  text,
  verificado_em   timestamptz,
  timestamp       timestamptz not null default now(),
  -- Coerência: só há verificação quando a origem é "verificado_independente".
  constraint evidencia_verificacao_coerente check (
    (origem_dado = 'verificado_independente'
      and verificado_por is not null and verificado_em is not null) or
    (origem_dado <> 'verificado_independente'
      and verificado_por is null and verificado_em is null)
  )
);

-- ---------------------------------------------------------------------
-- Aprovações humanas
-- ---------------------------------------------------------------------
create table if not exists public.aprovacoes (
  id              uuid primary key default gen_random_uuid(),
  organizacao_id  uuid not null references public.organizacoes(id) on delete cascade,
  missao_id       uuid not null references public.missoes(id) on delete cascade,
  run_id          uuid references public.mission_runs(id) on delete set null,
  criticidade     criticidade not null default 'normal',
  decisao         decisao_aprovacao not null default 'pendente',
  solicitado_por  uuid references public.usuarios(id) on delete set null,
  decidido_por    uuid references public.usuarios(id) on delete set null,
  justificativa   text not null default '',
  solicitado_em   timestamptz not null default now(),
  decidido_em     timestamptz,
  constraint aprovacao_decisao_coerente check (
    (decisao = 'pendente' and decidido_em is null) or
    (decisao <> 'pendente' and decidido_em is not null)
  )
);

-- ---------------------------------------------------------------------
-- Auditoria e consumo
-- ---------------------------------------------------------------------
create table if not exists public.audit_log (
  id              uuid primary key default gen_random_uuid(),
  organizacao_id  uuid not null references public.organizacoes(id) on delete cascade,
  usuario_id      uuid references public.usuarios(id) on delete set null,
  acao            text not null,
  recurso         text not null,
  recurso_id      text,
  resultado       resultado_auditoria not null default 'info',
  detalhe         text,
  timestamp       timestamptz not null default now()
);

create table if not exists public.usage_metrics (
  id              uuid primary key default gen_random_uuid(),
  organizacao_id  uuid not null references public.organizacoes(id) on delete cascade,
  provedor_id     text not null default 'desconhecido',
  agente_id       uuid references public.agentes(id) on delete set null,
  missao_id       uuid references public.missoes(id) on delete set null,
  run_id          uuid references public.mission_runs(id) on delete set null,
  unidade         text not null default 'unidades',
  quantidade      numeric(18, 4) not null default 0,
  custo_estimado  numeric(18, 4) not null default 0,
  moeda           text not null default 'BRL',
  -- Consumo nunca é medido por API paga neste projeto: é sempre informado.
  origem_dado     origem_dado not null default 'informado_operador',
  timestamp       timestamptz not null default now()
);

insert into public.schema_migrations (versao, nome)
values ('0001', 'init')
on conflict (versao) do nothing;
