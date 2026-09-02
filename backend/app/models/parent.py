"""
ORM Model — parent_student_links (+ the access rules the parent portal reads)

One row = one guardian's access grant to one student. The table itself predates
the parent portal (it existed in database.sql as a bare relation/is_primary
pair), which is why the ORM for it lived, cramped, inside `models/hostel.py`
for the warden's "guaranteed can see this room" check. The portal needs the same
rows for nine more screens, so the model is here now and hostel imports it.

Why an *access grant* rather than a family note:

  status          PENDING_CLAIM → ACTIVE → SUSPENDED. A school pauses a
                  guardian (fee dispute, custody order, alumnus who stopped
                  paying) without destroying the history, and re-opens it.
  activation_code the guardian code on the admission slip. The school records a
                  link by email; the parent claims it and the row gains a
                  parent_id. Nobody has to hand-create an account, and the code
                  is cleared on claim so it cannot be replayed.
  access_scope    the modules this guardian may open. Two parents of one child
                  legitimately see different things, so the scope lives on the
                  link, not on the PARENT role.
  access_upto     optional end date for a temporary guardian.

`parent_id` is nullable because an invite exists before the account does;
`ck_parent_student_links_guardian` guarantees one of parent_id / parent_email
is always present, so a row can never be an orphan pointing at nobody.
"""

from __future__ import annotations

import enum
import uuid
from datetime import date, datetime

from sqlalchemy import (
    Boolean,
    CheckConstraint,
    Date,
    ForeignKey,
    Index,
    String,
    Text,
    UniqueConstraint,
    text,
)
from sqlalchemy.dialects.postgresql import ARRAY, TIMESTAMP, UUID
from sqlalchemy.orm import Mapped, mapped_column
from sqlalchemy.sql import func

from app.database import Base


class LinkStatus(str, enum.Enum):
    """Lifecycle of a guardian's access grant (`parent_student_links.status`)."""

    PENDING_CLAIM = "PENDING_CLAIM"  # invited, no account attached yet
    ACTIVE = "ACTIVE"                # portal open
    SUSPENDED = "SUSPENDED"          # paused by the school; history retained


#: Modules a guardian can be granted read access to. Mirrors the
#: `access_scope` DEFAULT in database.sql — keep the two in step, or a link
#: created by SQL and a link created by the API would behave differently.
PARENT_ACCESS_MODULES: tuple[str, ...] = (
    "attendance",
    "timetable",
    "examination",
    "assignment",
    "results",
    "notice",
    "finance",
)

#: The scope an admin gets when they do not choose one: everything a school
#: card-moment needs, and nothing a student would expect to keep private.
DEFAULT_PARENT_ACCESS_SCOPE: tuple[str, ...] = PARENT_ACCESS_MODULES


class ParentStudentLink(Base):
    __tablename__ = "parent_student_links"

    # Async ORM rule: a column whose value is produced by SQL (`onupdate=now()`)
    # is expired after every flush, and reading it then issues a lazy SELECT —
    # which in an async session raises MissingGreenlet and surfaces to the office
    # as a 500 on a PATCH that worked. Fetching defaults during the flush keeps
    # `updated_at` readable, and costs one RETURNING instead of a round trip.
    __mapper_args__ = {"eager_defaults": True}

    id: Mapped[uuid.UUID] = mapped_column(
        UUID(as_uuid=True), primary_key=True, default=uuid.uuid4
    )
    tenant_id: Mapped[uuid.UUID] = mapped_column(
        UUID(as_uuid=True), ForeignKey("tenants.id"), nullable=False
    )
    # NULL until an invite is claimed — see the module docstring.
    parent_id: Mapped[uuid.UUID | None] = mapped_column(
        UUID(as_uuid=True), ForeignKey("users.id"), nullable=True
    )
    parent_email: Mapped[str | None] = mapped_column(String(255), nullable=True)
    student_id: Mapped[uuid.UUID] = mapped_column(
        UUID(as_uuid=True), ForeignKey("users.id"), nullable=False
    )
    relation: Mapped[str] = mapped_column(String(50), nullable=False)
    is_primary: Mapped[bool] = mapped_column(Boolean, nullable=False, default=False)
    status: Mapped[str] = mapped_column(
        String(20), nullable=False, server_default=LinkStatus.ACTIVE.value
    )
    access_scope: Mapped[list[str]] = mapped_column(
        ARRAY(Text),
        nullable=False,
        # Must be a text() clause: a plain string here is quoted into a string
        # literal by DDL, which Postgres then rejects as a malformed array. The
        # same default is written into database.sql and update_parent_portal.sql
        # so a row inserted by hand in psql behaves exactly like one the API
        # created — "full access by default" cannot depend on which door you used.
        server_default=text("'{%s}'::text[]" % ",".join(DEFAULT_PARENT_ACCESS_SCOPE)),
        default=lambda: list(DEFAULT_PARENT_ACCESS_SCOPE),
    )
    activation_code: Mapped[str | None] = mapped_column(String(24), nullable=True)
    code_expires_at: Mapped[datetime | None] = mapped_column(
        TIMESTAMP(timezone=True), nullable=True
    )
    claimed_at: Mapped[datetime | None] = mapped_column(
        TIMESTAMP(timezone=True), nullable=True
    )
    access_upto: Mapped[date | None] = mapped_column(Date, nullable=True)
    managed_by: Mapped[uuid.UUID | None] = mapped_column(
        UUID(as_uuid=True),
        ForeignKey("users.id", ondelete="SET NULL"),
        nullable=True,
    )
    note: Mapped[str | None] = mapped_column(Text, nullable=True)
    created_at: Mapped[datetime] = mapped_column(
        TIMESTAMP(timezone=True), nullable=False, server_default=func.now()
    )
    updated_at: Mapped[datetime] = mapped_column(
        TIMESTAMP(timezone=True), nullable=False, server_default=func.now(), onupdate=func.now()
    )

    __table_args__ = (
        UniqueConstraint(
            "parent_id",
            "student_id",
            name="uq_parent_student_links__parent_id_student_id",
        ),
        CheckConstraint(
            "status IN ('PENDING_CLAIM','ACTIVE','SUSPENDED')",
            name="ck_parent_student_links_status",
        ),
        CheckConstraint(
            "parent_id IS NOT NULL OR parent_email IS NOT NULL",
            name="ck_parent_student_links_guardian",
        ),
        # A code only exists while the link is waiting to be claimed, so a
        # leaked code can never reopen a connection that already exists.
        CheckConstraint(
            "activation_code IS NULL OR status = 'PENDING_CLAIM'",
            name="ck_parent_student_links_activation",
        ),
        Index(
            "idx_parent_student_links_parent_active",
            "tenant_id",
            "parent_id",
            "status",
            postgresql_where="parent_id IS NOT NULL",
        ),
        Index(
            "idx_parent_student_links_pending_email",
            "tenant_id",
            "parent_email",
            postgresql_where="parent_email IS NOT NULL",
        ),
        Index("idx_parent_student_links_student_id", "student_id"),
        Index("idx_parent_student_links_tenant_id", "tenant_id"),
        Index("idx_parent_student_links_managed_by", "managed_by"),
        # Partial uniques express "at most one *live* thing", which a plain
        # UNIQUE cannot: a suspended primary must stay on the row for history.
        Index(
            "uq_parent_student_links_activation_code",
            "activation_code",
            unique=True,
            postgresql_where="activation_code IS NOT NULL",
        ),
        Index(
            "uq_parent_student_links_primary_active",
            "tenant_id",
            "student_id",
            unique=True,
            postgresql_where="is_primary AND status = 'ACTIVE'",
        ),
        Index(
            "uq_parent_student_links_pending_email_student",
            "tenant_id",
            "parent_email",
            "student_id",
            unique=True,
            postgresql_where="parent_email IS NOT NULL AND parent_id IS NULL",
        ),
    )

    # ── access rules ─────────────────────────────────────────────────────────

    def is_live(self, today: date | None = None) -> bool:
        """Whether this grant currently opens the portal for its child.

        Three independent doors, and the strictest one wins: the status must be
        ACTIVE, an account must be attached (a PENDING_CLAIM row has no
        `parent_id`, so there is nobody to authorise), and `access_upto` must
        not have passed. `today` is the *tenant's* calendar day, so a guardian
        whose access ends on the 31st does not lose it at midnight UTC.
        """
        if self.status != LinkStatus.ACTIVE.value or self.parent_id is None:
            return False
        if self.access_upto is None:
            return True
        return (today or date.today()) <= self.access_upto

    def allows(self, module: str) -> bool:
        """Per-link module gate. Empty scope = nothing, deliberately."""
        return module in (self.access_scope or [])

    def __repr__(self) -> str:
        who = str(self.parent_id) if self.parent_id else self.parent_email or "?"
        return f"<ParentStudentLink {who} → {self.student_id} [{self.status}]>"
