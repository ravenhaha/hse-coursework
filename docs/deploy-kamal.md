# Развёртывание на VDS через Kamal (Yandex Cloud)

Документ описывает production-развёртывание «Омут Памяти» на одном VDS
в Yandex Cloud с помощью Kamal 2. Это отдельный от локального Docker-режима
путь (локальный режим — см. `docs/docker-dev.md`).

> Статус: конфигурация подготовлена (`config/deploy.yml`, `.github/workflows/`,
> `backend/entrypoint.sh`). Первичный деплой выполняется вручную по шагам ниже;
> повторные выкладки — через GitHub Actions.

## Схема

```text
GitHub Actions (CI)            GitHub Actions (Deploy) / локально
  ├─ lint + build (frontend)     ├─ build & push backend -> GHCR
  ├─ smoke import (backend)      └─ kamal deploy
  └─ docker build (оба образа)         ↓ ssh
                                  VDS (Yandex Cloud, Docker Engine)
                                    ├─ kamal-proxy  (TLS :443, Let's Encrypt)
                                    │     -> frontend (nginx :80)
                                    │           -> /api, /uploads -> backend
                                    ├─ backend  (uvicorn :8000, 2 воркера)
                                    └─ postgres (:5432, volume)
```

Образы хранятся в GitHub Container Registry (`ghcr.io/<owner>/pencieve-*`).

## Что нужно подготовить

1. **VDS в Yandex Cloud**: 2 vCPU / 2 GB, Ubuntu 22.04+, публичный IP.
2. **Docker Engine на VDS** и пользователь `deploy` в группе `docker`:
   ```bash
   curl -fsSL https://get.docker.com | sh
   sudo useradd -m -s /bin/bash deploy && sudo usermod -aG docker deploy
   ```
   Публичный SSH-ключ для пользователя `deploy` добавляется в
   `/home/deploy/.ssh/authorized_keys`.
3. **Открыть порты** в группе безопасности Yandex Cloud: 22, 80, 443.
4. **Домен**: бесплатный через sslip.io — `<IP-с-дефисами>.sslip.io`
   (например, IP `203.0.113.10` -> `203-0-113-10.sslip.io`). DNS отдельно
   настраивать не нужно, sslip.io резолвит IP автоматически.
5. **Kamal локально**: `gem install kamal` (или `bundle install` через `Gemfile`).

## Заменить плейсхолдеры

В `config/deploy.yml` поменять:

| Плейсхолдер | На что |
|---|---|
| `203.0.113.10` | публичный IP VDS |
| `203-0-113-10.sslip.io` | тот же IP в формате sslip.io |
| `liaiv` | владелец GHCR-образов для текущего деплоя |
| `ssh.user: deploy` | пользователь на VDS |

## Секреты

Kamal читает секреты из `.kamal/secrets` (там только ссылки на env).
Перед локальным деплоем экспортировать переменные окружения:

```bash
export KAMAL_REGISTRY_USERNAME=<GitHub username владельца токена>
export KAMAL_REGISTRY_PASSWORD=<GitHub Personal Access Token с правом write:packages>
export SECRET_KEY=$(openssl rand -hex 32)
export POSTGRES_PASSWORD=<пароль БД>
export YANDEX_CLIENT_ID=...
export YANDEX_CLIENT_SECRET=...
```

В GitHub Actions те же значения задаются как Secrets репозитория
(см. `.github/workflows/deploy.yml`). Для GHCR нужны `KAMAL_REGISTRY_USERNAME`
и `KAMAL_REGISTRY_PASSWORD`, потому что образы текущего деплоя публикуются в
`ghcr.io/liaiv`. Также для `ssh-keyscan` нужен secret `VDS_HOST` со значением
публичного IP сервера, а `SSH_PRIVATE_KEY` используется workflow для создания
файла `~/.ssh/yandex_pencieve_kamal` на GitHub runner.
VK OAuth в текущей схеме оставлен как заглушка: `VK_CLIENT_ID` и
`VK_CLIENT_SECRET` передаются пустыми значениями и не требуют отдельного
секрета. Рабочей OAuth-интеграцией для production-like окружения остаётся
Yandex.

## Первичный деплой

```bash
echo $KAMAL_REGISTRY_PASSWORD | docker login ghcr.io -u "$KAMAL_REGISTRY_USERNAME" --password-stdin

docker buildx build --platform linux/amd64 \
  -t ghcr.io/liaiv/pencieve-backend:latest \
  --push ./backend

kamal setup
```

После этого приложение доступно по `https://<IP>.sslip.io`.
Миграции БД накатываются автоматически в entrypoint backend-контейнера
(`alembic upgrade head` перед стартом uvicorn).

## Повторные выкладки

- Через GitHub Actions: вкладка **Actions -> Deploy -> Run workflow**.
- Локально:
  ```bash
  kamal deploy
  kamal accessory reboot backend
  ```
  `kamal deploy` пересобирает и выкладывает frontend. `kamal accessory reboot
  backend` обновляет backend после публикации нового backend-образа.

## Проверка и диагностика

```bash
kamal app logs -f
kamal accessory logs backend -f
kamal proxy logs -f
curl -I https://<IP>.sslip.io
curl -i https://<IP>.sslip.io/api/users/me
BASE_URL=https://<IP>.sslip.io SERVER_HOST=<IP> SSH_KEY=~/.ssh/yandex_pencieve_kamal \
  scripts/devops/smoke-prod.sh
```

> `/health` бэкенда наружу через nginx не проксируется (nginx отдаёт SPA на всё, кроме
> `/api` и `/uploads`). Состояние backend проверяется его Docker healthcheck'ом
> (`127.0.0.1:8000/health` внутри контейнера) — см. `kamal accessory logs backend`.

Если frontend не достучался до backend, проверить, что имена в сети `kamal`
совпадают с `BACKEND_UPSTREAM`/`POSTGRES_HOST`:

```bash
ssh deploy@<IP> 'docker network inspect kamal --format "{{range .Containers}}{{.Name}} {{end}}"'
```

## Ограничения текущего варианта

- Развёртывание на **одном** VDS (backend, БД и proxy на одном хосте);
  горизонтального масштабирования и резервирования нет.
- Резервное копирование БД не автоматизировано (volume `pencieve_pg_data`
  можно бэкапить через `pg_dump`/снапшоты диска вручную).
- Мониторинг/алертинг и централизованный сбор логов не настроены.
- TLS-сертификат выпускается Let's Encrypt автоматически (kamal-proxy);
  при использовании только IP без домена HTTPS через Let's Encrypt недоступен.
