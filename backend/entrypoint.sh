#!/bin/sh

set -e

echo "[entrypoint] alembic upgrade head ..."
alembic upgrade head

WORKERS="${WEB_CONCURRENCY:-2}"
echo "[entrypoint] starting uvicorn (${WORKERS} workers) on :8000 ..."
exec uvicorn app.main:app \
  --host 0.0.0.0 \
  --port 8000 \
  --workers "${WORKERS}" \
  --proxy-headers \
  --forwarded-allow-ips="*"
