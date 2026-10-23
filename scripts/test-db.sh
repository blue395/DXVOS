#!/usr/bin/env bash
# Database tests against a fresh, throwaway database (synthetic data only).
#   TEST_DATABASE_URL: the database to (re)create. It must be on localhost / a CI service
#   and its name must end in _test. Default: your local DATABASE_URL's server, database
#   "dxvos_test". The login needs CREATEDB and CREATEROLE (like Supabase's postgres role).
set -euo pipefail
cd "$(dirname "$0")/.."
if [ -z "${TEST_DATABASE_URL:-}" ]; then
  base="${DATABASE_URL:-$(grep '^DATABASE_URL=' .env | cut -d= -f2- | tr -d '"')}"
  TEST_DATABASE_URL="${base%%\?*}"
  TEST_DATABASE_URL="${TEST_DATABASE_URL%/*}/dxvos_test"
fi
case "$TEST_DATABASE_URL" in
  *@localhost[:/]*|*@127.0.0.1[:/]*|*@postgres[:/]*) ;;
  *) echo "Refusing: TEST_DATABASE_URL must be a local or CI database" >&2; exit 1 ;;
esac
db_name="${TEST_DATABASE_URL##*/}"; db_name="${db_name%%\?*}"
case "$db_name" in *_test) ;; *) echo "Refusing: the test database's name must end in _test" >&2; exit 1 ;; esac
admin_url="${TEST_DATABASE_URL%/*}/postgres"
psql "$admin_url" -q -v ON_ERROR_STOP=1 -c "DROP DATABASE IF EXISTS \"$db_name\"" -c "CREATE DATABASE \"$db_name\""
DATABASE_URL="$TEST_DATABASE_URL" DIRECT_URL="$TEST_DATABASE_URL" npx prisma migrate deploy >/dev/null
DATABASE_URL="$TEST_DATABASE_URL" npx vitest run -c vitest.db.config.ts "$@"
