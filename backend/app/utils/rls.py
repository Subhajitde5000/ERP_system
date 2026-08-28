"""
PostgreSQL Row-Level Security context helpers (audit issue H3).

RLS is enabled by ``database/update_rls.sql`` on every table that carries a
``tenant_id`` column. The policy allows a row when EITHER:

* ``app.tenant_id`` (a session setting) equals the row's tenant, or
* ``app.rls_bypass`` is ``'on'`` (platform / owner / bootstrap contexts).

Why the context is re-applied on every transaction begin
---------------------------------------------------------
``set_config`` lives on a physical connection, but a SQLAlchemy session may
release its connection back to the pool after each commit and check out a
DIFFERENT one for the next statement (always true with NullPool). Settings
would silently vanish mid-request. To stay correct, the context is stored on
``session.info`` and an ``after_begin`` event listener re-applies it whenever
the session (re)starts a transaction on a (new) connection. The pool check-in
hook in ``app/database.py`` additionally wipes settings when connections are
returned, so nothing leaks between requests.

Rules of use
------------
* Authenticated TENANT requests → :func:`set_tenant_context` right after the
  user is resolved; every later query is then double-checked by Postgres.
* PLATFORM / OWNER / public bootstrap paths → :func:`enable_rls_bypass`.
* Both helpers are idempotent and safe to call repeatedly.
"""

from __future__ import annotations

import logging
import uuid
import weakref

from sqlalchemy import event, text
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy.orm import Session

logger = logging.getLogger(__name__)

_TENANT_GUC = "app.tenant_id"
_BYPASS_GUC = "app.rls_bypass"

_INFO_TENANT = "rls_tenant_id"
_INFO_BYPASS = "rls_bypass"
_INFO_HOOK = "rls_hook_installed"

# Real AsyncSession objects expose ``.info``; test doubles may not. This
# fallback keeps the context sticky for those without changing behaviour for
# production sessions.
_FALLBACK_INFO: "weakref.WeakKeyDictionary" = weakref.WeakKeyDictionary()


def _session_info(db) -> dict:
    """Return the mutable per-session context dict (session.info or fallback)."""
    info = getattr(db, "info", None)
    if isinstance(info, dict):
        return info
    try:
        return _FALLBACK_INFO.setdefault(db, {})
    except TypeError:  # not weak-referenceable — ephemeral store is fine
        return {}


def _apply_context_sync(connection, info: dict) -> None:
    """Write the session's stored RLS context onto a physical connection."""
    if info.get(_INFO_BYPASS):
        connection.execute(
            text(
                f"SELECT set_config('{_BYPASS_GUC}', 'on', false),"
                f"       set_config('{_TENANT_GUC}', '', false)"
            )
        )
    elif info.get(_INFO_TENANT):
        connection.execute(
            text(
                f"SELECT set_config('{_TENANT_GUC}', :tid, false),"
                f"       set_config('{_BYPASS_GUC}', 'off', false)"
            ),
            {"tid": info[_INFO_TENANT]},
        )


def _install_hook(db) -> None:
    """Re-apply the stored context whenever a new transaction/connection starts.

    No-op for session objects without a real ``sync_session`` (test doubles).
    """
    info = _session_info(db)
    if info.get(_INFO_HOOK):
        return
    info[_INFO_HOOK] = True

    sync_session = getattr(db, "sync_session", None)
    if not isinstance(sync_session, Session):
        return

    @event.listens_for(sync_session, "after_begin")
    def _reapply(session, transaction, connection):  # noqa: ANN001
        _apply_context_sync(connection, _session_info(session))


async def _apply_now_if_mid_transaction(db, stmt: str, params: dict | None = None) -> None:
    """
    Apply the context immediately when a transaction is already open
    (after_begin only fires for the NEXT transaction in that case).
    Skipped for non-SQLAlchemy session doubles used in unit tests.
    """
    if isinstance(db, AsyncSession) and db.in_transaction():
        await db.execute(text(stmt), params or {})


async def set_tenant_context(db: AsyncSession, tenant_id: uuid.UUID) -> None:
    """
    Scope the session to one tenant and turn the bypass OFF.

    Call once per tenant request, right after the authenticated user has been
    resolved. The context is applied by the after_begin hook (before the next
    statement executes) and persists across commits/connection changes.
    """
    info = _session_info(db)
    info[_INFO_TENANT] = str(tenant_id)
    info[_INFO_BYPASS] = False
    _install_hook(db)
    await _apply_now_if_mid_transaction(
        db,
        f"SELECT set_config('{_TENANT_GUC}', :tid, false),"
        f"       set_config('{_BYPASS_GUC}', 'off', false)",
        {"tid": str(tenant_id)},
    )


async def enable_rls_bypass(db: AsyncSession) -> None:
    """
    Allow the session to see all rows regardless of tenant.

    Use ONLY for platform/owner staff, public signup/provisioning, login
    bootstrap queries and background jobs. The choice is sticky on the
    session so connection churn cannot lose it.
    """
    info = _session_info(db)
    info[_INFO_BYPASS] = True
    info[_INFO_TENANT] = None
    _install_hook(db)
    await _apply_now_if_mid_transaction(
        db,
        f"SELECT set_config('{_BYPASS_GUC}', 'on', false),"
        f"       set_config('{_TENANT_GUC}', '', false)",
    )


def reset_rls_context_raw(dbapi_connection) -> None:
    """
    Synchronous reset for the SQLAlchemy pool ``checkin`` event.

    Runs on the raw DBAPI connection when it is returned to the pool, so the
    next borrower starts with a clean tenant context. Failures are swallowed
    (the connection is usually being returned because of an error) but
    logged, because a leaked context is a security concern.
    """
    try:
        cursor = dbapi_connection.cursor()
        try:
            cursor.execute(
                "SELECT set_config('app.tenant_id', '', false),"
                "       set_config('app.rls_bypass', '', false)"
            )
        finally:
            cursor.close()
        dbapi_connection.commit()
    except Exception:  # noqa: BLE001 — never break pool bookkeeping
        try:
            dbapi_connection.rollback()
        except Exception:  # noqa: BLE001
            pass
        logger.warning("RLS context reset failed on pool check-in", exc_info=True)
