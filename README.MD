# Омут Памяти

Курсовая работа — веб-приложение «Омут Памяти».

## Технологии

- **Frontend:** React, Vite
- **Backend:** FastAPI, Python
- **БД:** PostgreSQL 17, SQLAlchemy, Alembic
- **Инфра:** Docker

## Запуск

### База данных

```bash
# 1. Создай .env по образцу .env.example
cp .env.example .env

# 2. Запусти PostgreSQL
docker-compose up -d

# 3. Примени миграции
cd backend/app
alembic upgrade head
```

> 📖 Подробная инструкция: [docs/DB_SETUP.md](docs/DB_SETUP.md)

### Frontend

```bash
cd frontend
npm install
npm run dev
```

### Backend

```bash
cd backend
python -m venv .venv
.venv\Scripts\activate
pip install -r requirements.txt
uvicorn app.main:app --reload
```

## Авторы
Студенты НИУ ВШЭ