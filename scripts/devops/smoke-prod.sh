#!/usr/bin/env sh
set -eu

BASE_URL="${BASE_URL:-${1:-}}"
SERVER_HOST="${SERVER_HOST:-}"

info() {
  printf '\n[smoke-prod] %s\n' "$1"
}

fail() {
  printf '\n[smoke-prod] ERROR: %s\n' "$1" >&2
  exit 1
}

need_cmd() {
  command -v "$1" >/dev/null 2>&1 || fail "Command not found: $1"
}

http_status() {
  curl -k -sS -o /dev/null -w "%{http_code}" "$1"
}

need_cmd curl

[ -n "$BASE_URL" ] || fail "Usage: BASE_URL=https://example.sslip.io $0"
BASE_URL="${BASE_URL%/}"

info "Checking frontend over HTTPS"
frontend_status="$(http_status "$BASE_URL/")"
case "$frontend_status" in
  200|301|302) ;;
  *) fail "Expected frontend HTTP 200/301/302, got $frontend_status" ;;
esac

info "Checking API route through proxy"
api_status="$(http_status "$BASE_URL/api/users/me")"
[ "$api_status" = "401" ] || fail "Expected API HTTP 401 without auth, got $api_status"

info "Checking uploads route through proxy"
uploads_status="$(http_status "$BASE_URL/uploads/not-found")"
case "$uploads_status" in
  404|401|403) ;;
  *) fail "Expected uploads route to reach backend/static files, got HTTP $uploads_status" ;;
esac

if [ -n "$SERVER_HOST" ]; then
  need_cmd nc
  info "Checking that PostgreSQL is not public on $SERVER_HOST:5432"
  if nc -z -w 3 "$SERVER_HOST" 5432 >/dev/null 2>&1; then
    fail "PostgreSQL port 5432 is reachable from outside"
  fi
fi

info "Production smoke check passed"
