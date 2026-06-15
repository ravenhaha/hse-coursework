"""Точка входа FastAPI-приложения Pensieve."""

from contextlib import asynccontextmanager

from fastapi import Depends, FastAPI, Request, status
from fastapi.exceptions import RequestValidationError
from fastapi.middleware.cors import CORSMiddleware
from fastapi.responses import JSONResponse
from fastapi.staticfiles import StaticFiles
from slowapi.errors import RateLimitExceeded

from app.api.auth import router as auth_router
from app.api.collection import router as collection_router
from app.api.graph import router as graph_router
from app.api.material import router as material_router
from app.api.tag import router as tag_router
from app.api.user import router as user_router
from app.core.config import settings
from app.core.csrf import verify_csrf
from app.core.limiter import limiter
from app.core.validation import translate_validation_errors


@asynccontextmanager
async def lifespan(app: FastAPI):
    """Хуки старта/остановки приложения."""
    settings.ensure_upload_dirs()
    yield


app = FastAPI(
    title="Pensieve",
    description="Бэкенд для образовательного менеджера знаний",
    version="0.1.0",
    lifespan=lifespan,
)


# ══════════════════════════════════════════
# Rate limiting (slowapi)
# ══════════════════════════════════════════
app.state.limiter = limiter


@app.exception_handler(RateLimitExceeded)
async def rate_limit_handler(
    request: Request,
    exc: RateLimitExceeded,
) -> JSONResponse:
    """Ответ на превышение лимита запросов — на русском."""
    return JSONResponse(
        status_code=status.HTTP_429_TOO_MANY_REQUESTS,
        content={"detail": "Слишком много запросов. Попробуйте позже."},
    )


# ══════════════════════════════════════════
# Локализация ошибок валидации (422)
# ══════════════════════════════════════════
@app.exception_handler(RequestValidationError)
async def validation_exception_handler(
    request: Request,
    exc: RequestValidationError,
) -> JSONResponse:
    """Переводит ошибки валидации (422) на русский язык.

    Вся логика перевода вынесена в app.core.validation.
    """
    errors = translate_validation_errors(exc.errors())
    return JSONResponse(
        status_code=status.HTTP_422_UNPROCESSABLE_CONTENT,
        content={"detail": errors},
    )


# ══════════════════════════════════════════
# CORS
# ══════════════════════════════════════════
app.add_middleware(
    CORSMiddleware,
    allow_origins=[settings.FRONTEND_URL],
    allow_credentials=True,
    allow_methods=["GET", "POST", "PUT", "PATCH", "DELETE", "OPTIONS"],
    allow_headers=["Content-Type", "Authorization", "X-CSRF-Token"],
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
_csrf_dep = [Depends(verify_csrf)]

app.include_router(auth_router,       prefix=settings.API_PREFIX, dependencies=_csrf_dep)
app.include_router(user_router,       prefix=settings.API_PREFIX, dependencies=_csrf_dep)
app.include_router(collection_router, prefix=settings.API_PREFIX, dependencies=_csrf_dep)
app.include_router(material_router,   prefix=settings.API_PREFIX, dependencies=_csrf_dep)
app.include_router(tag_router,        prefix=settings.API_PREFIX, dependencies=_csrf_dep)
app.include_router(graph_router,      prefix=settings.API_PREFIX, dependencies=_csrf_dep)


# ══════════════════════════════════════════
# Healthcheck / root
# ══════════════════════════════════════════
@app.get("/")
async def root():
    return {"message": "Hello everyone! Good mood"}


@app.get("/health")
async def health():
    return {"status": "ok"}
