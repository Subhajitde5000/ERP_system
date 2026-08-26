"""ORM models for the Online Class module.

Live classes a teacher schedules from the timetable or starts instantly.
Participants rows track join/leave times so attendance is computed
automatically when the class ends, then synced to the canonical
``attendance_sessions`` / ``attendance_records`` tables.

New in production pass:
- ``online_classes.whiteboard_strokes``   – persisted board state (JSONB)
- ``online_class_muted_students``         – per-class chat mute list
- ``Notification`` model now managed by Alembic (removed from _UNMANAGED_TABLES)
"""

from __future__ import annotations

import enum
import uuid
from datetime import datetime

from sqlalchemy import BigInteger, Boolean, Enum as SAEnum, ForeignKey, Index, Integer, String, Text, UniqueConstraint
from sqlalchemy.dialects.postgresql import JSONB, TIMESTAMP, UUID
from sqlalchemy.orm import Mapped, mapped_column
from sqlalchemy.sql import func

from app.database import Base


# ── Enum types ────────────────────────────────────────────────────────────────

class OnlineClassStatus(str, enum.Enum):
    SCHEDULED = "SCHEDULED"
    LIVE      = "LIVE"
    COMPLETED = "COMPLETED"
    CANCELLED = "CANCELLED"


class OnlineClassMode(str, enum.Enum):
    SCHEDULED = "SCHEDULED"
    INSTANT   = "INSTANT"


class OnlineAttendanceStatus(str, enum.Enum):
    PRESENT = "PRESENT"
    LATE    = "LATE"
    ABSENT  = "ABSENT"


# ── Tables ───────────────────────────────────────────────────────────────────

class OnlineClass(Base):
    """A single live teaching session (scheduled or instant)."""
    __tablename__ = "online_classes"
    __table_args__ = (
        Index("idx_online_classes_tenant_status", "tenant_id", "status", "scheduled_at"),
        Index("idx_online_classes_teacher",        "teacher_id", "created_at"),
        Index("idx_online_classes_class",          "class_id",   "scheduled_at"),
    )

    id:                    Mapped[uuid.UUID]           = mapped_column(UUID(as_uuid=True), primary_key=True, default=uuid.uuid4)
    tenant_id:             Mapped[uuid.UUID]           = mapped_column(UUID(as_uuid=True), ForeignKey("tenants.id", ondelete="CASCADE"), nullable=False)
    teacher_id:            Mapped[uuid.UUID]           = mapped_column(UUID(as_uuid=True), ForeignKey("users.id"),                      nullable=False)
    class_id:              Mapped[uuid.UUID]           = mapped_column(UUID(as_uuid=True), ForeignKey("classes.id"),                    nullable=False)
    subject_id:            Mapped[uuid.UUID]           = mapped_column(UUID(as_uuid=True), ForeignKey("subjects.id"),                   nullable=False)
    timetable_slot_id:     Mapped[uuid.UUID | None]    = mapped_column(UUID(as_uuid=True), ForeignKey("timetable_slots.id", ondelete="SET NULL"), nullable=True)
    topic:                 Mapped[str]                 = mapped_column(String(255), nullable=False)
    mode:                  Mapped[OnlineClassMode]     = mapped_column(SAEnum(OnlineClassMode,   name="online_class_mode"),   nullable=False, default=OnlineClassMode.SCHEDULED)
    status:                Mapped[OnlineClassStatus]   = mapped_column(SAEnum(OnlineClassStatus, name="online_class_status"), nullable=False, default=OnlineClassStatus.SCHEDULED)
    scheduled_at:          Mapped[datetime | None]     = mapped_column(TIMESTAMP(timezone=True), nullable=True)
    duration_minutes:      Mapped[int]                 = mapped_column(Integer,  nullable=False, default=60)
    allow_join:            Mapped[bool]                = mapped_column(Boolean,  nullable=False, default=True)
    recording_enabled:     Mapped[bool]                = mapped_column(Boolean,  nullable=False, default=False)
    recording_url:         Mapped[str | None]          = mapped_column(Text,     nullable=True)
    started_at:            Mapped[datetime | None]     = mapped_column(TIMESTAMP(timezone=True), nullable=True)
    ended_at:              Mapped[datetime | None]     = mapped_column(TIMESTAMP(timezone=True), nullable=True)
    attendance_session_id: Mapped[uuid.UUID | None]    = mapped_column(UUID(as_uuid=True), ForeignKey("attendance_sessions.id", ondelete="SET NULL"), nullable=True)
    # JSONB list of stroke objects — capped at 500 entries; used to replay the
    # whiteboard for late joiners and to restore state after a page reload.
    whiteboard_strokes:    Mapped[dict]                = mapped_column(JSONB, nullable=False, server_default="[]")
    created_at:            Mapped[datetime]            = mapped_column(TIMESTAMP(timezone=True), nullable=False, server_default=func.now())


class OnlineClassParticipant(Base):
    """One row per student per class; tracks wait/join/leave timing."""
    __tablename__ = "online_class_participants"
    __table_args__ = (
        Index("uq_online_class_participants__class_id_student_id", "class_id", "student_id", unique=True),
        Index("idx_online_class_participants_class",   "class_id"),
        Index("idx_online_class_participants_student", "student_id"),
    )

    id:                Mapped[uuid.UUID]                      = mapped_column(UUID(as_uuid=True), primary_key=True, default=uuid.uuid4)
    tenant_id:         Mapped[uuid.UUID]                      = mapped_column(UUID(as_uuid=True), ForeignKey("tenants.id", ondelete="CASCADE"), nullable=False)
    class_id:          Mapped[uuid.UUID]                      = mapped_column(UUID(as_uuid=True), ForeignKey("online_classes.id",      ondelete="CASCADE"), nullable=False)
    student_id:        Mapped[uuid.UUID]                      = mapped_column(UUID(as_uuid=True), ForeignKey("users.id"),               nullable=False)
    waiting_since:     Mapped[datetime]                       = mapped_column(TIMESTAMP(timezone=True), nullable=False, server_default=func.now())
    joined_at:         Mapped[datetime | None]                = mapped_column(TIMESTAMP(timezone=True), nullable=True)
    left_at:           Mapped[datetime | None]                = mapped_column(TIMESTAMP(timezone=True), nullable=True)
    duration_seconds:  Mapped[int]                            = mapped_column(Integer, nullable=False, default=0)
    attendance_status: Mapped[OnlineAttendanceStatus | None]  = mapped_column(SAEnum(OnlineAttendanceStatus, name="online_attendance_status"), nullable=True)
    hand_raised_at:    Mapped[datetime | None]                = mapped_column(TIMESTAMP(timezone=True), nullable=True)
    is_online:         Mapped[bool]                           = mapped_column(Boolean, nullable=False, default=False)


class OnlineClassMutedStudent(Base):
    """Students muted by the teacher in a specific live class (chat blocked)."""
    __tablename__ = "online_class_muted_students"
    __table_args__ = (
        UniqueConstraint("class_id", "student_id", name="uq_muted__class_student"),
        Index("idx_muted_class", "class_id"),
    )

    id:         Mapped[uuid.UUID] = mapped_column(UUID(as_uuid=True), primary_key=True, default=uuid.uuid4)
    tenant_id:  Mapped[uuid.UUID] = mapped_column(UUID(as_uuid=True), ForeignKey("tenants.id", ondelete="CASCADE"), nullable=False)
    class_id:   Mapped[uuid.UUID] = mapped_column(UUID(as_uuid=True), ForeignKey("online_classes.id", ondelete="CASCADE"), nullable=False)
    student_id: Mapped[uuid.UUID] = mapped_column(UUID(as_uuid=True), ForeignKey("users.id"), nullable=False)
    muted_at:   Mapped[datetime]  = mapped_column(TIMESTAMP(timezone=True), nullable=False, server_default=func.now())


class OnlineClassMessage(Base):
    """Persistent chat messages for a live or completed class."""
    __tablename__ = "online_class_messages"
    __table_args__ = (Index("idx_online_class_messages_class", "class_id", "created_at"),)

    id:          Mapped[uuid.UUID] = mapped_column(UUID(as_uuid=True), primary_key=True, default=uuid.uuid4)
    tenant_id:   Mapped[uuid.UUID] = mapped_column(UUID(as_uuid=True), ForeignKey("tenants.id", ondelete="CASCADE"), nullable=False)
    class_id:    Mapped[uuid.UUID] = mapped_column(UUID(as_uuid=True), ForeignKey("online_classes.id", ondelete="CASCADE"), nullable=False)
    sender_id:   Mapped[uuid.UUID] = mapped_column(UUID(as_uuid=True), ForeignKey("users.id"), nullable=False)
    sender_role: Mapped[str]       = mapped_column(String(20), nullable=False)
    body:        Mapped[str]       = mapped_column(Text, nullable=False)
    created_at:  Mapped[datetime]  = mapped_column(TIMESTAMP(timezone=True), nullable=False, server_default=func.now())


class OnlineClassFile(Base):
    """Files shared during a class (by teacher or student)."""
    __tablename__ = "online_class_files"
    __table_args__ = (Index("idx_online_class_files_class", "class_id", "created_at"),)

    id:              Mapped[uuid.UUID] = mapped_column(UUID(as_uuid=True), primary_key=True, default=uuid.uuid4)
    tenant_id:       Mapped[uuid.UUID] = mapped_column(UUID(as_uuid=True), ForeignKey("tenants.id", ondelete="CASCADE"), nullable=False)
    class_id:        Mapped[uuid.UUID] = mapped_column(UUID(as_uuid=True), ForeignKey("online_classes.id", ondelete="CASCADE"), nullable=False)
    uploader_id:     Mapped[uuid.UUID] = mapped_column(UUID(as_uuid=True), ForeignKey("users.id"), nullable=False)
    uploader_role:   Mapped[str]       = mapped_column(String(20), nullable=False, default="TEACHER")
    file_name:       Mapped[str]       = mapped_column(String(255), nullable=False)
    file_path:       Mapped[str]       = mapped_column(Text, nullable=False)
    file_size_bytes: Mapped[int]       = mapped_column(BigInteger, nullable=False, default=0)
    mime_type:       Mapped[str]       = mapped_column(String(100), nullable=False, default="application/octet-stream")
    created_at:      Mapped[datetime]  = mapped_column(TIMESTAMP(timezone=True), nullable=False, server_default=func.now())


class Notification(Base):
    """In-app notifications (push-fallback for students).

    Used by the online-class module to tell students an instant class started,
    a scheduled class was cancelled, a class is about to begin, etc.
    This model is now fully Alembic-managed (removed from _UNMANAGED_TABLES).
    """
    __tablename__ = "notifications"
    __table_args__ = (Index("idx_notif_user_unread", "user_id", "is_read", "created_at"),)

    id:         Mapped[uuid.UUID]    = mapped_column(UUID(as_uuid=True), primary_key=True, default=uuid.uuid4)
    tenant_id:  Mapped[uuid.UUID | None] = mapped_column(UUID(as_uuid=True), ForeignKey("tenants.id"), nullable=True)
    user_id:    Mapped[uuid.UUID]    = mapped_column(UUID(as_uuid=True), ForeignKey("users.id", ondelete="CASCADE"), nullable=False)
    title:      Mapped[str]         = mapped_column(String(255), nullable=False)
    body:       Mapped[str]         = mapped_column(Text, nullable=False)
    type:       Mapped[str]         = mapped_column(String(50), nullable=False)
    data:       Mapped[dict]        = mapped_column(JSONB, nullable=False, server_default="{}")
    is_read:    Mapped[bool]        = mapped_column(Boolean, nullable=False, default=False)
    read_at:    Mapped[datetime | None] = mapped_column(TIMESTAMP(timezone=True), nullable=True)
    created_at: Mapped[datetime]    = mapped_column(TIMESTAMP(timezone=True), nullable=False, server_default=func.now())
