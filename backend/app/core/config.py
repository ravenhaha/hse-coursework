"""Конфигурация приложения: загружает переменные из .env через Pydantic Settings.

Принципы:
    - Здесь только env-зависимые настройки (БД, ключи, лимиты).
    - Глобальные константы (MIME-типы, расширения) — в core/constants.py.
"""

from functools import lru_cache
from pathlib import Path

from pydantic_settings import BaseSettings, SettingsConfigDict

BASE_DIR = Path(__file__).resolve().parents[2]
PROJECT_ROOT = BASE_DIR.parent


class Settings(BaseSettings):
    """Настройки приложения, считываемые из переменных окружения."""

    model_config = SettingsConfigDict(
        env_file=PROJECT_ROOT / ".env",
        env_file_encoding="utf-8",
        extra="ignore",
        case_sensitive=True,
    )

    # ── База данных ──
    POSTGRES_DB: str
    POSTGRES_USER: str
    POSTGRES_PASSWORD: str
    POSTGRES_HOST: str = "127.0.0.1"
    POSTGRES_PORT: int = 5432

    # ── Безопасность и JWT ──
    SECRET_KEY: str
    ALGORITHM: str = "HS256"
    ACCESS_TOKEN_EXPIRE_MINUTES: int = 30          # 30 минут
    REFRESH_TOKEN_EXPIRE_DAYS: int = 30             # 30 дней
    
    CSRF_ENABLED: bool = False

    # ── OAuth: VK ──
    VK_CLIENT_ID: str = ""
    VK_CLIENT_SECRET: str = ""
    VK_REDIRECT_URI: str = "http://localhost:8000/api/auth/vk/callback"

    # ── OAuth: Yandex ──
    YANDEX_CLIENT_ID: str = ""
    YANDEX_CLIENT_SECRET: str = ""
    YANDEX_REDIRECT_URI: str = "http://localhost:8000/api/auth/yandex/callback"

    # ── Фронтенд и режим работы ──
    FRONTEND_URL: str = "http://localhost:5173"
    IS_PRODUCTION: bool = False

    # ── API ──
    API_PREFIX: str = "/api"

    # ── Загрузка файлов ──
    UPLOADS_SUBDIR: str = "uploads"
    MAX_AVATAR_SIZE: int = 8 * 1024 * 1024          # 8 MB
    MAX_MATERIAL_FILE_SIZE: int = 50 * 1024 * 1024  # 50 MB

    # ──────────────────────────────────────────
    # Computed: БД
    # ──────────────────────────────────────────

    @property
    def DATABASE_URL(self) -> str:
        """Async-URL для подключения к PostgreSQL через psycopg (v3)."""
        return (
            f"postgresql+psycopg://{self.POSTGRES_USER}:{self.POSTGRES_PASSWORD}"
            f"@{self.POSTGRES_HOST}:{self.POSTGRES_PORT}/{self.POSTGRES_DB}"
        )

    # ──────────────────────────────────────────
    # Computed: Cookies
    # ──────────────────────────────────────────

    @property
    def COOKIE_SECURE(self) -> bool:
        """Флаг Secure для cookie: True только в проде (требует HTTPS)."""
        return self.IS_PRODUCTION

    @property
    def COOKIE_SAMESITE(self) -> str:
        """SameSite: 'none' в проде (для cross-site), 'lax' в dev."""
        return "none" if self.IS_PRODUCTION else "lax"

    @property
    def ACCESS_COOKIE_MAX_AGE(self) -> int:
        """Время жизни access-cookie в секундах (= TTL access-токена)."""
        return self.ACCESS_TOKEN_EXPIRE_MINUTES * 60

    @property
    def REFRESH_COOKIE_MAX_AGE(self) -> int:
        """Время жизни refresh-cookie в секундах (= TTL refresh-токена)."""
        return self.REFRESH_TOKEN_EXPIRE_DAYS * 24 * 60 * 60

    @property
    def REFRESH_COOKIE_PATH(self) -> str:
        """Path для refresh-cookie: узкий, чтобы браузер не слал его
        на каждый запрос к API. Сейчас "/api/auth" — только для эндпоинтов
        логина/refresh/logout. Если поменяется API_PREFIX — путь обновится
        автоматически."""
        return f"{self.API_PREFIX}/auth"

    # ──────────────────────────────────────────
    # Computed: пути к загрузкам
    # ──────────────────────────────────────────

    @property
    def UPLOADS_DIR(self) -> Path:
        """Корневая директория для пользовательских загрузок: backend/uploads/."""
        return BASE_DIR / self.UPLOADS_SUBDIR

    @property
    def AVATARS_DIR(self) -> Path:
        """Директория для аватаров: backend/uploads/avatars/."""
        return self.UPLOADS_DIR / "avatars"

    @property
    def MATERIALS_DIR(self) -> Path:
        """Директория для файлов материалов: backend/uploads/materials/."""
        return self.UPLOADS_DIR / "materials"

    def ensure_upload_dirs(self) -> None:
        """Создаёт все директории загрузок, если их нет.
        Вызывается один раз при старте приложения (в lifespan)."""
        self.AVATARS_DIR.mkdir(parents=True, exist_ok=True)
        self.MATERIALS_DIR.mkdir(parents=True, exist_ok=True)


@lru_cache
def get_settings() -> Settings:
    """Кэшированный синглтон настроек.
    Используется как FastAPI dependency: `Depends(get_settings)`."""
    return Settings()


settings = get_settings()