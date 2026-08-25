"""Online Class API — schedule or start live classes, join, auto-attendance.

Teacher endpoints live under the teaching scope; student endpoints are scoped
to the caller's active enrollment. The WebSocket carries the live classroom:
presence, chat, raise-hand, WebRTC signalling, whiteboard strokes.
"""

from __future__ import annotations

import contextlib
import json
import uuid
from datetime import datetime, timezone
from pathlib import Path
from typing import Annotated

import anyio
from fastapi import APIRouter, Depends, File, Query, UploadFile, WebSocket, WebSocketDisconnect, status
from jose import JWTError
from sqlalchemy.ext.asyncio import AsyncSession

from app.database import get_db
from app.dependencies.auth import get_current_tenant_user_student, get_current_tenant_user_teacher
from app.models.online_class import OnlineClass, OnlineClassStatus
from app.models.user import User
from app.schemas.common import APIResponse
from app.schemas.online_class import (
    APIResponseOnlineAttendanceReport,
    APIResponseOnlineClass,
    APIResponseOnlineClassDetail,
    APIResponseOnlineClassPage,
    APIResponseOnlineClassSetupOptions,
    APIResponseOnlineFile,
    APIResponseOnlineFiles,
    APIResponseOnlineMessages,
    APIResponseStudentOnlineClasses,
    OnlineClassCreate,
    OnlineClassUpdate,
    StudentOnlineClassRow,
)
from app.services.jwt_service import decode_access_token
from app.services.online_class_service import OnlineClassService, live_rooms

router = APIRouter(prefix="/online-classes", tags=["Online Classes"])

DB = Annotated[AsyncSession, Depends(get_db)]
Teacher = Annotated[User, Depends(get_current_tenant_user_teacher)]
Student = Annotated[User, Depends(get_current_tenant_user_student)]

UPLOADS_ROOT = Path(__file__).resolve().parent.parent.parent / "uploads"

# ── Teacher: setup & lifecycle ────────────────────────────────────────────────


@router.get("/setup-options", response_model=APIResponseOnlineClassSetupOptions)
async def setup_options(db: DB, teacher: Teacher):
    return APIResponse(
        success=True, data=await OnlineClassService.setup_options(db, teacher), message="Setup options loaded"
    )


@router.post("", response_model=APIResponseOnlineClass, status_code=status.HTTP_201_CREATED)
async def schedule_class(payload: OnlineClassCreate, db: DB, teacher: Teacher):
    return APIResponse(
        success=True,
        data=await OnlineClassService.create_scheduled(db, teacher, payload),
        message="Online class scheduled",
    )


@router.post("/instant", response_model=APIResponseOnlineClass, status_code=status.HTTP_201_CREATED)
async def start_instant_class(payload: OnlineClassCreate, db: DB, teacher: Teacher):
    return APIResponse(
        success=True,
        data=await OnlineClassService.create_instant(db, teacher, payload),
        message="Class is live — students notified",
    )


@router.get("", response_model=APIResponseOnlineClassPage)
async def teacher_classes(
    db: DB,
    teacher: Teacher,
    status_filter: str | None = Query(default=None, alias="status"),
    limit: int = Query(default=50, ge=1, le=100),
    offset: int = Query(default=0, ge=0),
):
    return APIResponse(
        success=True,
        data=await OnlineClassService.list_for_teacher(db, teacher, status_filter, limit, offset),
        message="Online classes loaded",
    )


@router.get("/{class_id}", response_model=APIResponseOnlineClassDetail)
async def class_detail(class_id: uuid.UUID, db: DB, teacher: Teacher):
    return APIResponse(
        success=True, data=await OnlineClassService.detail_for_teacher(db, teacher, class_id), message="Class loaded"
    )


@router.post("/{class_id}/start", response_model=APIResponseOnlineClass)
async def start_class(class_id: uuid.UUID, db: DB, teacher: Teacher):
    return APIResponse(success=True, data=await OnlineClassService.start(db, teacher, class_id), message="Class is live")


@router.patch("/{class_id}", response_model=APIResponseOnlineClass)
async def update_class(class_id: uuid.UUID, payload: OnlineClassUpdate, db: DB, teacher: Teacher):
    return APIResponse(
        success=True, data=await OnlineClassService.update(db, teacher, class_id, payload), message="Class updated"
    )


@router.post("/{class_id}/cancel", response_model=APIResponseOnlineClass)
async def cancel_class(class_id: uuid.UUID, db: DB, teacher: Teacher):
    return APIResponse(success=True, data=await OnlineClassService.cancel(db, teacher, class_id), message="Class cancelled")


@router.post("/{class_id}/end", response_model=APIResponseOnlineAttendanceReport)
async def end_class(class_id: uuid.UUID, db: DB, teacher: Teacher):
    return APIResponse(
        success=True,
        data=await OnlineClassService.end(db, teacher, class_id),
        message="Class ended — attendance generated",
    )


# ── Teacher: waiting room, attendance, materials ─────────────────────────────


@router.post("/{class_id}/admit-all", response_model=APIResponseOnlineClassDetail)
async def admit_all(class_id: uuid.UUID, db: DB, teacher: Teacher):
    return APIResponse(
        success=True, data=await OnlineClassService.admit_all(db, teacher, class_id), message="Everyone admitted"
    )


@router.post("/{class_id}/participants/{student_id}/admit", response_model=APIResponseOnlineClassDetail)
async def admit_student(class_id: uuid.UUID, student_id: uuid.UUID, db: DB, teacher: Teacher):
    return APIResponse(
        success=True,
        data=await OnlineClassService.admit(db, teacher, class_id, student_id),
        message="Student admitted",
    )


@router.post("/{class_id}/participants/{student_id}/remove", response_model=APIResponseOnlineClassDetail)
async def remove_student(class_id: uuid.UUID, student_id: uuid.UUID, db: DB, teacher: Teacher):
    return APIResponse(
        success=True,
        data=await OnlineClassService.remove_student(db, teacher, class_id, student_id),
        message="Student removed from class",
    )


@router.get("/{class_id}/attendance", response_model=APIResponseOnlineAttendanceReport)
async def attendance_report(class_id: uuid.UUID, db: DB, teacher: Teacher):
    return APIResponse(
        success=True,
        data=await OnlineClassService.attendance_report(db, teacher, class_id),
        message="Attendance report loaded",
    )


@router.post("/{class_id}/files", response_model=APIResponseOnlineFile, status_code=status.HTTP_201_CREATED)
async def share_file(class_id: uuid.UUID, db: DB, teacher: Teacher, file: UploadFile = File(...)):
    oc = await OnlineClassService._get_owned_class(db, teacher, class_id)
    content = await file.read()
    row = await OnlineClassService.add_file(db, teacher, oc, file.filename or "file", content, file.content_type or "", UPLOADS_ROOT)
    return APIResponse(success=True, data=row, message="File shared with the class")


@router.post("/{class_id}/recording", response_model=APIResponseOnlineClass, status_code=status.HTTP_201_CREATED)
async def save_recording(class_id: uuid.UUID, db: DB, teacher: Teacher, file: UploadFile = File(...)):
    oc = await OnlineClassService._get_owned_class(db, teacher, class_id)
    content = await file.read()
    row = await OnlineClassService.save_recording(
        db, teacher, oc, file.filename or "recording.webm", content, file.content_type or "video/webm", UPLOADS_ROOT
    )
    return APIResponse(success=True, data=row, message="Recording saved")


# ── Student console ───────────────────────────────────────────────────────────


@router.get("/my/classes", response_model=APIResponseStudentOnlineClasses)
async def my_classes(db: DB, student: Student):
    return APIResponse(
        success=True, data=await OnlineClassService.list_for_student(db, student), message="Online classes loaded"
    )


@router.get("/{class_id}/student-view", response_model=APIResponseOnlineClassDetail)
async def student_class_detail(class_id: uuid.UUID, db: DB, student: Student):
    return APIResponse(
        success=True,
        data=await OnlineClassService.detail_for_student(db, student, class_id),
        message="Class loaded",
    )


@router.post("/{class_id}/join", response_model=APIResponse[StudentOnlineClassRow])
async def join_class(class_id: uuid.UUID, db: DB, student: Student):
    return APIResponse(
        success=True, data=await OnlineClassService.request_join(db, student, class_id), message="You are in the waiting room"
    )


@router.post("/{class_id}/leave", response_model=APIResponse[StudentOnlineClassRow])
async def leave_class(class_id: uuid.UUID, db: DB, student: Student):
    return APIResponse(success=True, data=await OnlineClassService.leave(db, student, class_id), message="You left the class")


@router.get("/{class_id}/messages", response_model=APIResponseOnlineMessages)
async def chat_history(class_id: uuid.UUID, db: DB, teacher: Teacher):
    return APIResponse(
        success=True, data=await OnlineClassService.messages(db, teacher, class_id), message="Chat loaded"
    )


@router.get("/{class_id}/student/messages", response_model=APIResponseOnlineMessages)
async def student_chat_history(class_id: uuid.UUID, db: DB, student: Student):
    return APIResponse(
        success=True, data=await OnlineClassService.messages(db, student, class_id), message="Chat loaded"
    )


@router.get("/{class_id}/student/files", response_model=APIResponseOnlineFiles)
async def student_files(class_id: uuid.UUID, db: DB, student: Student):
    return APIResponse(success=True, data=await OnlineClassService.files(db, student, class_id), message="Materials loaded")


# ── Live classroom WebSocket ──────────────────────────────────────────────────


async def _send_roster(websocket: WebSocket, db: AsyncSession, oc: OnlineClass) -> None:
    rows = await OnlineClassService._participant_rows(db, oc)
    await websocket.send_json({"type": "roster", "participants": [r.model_dump(mode="json") for r in rows]})


@router.websocket("/{class_id}/live")
async def live_room(websocket: WebSocket, class_id: uuid.UUID, db: DB, token: str = Query(...)):
    """Presence + chat + raise-hand + WebRTC signalling + whiteboard relay.

    Browsers cannot set headers on a WebSocket handshake, so the short-lived
    tenant JWT travels in the query string and is validated before accept().
    The injected session lives for the whole connection; every persisted
    event commits immediately so a mid-class crash loses nothing.
    """
    user: User | None = None
    oc: OnlineClass | None = None
    role = ""
    try:
        try:
            payload = decode_access_token(token)
        except JWTError:
            await websocket.close(code=status.WS_1008_POLICY_VIOLATION)
            return
        if payload.get("type") != "tenant" or not payload.get("sub") or not payload.get("tenant_id"):
            await websocket.close(code=status.WS_1008_POLICY_VIOLATION)
            return

        try:
            user_pk = uuid.UUID(str(payload["sub"]))
        except ValueError:
            await websocket.close(code=status.WS_1008_POLICY_VIOLATION)
            return
        user = await db.get(User, user_pk)
        oc = await db.get(OnlineClass, class_id)
        if user is None or not user.is_active or oc is None or oc.tenant_id != user.tenant_id:
            await websocket.close(code=status.WS_1008_POLICY_VIOLATION)
            return

        role = "TEACHER" if user.id == oc.teacher_id else "STUDENT"
        if role == "STUDENT":
            participant = await OnlineClassService._participant(db, oc, user)
            if oc.status != OnlineClassStatus.LIVE or participant is None or participant.joined_at is None:
                await websocket.close(code=status.WS_1008_POLICY_VIOLATION)
                return

        await websocket.accept()
        live_rooms.connect(class_id, user.id, websocket, user.name, role)
        if role == "STUDENT":
            await OnlineClassService.ws_student_joined(db, oc, user)
        await db.commit()

        await websocket.send_json(
            {
                "type": "welcome",
                "you": {"id": str(user.id), "name": user.name, "role": role},
                "peers": live_rooms.online_peers(class_id, exclude=user.id),
            }
        )
        await live_rooms.broadcast(
            class_id,
            {"type": "peer-joined", "peer": {"id": str(user.id), "name": user.name, "role": role}},
            exclude=user.id,
        )

        while True:
            raw = await websocket.receive_text()
            if len(raw) > 64 * 1024:
                continue  # oversized frame — ignore, never crash the room
            try:
                msg = json.loads(raw)
            except json.JSONDecodeError:
                continue
            if not isinstance(msg, dict):
                continue
            kind = msg.get("type")

            if kind == "chat":
                body = str(msg.get("body", "")).strip()[:1000]
                if body and oc.status == OnlineClassStatus.LIVE:
                    row = await OnlineClassService.post_message(db, user, oc, body)
                    await db.commit()
                    await live_rooms.broadcast(class_id, {"type": "chat", "message": row.model_dump(mode="json")})
            elif kind == "hand" and role == "STUDENT":
                participant = await OnlineClassService._participant(db, oc, user)
                if participant is not None:
                    participant.hand_raised_at = datetime.now(timezone.utc) if msg.get("raised") else None
                    await db.commit()
                await live_rooms.broadcast(
                    class_id, {"type": "hand", "student_id": str(user.id), "raised": bool(msg.get("raised"))}
                )
            elif kind == "signal":
                try:
                    target_id = uuid.UUID(str(msg.get("to")))
                except (ValueError, TypeError):
                    continue
                await live_rooms.send_to(
                    class_id, target_id, {"type": "signal", "from": str(user.id), "data": msg.get("data")}
                )
            elif kind == "whiteboard":
                await live_rooms.broadcast(
                    class_id,
                    {"type": "whiteboard", "from": str(user.id), "stroke": msg.get("stroke")},
                    exclude=user.id,
                )
            elif kind == "screen":
                await live_rooms.broadcast(
                    class_id, {"type": "screen", "from": str(user.id), "sharing": bool(msg.get("sharing"))}
                )
            elif kind == "roster-request" and role == "TEACHER":
                await _send_roster(websocket, db, oc)
    except WebSocketDisconnect:
        pass
    except Exception:
        # Transport or DB blip inside the loop — fall through to cleanup; the
        # client reconnects and attendance still settles on class end.
        await db.rollback()
    finally:
        if user is not None:
            live_rooms.disconnect(class_id, user.id)
            # Shield the ledger work from task cancellation: on a client drop
            # (or server shutdown) the leave must persist and peers must hear
            # peer-left even though this coroutine is being torn down.
            with anyio.CancelScope(shield=True):
                try:
                    if role == "STUDENT" and oc is not None and oc.status == OnlineClassStatus.LIVE:
                        await OnlineClassService.ws_student_left(db, oc, user)
                        await db.commit()
                    await live_rooms.broadcast(class_id, {"type": "peer-left", "peer_id": str(user.id)})
                except Exception:
                    with contextlib.suppress(Exception):
                        await db.rollback()
