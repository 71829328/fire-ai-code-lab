#!/usr/bin/env bash
# =====================================================================
# FIRE Agent Command Center — LAB-004
# Testes de RLS em PostgreSQL LOCAL/DESCARTÁVEL (nunca em banco real).
#
# O que faz:
#   1. Sobe um cluster PostgreSQL efêmero (initdb + pg_ctl) em diretório temporário.
#   2. Aplica o stub local de auth.uid() e as migrações 0001..0004 com a
#      guarda fire.allow_migrations = 'authorized'.
#   3. Roda backend/tests/rls_assertions.sql (isolamento, falsificação de
#      identidade, escalada de privilégio, imutabilidade da auditoria, etc.).
#   4. Derruba e remove o cluster ao final.
#
# Requer: postgresql instalado (PGBIN). Não usa serviços pagos nem rede.
# =====================================================================
set -euo pipefail

PGBIN="${PGBIN:-/usr/lib/postgresql/16/bin}"
PORT="${PGPORT:-$(( 54000 + RANDOM % 1000 ))}"
ROOT="$(cd "$(dirname "$0")/../.." && pwd)"
DATA="$(mktemp -d /tmp/fire_rls_data_XXXX)"
SOCK="$(mktemp -d /tmp/fire_rls_sock_XXXX)"

cleanup() {
  "$PGBIN/pg_ctl" -D "$DATA" -m immediate -w -t 30 stop >/dev/null 2>&1 || true
  pkill -9 -f "$DATA" >/dev/null 2>&1 || true
  rm -rf "$DATA" "$SOCK"
}
trap cleanup EXIT

if [ ! -x "$PGBIN/initdb" ]; then
  echo "PostgreSQL não encontrado em $PGBIN. Instale (ex.: apt-get install -y postgresql) ou defina PGBIN." >&2
  exit 1
fi

chown -R postgres:postgres "$DATA" "$SOCK"

echo "== Subindo cluster PostgreSQL efêmero (porta $PORT) =="
su postgres -c "$PGBIN/initdb -D '$DATA' -A trust -U postgres" >/dev/null
su postgres -c "$PGBIN/pg_ctl -D '$DATA' -o '-p $PORT -k $SOCK' -l '$DATA/log' -w start" >/dev/null

PSQL="psql -h $SOCK -p $PORT -U postgres -v ON_ERROR_STOP=1 -q"

$PSQL -c "create database fire_rls_test;" >/dev/null

echo "== Aplicando stub local de identidade + migrações 0001..0004 =="
$PSQL -d fire_rls_test -c "set fire.ambiente = 'teste_local';" \
  -f "$ROOT/backend/migrations/local/0000_auth_stub_local.sql" >/dev/null

for f in 0001_init 0002_rls 0003_indices_funcoes 0004_seguranca; do
  $PSQL -d fire_rls_test -c "set fire.allow_migrations = 'authorized';" \
    -f "$ROOT/backend/migrations/$f.sql" >/dev/null
  echo "   aplicada: $f"
done

echo "== Executando asserções de RLS =="
$PSQL -d fire_rls_test -f "$ROOT/backend/tests/rls_assertions.sql"

echo "== Concluído: asserções de RLS aprovadas =="
