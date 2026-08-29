"""Parent portal — unit tests for the parts that are pure logic.

The real-database suite (``test_parent_portal_integration.py``) owns everything
that needs SQL. This file owns the decisions that are made *before* SQL: how a
code typed on a phone becomes a lookup key, how a phone number is normalised, how
a module list turns into nulls in a payload, and what happens when the database
says no. Those are the rules a reviewer cannot re-derive from reading a query,
and each one is a one-line change that would silently break a family's access.
"""

import uuid
from datetime import date, datetime, timedelta, timezone

import pytest
from fastapi import HTTPException
from pydantic import ValidationError
from sqlalchemy.exc import IntegrityError

from app.models.parent import LinkStatus, ParentStudentLink
from app.schemas.parent import (
    ParentAccountClaim,
    ParentClaimByCode,
    ParentGuardianUpdate,
    ParentLinkCreate,
    ParentLinkUpdate,
)
from app.schemas.student import (
    StudentClassInfo,
    StudentDashboard,
    StudentNoticeRow,
    StudentResultAnswer,
)
from app.services import parent_service
from app.services.parent_service import (
    ParentLinkService,
    ParentService,
    _format_code,
    _integrity_conflict,
    _new_activation_code,
    _normalise_phone,
)


# ── the activation code ──────────────────────────────────────────────────────


def test_code_is_read_off_paper_not_typed_like_a_hash():
    """Separators, case and spaces are all noise from the family's point of view."""
    for typed in ("abcd-1234-efgh", " ABCD1234EFGH ", "abCD12-34E FGH", "ABCD1234EFGH"):
        assert ParentClaimByCode(code=typed).code == "ABCD1234EFGH"


def test_code_lengths_are_bounded_on_both_sides():
    with pytest.raises(ValidationError):
        ParentClaimByCode(code="  -  ")      # separators are not a code
    with pytest.raises(ValidationError):
        ParentClaimByCode(code="ABCD")        # too short to be unguessable
    with pytest.raises(ValidationError):
        ParentClaimByCode(code="A" * 25)      # longer than the column


def test_generated_codes_are_unambiguous_and_well_sized():
    codes = {_new_activation_code() for _ in range(500)}
    assert len(codes) == 500  # a 12-symbol Crockford space does not collide here
    for code in codes:
        assert len(code) == 12
        # No I, L, O or U: a code read over the phone and one copied from a slip
        # must not be able to disagree about a character.
        assert set(code) <= set("0123456789ABCDEFGHJKMNPQRSTVWXYZ")
    assert _format_code("ABCD1234EFGH") == "ABCD-1234-EFGH"


def test_account_claim_trims_the_email_the_office_typed():
    claim = ParentAccountClaim(
        code="abcd-1234-efgh", student_roll_no="  GV-2026-01 ", name=" Nil Sen ",
        email="  Nil@Example.COM  ", password="Fresh@2026pass",
    )
    assert claim.email == "nil@example.com"
    assert claim.student_roll_no == "GV-2026-01"
    assert claim.name == "Nil Sen"
    assert claim.code == "ABCD1234EFGH"


def test_self_service_password_is_stronger_than_a_staff_invite():
    """The staff console posts a reset link; this endpoint is open to the internet
    and creates the login itself, so it cannot trust the same length."""
    base = dict(code="abcd-1234-efgh", student_roll_no="GV-1", name="Nil Sen",
                email="nil@example.com")
    with pytest.raises(ValidationError):
        ParentAccountClaim(**base, password="12345678")   # 8 is the old staff floor
    assert ParentAccountClaim(**base, password="1234567890").password == "1234567890"


# ── phone numbers ────────────────────────────────────────────────────────────


@pytest.mark.parametrize(
    "raw,expected",
    [
        ("+91 98765 43210", "+919876543210"),
        ("(033) 2211 4455", "03322114455"),
        ("98765 43210", "9876543210"),
        ("", None),
        (None, None),
    ],
)
def test_phone_is_normalised_for_the_schools_sms_export(raw, expected):
    assert _normalise_phone(raw) == expected


def test_a_number_too_short_to_dial_is_refused_not_stored():
    with pytest.raises(HTTPException) as exc:
        _normalise_phone("12345")
    assert exc.value.status_code == 422
    assert "7 digits" in exc.value.detail


# ── what a link means ────────────────────────────────────────────────────────


def link(**overrides) -> ParentStudentLink:
    values = dict(
        id=uuid.uuid4(),
        tenant_id=uuid.uuid4(),
        parent_id=uuid.uuid4(),
        student_id=uuid.uuid4(),
        relation="Mother",
        is_primary=True,
        status=LinkStatus.ACTIVE.value,
        access_scope=["attendance", "finance"],
        access_upto=None,
    )
    values.update(overrides)
    return ParentStudentLink(**values)


@pytest.mark.parametrize(
    "status,upto,live",
    [
        (LinkStatus.ACTIVE.value, None, True),
        (LinkStatus.SUSPENDED.value, None, False),
        (LinkStatus.PENDING_CLAIM.value, None, False),
        (LinkStatus.ACTIVE.value, date.today() + timedelta(days=3), True),
        # The last day counts: a link ending 31 Aug is still read on 31 Aug.
        (LinkStatus.ACTIVE.value, date.today(), True),
        (LinkStatus.ACTIVE.value, date.today() - timedelta(days=1), False),
        (LinkStatus.SUSPENDED.value, date.today() + timedelta(days=3), False),
    ],
)
def test_is_live_is_the_single_answer_to_can_this_guardian_look_today(status, upto, live):
    assert link(status=status, access_upto=upto).is_live() is live


def test_a_pending_invite_has_no_access_yet():
    """The row exists so the office can print a slip; it must not read as access.
    `hostel_service.allowed_students` treats it as no access too, and this test is
    the single place that both statements can be checked against."""
    row = link(status=LinkStatus.PENDING_CLAIM.value, parent_id=None,
               parent_email="nil@example.com")
    assert row.is_live() is False
    assert row.allows("attendance") is True  # scope ≠ permission; is_live gates it


def test_scope_membership_is_per_module_and_absent_means_denied():
    row = link()
    assert row.allows("attendance") and row.allows("finance")
    assert not row.allows("results")
    assert not row.allows("examination")
    assert link(access_scope=None).allows("attendance") is False
    assert link(access_scope=[]).allows("attendance") is False


def test_link_create_distinguishes_unset_from_empty_scope():
    """`None` is the school default (everything); `[]` is "nothing ticked"."""
    base = dict(student_id=uuid.uuid4(), relation="Mother", email="a@b.com")
    assert ParentLinkCreate(**base).access_scope is None
    assert ParentLinkCreate(**base, access_scope=[]).access_scope == []
    # Duplicates are the UI's to avoid and the service's to collapse; the wire
    # contract keeps what was sent so the board can echo it back unchanged.
    assert ParentLinkCreate(**base, access_scope=["finance", "finance"]).access_scope == [
        "finance", "finance"
    ]
    with pytest.raises(ValidationError):
        ParentLinkCreate(**base, access_scope=["salaries"])
    with pytest.raises(ValidationError):
        ParentLinkCreate(**base, access_upto=date.today() - timedelta(days=1))
    assert ParentLinkCreate(**base, access_upto=date.today()).access_upto == date.today()


def test_email_is_lowered_before_it_becomes_a_key():
    """`uq_parent_student_links_pending_email_student` compares `parent_email`
    as stored, so the schema relies on the service having normalised it."""
    created = ParentLinkCreate(student_id=uuid.uuid4(), relation="Mother",
                              email="  Anu.Roy@Example.com ")
    assert created.email == "anu.roy@example.com"
    # A blank note is stored as NULL by the service (`payload.note or None`); the
    # schema only trims, so `note=None` (leave alone) and `note=""` (clear) stay
    # distinguishable — collapsing them here would make "clear the note" impossible.
    updated = ParentLinkUpdate(relation="  Stepmother ", note="   ")
    assert updated.relation == "Stepmother" and updated.note == ""
    assert ParentLinkUpdate(note=None).note is None


# ── scope filtering of the child's payload ───────────────────────────────────


def dashboard() -> StudentDashboard:
    return StudentDashboard(
        student_name="Aarav Sen",
        class_info=StudentClassInfo(
            class_id=uuid.uuid4(), class_name="Class 5-A", department_name=None,
            academic_year="2026-27",
        ),
        attendance_percentage=75.0,
        attendance_marks=4,
        upcoming_exam_count=2,
        pending_assignment_count=3,
        fee_balance_due=30000.0,
        recent_notices=[StudentNoticeRow(
            id=uuid.uuid4(), title="Annual day", body="Bring the costume.",
            target_scope="CLASS", priority="NORMAL", is_pinned=False,
            published_at=datetime(2026, 8, 1, tzinfo=timezone.utc),
        )],
    )


async def test_ungranted_modules_are_removed_from_the_payload(monkeypatch):
    """Hiding a card in CSS would still ship the fee balance to the browser. The
    values are nulled server-side, so the answer to "can a guardian see this" is
    the same in the API, the app and the network tab."""
    async def fake_dashboard(db, student):
        return dashboard()

    monkeypatch.setattr("app.services.student_service.StudentService.dashboard", fake_dashboard)

    everything = await ParentService._dashboard_payload(
        None, None, link(access_scope=["attendance", "timetable", "examination", "assignment",
                                       "results", "notice", "finance"])
    )
    assert everything.fee_balance_due == 30000.0
    assert everything.attendance_percentage == 75.0
    assert everything.recent_notices

    attendance_only = await ParentService._dashboard_payload(
        None, None, link(access_scope=["attendance"])
    )
    assert attendance_only.attendance_percentage == 75.0
    assert attendance_only.fee_balance_due is None
    assert attendance_only.recent_notices == []
    assert attendance_only.pending_assignment_count == 0
    assert attendance_only.upcoming_exam_count == 0
    assert attendance_only.today_periods == []
    # The name and class are not a module: a guardian always knows whose record
    # they are looking at, or the portal is unauditable by the family.
    assert attendance_only.student_name == "Aarav Sen"
    assert attendance_only.class_info.class_name == "Class 5-A"


async def test_exam_result_projection_carries_no_answers(monkeypatch):
    """`StudentService.exam_result` attaches per-question answers once review is
    allowed. A parent console must not become a way to read the answer key of an
    exam that other students have not sat yet, so the parent shape has no such
    field at all — asserted on the serialised payload, where a leak would appear."""
    from app.schemas.student import StudentExamResult

    released = StudentExamResult(
        exam_id=uuid.uuid4(), title="Mid-term Science", subject_name="Science",
        total_marks=100, passing_marks=40, status="COMPLETED", total_score=61.5,
        percentage=61.5, grade="B", show_answers=True,
        answers=[StudentResultAnswer(
            question_id=uuid.uuid4(), question_text="Define photosynthesis",
            question_type="MCQ", marks=5.0, selected_option_text="it is a plant thing",
            correct_option_text="conversion of light energy", score=0.0,
        )],
    )

    async def fake_link(db, parent, child_id, *, module=None):
        return link(), object()

    async def fake_result(db, child, exam_id):
        return released

    monkeypatch.setattr(ParentService, "link", fake_link)
    monkeypatch.setattr("app.services.student_service.StudentService.exam_result", fake_result)

    summary = await ParentService.exam_result(None, None, uuid.uuid4(), uuid.uuid4())
    payload = summary.model_dump()
    assert "answers" not in payload and "show_answers" not in payload
    assert summary.total_score == 61.5 and summary.grade == "B"
    assert summary.title == "Mid-term Science"


async def test_result_detail_is_delegated_and_gated_by_results_module(monkeypatch):
    """The parent must not be able to read a publication through a second door:
    the same release rule the child's console applies has to apply here."""
    seen: dict[str, object] = {}

    async def fake_link(db, parent, child_id, *, module=None):
        seen["module"] = module
        raise HTTPException(403, detail="not granted")

    monkeypatch.setattr(ParentService, "link", fake_link)
    with pytest.raises(HTTPException):
        await ParentService.result_detail(None, None, uuid.uuid4(), uuid.uuid4())
    assert seen["module"] == "results"


# ── when the database says no ────────────────────────────────────────────────


def _integrity(message: str) -> IntegrityError:
    return IntegrityError("INSERT INTO parent_student_links …", {}, Exception(message))


def test_a_rejected_write_is_explained_by_the_rule_it_broke():
    conflict = _integrity_conflict(
        _integrity('duplicate key value violates unique constraint '
                    '"uq_parent_student_links_primary_active"'),
        fallback="should not be used",
    )
    assert conflict.status_code == 409
    assert "primary guardian" in conflict.detail

    linked = _integrity_conflict(
        _integrity('duplicate key value violates unique constraint '
                    '"uq_parent_student_links__parent_id_student_id"'),
        fallback="should not be used",
    )
    assert "already linked" in linked.detail


def test_an_unmapped_constraint_is_logged_instead_of_relabelled(caplog):
    """Every IntegrityError used to be reported as "already linked", which sent a
    school chasing a duplicate that did not exist. Anything not in the map is now
    the database's problem in the log, with a plain sentence for the caller."""
    with caplog.at_level("ERROR", logger="erp.parent"):
        conflict = _integrity_conflict(
            _integrity('null value in column "student_id" violates not-null constraint'),
            fallback="The guardian link could not be saved.",
            tenant_id=uuid.uuid4(),
        )
    assert conflict.detail == "The guardian link could not be saved."
    assert "not-null constraint" in caplog.text
    # The structured field is what an alert rule greps for, so it has to be on the
    # record itself and not only in the human-readable line.
    assert any(
        getattr(record, "event", None) == "parent.db.constraint_violation"
        and record.constraint is None
        for record in caplog.records
    )


def test_constraint_name_is_read_from_asyncpg_or_the_message():
    class WithAttribute(Exception):
        constraint_name = "uq_parent_student_links_pending_email_student"

    exc = IntegrityError("s", {}, WithAttribute())
    assert ParentLinkService is not None  # the helper is module-private on purpose
    assert parent_service._constraint_name(exc) == "uq_parent_student_links_pending_email_student"
    assert parent_service._constraint_name(
        _integrity('violates unique constraint "some_index"')
    ) == "some_index"
    assert parent_service._constraint_name(_integrity("something else entirely")) is None


# ── the guardian's own edit surface ─────────────────────────────────────────


def test_the_write_surface_of_this_feature_is_exactly_what_it_should_be():
    """Small, closed lists — and asserted as lists rather than as behaviour, because
    a field added to one of these contracts is a policy change, not a bug fix.

    `ParentGuardianUpdate` has no `name`: that is the identity on the admission
    record, staff verify it against documents, and the audit trail quotes whatever
    the account claims. `ParentLinkUpdate` has no `parent_id`/`student_id`:
    re-pointing a link at another family would move a child's record between
    households with a single PATCH, so unlink-and-link is the only route, and it
    leaves two audit rows instead of one rewritten foreign key.
    """
    assert set(ParentGuardianUpdate.model_fields) == {"phone", "address"}
    assert set(ParentLinkUpdate.model_fields) == {
        "relation", "is_primary", "status", "access_scope", "access_upto", "note"
    }
    # An invite is created for a student, never moved to a different one.
    assert "student_id" in ParentLinkCreate.model_fields
    assert "tenant_id" not in ParentLinkCreate.model_fields
    with pytest.raises(ValidationError):
        ParentLinkUpdate(status="DELETED")  # only ACTIVE / SUSPENDED are switchable
