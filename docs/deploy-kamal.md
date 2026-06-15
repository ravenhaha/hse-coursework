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
   # положить свой публичный SSH-ключ в /home/deploy/.ssh/authorized_keys
   ```
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
| `ravenhaha` | ваш GitHub username (владелец GHCR-образов) |
| `ssh.user: deploy` | пользователь на VDS |

## Секреты

Kamal читает секреты из `.kamal/secrets` (там только ссылки на env).
Перед локальным деплоем экспортировать переменные окружения:

```bash
export KAMAL_REGISTRY_PASSWORD=<GitHub Personal Access Token с правом write:packages>
export SECRET_KEY=$(openssl rand -hex 32)
export POSTGRES_PASSWORD=<пароль БД>
export VK_CLIENT_SECRET=...        # или пустая строка, если OAuth не используется
export YANDEX_CLIENT_SECRET=...
```

В GitHub Actions те же значения задаются как Secrets репозитория
(см. `.github/workflows/deploy.yml`); GHCR-пуш использует встроенный `GITHUB_TOKEN`.

## Первичный деплой

```bash
# 1) Залогиниться в GHCR локально (один раз)
echo $KAMAL_REGISTRY_PASSWORD | docker login ghcr.io -u <github-username> --password-stdin

# 2) Собрать и запушить backend-образ (его Kamal не собирает — это accessory)
docker build -t ghcr.io/<owner>/pencieve-backend:latest ./backend
docker push ghcr.io/<owner>/pencieve-backend:latest

# 3) Провижининг VDS: установка kamal-proxy, accessories (postgres, backend),
#    сборка и выкладка frontend, выпуск TLS-сертификата
kamal setup
```

После этого приложение доступно по `https://<IP>.sslip.io`.
Миграции БД накатываются автоматически в entrypoint backend-контейнера
(`alembic upgrade head` перед стартом uvicorn).

## Повторные выкладки

- Через GitHub Actions: вкладка **Actions -> Deploy -> Run workflow**
  (или раскомментировать триггер `push: branches: [main]` в `deploy.yml`).
- Локально:
  ```bash
  kamal deploy                      # пересобрать и выложить frontend
  kamal accessory reboot backend    # обновить backend (после push нового образа)
  ```

## Проверка и диагностика

```bash
kamal app logs -f           # логи frontend
kamal accessory logs backend -f
kamal proxy logs -f         # логи kamal-proxy (в т.ч. выпуск сертификата)
curl -I https://<IP>.sslip.io               # ожидаем 200 и валидный TLS (frontend)
curl -i https://<IP>.sslip.io/api/users/me  # ожидаем 401 — запрос дошёл через nginx до backend
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
