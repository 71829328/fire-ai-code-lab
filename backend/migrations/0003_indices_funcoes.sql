-- =====================================================================
-- FIRE Agent Command Center — LAB-003 (OPERATIONAL CORE)
-- Migração 0003 — "indices_e_funcoes"
--
-- Objetivo: índices de desempenho, função de verificação de dependências e
-- gatilhos de manutenção de "atualizado_em".
--
-- !!! NÃO APLIQUE SEM AUTORIZAÇÃO (a guarda abaixo bloqueia por padrão) !!!
-- =====================================================================

do $$
begin
  if coalesce(current_setting('fire.allow_migrations', true), '') <> 'authorized' then
    raise exception
      'Migração 0003 bloqueada: defina fire.allow_migrations = ''authorized'' apenas em ambiente autorizado.';
  end if;
end
$$;

-- ---------------------------------------------------------------------
-- Índices de desempenho (filtros mais usados pela aplicação)
-- ---------------------------------------------------------------------
create index if not exists usuarios_org_idx            on public.usuarios (organizacao_id);
create index if not exists agentes_org_idx             on public.agentes (organizacao_id);
create index if not exists projetos_org_idx            on public.projetos (organizacao_id);
create index if not exists projetos_responsavel_idx    on public.projetos (responsavel_id);
create index if not exists missoes_org_status_idx      on public.missoes (organizacao_id, status);
create index if not exists missoes_agente_idx          on public.missoes (agente_id);
create index if not exists missoes_prioridade_idx      on public.missoes (organizacao_id, prioridade);
create index if not exists runs_org_status_idx         on public.mission_runs (organizacao_id, status);
create index if not exists runs_missao_idx             on public.mission_runs (missao_id);
create index if not exists runs_fila_idx               on public.mission_runs (organizacao_id, prioridade, criado_em)
  where status in ('enfileirada', 'aguardando_dependencia');
create index if not exists attempts_run_idx            on public.run_attempts (run_id);
create index if not exists eventos_run_idx             on public.run_eventos (run_id, timestamp);
create index if not exists evidencias_org_tipo_idx     on public.evidencias (organizacao_id, tipo);
create index if not exists evidencias_missao_idx       on public.evidencias (missao_id);
create index if not exists evidencias_run_idx          on public.evidencias (run_id);
create index if not exists evidencias_origem_idx       on public.evidencias (organizacao_id, origem_dado);
create index if not exists aprovacoes_org_decisao_idx  on public.aprovacoes (organizacao_id, decisao);
create index if not exists aprovacoes_run_idx          on public.aprovacoes (run_id);
create index if not exists audit_org_ts_idx            on public.audit_log (organizacao_id, timestamp desc);
create index if not exists consumo_org_idx             on public.usage_metrics (organizacao_id, timestamp desc);
create index if not exists consumo_agente_idx          on public.usage_metrics (agente_id);

-- ---------------------------------------------------------------------
-- Função: dependências satisfeitas?
-- Uma missão só pode executar quando TODAS as suas dependências estão
-- concluídas. Retorna true quando não há dependências pendentes.
-- ---------------------------------------------------------------------
create or replace function app.dependencias_satisfeitas(p_missao_id uuid)
returns boolean
language sql stable as $$
  select not exists (
    select 1
      from public.missao_dependencias d
      join public.missoes dep on dep.id = d.depende_de_id
     where d.missao_id = p_missao_id
       and dep.status <> 'concluida'
  );
$$;

-- ---------------------------------------------------------------------
-- Função: próxima execução elegível (prioridade + ordem de criação),
-- respeitando dependências. Não inicia nada — apenas informa o candidato.
-- ---------------------------------------------------------------------
create or replace function app.proxima_execucao_elegivel(p_organizacao_id uuid)
returns uuid
language sql stable as $$
  select r.id
    from public.mission_runs r
   where r.organizacao_id = p_organizacao_id
     and r.status = 'enfileirada'
     and app.dependencias_satisfeitas(r.missao_id)
   order by
     case r.prioridade when 'alta' then 0 when 'media' then 1 else 2 end,
     r.criado_em
   limit 1;
$$;

-- ---------------------------------------------------------------------
-- Gatilho: mantém atualizado_em coerente em missões e execuções.
-- ---------------------------------------------------------------------
create or replace function app.tocar_atualizado_em()
returns trigger
language plpgsql as $$
begin
  new.atualizado_em := now();
  return new;
end;
$$;

drop trigger if exists missoes_touch on public.missoes;
create trigger missoes_touch
  before update on public.missoes
  for each row execute function app.tocar_atualizado_em();

drop trigger if exists mission_runs_touch on public.mission_runs;
create trigger mission_runs_touch
  before update on public.mission_runs
  for each row execute function app.tocar_atualizado_em();

-- ---------------------------------------------------------------------
-- Gatilho: registra automaticamente um evento ao criar uma execução.
-- ---------------------------------------------------------------------
create or replace function app.registrar_evento_inicial()
returns trigger
language plpgsql as $$
begin
  insert into public.run_eventos (run_id, status, descricao)
  values (new.id, new.status, 'Execução registrada');
  return new;
end;
$$;

drop trigger if exists mission_runs_evento_inicial on public.mission_runs;
create trigger mission_runs_evento_inicial
  after insert on public.mission_runs
  for each row execute function app.registrar_evento_inicial();

insert into public.schema_migrations (versao, nome)
values ('0003', 'indices_e_funcoes')
on conflict (versao) do nothing;
