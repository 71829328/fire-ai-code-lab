-- =====================================================================
-- FIRE Agent Command Center — LAB-004 (REAL CONNECTIVITY & SECURE BACKEND)
-- Stub de identidade — SOMENTE AMBIENTE LOCAL/DESCARTÁVEL
-- Arquivo: backend/migrations/local/0000_auth_stub_local.sql
--
-- Este arquivo NÃO faz parte da lista de migrações de produção
-- (src/platform/migrations.ts) e NUNCA deve ser aplicado em banco real,
-- de homologação ou de produção.
--
-- Motivo: em Supabase, o schema `auth` e a função `auth.uid()` já existem e
-- são preenchidos a partir do JWT verificado. Em um PostgreSQL local de testes,
-- eles não existem. Este stub cria um `auth.uid()` equivalente para permitir
-- testar as políticas de RLS localmente.
--
-- A identidade continua vindo EXCLUSIVAMENTE de `request.jwt.claim.sub`
-- (o mesmo caminho confiável do Supabase). O stub NÃO cria nenhum caminho
-- alternativo tipo `app.usuario_id` — essa era a falha corrigida no LAB-004.
--
-- Uso (local):  SET fire.ambiente = 'teste_local';
--               \i backend/migrations/local/0000_auth_stub_local.sql
-- =====================================================================

do $$
begin
  if coalesce(current_setting('fire.ambiente', true), '') <> 'teste_local' then
    raise exception
      'Stub local bloqueado: defina fire.ambiente = ''teste_local''. Este arquivo é exclusivo de ambiente local/descartável.';
  end if;
end
$$;

create schema if not exists auth;

-- Equivalente local de auth.uid() do Supabase: lê o "sub" do JWT.
create or replace function auth.uid() returns uuid
language sql stable as $$
  select nullif(current_setting('request.jwt.claim.sub', true), '')::uuid;
$$;
