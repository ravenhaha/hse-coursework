# 🗄️ Настройка базы данных Pencieve

## Содержание
- [Требования](#требования)
- [1. Запуск PostgreSQL через Docker](#1-запуск-postgresql-через-docker)
- [2. Настройка Python-окружения](#2-настройка-python-окружения)
- [3. Применение миграций](#3-применение-миграций)
- [4. Проверка](#4-проверка)
- [5. Полезные команды](#5-полезные-команды)
- [Структура проекта](#структура-проекта)
- [Примечание: синхронный vs асинхронный подход](#примечание-синхронный-vs-асинхронный-подход)

---

## Требования

- **Docker Desktop** — [скачать](https://www.docker.com/products/docker-desktop/)
- **Python 3.11+** — [скачать](https://www.python.org/downloads/)
- **Git** — [скачать](https://git-scm.com/)

---

## 1. Запуск PostgreSQL через Docker

### 1.1 Создай файл `.env` в корне проекта

В корне репозитория (`hse-coursework/`) создай файл `.env` по образцу `.env.example`:

```env
POSTGRES_DB=pencieve
POSTGRES_USER=user
POSTGRES_PASSWORD=secret
POSTGRES_PORT=5440
```

### 1.2 Запусти контейнер
```
cd hse-coursework
docker-compose up -d
```

### 1.3 Проверь что контейнер работает
```
docker ps
```
Должен быть контейнер pencieve-postgres со статусом Up ... (healthy)

## 2. Настройка Python-окружения

### 2.1 Создай виртуальное окружение
Windows (PowerShell):
```
cd backend
python -m venv .venv
.venv\Scripts\Activate.ps1
```
macOS / Linux:
```
cd backend
python3 -m venv .venv
source .venv/bin/activate
```
### 2.2 Установи зависимости
```
pip install -r requirements.txt
```

## 3. Применение миграций
```
cd backend/app
alembic upgrade head
```
Эта команда создаст все таблицы в базе данных:

* users — пользователи
* collections — коллекции (поддерживают вложенность через parent_id)
* materials — материалы (тексты, файлы)
* tags — теги пользователей
* material_tags — связь материалов и тегов (many-to-many)

## 4. Проверка
Подключись к базе и посмотри таблицы:
```
docker exec -it pencieve-postgres psql -U user -d pencieve -c "\dt"
```
Ожидаемый вывод:
  List of relations
 Schema |      Name       | Type  | Owner
--------+-----------------+-------+------
 public | alembic_version | table | user
 public | collections     | table | user
 public | material_tags   | table | user
 public | materials       | table | user
 public | tags            | table | user
 public | users           | table | user

Проверь структуру конркетной таблицы:
```
docker exec -it pencieve-postgres psql -U user -d pencieve -c "\d users"
```
## 5. Полезные команды
| Действие | Команда |
|----------|---------|
| Запустить контейнер | `docker-compose up -d` |
| Остановить контейнер | `docker-compose down` |
| Остановить и **удалить данные** | `docker-compose down -v` |
| Применить миграции | `cd backend/app && alembic upgrade head` |
| Откатить последнюю миграцию | `cd backend/app && alembic downgrade -1` |
| Создать новую миграцию | `cd backend/app && alembic revision --autogenerate -m "описание"` |
| Посмотреть текущую ревизию | `cd backend/app && alembic current` |
| SQL-консоль базы | `docker exec -it pencieve-postgres psql -U user -d pencieve` |

## Примечание: синхронный vs асинхронный подход
В проекте используется гибридный подход:
| Компонент | Режим | Драйвер | Почему |
|-----------|-------|---------|--------|
| **Alembic** (миграции) | Синхронный | `psycopg` | Стабильно на всех ОС, миграции не требуют async |
| **FastAPI** (API) | Асинхронный | `asyncpg` | Быстрее при множестве одновременных запросов |

**Можно ли сделать всё синхронно?**
Да. Заменить asyncpg на psycopg в db/session.py, использовать обычные Session вместо AsyncSession.

✅ Плюсы:
- Проще отлаживать
- Нет проблем с event loop на Windows
- Один драйвер на всё
❌ Минусы:
- Медленнее под нагрузкой — каждый запрос блокирует поток

**Можно ли сделать всё асинхронно?**
Да. Настроить alembic/env.py через run_async + asyncpg.

✅ Плюсы:
- Единый async-драйвер (asyncpg)
- Консистентность кода
❌ Минусы:
- Сложнее настройка env.py
-На Windows могут быть проблемы с asyncio event loop (ошибки ProactorEventLoop)
- Для миграций async не даёт реального выигрыша — они запускаются однократно

**Вывод: гибридный подход, как у нас в проекте, — оптимальный баланс простоты и производительности.**