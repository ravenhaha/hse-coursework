#!/usr/bin/env sh
set -eu

COMPOSE_FILE="${COMPOSE_FILE:-compose.dev.yml}"
FRONTEND_URL="${FRONTEND_URL:-http://localhost:3000}"
BACKEND_URL="${BACKEND_URL:-http://localhost:8000}"
API_CHECK_URL="${API_CHECK_URL:-$FRONTEND_URL/api/users/me}"
UPLOADS_CHECK_URL="${UPLOADS_CHECK_URL:-$FRONTEND_URL/uploads/not-found}"
POSTGRES_DB="${POSTGRES_DB:-pencieve}"
POSTGRES_USER="${POSTGRES_USER:-user}"

PROJECT_ROOT="$(CDPATH= cd -- "$(dirname -- "$0")/../.." && pwd)"
cd "$PROJECT_ROOT"

info() {
  printf '\n[smoke-local] %s\n' "$1"
}

fail() {
  printf '\n[smoke-local] ERROR: %s\n' "$1" >&2
  exit 1
}

need_cmd() {
  command -v "$1" >/dev/null 2>&1 || fail "Command not found: $1"
}

http_status() {
  curl -sS -o /dev/null -w "%{http_code}" "$1"
}

container_health() {
  service="$1"
  container_id="$(docker compose -f "$COMPOSE_FILE" ps -q "$service")"
  [ -n "$container_id" ] || return 1
  docker inspect -f '{{if .State.Health}}{{.State.Health.Status}}{{else}}{{.State.Status}}{{end}}' "$container_id"
}

wait_service_healthy() {
  service="$1"
  info "Waiting for $service container health"
  i=0
  while [ "$i" -lt 90 ]; do
    status="$(container_health "$service" 2>/dev/null || true)"
    if [ "$status" = "healthy" ] || [ "$status" = "running" ]; then
      return 0
    fi
    i=$((i + 1))
    sleep 2
  done

  docker compose -f "$COMPOSE_FILE" ps
  docker compose -f "$COMPOSE_FILE" logs --tail=80 "$service"
  fail "$service did not become healthy"
}

need_cmd docker
need_cmd curl

info "Checking Docker"
docker info >/dev/null 2>&1 || fail "Docker daemon is not available. Start Colima or Docker Desktop first."

info "Validating $COMPOSE_FILE"
docker compose -f "$COMPOSE_FILE" config >/dev/null

info "Starting local stack"
docker compose -f "$COMPOSE_FILE" up -d --build

info "Waiting for backend healthcheck"
i=0
while [ "$i" -lt 90 ]; do
  if curl -fs "$BACKEND_URL/health" 2>/dev/null | grep -q '"status"[[:space:]]*:[[:space:]]*"ok"'; then
    break
  fi
  i=$((i + 1))
  sleep 2
done

if [ "$i" -ge 90 ]; then
  docker compose -f "$COMPOSE_FILE" ps
  docker compose -f "$COMPOSE_FILE" logs --tail=80 backend
  fail "Backend did not become healthy"
fi

info "Checking frontend"
frontend_status="$(http_status "$FRONTEND_URL")"
[ "$frontend_status" = "200" ] || fail "Expected frontend HTTP 200, got $frontend_status"

info "Checking API proxy through frontend/nginx"
api_status="$(http_status "$API_CHECK_URL")"
[ "$api_status" = "401" ] || fail "Expected API HTTP 401 without auth, got $api_status"

info "Checking uploads proxy through frontend/nginx"
uploads_status="$(http_status "$UPLOADS_CHECK_URL")"
case "$uploads_status" in
  404|401|403) ;;
  *) fail "Expected uploads route to reach backend/static files, got HTTP $uploads_status" ;;
esac

info "Checking PostgreSQL from compose network"
docker compose -f "$COMPOSE_FILE" exec -T postgres \
  psql -U "$POSTGRES_USER" -d "$POSTGRES_DB" -c "select 1;" >/dev/null

wait_service_healthy postgres
wait_service_healthy backend
wait_service_healthy frontend

info "Local smoke check passed"
docker compose -f "$COMPOSE_FILE" ps
