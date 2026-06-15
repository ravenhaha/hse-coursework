#!/usr/bin/env sh
set -eu

COMPOSE_FILE="${COMPOSE_FILE:-compose.dev.yml}"
POSTGRES_SERVICE="${POSTGRES_SERVICE:-postgres}"
POSTGRES_DB="${POSTGRES_DB:-pencieve}"
POSTGRES_USER="${POSTGRES_USER:-user}"
BACKUP_DIR="${BACKUP_DIR:-/tmp/pencieve-backups}"
VERIFY_RESTORE="${VERIFY_RESTORE:-false}"

PROJECT_ROOT="$(CDPATH= cd -- "$(dirname -- "$0")/../.." && pwd)"
cd "$PROJECT_ROOT"

info() {
  printf '\n[backup-check] %s\n' "$1"
}

fail() {
  printf '\n[backup-check] ERROR: %s\n' "$1" >&2
  exit 1
}

need_cmd() {
  command -v "$1" >/dev/null 2>&1 || fail "Command not found: $1"
}

need_cmd docker
mkdir -p "$BACKUP_DIR"

backup_file="$BACKUP_DIR/${POSTGRES_DB}_$(date +%Y%m%d_%H%M%S).sql"

info "Creating pg_dump: $backup_file"
docker compose -f "$COMPOSE_FILE" exec -T "$POSTGRES_SERVICE" \
  pg_dump -U "$POSTGRES_USER" -d "$POSTGRES_DB" > "$backup_file"

[ -s "$backup_file" ] || fail "Backup file is empty"
grep -q "PostgreSQL database dump" "$backup_file" || fail "Backup file does not look like pg_dump output"

if [ "$VERIFY_RESTORE" = "true" ]; then
  restore_db="${POSTGRES_DB}_restore_check"
  info "Verifying restore in temporary database: $restore_db"
  docker compose -f "$COMPOSE_FILE" exec -T "$POSTGRES_SERVICE" \
    dropdb -U "$POSTGRES_USER" --if-exists "$restore_db"
  docker compose -f "$COMPOSE_FILE" exec -T "$POSTGRES_SERVICE" \
    createdb -U "$POSTGRES_USER" "$restore_db"
  docker compose -f "$COMPOSE_FILE" exec -T "$POSTGRES_SERVICE" \
    psql -U "$POSTGRES_USER" -d "$restore_db" < "$backup_file" >/dev/null
  docker compose -f "$COMPOSE_FILE" exec -T "$POSTGRES_SERVICE" \
    dropdb -U "$POSTGRES_USER" "$restore_db"
fi

info "Backup check passed"
printf '%s\n' "$backup_file"
