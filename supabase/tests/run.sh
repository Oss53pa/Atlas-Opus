#!/usr/bin/env bash
# ============================================================================
# Atlas Opus — Exécute les tests RLS contre un PostgreSQL éphémère.
#
# Provisionne un cluster jetable, applique le harnais d'auth de test, puis
# schema.sql (source de vérité), accorde les privilèges au rôle `authenticated`
# et lance supabase/tests/rls_test.sql. Sortie ≠ 0 si une assertion échoue.
#
# Prérequis : binaires PostgreSQL 16 (initdb, pg_ctl, psql) dans le PATH ou
# sous /usr/lib/postgresql/16/bin. pgvector n'est PAS requis (neutralisé pour
# le test — les politiques RLS ne touchent pas les embeddings).
#
# Usage :   bash supabase/tests/run.sh
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
    WORK_ROOT="$(mktemp -d /tmp/aopg-rls.XXXXXX)"
    cp "$REPO/schema.sql" "$HERE/_harness.sql" "$HERE/rls_test.sql" "$WORK_ROOT/"
    cp "$HERE/run.sh" "$WORK_ROOT/run.sh"
    chown -R postgres:postgres "$WORK_ROOT"
    exec runuser -u postgres -- env AO_STANDALONE="$WORK_ROOT" bash "$WORK_ROOT/run.sh"
  else
    echo "ERREUR : PostgreSQL ne peut pas tourner en root et aucun utilisateur 'postgres' n'existe." >&2
    exit 1
  fi
fi

# Sources : soit le dépôt, soit la copie autonome préparée par la branche root.
SRC="${AO_STANDALONE:-$HERE}"
SCHEMA="${AO_STANDALONE:+$AO_STANDALONE/schema.sql}"; SCHEMA="${SCHEMA:-$REPO/schema.sql}"
HARNESS="$SRC/_harness.sql"; TESTS="$SRC/rls_test.sql"

BASE="$(mktemp -d /tmp/aopg-data.XXXXXX)"
PORT=54329
cleanup() { pg_ctl -D "$BASE/data" stop -m fast >/dev/null 2>&1 || true; rm -rf "$BASE"; }
trap cleanup EXIT

echo "· initdb ($BASE)"
initdb -U postgres -A trust -D "$BASE/data" >/dev/null
pg_ctl -D "$BASE/data" -o "-p $PORT -k $BASE -c listen_addresses=''" -l "$BASE/pg.log" -w start >/dev/null

P() { psql -h "$BASE" -p "$PORT" -U postgres -v ON_ERROR_STOP=1 -q "$@"; }

echo "· create database atlas"
P -d postgres -c "create database atlas;" >/dev/null

echo "· auth harness + schema.sql (pgvector neutralisé pour le test)"
P -d atlas -f "$HARNESS" >/dev/null
# check_function_bodies=off : les helpers RLS référencent des tables définies plus bas.
{ echo "set check_function_bodies = off;";
  sed -e '/create extension if not exists vector;/d' \
      -e 's/embedding vector(1024)/embedding text/' "$SCHEMA"; } | P -d atlas -f - >/dev/null

echo "· grants → authenticated"
P -d atlas -c "grant usage on schema public, auth to authenticated;
grant select,insert,update,delete on all tables in schema public to authenticated;
grant execute on all functions in schema public to authenticated;
grant execute on all functions in schema auth to authenticated;" >/dev/null

echo "· rls_test.sql"
echo "----------------------------------------------------------------------"
P -d atlas -f "$TESTS"
echo "----------------------------------------------------------------------"
echo "OK — tous les tests RLS sont verts."
