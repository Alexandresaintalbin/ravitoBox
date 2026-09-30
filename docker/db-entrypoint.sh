#!/bin/sh
# L'image supabase/postgres crée les rôles internes sans mot de passe.
# On le pose après le démarrage, y compris si le volume existe déjà.
set -eu

/usr/local/bin/docker-entrypoint.sh "$@" &
pid=$!

trap 'kill -TERM "$pid" 2>/dev/null || true; wait "$pid" || true' TERM INT

until pg_isready -U postgres -d postgres >/dev/null 2>&1; do
  if ! kill -0 "$pid" 2>/dev/null; then
    wait "$pid"
    exit $?
  fi
  sleep 1
done

escaped=$(printf '%s' "${POSTGRES_PASSWORD}" | sed "s/'/''/g")

PGPASSWORD="$POSTGRES_PASSWORD" psql -v ON_ERROR_STOP=1 --no-psqlrc -h 127.0.0.1 -U supabase_admin -d postgres <<SQL
SELECT set_config('app.db_password', '${escaped}', false);
DO \$body\$
DECLARE
  role_name text;
BEGIN
  FOREACH role_name IN ARRAY ARRAY[
    'authenticator',
    'supabase_auth_admin',
    'supabase_storage_admin'
  ]
  LOOP
    IF EXISTS (SELECT 1 FROM pg_roles WHERE rolname = role_name) THEN
      EXECUTE format('ALTER ROLE %I WITH LOGIN PASSWORD %L', role_name, current_setting('app.db_password'));
    END IF;
  END LOOP;
END
\$body\$;
SQL

touch /tmp/roles-ready
wait "$pid"
