from contextlib import asynccontextmanager

from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware
from fastapi.staticfiles import StaticFiles

from app.core.config import settings
from app.api.auth import router as auth_router
from app.api.user import router as user_router
from app.api.collection import router as collection_router
from app.api.material import router as material_router
from app.api.tag import router as tag_router


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

app.add_middleware(
    CORSMiddleware,
    allow_origins=[settings.FRONTEND_URL],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

app.mount(
    "/uploads",
    StaticFiles(directory=str(settings.UPLOADS_DIR)),
    name="uploads",
)

app.include_router(auth_router, prefix="/api")
app.include_router(user_router, prefix="/api")
app.include_router(collection_router, prefix="/api")
app.include_router(material_router, prefix="/api")
app.include_router(tag_router, prefix="/api")


@app.get("/")
async def root():
    return {"message": "Hello everyone! Good mood"}


@app.get("/health")
async def health():
    return {"status": "ok"}