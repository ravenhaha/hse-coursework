"""Точка входа FastAPI-приложения Pensieve."""

from contextlib import asynccontextmanager

from fastapi import Depends, FastAPI
from fastapi.middleware.cors import CORSMiddleware
from fastapi.staticfiles import StaticFiles

from app.api.auth import router as auth_router
from app.api.collection import router as collection_router
from app.api.material import router as material_router
from app.api.tag import router as tag_router
from app.api.user import router as user_router
from app.core.config import settings
from app.core.csrf import verify_csrf


@asynccontextmanager
async def lifespan(app: FastAPI):
    """Хуки старта/остановки приложения."""
    # Startup: гарантируем, что директории для загрузок существуют.
    settings.ensure_upload_dirs()
    yield
    # Shutdown: пока ничего.


app = FastAPI(
    title="Pensieve",
    description="Бэкенд для образовательного менеджера знаний",
    version="0.1.0",
    lifespan=lifespan,
)


# ══════════════════════════════════════════
# CORS
# ══════════════════════════════════════════
# ВАЖНО про спеку CORS:
#   - allow_credentials=True НЕСОВМЕСТИМ с allow_origins=["*"] и
#     allow_headers=["*"]. Браузер не пропустит preflight.
#   - Поэтому перечисляем origin и заголовки ЯВНО.
#
# X-CSRF-Token нужен для double-submit pattern (см. core/csrf.py):
# фронт читает cookie csrf_token и шлёт значение в этом заголовке.

app.add_middleware(
    CORSMiddleware,
    allow_origins=[settings.FRONTEND_URL],
    allow_credentials=True,
    allow_methods=["GET", "POST", "PUT", "PATCH", "DELETE", "OPTIONS"],
    allow_headers=[
        "Content-Type",
        "Authorization",
        "X-CSRF-Token",
    ],
)


# ══════════════════════════════════════════
# Статика загрузок
# ══════════════════════════════════════════
app.mount(
    "/uploads",
    StaticFiles(directory=str(settings.UPLOADS_DIR)),
    name="uploads",
)


# ══════════════════════════════════════════
# Роутеры с глобальной CSRF-защитой
# ══════════════════════════════════════════
# verify_csrf сам решает, что пропускать (см. core/csrf.py):
#   - safe-методы (GET/HEAD/OPTIONS);
#   - auth-эндпоинты (login/register/refresh/logout, OAuth);
#   - если CSRF_ENABLED=false (dev) — пропускает всё.
# Поэтому безопасно вешать dependency глобально, даже на auth.router.

_csrf_dep = [Depends(verify_csrf)]

app.include_router(auth_router,       prefix=settings.API_PREFIX, dependencies=_csrf_dep)
app.include_router(user_router,       prefix=settings.API_PREFIX, dependencies=_csrf_dep)
app.include_router(collection_router, prefix=settings.API_PREFIX, dependencies=_csrf_dep)
app.include_router(material_router,   prefix=settings.API_PREFIX, dependencies=_csrf_dep)
app.include_router(tag_router,        prefix=settings.API_PREFIX, dependencies=_csrf_dep)


# ══════════════════════════════════════════
# Healthcheck / root
# ══════════════════════════════════════════

@app.get("/")
async def root():
    return {"message": "Hello everyone! Good mood"}


@app.get("/health")
async def health():
    return {"status": "ok"}