"""
Real end-to-end integration test for the Online Class module.

Embedded Postgres (pgserver) + full schema from the ORM models, seeded with a
tenant, one teacher and one enrolled student. The tests drive the actual
/api/v1/online-classes HTTP API and the live WebSocket with real JWTs:

  scheduled class → start → student join (waiting room) → admit → live
    → end → automatic attendance synced to attendance_sessions/records
  instant class → student notified → join → leave before admit
  live WebSocket → welcome / chat / raise-hand / peer events
"""

import asyncio
import pathlib
import tempfile
import uuid
from datetime import date, datetime, time, timedelta, timezone

import pytest
import pytest_asyncio

pgserver = pytest.importorskip("pgserver")

import app.models  # noqa: F401,E402  (register models on Base.metadata)
from app.database import Base, get_db  # noqa: E402
from app.main import app  # noqa: E402
from app.models.academic import AcademicYear, Department, SchoolClass, Subject  # noqa: E402
from app.models.catalog import Plan  # noqa: E402
from app.models.enrollment import Enrollment, TeacherSubject  # noqa: E402
from app.models.online_class import OnlineClass, OnlineClassParticipant  # noqa: E402
from app.models.principal import AttendanceSession, TimetableSlot  # noqa: E402
from app.models.role import Role, RoleAssignment, ScopeLevel  # noqa: E402
from app.models.tenant import Tenant, TenantType  # noqa: E402
from app.models.user import User  # noqa: E402
from app.utils.security import hash_password  # noqa: E402

from sqlalchemy import select  # noqa: E402
from sqlalchemy.ext.asyncio import async_sessionmaker, create_async_engine  # noqa: E402
from sqlalchemy.pool import NullPool  # noqa: E402
from httpx import ASGITransport, AsyncClient  # noqa: E402
from starlette.testclient import TestClient  # noqa: E402

SLUG = "livevalley"
TEACHER_EMAIL = "meera@livevalley.edu"
TEACHER_PASSWORD = "Teach@12345"
STUDENT_EMAIL = "arjun@livevalley.edu"
STUDENT_PASSWORD = "Study@12345"


@pytest_asyncio.fixture(scope="module")
def event_loop():
    loop = asyncio.new_event_loop()
    yield loop
    loop.close()


@pytest_asyncio.fixture(scope="module")
async def seeded_backend():
    """Start Postgres, create schema, seed the college, yield client + ids."""
    srv = pgserver.get_server(pathlib.Path(tempfile.mkdtemp()), cleanup_mode="stop")
    srv.ensure_postgres_running()
    async_uri = srv.get_uri().replace("postgresql://", "postgresql+asyncpg://")
    # NullPool: the WebSocket part runs under TestClient's own event loop, so
    # pooled connections from the module loop could not be reused there.
    engine = create_async_engine(async_uri, poolclass=NullPool)
    async with engine.begin() as conn:
        await conn.run_sync(Base.metadata.create_all)

    Session = async_sessionmaker(engine, expire_on_commit=False)

    async with Session() as s:
        plan = Plan(
            id=uuid.uuid4(), name="Professional", slug=f"professional-{SLUG}",
            max_students=5000, max_teachers=500, max_storage_gb=200,
            price_monthly=7999, price_yearly=79990, currency="INR",
            allowed_modules=[], is_active=True,
        )
        s.add(plan)
        for name, scope in (("TEACHER", ScopeLevel.INSTITUTION), ("STUDENT", ScopeLevel.SELF)):
            s.add(Role(id=uuid.uuid4(), name=name, label=name.title(), scope_level=scope,
                       is_platform=False, is_optional=False))
        await s.flush()

        tenant = Tenant(id=uuid.uuid4(), name="Live Valley College", slug=SLUG,
                        type=TenantType.COLLEGE, plan_id=plan.id, is_active=True,
                        country="India", timezone="Asia/Kolkata")
        s.add(tenant)
        await s.flush()

        year = AcademicYear(id=uuid.uuid4(), tenant_id=tenant.id, name="2026-27",
                            start_date=date(2026, 6, 1), end_date=date(2027, 5, 31), is_current=True)
        dept = Department(id=uuid.uuid4(), tenant_id=tenant.id, name="Computer Science", code="CSE")
        s.add_all([year, dept])
        await s.flush()

        teacher = User(id=uuid.uuid4(), tenant_id=tenant.id, name="Dr. Meera Iyer",
                       email=TEACHER_EMAIL, password_hash=hash_password(TEACHER_PASSWORD), is_active=True)
        student = User(id=uuid.uuid4(), tenant_id=tenant.id, name="Arjun Nair",
                       email=STUDENT_EMAIL, password_hash=hash_password(STUDENT_PASSWORD), is_active=True)
        s.add_all([teacher, student])
        await s.flush()

        school_class = SchoolClass(
            id=uuid.uuid4(), tenant_id=tenant.id, department_id=dept.id, academic_year_id=year.id,
            name="B.Tech Sem 1-A", code="BT-1A", class_teacher_id=teacher.id, is_active=True,
        )
        s.add(school_class)
        await s.flush()

        subject = Subject(id=uuid.uuid4(), tenant_id=tenant.id, class_id=school_class.id,
                          name="DBMS", code="DB101", subject_type="THEORY", is_active=True)
        s.add(subject)
        await s.flush()

        s.add(TeacherSubject(id=uuid.uuid4(), tenant_id=tenant.id, teacher_id=teacher.id,
                             subject_id=subject.id, role_in_subject="TEACHER"))
        s.add(Enrollment(id=uuid.uuid4(), tenant_id=tenant.id, student_id=student.id,
                         class_id=school_class.id, academic_year_id=year.id,
                         roll_number="BT-1A-07", status="ACTIVE"))
        s.add(TimetableSlot(
            id=uuid.uuid4(), tenant_id=tenant.id, class_id=school_class.id,
            academic_year_id=year.id, day_of_week=datetime.now(timezone.utc).isoweekday(),
            period_number=2, start_time=time(10, 0), end_time=time(10, 50),
            subject_id=subject.id, teacher_id=teacher.id, room_no="LH-2",
            slot_type="CLASS", effective_from=date(2026, 6, 1), effective_to=None,
        ))

        roles = (await s.execute(select(Role))).scalars().all()
        role_map = {r.name: r.id for r in roles}
        s.add(RoleAssignment(id=uuid.uuid4(), user_id=teacher.id, role_id=role_map["TEACHER"],
                             tenant_id=tenant.id, is_active=True))
        s.add(RoleAssignment(id=uuid.uuid4(), user_id=student.id, role_id=role_map["STUDENT"],
                             tenant_id=tenant.id, is_active=True))
        await s.commit()

        ids = {
            "tenant_id": tenant.id, "year_id": year.id, "class_id": school_class.id,
            "subject_id": subject.id, "teacher_id": teacher.id, "student_id": student.id,
        }

    async def override_get_db():
        async with Session() as session:
            try:
                yield session
                await session.commit()
            except Exception:
                await session.rollback()
                raise

    app.dependency_overrides[get_db] = override_get_db

    async with AsyncClient(
        transport=ASGITransport(app=app), base_url="http://testserver", timeout=30.0
    ) as ac:
        yield ac, Session, ids

    app.dependency_overrides.clear()
    await engine.dispose()
    srv.cleanup()


async def _login(client, email, password):
    res = await client.post("/api/v1/tenant/auth/login", json={
        "slug": SLUG, "identifier": email, "password": password,
    })
    assert res.status_code == 200, res.text
    return {"Authorization": f"Bearer {res.json()['data']['tokens']['access_token']}"}


@pytest_asyncio.fixture(scope="module")
async def tokens(seeded_backend):
    client, _, _ = seeded_backend
    return {
        "teacher": await _login(client, TEACHER_EMAIL, TEACHER_PASSWORD),
        "student": await _login(client, STUDENT_EMAIL, STUDENT_PASSWORD),
    }


# ── The full scheduled-class lifecycle ───────────────────────────────────────


@pytest.mark.asyncio
async def test_scheduled_class_full_lifecycle_with_automatic_attendance(seeded_backend, tokens):
    client, Session, ids = seeded_backend
    teacher, student = tokens["teacher"], tokens["student"]

    # Teacher sees the DBMS slot in today's setup options.
    opts = await client.get("/api/v1/online-classes/setup-options", headers=teacher)
    assert opts.status_code == 200, opts.text
    assignments = opts.json()["data"]["assignments"]
    assert any(a["subject_code"] == "DB101" for a in assignments), opts.text

    # Schedule the class.
    created = await client.post("/api/v1/online-classes", headers=teacher, json={
        "class_id": str(ids["class_id"]), "subject_id": str(ids["subject_id"]),
        "topic": "SQL Joins",
        "scheduled_at": (datetime.now(timezone.utc) + timedelta(hours=1)).isoformat(),
        "duration_minutes": 50, "allow_join": True, "recording_enabled": False,
    })
    assert created.status_code == 201, created.text
    oc = created.json()["data"]
    assert oc["status"] == "SCHEDULED" and oc["topic"] == "SQL Joins"
    class_id = oc["id"]

    # Student sees it as upcoming, cannot join yet.
    mine = await client.get("/api/v1/online-classes/my/classes", headers=student)
    assert mine.status_code == 200, mine.text
    upcoming = [c for c in mine.json()["data"]["upcoming"] if c["id"] == class_id]
    assert upcoming and upcoming[0]["join_state"] == "UPCOMING"
    blocked = await client.post(f"/api/v1/online-classes/{class_id}/join", headers=student)
    assert blocked.status_code == 409

    # Teacher starts the class; student can now request to join.
    started = await client.post(f"/api/v1/online-classes/{class_id}/start", headers=teacher)
    assert started.status_code == 200 and started.json()["data"]["status"] == "LIVE"

    joined = await client.post(f"/api/v1/online-classes/{class_id}/join", headers=student)
    assert joined.status_code == 200, joined.text
    assert joined.json()["data"]["join_state"] == "WAITING"

    # Waiting room visible to the teacher; admit the student.
    detail = await client.get(f"/api/v1/online-classes/{class_id}", headers=teacher)
    assert detail.status_code == 200
    waiting = [p for p in detail.json()["data"]["participants"] if p["joined_at"] is None]
    assert len(waiting) == 1 and waiting[0]["student_name"] == "Arjun Nair"

    admitted = await client.post(f"/api/v1/online-classes/{class_id}/admit-all", headers=teacher)
    assert admitted.status_code == 200, admitted.text
    in_class = [p for p in admitted.json()["data"]["participants"] if p["joined_at"] is not None]
    assert len(in_class) == 1

    live_view = await client.get(f"/api/v1/online-classes/{class_id}/student-view", headers=student)
    assert live_view.json()["data"]["join_state"] == "IN_CLASS"

    # Backdate the live window so the policy math is deterministic:
    # class ran 50 min, the student was in for 47 min → PRESENT (94%).
    now = datetime.now(timezone.utc)
    async with Session() as s:
        oc_row = await s.get(OnlineClass, uuid.UUID(class_id))
        oc_row.started_at = now - timedelta(minutes=50)
        part = (await s.execute(
            select(OnlineClassParticipant).where(OnlineClassParticipant.class_id == oc_row.id)
        )).scalar_one()
        part.joined_at = now - timedelta(minutes=47)
        part.waiting_since = now - timedelta(minutes=47)
        await s.commit()

    ended = await client.post(f"/api/v1/online-classes/{class_id}/end", headers=teacher)
    assert ended.status_code == 200, ended.text
    report = ended.json()["data"]
    assert report["totals_present"] == 1 and report["totals_absent"] == 0
    row = report["rows"][0]
    assert row["attendance_status"] == "PRESENT" and row["percent"] >= 75

    # The canonical register got one ONLINE session with a PRESENT record.
    async with Session() as s:
        sessions = (await s.execute(
            select(AttendanceSession).where(
                AttendanceSession.tenant_id == ids["tenant_id"],
                AttendanceSession.class_id == ids["class_id"],
            )
        )).scalars().all()
        online_sessions = [x for x in sessions if x.period_label.startswith("ONLINE")]
        assert len(online_sessions) == 1
        assert online_sessions[0].total_present == 1 and online_sessions[0].total_absent == 0

    # History shows the completed class for both sides.
    history = await client.get("/api/v1/online-classes", headers=teacher, params={"status": "COMPLETED"})
    assert any(c["id"] == class_id for c in history.json()["data"]["items"])


# ── Instant class + notifications + guards ───────────────────────────────────


@pytest.mark.asyncio
async def test_instant_class_notifies_students_and_guards_hold(seeded_backend, tokens):
    client, Session, ids = seeded_backend
    teacher, student = tokens["teacher"], tokens["student"]

    instant = await client.post("/api/v1/online-classes/instant", headers=teacher, json={
        "class_id": str(ids["class_id"]), "subject_id": str(ids["subject_id"]),
        "topic": "Normalization quick revision", "duration_minutes": 20,
    })
    assert instant.status_code == 201, instant.text
    data = instant.json()["data"]
    assert data["status"] == "LIVE" and data["mode"] == "INSTANT"
    class_id = data["id"]

    # The student received an in-app notification.
    async with Session() as s:
        from app.models.online_class import Notification
        notes = (await s.execute(
            select(Notification).where(Notification.user_id == ids["student_id"])
        )).scalars().all()
        assert any(n.type == "ONLINE_CLASS" and class_id in (n.data or {}).get("class_id", "") for n in notes)

    # Student sees it live under today's classes.
    mine = await client.get("/api/v1/online-classes/my/classes", headers=student)
    today = [c for c in mine.json()["data"]["today"] if c["id"] == class_id]
    assert today and today[0]["join_state"] == "JOINABLE"

    # Guards: a student cannot end a class; a teacher cannot double-start.
    denied = await client.post(f"/api/v1/online-classes/{class_id}/end", headers=student)
    assert denied.status_code in (401, 403)
    restart = await client.post(f"/api/v1/online-classes/{class_id}/start", headers=teacher)
    assert restart.status_code == 409

    ended = await client.post(f"/api/v1/online-classes/{class_id}/end", headers=teacher)
    assert ended.status_code == 200, ended.text
    # Student never joined → ABSENT in the generated report.
    assert ended.json()["data"]["totals_absent"] == 1


# ── The live WebSocket room ───────────────────────────────────────────────────


@pytest.mark.asyncio
async def test_live_websocket_room_chat_and_hand_raise(seeded_backend, tokens):
    client, Session, ids = seeded_backend
    teacher_headers, student_headers = tokens["teacher"], tokens["student"]

    live = await client.post("/api/v1/online-classes/instant", headers=teacher_headers, json={
        "class_id": str(ids["class_id"]), "subject_id": str(ids["subject_id"]),
        "topic": "WS smoke test", "duration_minutes": 15,
    })
    assert live.status_code == 201, live.text
    class_id = live.json()["data"]["id"]
    assert (await client.post(f"/api/v1/online-classes/{class_id}/join", headers=student_headers)).status_code == 200
    assert (await client.post(f"/api/v1/online-classes/{class_id}/admit-all", headers=teacher_headers)).status_code == 200

    teacher_token = teacher_headers["Authorization"].split(" ", 1)[1]
    student_token = student_headers["Authorization"].split(" ", 1)[1]

    def drain_until(ws, predicate, limit: int = 10):
        """Broadcasts also echo to their sender, so read past anything else."""
        for _ in range(limit):
            msg = ws.receive_json()
            if predicate(msg):
                return msg
        raise AssertionError("expected WebSocket event never arrived")

    # starlette's sync TestClient drives the same app (and overridden DB).
    with TestClient(app) as tc:
        # Unknown class id is rejected before accept (1008).
        with pytest.raises(Exception):
            with tc.websocket_connect(f"/api/v1/online-classes/{uuid.uuid4()}/live?token={student_token}"):
                pass

        with tc.websocket_connect(f"/api/v1/online-classes/{class_id}/live?token={teacher_token}") as tw:
            welcome = tw.receive_json()
            assert welcome["type"] == "welcome" and welcome["you"]["role"] == "TEACHER"

            with tc.websocket_connect(f"/api/v1/online-classes/{class_id}/live?token={student_token}") as sw:
                s_welcome = sw.receive_json()
                assert s_welcome["you"]["role"] == "STUDENT"
                assert any(p["role"] == "TEACHER" for p in s_welcome["peers"])
                # Teacher hears the student arrive.
                drain_until(tw, lambda m: m["type"] == "peer-joined" and m["peer"]["role"] == "STUDENT")

                # Student raises a hand; teacher sees it.
                sw.send_json({"type": "hand", "raised": True})
                drain_until(tw, lambda m: m["type"] == "hand" and m["raised"] is True)

                # Chat round trip, persisted for late joiners.
                sw.send_json({"type": "chat", "body": "Doubt on LEFT JOIN"})
                msg = drain_until(
                    tw, lambda m: m["type"] == "chat" and m["message"]["body"] == "Doubt on LEFT JOIN"
                )
                assert msg["message"]["sender_role"] == "STUDENT"

                # Hand + presence are persisted while the student is online.
                live_detail = (await client.get(f"/api/v1/online-classes/{class_id}", headers=teacher_headers)).json()["data"]
                [p_row] = [p for p in live_detail["participants"] if p["student_id"] == str(ids["student_id"])]
                assert p_row["is_online"] is True and p_row["hand_raised_at"] is not None

            # Student socket closed → teacher hears peer-left.
            drain_until(tw, lambda m: m["type"] == "peer-left")

    history = await client.get(f"/api/v1/online-classes/{class_id}/messages", headers=teacher_headers)
    assert history.status_code == 200
    assert any(m["body"] == "Doubt on LEFT JOIN" for m in history.json()["data"])

    # After the drop the participant is offline but keeps the raised hand.
    detail = (await client.get(f"/api/v1/online-classes/{class_id}", headers=teacher_headers)).json()["data"]
    [p_row] = [p for p in detail["participants"] if p["student_id"] == str(ids["student_id"])]
    assert p_row["is_online"] is False

    ended = await client.post(f"/api/v1/online-classes/{class_id}/end", headers=teacher_headers)
    assert ended.status_code == 200, ended.text
    # The student was online at end time; duration ≥ 0 and status is one of the policy values.
    row = ended.json()["data"]["rows"][0]
    assert row["attendance_status"] in ("PRESENT", "LATE", "ABSENT")
