# Setup Guide — Backend

Пошаговая инструкция по локальному запуску backend-проекта «Омут памяти».

## Важно
В пользовательской документации проект называется «Омут памяти».

Во внутренних технических артефактах, переменных окружения, docker-именах и части старых файлов может использоваться историческое имя `pencieve`. Это нормально и не считается отдельным продуктом.

---

## Требования

- Docker Desktop
- Python 3.11+
- Git

Проверка установки:

```bash
python --version
docker --version
git --version
```

---

## 1. Запуск PostgreSQL через Docker

### 1.1 Создать `.env` в корне проекта

В корне репозитория создай `.env` по образцу `.env.example`:

```env
POSTGRES_DB=pencieve
POSTGRES_USER=user
POSTGRES_PASSWORD=secret
POSTGRES_PORT=5440
```

### 1.2 Запустить контейнер

```bash
cd hse-coursework
docker-compose up -d
```

### 1.3 Проверить статус контейнера

```bash
docker ps
```

Ожидается контейнер PostgreSQL со статусом `Up`.

---

## 2. Настройка Python-окружения

### 2.1 Создать виртуальное окружение

#### Windows (PowerShell)

```bash
cd backend
python -m venv .venv
.venv\Scripts\Activate.ps1
```

#### macOS / Linux

```bash
cd backend
python3 -m venv .venv
source .venv/bin/activate
```

### 2.2 Установить зависимости

```bash
pip install -r requirements.txt
```

---

## 3. Применение миграций

```bash
cd backend/app
alembic upgrade head
```

---

## 4. Проверка

### 4.1 Посмотреть таблицы

```bash
docker exec -it pencieve-postgres psql -U user -d pencieve -c "\dt"
```

Среди таблиц ожидаются:
- `alembic_version`
- `users`
- `auth_accounts`
- `collections`
- `materials`
- `tags`
- `material_tags`

### 4.2 Посмотреть структуру конкретной таблицы

```bash
docker exec -it pencieve-postgres psql -U user -d pencieve -c "\d users"
```

---

## 5. Полезные команды

| Действие | Команда |
|----------|---------|
| Запустить контейнер | `docker-compose up -d` |
| Остановить контейнер | `docker-compose down` |
| Остановить и удалить данные | `docker-compose down -v` |
| Применить миграции | `cd backend/app && alembic upgrade head` |
| Откатить последнюю миграцию | `cd backend/app && alembic downgrade -1` |
| Создать новую миграцию | `cd backend/app && alembic revision --autogenerate -m "описание"` |
| Текущая ревизия | `cd backend/app && alembic current` |
| SQL-консоль БД | `docker exec -it pencieve-postgres psql -U user -d pencieve` |

---

## 6. Примечание по sync / async

В проекте используется гибридный подход:

| Компонент | Режим | Драйвер | Почему |
|-----------|-------|---------|--------|
| Alembic | синхронный | `psycopg` | проще и стабильнее для миграций |
| FastAPI API | асинхронный | `asyncpg` | лучше для конкурентных запросов |

### Почему так
- миграции запускаются редко и не требуют async;
- API выигрывает от асинхронного режима;
- это даёт хороший баланс простоты и производительности.

### Если всё сделать синхронным
Плюсы:
- проще отладка;
- единый драйвер;
- меньше тонкостей с event loop.

Минусы:
- хуже поведение под нагрузкой;
- блокирующие запросы.

### Если всё сделать асинхронным
Плюсы:
- единый async-подход;
- единообразие кода.

Минусы:
- сложнее настройка Alembic;
- больше инфраструктурной сложности;
- реального выигрыша для миграций почти нет.

---

## 7. Примечание по auth-конфигу

Для локального запуска auth-механизмов могут понадобиться env-переменные для:
- JWT / cookie-настроек;
- CSRF;
- OAuth Yandex;
- OAuth VK.

Если VK-secret не задан, VK OAuth может работать не полностью и возвращать `501`.

---

## 8. Что должно считаться успешным локальным запуском

Локальный backend считается поднятым корректно, если:
1. контейнер PostgreSQL работает;
2. миграции применяются без ошибок;
3. API стартует;
4. регистрация / логин работают;
5. создаются коллекции, материалы и теги;
6. поиск и базовые CRUD-операции доступны.