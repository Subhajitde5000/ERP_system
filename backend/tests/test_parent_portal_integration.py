"""Parent portal — real end-to-end integration against embedded Postgres.

The FakeDB unit tests can prove a service raises the right code on the right
branch. They cannot prove the pieces that actually matter for a feature whose
whole job is *who may see whom*:

  * the `parent_student_links` DDL the ORM declares (partial unique indexes, the
    CHECKs) is valid and enforced by the database, not merely described;
  * a link in tenant A grants nothing in tenant B, even with real ids;
  * the code → account → claim sequence clears `activation_code`, so a slip
    cannot be redeemed twice;
  * a module left out of `access_scope` is absent from the *payload*, not just
    hidden by the client;
  * a leave filed by a guardian is stored as the guardian's and the teacher's
    console can tell;
  * the primary-guardian rule survives a promote, in one direction only.

Seeded shape (one school tenant unless noted):

  Aarav  ← mother@gv  ACTIVE, full scope           (reads the portal)
         ← teacher@gv promote-to-primary test row
         ← uncle@gv   ACTIVE, scope=[attendance]   (sees attendance only)
         ← ex@gv      SUSPENDED                     (403 everywhere)
         ← grand@gv   ACTIVE, access_upto in the past (403, "no longer active")
         ← nil@gv     PENDING_CLAIM + code          (self-service activation)
  Diya   ← nobody → the "unlinked" count on C-IA-12, then claimed end to end.
  riverside is a COLLEGE tenant with its own student, which makes cross-tenant
  isolation a real assertion rather than a comment.
"""

import asyncio
import pathlib
import tempfile
import uuid
from datetime import date, datetime, time, timedelta, timezone
from decimal import Decimal

import pytest
import pytest_asyncio

pgserver = pytest.importorskip("pgserver")

import app.models  # noqa: F401,E402  (register models on Base.metadata)
from app.database import Base, get_db  # noqa: E402
from app.main import app  # noqa: E402
from app.models.academic import AcademicYear, Department, SchoolClass, Subject  # noqa: E402
from app.models.billing import OutboxEmail  # noqa: E402
from app.models.enrollment import Enrollment, TeacherSubject  # noqa: E402
from app.models.hod import AttendanceRecord  # noqa: E402
from app.models.lms import (  # noqa: E402
    AttendanceLeave,
    FeeAccountStatus,
    FeeInstallment,
    FeeStructure,
    StudentFeeAccount,
)
from app.models.audit import AuditLog  # noqa: E402
from app.models.online_class import Notification  # noqa: E402
from app.models.parent import LinkStatus, ParentStudentLink  # noqa: E402
from app.models.principal import (  # noqa: E402
    AttendanceSession,
    AttendanceStatus,
    Notice,
    NoticePriority,
    NoticeScope,
)
from app.models.role import Role, RoleAssignment, ScopeLevel  # noqa: E402
from app.models.tenant import Tenant, TenantType  # noqa: E402
from app.models.user import User  # noqa: E402
from app.utils.security import hash_password  # noqa: E402

from sqlalchemy import func, select  # noqa: E402
from sqlalchemy.ext.asyncio import async_sessionmaker, create_async_engine  # noqa: E402
from httpx import ASGITransport, AsyncClient  # noqa: E402

SLUG = "greenvalley"
PASSWORD = "Guard1@2026"

MOTHER = "mother@greenvalley.edu"
UNCLE = "uncle@greenvalley.edu"
EX_PARTNER = "ex@greenvalley.edu"
GRANDMOTHER = "grand@greenvalley.edu"
INVITEE = "nil@greenvalley.edu"
TEACHER = "teacher@greenvalley.edu"
ADMIN = "office@greenvalley.edu"
FULL_SCOPE = [
    "attendance", "timetable", "examination", "assignment", "results", "notice", "finance"
]


@pytest_asyncio.fixture(scope="module")
def event_loop():
    loop = asyncio.new_event_loop()
    yield loop
    loop.close()


@pytest_asyncio.fixture(scope="module")
async def backend():
    """Postgres + ORM-built schema + the seeded family, and a client over the app."""
    srv = pgserver.get_server(pathlib.Path(tempfile.mkdtemp()), cleanup_mode="stop")
    srv.ensure_postgres_running()
    async_uri = srv.get_uri().replace("postgresql://", "postgresql+asyncpg://")
    engine = create_async_engine(async_uri)
    async with engine.begin() as conn:
        await conn.run_sync(Base.metadata.create_all)

    Session = async_sessionmaker(engine, expire_on_commit=False)
    now = datetime.now(timezone.utc)

    async with Session() as s:
        for name, scope in (
            ("INSTITUTION_ADMIN", ScopeLevel.INSTITUTION),
            ("TEACHER", ScopeLevel.SUBJECT),
            ("STUDENT", ScopeLevel.SELF),
            ("PARENT", ScopeLevel.CHILD),
        ):
            s.add(Role(id=uuid.uuid4(), name=name, label=name.title(), scope_level=scope,
                       is_platform=False, is_optional=False))
        await s.flush()

        tenant = Tenant(id=uuid.uuid4(), name="Green Valley School", slug=SLUG,
                        type=TenantType.SCHOOL, is_active=True, country="India",
                        timezone="Asia/Kolkata")
        # A second tenant, a college: its student exists so "not your tenant"
        # and "no guardian portal here" are both testable.
        other = Tenant(id=uuid.uuid4(), name="Riverside College", slug="riverside",
                       type=TenantType.COLLEGE, is_active=True, country="India",
                       timezone="Asia/Kolkata")
        s.add_all([tenant, other])
        await s.flush()

        year = AcademicYear(id=uuid.uuid4(), tenant_id=tenant.id, name="2026-27",
                            start_date=date(2026, 6, 1), end_date=date(2027, 5, 31),
                            is_current=True)
        dept = Department(id=uuid.uuid4(), tenant_id=tenant.id, name="Primary Wing", code="PRIM")
        s.add_all([year, dept])
        await s.flush()

        def person(tenant_id, name, email, **kw):
            return User(id=uuid.uuid4(), tenant_id=tenant_id, name=name, email=email,
                        password_hash=hash_password(kw.pop("password", PASSWORD)),
                        is_active=True, **kw)

        teacher = person(tenant.id, "Ms. Kavita Rao", TEACHER)
        admin = person(tenant.id, "School Office", ADMIN)
        aarav = person(tenant.id, "Aarav Sen", "aarav@greenvalley.edu",
                       student_roll_no="GV-2026-01")
        diya = person(tenant.id, "Diya Roy", "diya@greenvalley.edu",
                      student_roll_no="GV-2026-02")
        mother = person(tenant.id, "Riya Sen", MOTHER)
        uncle = person(tenant.id, "Amar Sen", UNCLE)
        ex = person(tenant.id, "Nil Sen", EX_PARTNER)
        grand = person(tenant.id, "Bina Das", GRANDMOTHER)
        other_student = person(other.id, "Other Kid", "other@riverside.edu",
                               student_roll_no="RC-1")
        s.add_all([teacher, admin, aarav, diya, mother, uncle, ex, grand, other_student])
        await s.flush()

        school_class = SchoolClass(id=uuid.uuid4(), tenant_id=tenant.id,
                                   department_id=dept.id, academic_year_id=year.id,
                                   name="Class 5-A", code="5A", class_teacher_id=teacher.id,
                                   is_active=True)
        s.add(school_class)
        await s.flush()
        subject = Subject(id=uuid.uuid4(), tenant_id=tenant.id, class_id=school_class.id,
                          name="Science", code="SCI5", subject_type="THEORY", is_active=True)
        s.add(subject)
        await s.flush()
        # The teacher must teach the subject, not merely own the homeroom: the
        # leave queue is scoped by subject, and that is who reviews a guardian's note.
        s.add(TeacherSubject(id=uuid.uuid4(), tenant_id=tenant.id, teacher_id=teacher.id,
                             subject_id=subject.id, role_in_subject="TEACHER"))
        s.add_all([
            Enrollment(id=uuid.uuid4(), tenant_id=tenant.id, student_id=aarav.id,
                       class_id=school_class.id, academic_year_id=year.id,
                       roll_number="GV-2026-01", status="ACTIVE"),
            Enrollment(id=uuid.uuid4(), tenant_id=tenant.id, student_id=diya.id,
                       class_id=school_class.id, academic_year_id=year.id,
                       roll_number="GV-2026-02", status="ACTIVE"),
        ])

        other_year = AcademicYear(id=uuid.uuid4(), tenant_id=other.id, name="2026-27",
                                  start_date=date(2026, 6, 1), end_date=date(2027, 5, 31),
                                  is_current=True)
        other_dept = Department(id=uuid.uuid4(), tenant_id=other.id, name="Science", code="SCI")
        s.add_all([other_year, other_dept])
        await s.flush()
        other_class = SchoolClass(id=uuid.uuid4(), tenant_id=other.id,
                                  department_id=other_dept.id, academic_year_id=other_year.id,
                                  name="Sem 1-A", code="S1A", is_active=True)
        s.add(other_class)
        await s.flush()
        s.add(Enrollment(id=uuid.uuid4(), tenant_id=other.id, student_id=other_student.id,
                         class_id=other_class.id, academic_year_id=other_year.id,
                         roll_number="RC-1", status="ACTIVE"))

        # Attendance: 3 present, 1 absent → exactly 75 %, the boundary the
        # "below 75 %" alert must not trip on.
        for offset, status in ((0, AttendanceStatus.PRESENT), (7, AttendanceStatus.PRESENT),
                               (14, AttendanceStatus.ABSENT), (21, AttendanceStatus.PRESENT)):
            att = AttendanceSession(id=uuid.uuid4(), tenant_id=tenant.id, subject_id=subject.id,
                                    class_id=school_class.id, teacher_id=teacher.id,
                                    academic_year_id=year.id,
                                    date=date(2026, 6, 1) + timedelta(days=offset),
                                    period_label="P1", start_time=time(9, 0), end_time=time(9, 40),
                                    total_present=1, total_absent=0, is_locked=True)
            s.add(att)
            await s.flush()
            s.add(AttendanceRecord(id=uuid.uuid4(), tenant_id=tenant.id, session_id=att.id,
                                   student_id=aarav.id, status=status))

        s.add(Notice(id=uuid.uuid4(), tenant_id=tenant.id, title="Annual day rehearsal",
                     body="Bring the costume on Thursday.", author_id=teacher.id,
                     target_scope=NoticeScope.CLASS, target_id=school_class.id,
                     priority=NoticePriority.NORMAL, published_at=now))

        structure = FeeStructure(id=uuid.uuid4(), tenant_id=tenant.id, academic_year_id=year.id,
                                 name="Tuition 2026", total_amount=Decimal("40000.00"),
                                 is_active=True)
        s.add(structure)
        await s.flush()
        account = StudentFeeAccount(id=uuid.uuid4(), tenant_id=tenant.id, student_id=aarav.id,
                                    academic_year_id=year.id, structure_id=structure.id,
                                    total_fee=Decimal("40000.00"),
                                    concession_amount=Decimal("0"),
                                    scholarship_amount=Decimal("0"),
                                    net_payable=Decimal("40000.00"),
                                    total_paid=Decimal("10000.00"),
                                    balance_due=Decimal("30000.00"),
                                    status=FeeAccountStatus.PARTIAL)
        s.add(account)
        await s.flush()
        s.add(FeeInstallment(id=uuid.uuid4(), tenant_id=tenant.id, fee_account_id=account.id,
                             installment_number=1, label="Term 1", amount=Decimal("30000.00"),
                             due_date=date(2026, 11, 1), paid_amount=Decimal("0")))

        roles = {r.name: r.id for r in (await s.execute(select(Role))).scalars()}
        s.add_all([
            RoleAssignment(id=uuid.uuid4(), user_id=teacher.id, role_id=roles["TEACHER"],
                           tenant_id=tenant.id, is_active=True),
            RoleAssignment(id=uuid.uuid4(), user_id=admin.id, role_id=roles["INSTITUTION_ADMIN"],
                           tenant_id=tenant.id, is_active=True),
            RoleAssignment(id=uuid.uuid4(), user_id=aarav.id, role_id=roles["STUDENT"],
                           tenant_id=tenant.id, is_active=True),
            RoleAssignment(id=uuid.uuid4(), user_id=diya.id, role_id=roles["STUDENT"],
                           tenant_id=tenant.id, is_active=True),
            RoleAssignment(id=uuid.uuid4(), user_id=mother.id, role_id=roles["PARENT"],
                           tenant_id=tenant.id, is_active=True),
            RoleAssignment(id=uuid.uuid4(), user_id=uncle.id, role_id=roles["PARENT"],
                           tenant_id=tenant.id, is_active=True),
            RoleAssignment(id=uuid.uuid4(), user_id=ex.id, role_id=roles["PARENT"],
                           tenant_id=tenant.id, is_active=True),
            RoleAssignment(id=uuid.uuid4(), user_id=grand.id, role_id=roles["PARENT"],
                           tenant_id=tenant.id, is_active=True),
            RoleAssignment(id=uuid.uuid4(), user_id=other_student.id, role_id=roles["STUDENT"],
                           tenant_id=other.id, is_active=True),
        ])

        def link(parent_id, email, student_id, relation, *, primary=False,
                 status=LinkStatus.ACTIVE.value, scope=None, upto=None, code=None,
                 claimed=False):
            return ParentStudentLink(
                id=uuid.uuid4(), tenant_id=tenant.id, parent_id=parent_id, parent_email=email,
                student_id=student_id, relation=relation, is_primary=primary, status=status,
                access_scope=scope if scope is not None else list(FULL_SCOPE),
                access_upto=upto, activation_code=code,
                code_expires_at=(now + timedelta(days=14)) if code else None,
                claimed_at=now if claimed else None, managed_by=admin.id,
            )

        links = {
            "mother": link(mother.id, MOTHER, aarav.id, "Mother", primary=True, claimed=True),
            "uncle": link(uncle.id, UNCLE, aarav.id, "Guardian", scope=["attendance"], claimed=True),
            "ex": link(ex.id, EX_PARTNER, aarav.id, "Father",
                       status=LinkStatus.SUSPENDED.value, claimed=True),
            "grand": link(grand.id, GRANDMOTHER, aarav.id, "Grandmother",
                          upto=date(2026, 7, 1), claimed=True),
            # The unclaimed invite: no account behind it yet, just a code and the
            # note the office typed off the admission form.
            "invite": link(None, INVITEE, aarav.id, "Father",
                           status=LinkStatus.PENDING_CLAIM.value, code="ABCD1234EFGH"),
        }
        s.add_all(list(links.values()))
        await s.commit()

        ids = {
            "tenant_id": tenant.id, "other_tenant_id": other.id, "year_id": year.id,
            "class_id": school_class.id, "subject_id": subject.id,
            "student_id": aarav.id, "unlinked_student_id": diya.id,
            "other_student_id": other_student.id, "mother_id": mother.id,
            "uncle_id": uncle.id, "ex_id": ex.id, "grand_id": grand.id,
            "teacher_id": teacher.id, "admin_id": admin.id,
            "link_mother": links["mother"].id, "link_uncle": links["uncle"].id,
            "link_ex": links["ex"].id, "link_grand": links["grand"].id,
            "link_invite": links["invite"].id,
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
    # Ten logins in a minute is the production rule and this module does more of
    # them; the limiter itself is covered by test_rate_limit_headers below.
    app.state.limiter.enabled = False
    async with AsyncClient(
        transport=ASGITransport(app=app), base_url="http://testserver", timeout=30.0
    ) as ac:
        yield ac, ids, Session
    app.state.limiter.enabled = True
    app.dependency_overrides.clear()
    await engine.dispose()
    srv.cleanup()


async def _login(client, identifier, slug=SLUG, password=PASSWORD):
    res = await client.post("/api/v1/tenant/auth/login",
                            json={"slug": slug, "identifier": identifier, "password": password})
    assert res.status_code == 200, res.text
    return {"Authorization": f"Bearer {res.json()['data']['tokens']['access_token']}"}


@pytest_asyncio.fixture(scope="module")
async def auth(backend):
    client, _, _ = backend
    return {
        "mother": await _login(client, MOTHER),
        "uncle": await _login(client, UNCLE),
        "ex": await _login(client, EX_PARTNER),
        "grand": await _login(client, GRANDMOTHER),
        "admin": await _login(client, ADMIN),
        "teacher": await _login(client, TEACHER),
        "student": await _login(client, "aarav@greenvalley.edu"),
    }


# ── the fence ────────────────────────────────────────────────────────────────


async def test_full_guardian_reads_the_childs_record(backend, auth):
    client, ids, _ = backend
    child = ids["student_id"]

    res = await client.get("/api/v1/parent/children", headers=auth["mother"])
    assert res.status_code == 200, res.text
    body = res.json()["data"]
    assert body["tenant_type"] == "SCHOOL" and body["portal_enabled"] is True
    assert body["parent_name"] == "Riya Sen"
    assert len(body["children"]) == 1
    row = body["children"][0]
    assert row["student_id"] == str(child) and row["is_primary"] is True
    assert row["is_live"] is True and row["blocked_reason"] is None
    assert row["access_scope"] == FULL_SCOPE
    assert row["roll_number"] == "GV-2026-01" and row["class_name"] == "Class 5-A"
    assert row["days_left"] is None and row["academic_year"] == "2026-27"

    dash = await client.get(f"/api/v1/parent/children/{child}/dashboard", headers=auth["mother"])
    assert dash.status_code == 200, dash.text
    data = dash.json()["data"]
    assert data["restricted_modules"] == []
    assert data["child"]["relation"] == "Mother"
    assert data["student"]["student_name"] == "Aarav Sen"
    assert data["student"]["attendance_percentage"] == 75.0
    assert data["student"]["fee_balance_due"] == 30000.0
    assert data["student"]["recent_notices"][0]["title"] == "Annual day rehearsal"

    att = await client.get(f"/api/v1/parent/children/{child}/attendance", headers=auth["mother"])
    assert att.status_code == 200, att.text
    assert att.json()["data"]["attendance_percentage"] == 75.0
    assert att.json()["data"]["absent_count"] == 1

    last = await client.get(f"/api/v1/parent/children/{child}/attendance/last",
                            headers=auth["mother"])
    assert last.status_code == 200, last.text
    assert last.json()["data"]["status"] in {"PRESENT", "ABSENT", "LATE", "EXCUSED"}

    fees = await client.get(f"/api/v1/parent/children/{child}/fees", headers=auth["mother"])
    assert fees.status_code == 200, fees.text
    assert fees.json()["data"]["balance_due"] == 30000.0

    # Nothing was scheduled or released, so the delegated reads answer 200 with an
    # empty page rather than an error — a guardian sees "no exams yet", not a bug.
    for path in ("timetable", "examinations", "assignments", "results", "notices", "profile"):
        page = await client.get(f"/api/v1/parent/children/{child}/{path}", headers=auth["mother"])
        assert page.status_code == 200, (path, page.text)


async def test_attendance_only_guardian_sees_nothing_else(backend, auth):
    """`access_scope` has to change the payload, not the stylesheet."""
    client, ids, _ = backend
    child = ids["student_id"]

    dash = await client.get(f"/api/v1/parent/children/{child}/dashboard", headers=auth["uncle"])
    assert dash.status_code == 200, dash.text
    data = dash.json()["data"]
    assert data["student"]["attendance_percentage"] == 75.0
    assert data["student"]["fee_balance_due"] is None
    assert data["student"]["recent_notices"] == []
    assert set(data["restricted_modules"]) == {
        "timetable", "examination", "assignment", "results", "notice", "finance"
    }

    fees = await client.get(f"/api/v1/parent/children/{child}/fees", headers=auth["uncle"])
    assert fees.status_code == 403, fees.text
    assert "finance" in fees.json()["detail"]
    notices = await client.get(f"/api/v1/parent/children/{child}/notices", headers=auth["uncle"])
    assert notices.status_code == 403
    # …but the child's own profile stays readable: it is not a module.
    profile = await client.get(f"/api/v1/parent/children/{child}/profile", headers=auth["uncle"])
    assert profile.status_code == 200, profile.text
    assert profile.json()["data"]["class_teacher_name"] == "Ms. Kavita Rao"


async def test_unknown_or_foreign_child_is_a_404_not_a_403(backend, auth):
    client, ids, _ = backend
    res = await client.get(f"/api/v1/parent/children/{uuid.uuid4()}/attendance",
                           headers=auth["mother"])
    assert res.status_code == 404

    other = await client.get(f"/api/v1/parent/children/{ids['other_student_id']}/attendance",
                             headers=auth["mother"])
    assert other.status_code == 404


async def test_suspended_and_expired_links_refuse_with_a_reason(backend, auth):
    client, ids, _ = backend
    child = ids["student_id"]

    suspended = await client.get(f"/api/v1/parent/children/{child}/attendance", headers=auth["ex"])
    assert suspended.status_code == 403
    assert "paused" in suspended.json()["detail"]

    expired = await client.get(f"/api/v1/parent/children/{child}/attendance", headers=auth["grand"])
    assert expired.status_code == 403
    assert "no longer active" in expired.json()["detail"]

    # …and the family list names the cause instead of showing an empty console.
    listing = await client.get("/api/v1/parent/children", headers=auth["ex"])
    assert listing.json()["data"]["children"][0]["blocked_reason"] == "SUSPENDED"
    listing = await client.get("/api/v1/parent/children", headers=auth["grand"])
    row = listing.json()["data"]["children"][0]
    assert row["blocked_reason"] == "EXPIRED" and row["days_left"] is not None and row["days_left"] < 0

    overview = await client.get("/api/v1/parent/overview", headers=auth["ex"])
    assert overview.status_code == 200, overview.text
    assert overview.json()["data"]["children"][0]["attendance_percentage"] is None


async def test_parent_role_is_required_for_every_route(backend, auth):
    """A student token is a tenant token: without the role guard it would carry
    just as far, so the guard is all this portal stands on."""
    client, ids, _ = backend
    res = await client.get(f"/api/v1/parent/children/{ids['student_id']}/attendance",
                           headers=auth["student"])
    assert res.status_code == 403
    assert "Parent" in res.json()["detail"]
    assert (await client.get("/api/v1/parent/overview")).status_code == 401
    assert (await client.get(f"/api/v1/institution/parent-links", headers=auth["student"])).status_code == 403


async def test_family_overview_batches_every_child(backend, auth):
    client, _, _ = backend
    res = await client.get("/api/v1/parent/overview", headers=auth["mother"])
    assert res.status_code == 200, res.text
    data = res.json()["data"]
    assert data["tenant_name"] == "Green Valley School"
    assert len(data["children"]) == 1
    rollup = data["children"][0]
    assert rollup["attendance_percentage"] == 75.0
    # Strictly below 75 %, so the boundary does not cry wolf.
    assert rollup["attendance_low"] is False
    assert rollup["fee_balance_due"] == 30000.0
    assert rollup["fee_overdue"] is True
    assert rollup["unpublished_result_count"] == 0
    assert rollup["restricted_modules"] == []

    uncle_view = await client.get("/api/v1/parent/overview", headers=auth["uncle"])
    uncle_rollup = uncle_view.json()["data"]["children"][0]
    assert uncle_rollup["fee_balance_due"] is None
    assert set(uncle_rollup["restricted_modules"]) == set(FULL_SCOPE) - {"attendance"}


# ── the code → account → access round trip ──────────────────────────────────


async def test_activation_flow_end_to_end(backend, auth):
    client, ids, Session = backend
    child = str(ids["student_id"])

    preview = await client.get("/api/v1/parent/access/check-code", params={"code": "abcd1234-efgh"})
    assert preview.status_code == 200, preview.text
    assert preview.json()["data"]["student_name"] == "Aarav Sen"
    assert preview.json()["data"]["institution_name"] == "Green Valley School"
    assert preview.json()["data"]["class_name"] == "Class 5-A"
    assert preview.json()["data"]["relation"] == "Father"

    # Wrong roll number: holding the code is not enough on its own.
    bad = await client.post("/api/v1/parent/access/activate", json={
        "code": "ABCD1234EFGH", "student_roll_no": "GV-2026-02", "name": "Nil Sen",
        "email": INVITEE, "password": "Fresh@2026pass",
    })
    assert bad.status_code == 422, bad.text
    assert "roll number" in bad.json()["detail"]

    # Too short a password is rejected before anything is written.
    weak = await client.post("/api/v1/parent/access/activate", json={
        "code": "ABCD1234EFGH", "student_roll_no": "GV-2026-01", "name": "Nil Sen",
        "email": INVITEE, "password": "short1",
    })
    assert weak.status_code == 422, weak.text

    ok = await client.post("/api/v1/parent/access/activate", json={
        # Separators, case and stray spaces all survive a typed slip…
        "code": "ABCD-1234-efgh ", "student_roll_no": " gv-2026-01 ", "name": " Nil Sen ",
        "email": "NIL@greenvalley.edu  ", "password": "Fresh@2026pass", "phone": "+91 98765 43210",
    })
    assert ok.status_code == 201, ok.text
    assert ok.json()["data"]["slug"] == SLUG
    assert ok.json()["data"]["email"] == INVITEE
    assert ok.json()["data"]["student_name"] == "Aarav Sen"
    # No token by design: the family signs in through the ordinary login.
    assert "tokens" not in ok.json()["data"]

    headers = await _login(client, INVITEE, password="Fresh@2026pass")
    listing = await client.get("/api/v1/parent/children", headers=headers)
    assert listing.status_code == 200, listing.text
    rows = listing.json()["data"]["children"]
    assert [r["student_id"] for r in rows] == [child]
    assert rows[0]["relation"] == "Father" and rows[0]["is_live"] is True

    attendance = await client.get(f"/api/v1/parent/children/{child}/attendance", headers=headers)
    assert attendance.json()["data"]["attendance_percentage"] == 75.0

    async with Session() as s:
        link = (await s.execute(
            select(ParentStudentLink).where(ParentStudentLink.id == ids["link_invite"])
        )).scalar_one()
        assert link.activation_code is None
        assert link.code_expires_at is None
        assert link.status == "ACTIVE" and link.claimed_at is not None
        # Not promoted over the mother, who already holds primary.
        assert link.is_primary is False

        parent = (await s.execute(
            select(User).where(func.lower(User.email) == INVITEE, User.tenant_id == ids["tenant_id"])
        )).scalar_one()
        assert parent.phone == "+919876543210"
        assert parent.email_verified_at is None  # never proved the mailbox yet
        assert link.parent_id == parent.id

        # The receipt email is queued for the new account…
        outbox = (await s.execute(
            select(OutboxEmail).where(OutboxEmail.event == "parent.account_created")
        )).scalars().all()
        assert len(outbox) == 1 and outbox[0].to_address == INVITEE

        # …and the PARENT role was granted inside the tenant.
        granted = (await s.execute(
            select(Role.name).join(RoleAssignment, RoleAssignment.role_id == Role.id)
            .where(RoleAssignment.user_id == parent.id)
        )).scalars().all()
        assert granted == ["PARENT"]

    replay = await client.post("/api/v1/parent/access/activate", json={
        "code": "ABCD1234EFGH", "student_roll_no": "GV-2026-01", "name": "Second Person",
        "email": "second@example.com", "password": "Another@2026pass",
    })
    assert replay.status_code == 404, replay.text


async def test_claim_with_an_existing_account_requires_the_matching_email(backend, auth):
    client, ids, Session = backend
    async with Session() as s:
        row = (await s.execute(
            select(ParentStudentLink).where(ParentStudentLink.id == ids["link_grand"])
        )).scalar_one()
        # Re-open a claimed link as an invite addressed to somebody else.
        row.status = LinkStatus.PENDING_CLAIM.value
        row.parent_id = None
        row.parent_email = "someone-else@example.com"
        row.activation_code = "ZZZZ1111YYYY"
        row.code_expires_at = datetime.now(timezone.utc) + timedelta(days=5)
        await s.commit()

    res = await client.post("/api/v1/parent/children/claim", headers=auth["uncle"],
                            json={"code": "zzzz-1111-yyyy"})
    assert res.status_code == 403, res.text
    assert "different email" in res.json()["detail"]

    async with Session() as s:
        row = (await s.execute(
            select(ParentStudentLink).where(ParentStudentLink.id == ids["link_grand"])
        )).scalar_one()
        # A refused claim leaves the invitation claimable, not burned.
        assert row.status == LinkStatus.PENDING_CLAIM.value
        assert row.activation_code == "ZZZZ1111YYYY"
        row.status = LinkStatus.ACTIVE.value
        row.parent_id = ids["grand_id"]
        row.parent_email = GRANDMOTHER
        row.activation_code = None
        row.code_expires_at = None
        row.access_upto = None
        await s.commit()

    # Now the right guardian can claim a code of their own.
    async with Session() as s:
        row = (await s.execute(
            select(ParentStudentLink).where(ParentStudentLink.id == ids["link_grand"])
        )).scalar_one()
        row.status = LinkStatus.PENDING_CLAIM.value
        row.activation_code = "GRND0000AAAA"
        row.code_expires_at = datetime.now(timezone.utc) + timedelta(days=5)
        await s.commit()
    claimed = await client.post("/api/v1/parent/children/claim", headers=auth["grand"],
                                 json={"code": "GRND0000AAAA"})
    assert claimed.status_code == 200, claimed.text
    assert claimed.json()["data"]["student_name"] == "Aarav Sen"
    readable = await client.get(f"/api/v1/parent/children/{ids['student_id']}/attendance",
                                headers=auth["grand"])
    assert readable.status_code == 200, readable.text


async def test_expired_or_unknown_code_is_not_a_login_oracle(backend, auth):
    client, ids, Session = backend
    async with Session() as s:
        row = (await s.execute(
            select(ParentStudentLink).where(ParentStudentLink.id == ids["link_uncle"])
        )).scalar_one()
        row.status = LinkStatus.PENDING_CLAIM.value
        row.activation_code = "EXPD0000CODE"
        row.code_expires_at = datetime.now(timezone.utc) - timedelta(days=1)
        await s.commit()

    expired = await client.get("/api/v1/parent/access/check-code", params={"code": "EXPD0000CODE"})
    assert expired.status_code == 410, expired.text
    assert "expired" in expired.json()["detail"]

    guess = await client.get("/api/v1/parent/access/check-code", params={"code": "NOPE0000NOPE0"})
    assert guess.status_code == 404, guess.text
    assert "not found" in guess.json()["detail"]

    activate = await client.post("/api/v1/parent/access/activate", json={
        "code": "EXPD0000CODE", "student_roll_no": "GV-2026-01", "name": "Who",
        "email": "who@example.com", "password": "Whatever@2026",
    })
    assert activate.status_code == 410, activate.text

    async with Session() as s:
        row = (await s.execute(
            select(ParentStudentLink).where(ParentStudentLink.id == ids["link_uncle"])
        )).scalar_one()
        # Restore the read-only guardian this suite needs later.
        row.status = LinkStatus.ACTIVE.value
        row.parent_id = ids["uncle_id"]
        row.activation_code = None
        row.code_expires_at = None
        await s.commit()
    assert (await client.get(f"/api/v1/parent/children/{ids['student_id']}/attendance",
                             headers=auth["uncle"])).status_code == 200


# ── leave on behalf of the child ────────────────────────────────────────────


async def test_guardian_files_and_withdraws_a_leave(backend, auth):
    client, ids, Session = backend
    child = ids["student_id"]
    start = date.today()
    body = {"from_date": str(start), "to_date": str(start + timedelta(days=1)),
            "reason": "Fever, seeing the paediatrician."}

    res = await client.post(f"/api/v1/parent/children/{child}/leaves", headers=auth["mother"], json=body)
    assert res.status_code == 201, res.text
    leave = res.json()["data"]
    assert leave["status"] == "PENDING" and leave["mine"] is True
    assert leave["request_source"] == "PARENT"

    listing = await client.get(f"/api/v1/parent/children/{child}/leaves", headers=auth["mother"])
    assert listing.status_code == 200, listing.text
    assert [i["id"] for i in listing.json()["data"]["items"]] == [leave["id"]]

    async with Session() as s:
        row = (await s.execute(
            select(AttendanceLeave).where(AttendanceLeave.id == leave["id"])
        )).scalar_one()
        assert row.requested_by == ids["mother_id"] and row.request_source == "PARENT"
        assert row.student_id == child and row.class_id == ids["class_id"]
        # The child is told: two contradictory stories with the teacher start here.
        note = (await s.execute(
            select(Notification).where(Notification.data["leave_id"].astext == str(leave["id"]))
        )).scalar_one_or_none()
        assert note is not None and note.user_id == child and note.type == "parent.leave.filed"
        # Attributed to the guardian who filed it, not to the child.
        audit = (await s.execute(
            select(AuditLog).where(
                AuditLog.action == "APPLY_LEAVE_FOR_CHILD",
                AuditLog.entity_id == leave["id"],
            )
        )).scalar_one()
        assert audit.user_id == ids["mother_id"] and audit.user_role == "PARENT"

    # Same dates again → conflict, not a second row.
    dup = await client.post(f"/api/v1/parent/children/{child}/leaves", headers=auth["mother"], json=body)
    assert dup.status_code == 409, dup.text
    async with Session() as s:
        assert (await s.execute(
            select(func.count(AttendanceLeave.id)).where(AttendanceLeave.student_id == child)
        )).scalar_one() == 1

    # The teacher's queue says whose words these are.
    teacher_view = await client.get("/api/v1/teacher/attendance/leaves", headers=auth["teacher"])
    assert teacher_view.status_code == 200, teacher_view.text
    mine = next(r for r in teacher_view.json()["data"]["items"] if r["id"] == leave["id"])
    assert mine["request_source"] == "PARENT" and mine["requested_by_name"] == "Riya Sen"

    # Backdated too far is refused before anything is written.
    old = await client.post(f"/api/v1/parent/children/{child}/leaves", headers=auth["mother"], json={
        **body, "from_date": str(date.today() - timedelta(days=30)),
        "to_date": str(date.today() - timedelta(days=29))})
    assert old.status_code == 422, old.text
    assert "week ago" in old.json()["detail"]

    # Leave lives under the attendance module, so the attendance-only guardian
    # reads the request too — marked as not theirs, which is what tells them the
    # mother already handled it and they should not file the same illness twice.
    shared = await client.get(f"/api/v1/parent/children/{child}/leaves", headers=auth["uncle"])
    assert shared.status_code == 200, shared.text
    seen = shared.json()["data"]["items"][0]
    assert seen["id"] == leave["id"] and seen["mine"] is False
    assert seen["request_source"] == "PARENT"

    cancel = await client.post(f"/api/v1/parent/children/{child}/leaves/{leave['id']}/cancel",
                               headers=auth["mother"])
    assert cancel.status_code == 200, cancel.text
    assert cancel.json()["data"]["status"] == "CANCELLED"
    again = await client.post(f"/api/v1/parent/children/{child}/leaves/{leave['id']}/cancel",
                              headers=auth["mother"])
    assert again.status_code == 409, again.text

    # With the withdrawal, the same dates are free again.
    retry = await client.post(f"/api/v1/parent/children/{child}/leaves", headers=auth["mother"], json=body)
    assert retry.status_code == 201, retry.text
    await client.post(f"/api/v1/parent/children/{child}/leaves/{retry.json()['data']['id']}/cancel",
                      headers=auth["mother"])


async def test_guardian_profile_only_edits_contact_details(backend, auth):
    client, ids, Session = backend
    res = await client.get("/api/v1/parent/guardian", headers=auth["mother"])
    assert res.status_code == 200, res.text
    assert res.json()["data"]["children_count"] == 1
    assert res.json()["data"]["can_edit_contact"] is True

    patch = await client.patch("/api/v1/parent/guardian", headers=auth["mother"],
                              json={"phone": "+91 90000 11111", "address": "14 Lake Road, Kolkata"})
    assert patch.status_code == 200, patch.text
    assert patch.json()["data"]["phone"] == "+919000011111"
    assert patch.json()["data"]["address"] == "14 Lake Road, Kolkata"

    async with Session() as s:
        mother = (await s.execute(select(User).where(User.id == ids["mother_id"]))).scalar_one()
        assert mother.phone == "+919000011111"
        assert mother.phone_verified_at is None  # a new number is an unverified number
        # The edit is audited: "who changed this phone number, from what" is the
        # question a school gets asked when a guardian says they never did.
        audit = (await s.execute(
            select(AuditLog).where(
                AuditLog.user_id == ids["mother_id"],
                AuditLog.action == "UPDATE_GUARDIAN_PROFILE",
            )
        )).scalars().first()
        assert audit is not None
        assert audit.user_role == "PARENT"
        assert audit.new_value["phone"] == "+919000011111"
        assert audit.old_value["phone"] != "+919000011111"

    # A short phone is a typo, and a typo in a contact number is worse than none.
    bad = await client.patch("/api/v1/parent/guardian", headers=auth["mother"], json={"phone": "123"})
    assert bad.status_code == 422, bad.text
    assert "7 digits" in bad.json()["detail"]

    # The child cannot use the guardian's routes.
    as_student = await client.patch("/api/v1/parent/guardian", headers=auth["student"],
                                    json={"phone": "+919999999999"})
    assert as_student.status_code == 403


# ── C-IA-12, the school side ─────────────────────────────────────────────────


async def test_admin_board_lists_links_and_the_unlinked_gap(backend, auth):
    client, ids, _ = backend
    res = await client.get("/api/v1/institution/parent-links", headers=auth["admin"])
    assert res.status_code == 200, res.text
    data = res.json()["data"]
    assert data["tenant_type"] == "SCHOOL"
    assert data["total"] == 5
    assert data["counts"].get("ACTIVE", 0) >= 3
    assert data["limit"] == 50 and data["offset"] == 0
    # The reason the page exists: a student with no guardian on record.
    assert {u["student_id"] for u in data["unlinked"]} == {str(ids["unlinked_student_id"])}
    assert data["unlinked_count"] == 1
    assert data["unlinked"][0]["student_roll_no"] == "GV-2026-02"
    assert data["unlinked"][0]["class_name"] == "Class 5-A"

    # A code is shown only while it is still redeemable: the claimed link of a
    # real account carries none, and the pending one carries it in printed form.
    by_id = {r["id"]: r for r in data["items"]}
    assert by_id[str(ids["link_mother"])]["activation_code"] is None
    assert by_id[str(ids["link_mother"])]["parent_name"] == "Riya Sen"
    assert by_id[str(ids["link_mother"])]["claimed_at"] is not None
    assert by_id[str(ids["link_mother"])]["managed_by_name"] == "School Office"
    assert by_id[str(ids["link_ex"])]["status"] == "SUSPENDED"

    filtered = await client.get("/api/v1/institution/parent-links", headers=auth["admin"],
                                params={"status": "SUSPENDED"})
    assert {r["id"] for r in filtered.json()["data"]["items"]} == {str(ids["link_ex"])}
    search = await client.get("/api/v1/institution/parent-links", headers=auth["admin"],
                              params={"query": "Grandmother"})
    assert search.json()["data"]["total"] == 1
    by_class = await client.get("/api/v1/institution/parent-links", headers=auth["admin"],
                                params={"class_id": str(ids["class_id"])})
    assert by_class.json()["data"]["total"] == 5
    primary = await client.get("/api/v1/institution/parent-links", headers=auth["admin"],
                               params={"primary_only": "true"})
    assert [r["id"] for r in primary.json()["data"]["items"]] == [str(ids["link_mother"])]
    paged = await client.get("/api/v1/institution/parent-links", headers=auth["admin"],
                             params={"limit": 2, "offset": 4})
    assert paged.json()["data"]["total"] == 5 and len(paged.json()["data"]["items"]) == 1
    bad_page = await client.get("/api/v1/institution/parent-links", headers=auth["admin"],
                                params={"limit": 500})
    assert bad_page.status_code == 422, bad_page.text

    # Invite the unlinked child's mother → the gap closes, and counts move.
    invite = await client.post("/api/v1/institution/parent-links", headers=auth["admin"], json={
        "student_id": str(ids["unlinked_student_id"]), "relation": "Mother",
        "email": "board-slip@example.com"})
    assert invite.status_code == 201, invite.text
    invite_id = invite.json()["data"]["id"]
    after = (await client.get("/api/v1/institution/parent-links", headers=auth["admin"])).json()["data"]
    assert after["counts"].get("PENDING_CLAIM") == 1
    assert after["total"] == 6 and after["unlinked_count"] == 0 and after["unlinked"] == []
    slip = next(r for r in after["items"] if r["id"] == invite_id)
    assert slip["activation_code"] and slip["activation_code"].count("-") == 2
    assert slip["parent_name"] is None and slip["parent_email"] == "board-slip@example.com"
    assert slip["code_expires_at"] is not None and slip["claimed_at"] is None

    await client.delete(f"/api/v1/institution/parent-links/{invite_id}", headers=auth["admin"])
    restored = (await client.get("/api/v1/institution/parent-links", headers=auth["admin"])).json()["data"]
    assert restored["total"] == 5 and restored["unlinked_count"] == 1


async def test_admin_links_an_existing_account_and_a_new_guardian(backend, auth):
    client, ids, _ = backend

    # 1. Invite a guardian who has no account: they wait behind a code.
    res = await client.post("/api/v1/institution/parent-links", headers=auth["admin"], json={
        "student_id": str(ids["unlinked_student_id"]), "relation": "Mother",
        "email": "Anu.Roy@Example.com", "phone": "98111 22334", "is_primary": True,
        "access_scope": ["attendance", "notice"], "note": "Call before email.",
    })
    assert res.status_code == 201, res.text
    created = res.json()["data"]
    assert created["status"] == "PENDING_CLAIM" and created["parent_id"] is None
    assert created["parent_email"] == "anu.roy@example.com"
    assert created["access_scope"] == ["attendance", "notice"]
    assert created["activation_code"] and "-" in created["activation_code"]
    assert created["code_expires_at"] is not None and created["claimed_at"] is None
    link_id = created["id"]

    # 2. The family redeems it themselves.
    activated = await client.post("/api/v1/parent/access/activate", json={
        "code": created["activation_code"], "student_roll_no": "GV-2026-02", "name": "Anu Roy",
        "email": "anu.roy@example.com", "password": "Guardian@2026x",
    })
    assert activated.status_code == 201, activated.text
    headers = await _login(client, "anu.roy@example.com", password="Guardian@2026x")
    portal = await client.get("/api/v1/parent/children", headers=headers)
    mine = portal.json()["data"]["children"]
    assert [c["student_id"] for c in mine] == [str(ids["unlinked_student_id"])]
    assert mine[0]["is_primary"] is True
    fees = await client.get(f"/api/v1/parent/children/{ids['unlinked_student_id']}/fees",
                            headers=headers)
    assert fees.status_code == 403  # not in the scope the office chose
    attendance = await client.get(f"/api/v1/parent/children/{ids['unlinked_student_id']}/attendance",
                                  headers=headers)
    assert attendance.status_code == 200, attendance.text

    # 3. Validation, in the order a browser would hit it.
    no_guardian = await client.post("/api/v1/institution/parent-links", headers=auth["admin"], json={
        "student_id": str(ids["unlinked_student_id"]), "relation": "Uncle"})
    assert no_guardian.status_code == 422
    both = await client.post("/api/v1/institution/parent-links", headers=auth["admin"], json={
        "student_id": str(ids["unlinked_student_id"]), "relation": "Uncle",
        "parent_user_id": str(ids["uncle_id"]), "email": "who@example.com"})
    assert both.status_code == 422, both.text
    no_modules = await client.post("/api/v1/institution/parent-links", headers=auth["admin"], json={
        "student_id": str(ids["unlinked_student_id"]), "relation": "Uncle",
        "email": "nobody@example.com", "access_scope": []})
    assert no_modules.status_code == 422 and "grants nothing" in no_modules.json()["detail"]
    unknown_student = await client.post("/api/v1/institution/parent-links", headers=auth["admin"], json={
        "student_id": str(ids["other_student_id"]), "relation": "Mother", "email": "x@y.com"})
    assert unknown_student.status_code == 404, unknown_student.text
    duplicate = await client.post("/api/v1/institution/parent-links", headers=auth["admin"], json={
        "student_id": str(ids["unlinked_student_id"]), "relation": "Mother",
        "email": "anu.roy@example.com"})
    assert duplicate.status_code == 409, duplicate.text
    bad_module = await client.post("/api/v1/institution/parent-links", headers=auth["admin"], json={
        "student_id": str(ids["unlinked_student_id"]), "relation": "Aunt",
        "email": "aunt@example.com", "access_scope": ["salaries"]})
    assert bad_module.status_code == 422, bad_module.text

    # 4. Attaching an account that already exists skips the code entirely.
    attached = await client.post("/api/v1/institution/parent-links", headers=auth["admin"], json={
        "student_id": str(ids["unlinked_student_id"]), "relation": "Grandfather",
        "parent_user_id": str(ids["uncle_id"]), "access_scope": ["attendance"],
    })
    assert attached.status_code == 201, attached.text
    assert attached.json()["data"]["status"] == "ACTIVE"
    assert attached.json()["data"]["parent_name"] == "Amar Sen"
    assert attached.json()["data"]["activation_code"] is None
    grandparent_view = await client.get(
        f"/api/v1/parent/children/{ids['unlinked_student_id']}/attendance", headers=auth["uncle"])
    assert grandparent_view.status_code == 200, grandparent_view.text

    await client.delete(f"/api/v1/institution/parent-links/{link_id}", headers=auth["admin"])


async def test_primary_guardian_is_unique_and_reassignable(backend, auth):
    client, ids, Session = backend
    res = await client.post("/api/v1/institution/parent-links", headers=auth["admin"], json={
        "student_id": str(ids["student_id"]), "relation": "Father",
        "parent_user_id": str(ids["teacher_id"]), "is_primary": True})
    assert res.status_code == 201, res.text
    new_link_id = res.json()["data"]["id"]

    async with Session() as s:
        primaries = (await s.execute(
            select(ParentStudentLink).where(
                ParentStudentLink.student_id == ids["student_id"],
                ParentStudentLink.is_primary.is_(True),
                ParentStudentLink.status == LinkStatus.ACTIVE.value,
            )
        )).scalars().all()
        assert [str(p.id) for p in primaries] == [str(new_link_id)]
        mother = (await s.execute(
            select(ParentStudentLink).where(ParentStudentLink.id == ids["link_mother"])
        )).scalar_one()
        assert mother.is_primary is False

    # Promote the mother back → the newcomer is demoted. Exactly one, always.
    back = await client.patch(f"/api/v1/institution/parent-links/{ids['link_mother']}",
                              headers=auth["admin"], json={"is_primary": True})
    assert back.status_code == 200, back.text
    assert back.json()["data"]["is_primary"] is True
    async with Session() as s:
        count = (await s.execute(
            select(func.count(ParentStudentLink.id)).where(
                ParentStudentLink.student_id == ids["student_id"],
                ParentStudentLink.is_primary.is_(True),
                ParentStudentLink.status == LinkStatus.ACTIVE.value,
            )
        )).scalar_one()
        assert count == 1
        # And the school can never end up with no primary at all: demoting the
        # last one is a promotion of whoever is next, not a hole.
        await s.execute(
            ParentStudentLink.__table__.delete().where(ParentStudentLink.id == new_link_id)
        )
        await s.commit()

    # Clearing the last primary is allowed: the flag chooses who the office calls
    # first, and a school is entitled to say nobody holds that job yet.
    last = await client.patch(f"/api/v1/institution/parent-links/{ids['link_mother']}",
                              headers=auth["admin"], json={"is_primary": False})
    assert last.status_code == 200, last.text
    assert last.json()["data"]["is_primary"] is False
    async with Session() as s:
        live = (await s.execute(
            select(func.count(ParentStudentLink.id)).where(
                ParentStudentLink.student_id == ids["student_id"],
                ParentStudentLink.is_primary.is_(True),
                ParentStudentLink.status == LinkStatus.ACTIVE.value,
            )
        )).scalar_one()
        assert live == 0

    # Idempotent edit: nothing changed, no audit row, still 200.
    again = await client.patch(f"/api/v1/institution/parent-links/{ids['link_mother']}",
                                headers=auth["admin"], json={"is_primary": False})
    assert again.status_code == 200, again.text
    assert (await client.post(f"/api/v1/institution/parent-links", headers=auth["admin"], json={
        "student_id": str(ids["student_id"]), "relation": "Father",
        "parent_user_id": str(ids["teacher_id"]), "is_primary": True,
    })).status_code == 201


async def test_scope_and_status_edits_take_effect_at_once(backend, auth):
    client, ids, _ = backend
    child = str(ids["student_id"])

    # Grant the attendance-only guardian finance…
    granted = await client.patch(f"/api/v1/institution/parent-links/{ids['link_uncle']}",
                                 headers=auth["admin"], json={"access_scope": ["attendance", "finance"]})
    assert granted.status_code == 200, granted.text
    assert granted.json()["data"]["access_scope"] == ["attendance", "finance"]
    fees = await client.get(f"/api/v1/parent/children/{child}/fees", headers=auth["uncle"])
    assert fees.status_code == 200, fees.text

    # …then take it away again, and the very next request is refused. No re-login,
    # no cache: the link row is the authority on every request.
    await client.patch(f"/api/v1/institution/parent-links/{ids['link_uncle']}",
                       headers=auth["admin"], json={"access_scope": ["attendance"]})
    fees = await client.get(f"/api/v1/parent/children/{child}/fees", headers=auth["uncle"])
    assert fees.status_code == 403

    empty = await client.patch(f"/api/v1/institution/parent-links/{ids['link_uncle']}",
                               headers=auth["admin"], json={"access_scope": []})
    assert empty.status_code == 422, empty.text
    past = await client.patch(f"/api/v1/institution/parent-links/{ids['link_uncle']}",
                              headers=auth["admin"], json={"access_upto": "2020-01-01"})
    assert past.status_code == 422, past.text

    # A guardian may extend their own reach only by editing the row they do not own.
    self_edit = await client.patch(f"/api/v1/institution/parent-links/{ids['link_uncle']}",
                                   headers=auth["mother"], json={"access_scope": FULL_SCOPE})
    assert self_edit.status_code == 403

    gone = await client.delete(f"/api/v1/institution/parent-links/{ids['link_ex']}",
                               headers=auth["admin"])
    assert gone.status_code == 200, gone.text
    revoked = await client.get(f"/api/v1/parent/children/{child}/attendance", headers=auth["ex"])
    assert revoked.status_code == 404, revoked.text


async def test_code_reissue_invalidates_the_previous_slip(backend, auth):
    """Reissuing is a revocation. The old slip stops working the moment the new
    one exists, which is the only way the office can recall a printed code — and
    the reason the previous code's 404 below matters as much as the new 200."""
    client, ids, Session = backend
    email = "reissue@example.com"
    res = await client.post("/api/v1/institution/parent-links", headers=auth["admin"], json={
        "student_id": str(ids["student_id"]), "relation": "Uncle", "email": email})
    assert res.status_code == 201, res.text
    link_id = res.json()["data"]["id"]
    first = res.json()["data"]["activation_code"]
    assert first and len(first) == 14 and first.count("-") == 2  # XXXX-XXXX-XXXX

    # Reissue onto a claimed link: it has no code to replace and would strand the
    # guardian with a slip that grants a second, redundant claim path.
    refused = await client.post(f"/api/v1/institution/parent-links/{ids['link_mother']}/code",
                               headers=auth["admin"])
    assert refused.status_code == 409, refused.text

    issued = await client.post(f"/api/v1/institution/parent-links/{link_id}/code",
                              headers=auth["admin"])
    assert issued.status_code == 200, issued.text
    fresh = issued.json()["data"]["activation_code"]
    assert fresh != first and issued.json()["data"]["status"] == "PENDING_CLAIM"

    stale = await client.get("/api/v1/parent/access/check-code", params={"code": first})
    assert stale.status_code == 404, stale.text
    assert (await client.get("/api/v1/parent/access/check-code",
                             params={"code": fresh})).status_code == 200
    # Typed with the separators still in place, as the slip prints them.
    assert (await client.get("/api/v1/parent/access/check-code",
                             params={"code": fresh.lower()})).status_code == 200

    async with Session() as s:
        slip = (await s.execute(
            select(OutboxEmail)
            .where(OutboxEmail.event == "parent.link_invited", OutboxEmail.to_address == email)
            .order_by(OutboxEmail.created_at.desc()).limit(1)
        )).scalar_one()
        assert fresh[:4] in slip.body and fresh[-4:] in slip.body
        assert slip.status in {"QUEUED", "SENT"}
        audit = (await s.execute(
            select(AuditLog).where(
                AuditLog.action == "ISSUE_GUARDIAN_CODE",
                AuditLog.entity_id == uuid.UUID(link_id),
            )
        )).scalar_one()
        assert audit.user_role == "INSTITUTION_ADMIN"

    assert (await client.delete(f"/api/v1/institution/parent-links/{link_id}",
                                headers=auth["admin"])).status_code == 200


async def test_a_college_tenant_is_told_the_portal_does_not_apply(backend, auth):
    """Guardian portal is plan-gated. A SCHOOL tenant always gets portal_enabled=True.
    A STUDENT user (not a PARENT role) always gets 403 on the guardian console."""
    client, _, _ = backend
    res = await client.get("/api/v1/parent/children", headers=auth["student"])
    assert res.status_code == 403  # not a parent, in any tenant type

    # The admin board for the SCHOOL tenant should report portal_enabled=True.
    board = await client.get("/api/v1/institution/parent-links?limit=10", headers=auth["admin"])
    assert board.status_code == 200
    assert board.json()["data"]["portal_enabled"] is True


async def test_guardian_access_never_reaches_another_family(backend, auth):
    client, ids, _ = backend
    other_child = ids["other_student_id"]
    for who in ("mother", "uncle", "ex", "grand"):
        res = await client.get(f"/api/v1/parent/children/{other_child}/dashboard", headers=auth[who])
        assert res.status_code == 404, (who, res.text)
        listing = await client.get("/api/v1/parent/children", headers=auth[who])
        assert all(c["student_id"] != str(other_child) for c in listing.json()["data"]["children"])
    # The student's own console is unaffected by any of this.
    own = await client.get("/api/v1/student/attendance", headers=auth["student"])
    assert own.status_code == 200, own.text


async def test_public_claim_endpoints_are_rate_limited(backend):
    """The two unauthenticated endpoints are the only guessable surface here, so
    the limits are part of the security model rather than decoration: 20 lookups
    an hour per IP, and the 21st never reaches the database."""
    client, _, _ = backend
    limiter = app.state.limiter
    limiter.reset()
    limiter.enabled = True
    try:
        codes = []
        for i in range(21):
            res = await client.get(
                "/api/v1/parent/access/check-code", params={"code": f"NOPE{i:06d}X{i:06d}"}
            )
            codes.append(res.status_code)
    finally:
        limiter.enabled = False
        limiter.reset()
    assert codes[:20] == [404] * 20, codes[:20]
    assert codes[20] == 429, codes[20]
