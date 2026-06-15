# Docker dev environment

Этот документ описывает локальный запуск проекта в Docker. Режим нужен для проверки всего приложения в контейнерах: frontend, backend и PostgreSQL.

## Что запускается

Локальный stack состоит из трёх контейнеров:

```text
frontend  -> React production build, отдаётся через nginx
backend   -> FastAPI-приложение
postgres  -> PostgreSQL 17
```

Связь между сервисами:

```text
browser
  -> http://localhost:3000
  -> frontend nginx
  -> /api проксируется в backend
  -> backend обращается к postgres
```

Порты на локальной машине:

```text
Frontend:  http://localhost:3000
Backend:   http://localhost:8000
PostgreSQL localhost:5440
```

## Почему Colima

На macOS контейнеры не запускаются напрямую в системе. Нужен локальный Linux runtime. Для этого в проекте рекомендуется Colima.

Colima выбран потому что:

- он легче Docker Desktop;
- работает через обычный Docker CLI;
- запускает Docker Engine внутри Linux VM;
- ближе к тому, как контейнеры будут работать на VDS;
- не требует большого GUI-приложения;
- хорошо подходит для учебного production-like окружения.

Важно: проект не зависит от Colima жёстко. `compose.dev.yml` будет работать с любым Docker-compatible runtime: Colima, Docker Desktop или Docker Engine на Linux.

## Подготовка

Проверь, что Docker работает через Colima:

```bash
docker context show
docker version
docker compose version
```

Ожидаемо:

```text
docker context show -> colima
```

Если Colima ещё не запущен:

```bash
colima start
docker context use colima
```

## Первый запуск

Команды выполняются из корня репозитория!!!

```bash
cd hse-coursework
```

Поднять stack:

```bash
docker compose -f compose.dev.yml up -d --build
```

Миграции применяются автоматически при старте backend-контейнера через
`backend/entrypoint.sh`. Отдельно запускать `alembic upgrade head` для обычного
Docker-старта не нужно.

После этого приложение доступно по адресу:

```text
http://localhost:3000
```

## Проверка

Посмотреть состояние контейнеров:

```bash
docker compose -f compose.dev.yml ps
```

Ожидаемо должно быть три сервиса со статусом `healthy`:

```text
postgres
backend
frontend
```

Проверить backend:

```bash
curl http://localhost:8000/health
```

Ожидаемый ответ:

```json
{"status":"ok"}
```

Проверить frontend:

```bash
curl -I http://localhost:3000
```

Ожидаемо:

```text
HTTP/1.1 200 OK
```

Проверить, что frontend проксирует API в backend:

```bash
curl -i http://localhost:3000/api/users/me
```

Если пользователь не авторизован, нормальный ответ:

```text
HTTP/1.1 401 Unauthorized
```

Это значит, что запрос дошёл до backend.

Проверить PostgreSQL:

```bash
docker compose -f compose.dev.yml exec postgres psql -U user -d pencieve -c "\dt"
```

В списке должны быть таблицы приложения и `alembic_version`.

## Повторный запуск

Если контейнеры уже были созданы:

```bash
docker compose -f compose.dev.yml up -d
```

Если менялся код backend или frontend:

```bash
docker compose -f compose.dev.yml up -d --build
```

Если менялся только frontend:

```bash
docker compose -f compose.dev.yml up -d --build frontend
```

Если менялся только backend:

```bash
docker compose -f compose.dev.yml up -d --build backend
```

Если появились новые миграции, достаточно пересобрать и перезапустить backend:

```bash
docker compose -f compose.dev.yml up -d --build backend
```

При старте контейнера entrypoint сам выполнит `alembic upgrade head`.

## Логи

Все сервисы:

```bash
docker compose -f compose.dev.yml logs -f
```

Только backend:

```bash
docker compose -f compose.dev.yml logs -f backend
```

Только frontend:

```bash
docker compose -f compose.dev.yml logs -f frontend
```

Только PostgreSQL:

```bash
docker compose -f compose.dev.yml logs -f postgres
```

## Остановка

Остановить контейнеры:

```bash
docker compose -f compose.dev.yml down
```

Остановить контейнеры и удалить данные БД:

```bash
docker compose -f compose.dev.yml down -v
```

Команду с `-v` использовать аккуратно: она удаляет Docker volumes, включая данные PostgreSQL и загруженные файлы.

## Что важно помнить

`compose.dev.yml` сейчас работает как контейнерная проверка полного приложения. Это не hot reload режим.

После изменения кода нужно пересобрать соответствующий сервис:

```bash
docker compose -f compose.dev.yml up -d --build frontend
docker compose -f compose.dev.yml up -d --build backend
```

Для обычной разработки можно по-прежнему запускать frontend и backend вручную. Docker dev environment нужен, чтобы проверить, что приложение собирается и работает в контейнерах.
