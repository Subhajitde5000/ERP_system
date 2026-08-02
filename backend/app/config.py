"""
ERP Backend — Settings

All configuration is loaded from environment variables (or a .env file).
Validated at startup — a missing required variable crashes immediately,
not at the first request.
"""

from functools import lru_cache
from pathlib import Path
from pydantic_settings import BaseSettings, SettingsConfigDict

# Resolve the .env path relative to this file so it is found regardless of
# the working directory uvicorn (or its --reload subprocess) was launched from.
_ENV_FILE = Path(__file__).parent.parent / ".env"


class Settings(BaseSettings):
    model_config = SettingsConfigDict(
        env_file=str(_ENV_FILE),
        env_file_encoding="utf-8",
        case_sensitive=False,
    )

    # ── Database ──────────────────────────────────────────────────────────────
    DATABASE_URL: str

    # ── JWT ───────────────────────────────────────────────────────────────────
    JWT_SECRET_KEY: str
    JWT_ALGORITHM: str = "HS256"
    ACCESS_TOKEN_EXPIRE_MINUTES: int = 15
    REFRESH_TOKEN_EXPIRE_DAYS: int = 7

    # ── Redis ─────────────────────────────────────────────────────────────────
    REDIS_URL: str = "redis://localhost:6379/0"

    # ── CORS ──────────────────────────────────────────────────────────────────
    ALLOWED_ORIGINS: str = "http://localhost:3000,http://localhost:5173"

    @property
    def allowed_origins_list(self) -> list[str]:
        return [o.strip() for o in self.ALLOWED_ORIGINS.split(",")]

    # ── App ───────────────────────────────────────────────────────────────────
    APP_ENV: str = "development"
    APP_DEBUG: bool = True

    # ── Signup / provisioning ─────────────────────────────────────────────────
    # Root domain used to build login URLs and subdomain checks, e.g.
    # https://green.xyz.com/login — defaults to xyz.com.
    PUBLIC_ROOT_DOMAIN: str = "xyz.com"
    TRIAL_DAYS: int = 14
    TENANT_DEFAULT_TIMEZONE: str = "Asia/Kolkata"

    # ── Frontend / URLs ───────────────────────────────────────────────────────
    FRONTEND_URL: str = "http://localhost:3000"

    # ── Email / SMTP ──────────────────────────────────────────────────────────
    EMAIL_ENABLED: bool = True
    SMTP_HOST: str = ""
    SMTP_PORT: int = 587
    SMTP_USER: str = ""
    SMTP_PASSWORD: str = ""
    SMTP_FROM: str = "noreply@xyz.com"
    SMTP_FROM_NAME: str = "XYZ ERP"
    SMTP_TLS: bool = True
    SMTP_SSL: bool = False
    # When SMTP_HOST is empty, emails are logged to console and marked SENT
    # (dev/no-mailer mode). Set to true to force console fallback even if SMTP
    # is configured.
    EMAIL_FORCE_CONSOLE: bool = False


@lru_cache
def get_settings() -> Settings:
    """
    Cached singleton — settings are read once and reused everywhere.
    Use FastAPI's Depends(get_settings) to inject into route handlers.
    """
    # pydantic BaseSettings may require environment values at type-check time;
    # ignore static type checking here because values are provided via env/.env at runtime.
    return Settings()  # type: ignore[arg-type]
