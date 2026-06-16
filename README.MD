# Омут Памяти

Курсовая работа — веб-приложение «Омут Памяти».

## Технологии

- **Frontend:** React 19, Vite 7
- **Backend:** FastAPI, Python 3.13, SQLAlchemy 2.0 (async), Alembic
- **БД:** PostgreSQL 17 (драйвер psycopg3)
- **Инфра:** Docker, Docker Compose; деплой — Kamal + Yandex Cloud

## Запуск

### Вариант 1. Весь проект в Docker

Этот вариант удобен, когда нужно проверить приложение целиком: базу, backend и frontend.

```bash
cp .env.example .env
docker compose -f compose.dev.yml up -d --build
```

После запуска приложение доступно здесь:

```text
http://localhost:3000
```

Миграции БД в Docker-режиме запускаются автоматически при старте backend-контейнера.

Быстрая проверка:

```bash
docker compose -f compose.dev.yml ps
curl http://localhost:8000/health
curl -i http://localhost:3000/api/users/me
```

### Вариант 2. Только БД в Docker, backend/frontend вручную

Этот вариант удобен для обычной разработки, когда frontend и backend запускаются с hot reload.

```bash
cp .env.example .env
docker compose up -d
```

Backend:

```bash
cd backend
python -m venv .venv
source .venv/bin/activate
pip install -r requirements.txt
alembic upgrade head
uvicorn app.main:app --reload
```

Frontend:

```bash
cd frontend
npm install
npm run dev
```

## DevOps-проверки

Для базовой проверки инфраструктуры добавлены простые скрипты:

```bash
scripts/devops/smoke-local.sh
scripts/devops/smoke-frontend-auth.sh
scripts/devops/backup-check.sh
BASE_URL=https://<domain> SERVER_HOST=<ip> SSH_KEY=~/.ssh/yandex_pencieve_kamal scripts/devops/smoke-prod.sh
```

`smoke-local.sh` поднимает локальный Docker-стек и проверяет frontend, backend,
страницу авторизации, маршрут `/api/users/me`, uploads-маршрут и подключение к PostgreSQL.

`smoke-frontend-auth.sh` проверяет страницу авторизации: VK оставлен как
неактивная заглушка, а вход через Яндекс остаётся доступным.

`backup-check.sh` создаёт дамп PostgreSQL через `pg_dump`.

`smoke-prod.sh` нужен после развёртывания на VDS. Он проверяет HTTPS-доступ,
маршрут `/api/users/me`, uploads-маршрут через proxy и то, что PostgreSQL
не опубликован наружу как Docker port mapping или host listener.

Подробнее:

- [docs/docker-dev.md](docs/docker-dev.md) — локальный запуск в Docker;
- [docs/deploy-kamal.md](docs/deploy-kamal.md) — подготовка деплоя на VDS;
- [docs/current/10_SETUP_GUIDE_BACKEND.md](docs/current/10_SETUP_GUIDE_BACKEND.md) — backend.

## Авторы

Студенты НИУ ВШЭ
