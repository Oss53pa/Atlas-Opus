#!/usr/bin/env bash
# ============================================================================
# Atlas Opus — Exécute les tests RLS contre la PILE DE MIGRATIONS (déployé ao_).
#
# Complète run.sh (qui valide schema.sql). Provisionne un cluster PostgreSQL 16
# éphémère, applique le bootstrap (objets partagés + auth de test), puis TOUTES
# les migrations supabase/migrations/*.sql dans l'ordre, accorde les privilèges
# au rôle `authenticated`, et lance rls_migrations_test.sql. Sortie ≠ 0 si une
# assertion échoue.
#
# Usage :   bash supabase/tests/run_migrations.sh
# PostgreSQL refuse de tourner en root : si lancé en root avec un utilisateur
# `postgres`, le script se ré-exécute sous cet utilisateur.
# ============================================================================
set -euo pipefail

export PATH="/usr/lib/postgresql/16/bin:$PATH"
HERE="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
REPO="$(cd "$HERE/../.." && pwd)"

# PostgreSQL ne démarre pas en root → se replier sur l'utilisateur `postgres`.
if [ "$(id -u)" = "0" ]; then
  if id postgres >/dev/null 2>&1; then
    WORK_ROOT="$(mktemp -d /tmp/aopg-mig.XXXXXX)"
    cp -r "$REPO/supabase/migrations" "$WORK_ROOT/migrations"
    cp "$HERE/_bootstrap_migrations.sql" "$HERE/rls_migrations_test.sql" "$HERE/run_migrations.sh" "$WORK_ROOT/"
    chown -R postgres:postgres "$WORK_ROOT"
    exec runuser -u postgres -- env AO_MIG_STANDALONE="$WORK_ROOT" bash "$WORK_ROOT/run_migrations.sh"
  else
    echo "ERREUR : PostgreSQL ne peut pas tourner en root et aucun utilisateur 'postgres' n'existe." >&2
    exit 1
  fi
fi

SRC="${AO_MIG_STANDALONE:-$HERE}"
MIGRATIONS="${AO_MIG_STANDALONE:+$AO_MIG_STANDALONE/migrations}"; MIGRATIONS="${MIGRATIONS:-$REPO/supabase/migrations}"
BOOTSTRAP="$SRC/_bootstrap_migrations.sql"; TESTS="$SRC/rls_migrations_test.sql"

BASE="$(mktemp -d /tmp/aopg-mig-data.XXXXXX)"
PORT=54330
cleanup() { pg_ctl -D "$BASE/data" stop -m fast >/dev/null 2>&1 || true; rm -rf "$BASE"; }
trap cleanup EXIT

echo "· initdb ($BASE)"
initdb -U postgres -A trust -D "$BASE/data" >/dev/null
pg_ctl -D "$BASE/data" -o "-p $PORT -k $BASE -c listen_addresses=''" -l "$BASE/pg.log" -w start >/dev/null

P() { psql -h "$BASE" -p "$PORT" -U postgres -v ON_ERROR_STOP=1 -q "$@"; }

echo "· create database atlas"
P -d postgres -c "create database atlas;" >/dev/null

echo "· bootstrap (objets partagés + auth de test)"
P -d atlas -f "$BOOTSTRAP" >/dev/null

echo "· migrations (0001 → dernière, dans l'ordre)"
for f in "$MIGRATIONS"/*.sql; do
  P -d atlas -f "$f" >/dev/null
done

echo "· grants → authenticated"
P -d atlas -c "grant usage on schema public, auth to authenticated;
grant select,insert,update,delete on all tables in schema public to authenticated;
grant execute on all functions in schema public to authenticated;
grant execute on all functions in schema auth to authenticated;" >/dev/null

echo "· rls_migrations_test.sql"
echo "----------------------------------------------------------------------"
P -d atlas -f "$TESTS"
echo "----------------------------------------------------------------------"
echo "OK — tests RLS de la pile de migrations verts."
