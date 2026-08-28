"""
ERP Backend — Async Database Engine & Session Factory

Single source of truth for all database connectivity.
Uses SQLAlchemy 2.x async with asyncpg driver.
"""

from collections.abc import AsyncGenerator

from sqlalchemy import event
from sqlalchemy.ext.asyncio import (
    AsyncSession,
    async_sessionmaker,
    create_async_engine,
)
from sqlalchemy.orm import DeclarativeBase

from app.config import get_settings
from app.utils.rls import reset_rls_context_raw

settings = get_settings()

# ── Engine ────────────────────────────────────────────────────────────────────
# pool_pre_ping ensures stale connections are detected and replaced.
# echo=False in production; override via env if needed.
engine = create_async_engine(
    settings.DATABASE_URL,
    pool_pre_ping=True,
    pool_size=10,
    max_overflow=20,
    echo=settings.APP_DEBUG,
)


# ── Row-Level Security hygiene (audit issue H3) ───────────────────────────────
# The app sets per-request session settings (app.tenant_id / app.rls_bypass)
# to drive Postgres RLS. When a connection goes back to the pool we MUST wipe
# both settings, otherwise the next request could inherit someone else's
# tenant scope. checkin fires for every return, including error paths.
@event.listens_for(engine.sync_engine, "checkin")
def _sanitize_rls_on_checkin(dbapi_connection, connection_record):  # noqa: ANN001
    reset_rls_context_raw(dbapi_connection)

# ── Session factory ────────────────────────────────────────────────────────────
AsyncSessionLocal = async_sessionmaker(
    bind=engine,
    class_=AsyncSession,
    expire_on_commit=False,
    autoflush=False,
    autocommit=False,
)


# ── Base class for all ORM models ─────────────────────────────────────────────
class Base(DeclarativeBase):
    pass


# ── FastAPI dependency ─────────────────────────────────────────────────────────
async def get_db() -> AsyncGenerator[AsyncSession, None]:
    """
    Yields an async DB session for the duration of a request.
    Commits on clean exit, rolls back on exception, always closes.
    """
    async with AsyncSessionLocal() as session:
        try:
            yield session
            await session.commit()
        except Exception:
            await session.rollback()
            raise
        finally:
            await session.close()
