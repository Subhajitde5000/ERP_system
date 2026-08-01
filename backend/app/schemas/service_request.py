"""Validation contracts for public website service requests."""

import uuid
from datetime import datetime
from typing import Literal

from pydantic import BaseModel, ConfigDict, EmailStr, Field, field_validator

InstitutionType = Literal["SCHOOL", "COLLEGE", "UNIVERSITY", "OTHER"]
ServiceInterest = Literal[
    "FULL_PLATFORM",
    "ACADEMICS_AND_LMS",
    "OPERATIONS_AND_FINANCE",
    "CUSTOM_IMPLEMENTATION",
]


class ServiceRequestCreate(BaseModel):
    """The minimal information sales needs to qualify a consultation."""

    model_config = ConfigDict(extra="forbid", str_strip_whitespace=True)

    contact_name: str = Field(min_length=2, max_length=100)
    institution_name: str = Field(min_length=2, max_length=255)
    work_email: EmailStr
    phone: str | None = Field(default=None, max_length=30)
    institution_type: InstitutionType
    student_count: int | None = Field(default=None, ge=1, le=2_000_000)
    service_interest: ServiceInterest
    message: str | None = Field(default=None, max_length=2_000)
    # A visually hidden honeypot. Real visitors leave it empty.
    website: str = Field(default="", max_length=200)

    @field_validator("work_email", mode="after")
    @classmethod
    def normalize_email(cls, value: EmailStr) -> str:
        return str(value).lower()

    @field_validator("phone", "message", mode="after")
    @classmethod
    def empty_values_are_null(cls, value: str | None) -> str | None:
        return value or None


class ServiceRequestCreated(BaseModel):
    id: uuid.UUID
    created_at: datetime
