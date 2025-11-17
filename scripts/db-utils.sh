#!/usr/bin/env bash
set -euo pipefail

ROOT="$(cd "$(dirname "$0")/.." && pwd)"

cmd=${1:-}
case "$cmd" in
  gen-drop-remote)
    schema=${2:?schema path}
    out=${3:?out path}
    {
      echo "PRAGMA foreign_keys=OFF;"
      grep -oE "CREATE TABLE\s+\`[^\`]+\`" "$schema" | cut -d'\`' -f2 | grep -v '^_cf_KV$' | awk '{printf "DROP TABLE IF EXISTS \`%s\`;\n",$0}'
      echo "PRAGMA foreign_keys=ON;"
    } > "$out"
    ;;
  gen-drop-local)
    schema=${2:?schema path}
    out=${3:?out path}
    {
      echo "PRAGMA foreign_keys=OFF;"
      echo "BEGIN;"
      grep -oE "CREATE TABLE\s+\`[^\`]+\`" "$schema" | cut -d'\`' -f2 | grep -v '^_cf_KV$' | awk '{printf "DROP TABLE IF EXISTS \`%s\`;\n",$0}'
      echo "COMMIT;"
      echo "PRAGMA foreign_keys=ON;"
    } > "$out"
    ;;
  check-env)
    env_file=${2:?env file}
    shift 2
    missing=""
    for k in "$@"; do
      if ! grep -E -q "^${k}=" "$env_file"; then
        missing+=" ${k}"
      fi
    done
    if [ -n "$missing" ]; then
      echo "Brak wymaganych zmiennych w $env_file:" $missing
      exit 1
    fi
    ;;
  print-db)
    db=${2:-}
    if [ -z "$db" ]; then
      echo "DB not set"
      exit 1
    fi
    echo "DB=$db"
    ;;
  backup-remote)
    db="${D1_DB:-auth-litewkateam}"
    stamp="$(date +"%d-%m-%Y_%H-%M")-$(git rev-parse --short HEAD || echo unknown)"
    mkdir -p "$ROOT/backups"
    bun x wrangler@latest d1 export "$db" --remote --config "$ROOT/apps/server/wrangler.jsonc" --output "$ROOT/backups/remote-${stamp}.sql"
    ;;
  backup-local)
    db="${D1_DB:-auth-litewkateam}"
    stamp="$(date +"%d-%m-%Y_%H-%M")-$(git rev-parse --short HEAD || echo unknown)"
    mkdir -p "$ROOT/backups"
    bun x wrangler@latest d1 export "$db" --config "$ROOT/apps/server/wrangler.jsonc" --output "$ROOT/backups/local-${stamp}.sql"
    ;;
  backup-full)
    db="${D1_DB:-}"
    if [ -z "$db" ]; then echo set D1_DB; exit 1; fi
    ts="$(date +"%d-%m-%Y_%H-%M")"
    commit="$(git rev-parse --short HEAD || echo unknown)"
    stamp="${ts}-${commit}"
    mkdir -p "$ROOT/backups/${stamp}"
    bun x wrangler@latest d1 export "$db" --remote --config "$ROOT/apps/server/wrangler.jsonc" --output "$ROOT/backups/${stamp}/remote.sql"
    bun x wrangler@latest d1 export "$db" --config "$ROOT/apps/server/wrangler.jsonc" --output "$ROOT/backups/${stamp}/local.sql"
    ;;
  restore-remote)
    file=${2:?file}
    bun x wrangler@latest d1 execute "${D1_DB:?set D1_DB}" --remote --config "$ROOT/apps/server/wrangler.jsonc" --file "$file"
    ;;
  restore-local)
    file=${2:?file}
    bun x wrangler@latest d1 execute "${D1_DB:?set D1_DB}" --config "$ROOT/apps/server/wrangler.jsonc" --file "$file"
    ;;
  restore-remote-latest)
    file=$(ls -t "$ROOT"/backups/remote-*.sql | head -n 1 || true)
    if [ -n "$file" ]; then
      bun x wrangler@latest d1 execute "${D1_DB:?set D1_DB}" --remote --config "$ROOT/apps/server/wrangler.jsonc" --file "$file"
    else
      echo no remote backup found; exit 1
    fi
    ;;
  restore-local-latest)
    file=$(ls -t "$ROOT"/backups/local-*.sql | head -n 1 || true)
    if [ -n "$file" ]; then
      bun x wrangler@latest d1 execute "${D1_DB:?set D1_DB}" --config "$ROOT/apps/server/wrangler.jsonc" --file "$file"
    else
      echo no local backup found; exit 1
    fi
    ;;
  cleanup-remote)
    stamp="$(date +"%d-%m-%Y_%H-%M")-$(git rev-parse --short HEAD || echo unknown)"
    tmp_schema="$ROOT/backups/_schema-${stamp}.sql"
    tmp_drop="$ROOT/backups/_drop-${stamp}.sql"
    mkdir -p "$ROOT/backups"
    bun x wrangler@latest d1 export "${D1_DB:?set D1_DB}" --remote --no-data --config "$ROOT/apps/server/wrangler.jsonc" --output "$tmp_schema"
    bash "$0" gen-drop-remote "$tmp_schema" "$tmp_drop"
    bun x wrangler@latest d1 execute "${D1_DB:?set D1_DB}" --remote --config "$ROOT/apps/server/wrangler.jsonc" --file "$tmp_drop"
    ;;
  cleanup-local)
    stamp="$(date +"%d-%m-%Y_%H-%M")-$(git rev-parse --short HEAD || echo unknown)"
    tmp_schema="$ROOT/backups/_schema-${stamp}.sql"
    tmp_drop="$ROOT/backups/_drop-${stamp}.sql"
    mkdir -p "$ROOT/backups"
    bun x wrangler@latest d1 export "${D1_DB:?set D1_DB}" --no-data --config "$ROOT/apps/server/wrangler.jsonc" --output "$tmp_schema"
    bash "$0" gen-drop-local "$tmp_schema" "$tmp_drop"
    bun x wrangler@latest d1 execute "${D1_DB:?set D1_DB}" --config "$ROOT/apps/server/wrangler.jsonc" --file "$tmp_drop"
    ;;
  clean-restore-remote-latest)
    stamp="$(date +"%d-%m-%Y_%H-%M")-$(git rev-parse --short HEAD || echo unknown)"
    tmp_schema="$ROOT/backups/_schema-${stamp}.sql"
    tmp_drop="$ROOT/backups/_drop-${stamp}.sql"
    mkdir -p "$ROOT/backups"
    bun x wrangler@latest d1 export "${D1_DB:?set D1_DB}" --remote --no-data --config "$ROOT/apps/server/wrangler.jsonc" --output "$tmp_schema"
    bash "$0" gen-drop-remote "$tmp_schema" "$tmp_drop"
    bun x wrangler@latest d1 execute "${D1_DB:?set D1_DB}" --remote --config "$ROOT/apps/server/wrangler.jsonc" --file "$tmp_drop"
    file=$(ls -t "$ROOT"/backups/remote-*.sql | head -n 1 || true)
    if [ -n "$file" ]; then
      bun x wrangler@latest d1 execute "${D1_DB:?set D1_DB}" --remote --config "$ROOT/apps/server/wrangler.jsonc" --file "$file"
    else
      echo no remote backup found; exit 1
    fi
    ;;
  clean-restore-local-latest)
    stamp="$(date +"%d-%m-%Y_%H-%M")-$(git rev-parse --short HEAD || echo unknown)"
    tmp_schema="$ROOT/backups/_schema-${stamp}.sql"
    tmp_drop="$ROOT/backups/_drop-${stamp}.sql"
    mkdir -p "$ROOT/backups"
    bun x wrangler@latest d1 export "${D1_DB:?set D1_DB}" --no-data --config "$ROOT/apps/server/wrangler.jsonc" --output "$tmp_schema"
    bash "$0" gen-drop-local "$tmp_schema" "$tmp_drop"
    bun x wrangler@latest d1 execute "${D1_DB:?set D1_DB}" --config "$ROOT/apps/server/wrangler.jsonc" --file "$tmp_drop"
    file=$(ls -t "$ROOT"/backups/local-*.sql | head -n 1 || true)
    if [ -n "$file" ]; then
      bun x wrangler@latest d1 execute "${D1_DB:?set D1_DB}" --config "$ROOT/apps/server/wrangler.jsonc" --file "$file"
    else
      echo no local backup found; exit 1
    fi
    ;;
  reset-local)
    rm -f "$ROOT/apps/server/.wrangler/state/v3/d1/miniflare-D1DatabaseObject"/*.sqlite*
    ;;
  clean-migrate-local)
    db="${D1_DB:-auth-litewkateam}"
    bun x wrangler@latest d1 execute "$db" --config "$ROOT/apps/server/wrangler.jsonc" --command "SELECT 1;"
    (cd "$ROOT/packages/db" && bun run db:migrate:local)
    ;;
  clean-migrate-remote)
    db="${D1_DB:-}"
    if [ -z "$db" ]; then echo Set D1_DB; exit 1; fi
    stamp="$(date +"%d-%m-%Y_%H-%M")-$(git rev-parse --short HEAD || echo unknown)"
    mkdir -p "$ROOT/backups"
    bun x wrangler@latest d1 export "$db" --remote --config "$ROOT/apps/server/wrangler.jsonc" --output "$ROOT/backups/remote-${stamp}.sql"
    bun x wrangler@latest d1 export "$db" --remote --no-data --config "$ROOT/apps/server/wrangler.jsonc" --output "$ROOT/backups/_schema-${stamp}.sql"
    tmp_drop="$ROOT/backups/_drop-notx-noq-${stamp}.sql"
    bash "$0" gen-drop-remote "$ROOT/backups/_schema-${stamp}.sql" "$tmp_drop"
    bun x wrangler@latest d1 execute "$db" --remote --config "$ROOT/apps/server/wrangler.jsonc" --file "$tmp_drop"
    (cd "$ROOT/packages/db" && bun run db:migrate:remote)
    ;;
  drizzle-studio-local)
    project_root="$ROOT"
    local_db_path="$(find "$project_root/apps/server/.wrangler/state/v3/d1/miniflare-D1DatabaseObject" -type f -name '*.sqlite' -print0 2>/dev/null | xargs -0 ls -t 2>/dev/null | head -1 || true)"
    if [ -z "$local_db_path" ]; then echo "Brak lokalnego pliku SQLite Miniflare."; exit 1; fi
    export LOCAL_DB_PATH="$local_db_path"
    (cd "$ROOT/packages/db" && PORT="${PORT:-4984}" drizzle-kit studio --port="$PORT")
    ;;
  drizzle-studio-remote)
    "$0" check-env "$ROOT/apps/server/.env" CLOUDFLARE_ACCOUNT_ID CLOUDFLARE_DATABASE_ID CLOUDFLARE_D1_TOKEN
    (cd "$ROOT/packages/db" && PORT="${PORT:-4985}" drizzle-kit studio --port="$PORT")
    ;;
  drizzle-push-local)
    project_root="$ROOT"
    local_db_path="$(find "$project_root/apps/server/.wrangler/state/v3/d1/miniflare-D1DatabaseObject" -type f -name '*.sqlite' -print0 2>/dev/null | xargs -0 ls -t 2>/dev/null | head -1 || true)"
    if [ -z "$local_db_path" ]; then echo "Brak lokalnego pliku SQLite Miniflare."; exit 1; fi
    export LOCAL_DB_PATH="$local_db_path"
    (cd "$ROOT/packages/db" && drizzle-kit push)
    ;;
  drizzle-push-remote)
    "$0" check-env "$ROOT/apps/server/.env" CLOUDFLARE_ACCOUNT_ID CLOUDFLARE_DATABASE_ID CLOUDFLARE_D1_TOKEN
    (cd "$ROOT/packages/db" && drizzle-kit push)
    ;;
  drizzle-generate-local)
    project_root="$ROOT"
    local_db_path="$(find "$project_root/apps/server/.wrangler/state/v3/d1/miniflare-D1DatabaseObject" -type f -name '*.sqlite' -print0 2>/dev/null | xargs -0 ls -t 2>/dev/null | head -1 || true)"
    if [ -z "$local_db_path" ]; then echo "Brak lokalnego pliku SQLite Miniflare."; exit 1; fi
    export LOCAL_DB_PATH="$local_db_path"
    (cd "$ROOT/packages/db" && drizzle-kit generate)
    ;;
  drizzle-generate-remote)
    "$0" check-env "$ROOT/apps/server/.env" CLOUDFLARE_ACCOUNT_ID CLOUDFLARE_DATABASE_ID CLOUDFLARE_D1_TOKEN
    (cd "$ROOT/packages/db" && drizzle-kit generate)
    ;;
  drizzle-migrate-local)
    project_root="$ROOT"
    local_db_path="$(find "$project_root/apps/server/.wrangler/state/v3/d1/miniflare-D1DatabaseObject" -type f -name '*.sqlite' -print0 2>/dev/null | xargs -0 ls -t 2>/dev/null | head -1 || true)"
    if [ -z "$local_db_path" ]; then echo "Brak lokalnego pliku SQLite Miniflare."; exit 1; fi
    export LOCAL_DB_PATH="$local_db_path"
    (cd "$ROOT/packages/db" && drizzle-kit migrate)
    ;;
  drizzle-migrate-remote)
    "$0" check-env "$ROOT/apps/server/.env" CLOUDFLARE_ACCOUNT_ID CLOUDFLARE_DATABASE_ID CLOUDFLARE_D1_TOKEN
    (cd "$ROOT/packages/db" && drizzle-kit migrate)
    ;;
  drizzle-studio-local-file)
    db_dir="$ROOT/packages/db/.local"
    db_file="$db_dir/dev.sqlite"
    mkdir -p "$db_dir"
    export LOCAL_DB_PATH="$db_file"
    (cd "$ROOT/packages/db" && PORT="${PORT:-4984}" drizzle-kit studio --port="$PORT")
    ;;
  drizzle-migrate-local-file)
    db_dir="$ROOT/packages/db/.local"
    db_file="$db_dir/dev.sqlite"
    mkdir -p "$db_dir"
    export LOCAL_DB_PATH="$db_file"
    (cd "$ROOT/packages/db" && drizzle-kit migrate)
    ;;
  drizzle-clean-migrate-local-file)
    db_dir="$ROOT/packages/db/.local"
    db_file="$db_dir/dev.sqlite"
    rm -f "$db_file"*
    mkdir -p "$db_dir"
    export LOCAL_DB_PATH="$db_file"
    (cd "$ROOT/packages/db" && drizzle-kit migrate)
    ;;
  *)
    echo "Usage: $0 gen-drop-remote|gen-drop-local|check-env|backup-remote|backup-local|backup-full|restore-remote|restore-local|restore-remote-latest|restore-local-latest|cleanup-remote|cleanup-local|clean-restore-remote-latest|clean-restore-local-latest|reset-local|clean-migrate-local|clean-migrate-remote|drizzle-studio-local|drizzle-studio-remote|drizzle-push-local|drizzle-push-remote|drizzle-generate-local|drizzle-generate-remote|drizzle-migrate-local|drizzle-migrate-remote|drizzle-studio-local-file|drizzle-migrate-local-file|drizzle-clean-migrate-local-file"
    exit 2
    ;;
esac
