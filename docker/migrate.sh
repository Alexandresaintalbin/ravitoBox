#!/bin/sh
set -eu

echo "Attente de Postgres..."
until pg_isready -h "$PGHOST" -U "$PGUSER" -d "$PGDATABASE" >/dev/null 2>&1; do
  sleep 1
done

echo "Attente du schéma Auth..."
until psql -tAc "select to_regclass('auth.users')" | grep -q users; do
  sleep 1
done

psql -v ON_ERROR_STOP=1 <<'SQL'
create schema if not exists internal;
create table if not exists internal.schema_migrations (
  filename text primary key,
  applied_at timestamptz not null default now()
);
SQL

for file in /migrations/*.sql; do
  name=$(basename "$file")
  applied=$(psql -tAc "select 1 from internal.schema_migrations where filename = '$name'")
  if [ "$applied" = "1" ]; then
    echo "Déjà appliquée : $name"
    continue
  fi
  echo "Migration : $name"
  psql -v ON_ERROR_STOP=1 -f "$file"
  psql -v ON_ERROR_STOP=1 -c "insert into internal.schema_migrations (filename) values ('$name')"
done

echo "Jeu de données initial"
psql -v ON_ERROR_STOP=1 -f /seed.sql

mode=$(printf '%s' "${SIGNUP_MODE:-closed}" | tr '[:upper:]' '[:lower:]')
case "$mode" in
  closed|invite|open) ;;
  *) echo "SIGNUP_MODE invalide : $mode" >&2; exit 1 ;;
esac
if [ "$mode" = "closed" ] && [ "${DISABLE_SIGNUP:-true}" != "true" ]; then
  echo "SIGNUP_MODE=closed exige DISABLE_SIGNUP=true" >&2
  exit 1
fi
if [ "$mode" != "closed" ] && [ "${DISABLE_SIGNUP:-true}" = "true" ]; then
  echo "SIGNUP_MODE=$mode exige DISABLE_SIGNUP=false, sinon GoTrue refuse l'inscription avant le code." >&2
  exit 1
fi
autoconfirm=false
if [ "${ENABLE_EMAIL_AUTOCONFIRM:-false}" = "true" ]; then
  autoconfirm=true
fi
psql -v ON_ERROR_STOP=1 -c "insert into public.app_settings (key, value) values ('signup_mode', '$mode'), ('email_autoconfirm', '$autoconfirm') on conflict (key) do update set value = excluded.value, updated_at = now();"
echo "Inscriptions : $mode (confirmation e-mail : $([ "$autoconfirm" = "true" ] && echo désactivée || echo exigée))"
echo "Base prête."
