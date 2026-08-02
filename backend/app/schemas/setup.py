"""
Pydantic Schemas — first-time setup wizard (institution admin)

The wizard persists two things:

1. `state`      — the full 12-step payload, stored as JSON in
                  tenant_settings under the `onboarding` key (SYSTEM-FLOW
                  §4.3: state lives in tenant_settings, not the browser).
2. `entities`   — rows the backend materialises from the state into real
                  tables (academic_years, departments, classes, subjects,
                  users, role_assignments, tenant_modules, tenants).
"""

import uuid
from datetime import date
from typing import Any

from pydantic import BaseModel, EmailStr, Field

from app.schemas.common import APIResponse

# ── Step payloads ─────────────────────────────────────────────────────────────

class SetupProfile(BaseModel):
    """Step 1 — Institution profile (upserts the tenants row)."""

    name: str | None = Field(default=None, max_length=255)
    type: str | None = Field(default=None, pattern="^(SCHOOL|COLLEGE)$")
    email: EmailStr | None = None
    phone: str | None = Field(default=None, max_length=20)
    address: str | None = None
    city: str | None = Field(default=None, max_length=100)
    state: str | None = Field(default=None, max_length=100)
    country: str | None = Field(default=None, max_length=100)
    pincode: str | None = Field(default=None, max_length=20)
    website: str | None = Field(default=None, max_length=255)
    timezone: str | None = Field(default=None, max_length=50)


class SetupAcademicYear(BaseModel):
    """Step 3 — the current academic year."""

    name: str = Field(..., max_length=50)
    start_date: date
    end_date: date


class SetupDepartment(BaseModel):
    """Step 4 — departments."""

    name: str = Field(..., max_length=255)
    code: str = Field(..., max_length=20)
    description: str | None = None


class SetupProgram(BaseModel):
    """Step 5 — programs / courses.

    Stored in the onboarding JSON only: the DB schema models academic
    structure as departments → classes, so a program is a lightweight
    grouping label applied to classes rather than its own table.
    """

    name: str = Field(..., max_length=255)
    code: str = Field(..., max_length=20)


class SetupClass(BaseModel):
    """Step 6 — classes & sections (sections = classes, e.g. "10-A")."""

    name: str = Field(..., max_length=100)
    code: str = Field(..., max_length=20)
    department_code: str = Field(..., max_length=20)
    program_code: str | None = Field(default=None, max_length=20)
    section: str | None = Field(default=None, max_length=10)
    max_strength: int = Field(default=60, ge=1)
    room_no: str | None = Field(default=None, max_length=20)


class SetupSubject(BaseModel):
    """Step 7 — subjects attached to a class."""

    name: str = Field(..., max_length=255)
    code: str = Field(..., max_length=30)
    class_code: str = Field(..., max_length=20)
    subject_type: str = Field(default="THEORY", pattern="^(THEORY|PRACTICAL|ELECTIVE|PROJECT)$")
    credits: int | None = Field(default=None, ge=0)
    max_marks: int = Field(default=100, ge=1)
    passing_marks: int = Field(default=35, ge=0)


class SetupStaff(BaseModel):
    """Step 8 — invited staff members."""

    name: str = Field(..., max_length=255)
    email: EmailStr
    phone: str | None = Field(default=None, max_length=20)
    role: str = Field(..., max_length=50)  # e.g. TEACHER, ACCOUNTANT


class SetupStudent(BaseModel):
    """Step 9 — imported students."""

    name: str = Field(..., max_length=255)
    email: EmailStr | None = None
    roll_no: str = Field(..., max_length=50)
    class_code: str = Field(..., max_length=20)
    gender: str | None = Field(default=None, pattern="^(MALE|FEMALE|OTHER)$")
    date_of_birth: date | None = None


class SetupBranding(BaseModel):
    """Step 11 — branding."""

    logo_url: str | None = None
    primary_color: str | None = Field(default=None, max_length=20)
    tagline: str | None = Field(default=None, max_length=200)


class SetupState(BaseModel):
    """The whole wizard payload — every step, plus progress markers."""

    completed: bool = False
    step: int = Field(default=0, ge=0, le=12)
    profile: SetupProfile | None = None
    logo: str | None = None
    academic_year: SetupAcademicYear | None = None
    departments: list[SetupDepartment] = Field(default_factory=list)
    programs: list[SetupProgram] = Field(default_factory=list)
    classes: list[SetupClass] = Field(default_factory=list)
    subjects: list[SetupSubject] = Field(default_factory=list)
    staff: list[SetupStaff] = Field(default_factory=list)
    students: list[SetupStudent] = Field(default_factory=list)
    modules: list[str] = Field(default_factory=list)
    branding: SetupBranding | None = None
    meta: dict[str, Any] = Field(default_factory=dict)


# ── Responses ─────────────────────────────────────────────────────────────────

class SetupEntityCounts(BaseModel):
    """How much of the state has been materialised into real tables."""

    academic_years: int = 0
    departments: int = 0
    classes: int = 0
    subjects: int = 0
    staff: int = 0
    students: int = 0
    modules: int = 0


class SetupResponse(BaseModel):
    tenant_id: uuid.UUID
    tenant_slug: str
    state: SetupState
    entities: SetupEntityCounts


APIResponseSetup = APIResponse[SetupResponse]
