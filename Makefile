.PHONY: up down logs test test-integration test-e2e reset-db dev admin secrets backup restore import-products

LIMIT ?= 400

up:
	docker compose up -d --build

down:
	docker compose down

logs:
	docker compose logs -f --tail=200

test:
	docker compose --profile test run --rm test

test-integration:
	docker compose --profile integration run --rm integration

test-e2e:
	docker compose --profile e2e run --rm e2e

dev:
	docker compose --profile dev up --build dev

reset-db:
	docker compose down -v
	docker compose up -d --build

secrets:
	./scripts/generate-secrets.sh

backup:
	mkdir -p backups
	docker compose exec -T db pg_dump -U supabase_admin -d postgres --no-owner --clean --if-exists > backups/ravitobox-$$(date +%Y%m%d-%H%M%S).sql
	@ls -1t backups/ravitobox-*.sql | head -1

restore:
	@test -n "$(FILE)" || (echo "Usage: make restore FILE=backups/ravitobox-YYYYMMDD-HHMMSS.sql" && exit 1)
	docker compose exec -T db psql -U supabase_admin -d postgres -v ON_ERROR_STOP=1 < "$(FILE)"

import-products:
	npx tsx scripts/import-products/cli.ts --limit $(LIMIT) $(if $(DUMP),--dump $(DUMP),)

admin:
	@test -n "$(EMAIL)" || (echo "Usage: make admin EMAIL=vous@exemple.fr" && exit 1)
	docker compose exec -T db psql -U supabase_admin -d postgres -v email="$(EMAIL)" -c "update public.profiles set role = 'admin' where id = (select id from auth.users where email = :'email');"
