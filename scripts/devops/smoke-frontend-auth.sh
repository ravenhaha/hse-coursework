#!/usr/bin/env sh
set -eu

BASE_URL="${BASE_URL:-${1:-http://localhost:3000}}"
BASE_URL="${BASE_URL%/}"

info() {
  printf '\n[smoke-frontend-auth] %s\n' "$1"
}

fail() {
  printf '\n[smoke-frontend-auth] ERROR: %s\n' "$1" >&2
  exit 1
}

need_cmd() {
  command -v "$1" >/dev/null 2>&1 || fail "Command not found: $1"
}

fetch() {
  curl -fsSL "$1"
}

asset_url() {
  path="$1"
  case "$path" in
    http://*|https://*) printf '%s\n' "$path" ;;
    /*) printf '%s%s\n' "$BASE_URL" "$path" ;;
    *) printf '%s/%s\n' "$BASE_URL" "$path" ;;
  esac
}

need_cmd curl
need_cmd grep
need_cmd sed

info "Checking auth page"
auth_html="$(fetch "$BASE_URL/auth")"

main_js="$(printf '%s' "$auth_html" | sed -n 's/.*src="\([^"]*index-[^"]*\.js\)".*/\1/p' | head -1)"
[ -n "$main_js" ] || fail "Main frontend bundle was not found in /auth HTML"

info "Finding auth bundle"
main_js_body="$(fetch "$(asset_url "$main_js")")"
auth_js="$(printf '%s' "$main_js_body" | grep -o 'assets/AuthPage[^"]*\.js' | head -1 || true)"
[ -n "$auth_js" ] || fail "AuthPage bundle was not found in main bundle"

auth_js_body="$(fetch "$(asset_url "$auth_js")")"

info "Checking VK placeholder"
printf '%s' "$auth_js_body" | grep -q 'Вход через VK пока недоступен' \
  || fail "VK disabled label was not found"

if printf '%s' "$auth_js_body" | grep -q '/auth/vk'; then
  fail "VK OAuth route is still present in auth bundle"
fi

info "Checking Yandex OAuth route"
printf '%s' "$auth_js_body" | grep -q '/auth/yandex' \
  || fail "Yandex OAuth route was not found"

info "Frontend auth smoke check passed"
