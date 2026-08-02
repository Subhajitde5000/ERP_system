"""
Pydantic Schemas — Common API envelope

Every endpoint returns APIResponse so clients have a consistent shape.
Standard format from architecture doc:
  { "success": true, "data": {...}, "message": "..." }
  { "success": false, "error": "ERROR_CODE", "message": "..." }
"""

from typing import Any, Generic, TypeVar

from pydantic import BaseModel, ConfigDict

T = TypeVar("T")


class APIResponse(BaseModel, Generic[T]):
    """Standard success envelope for all API responses."""

    success: bool = True
    data: T | None = None
    message: str = "OK"

    model_config = {"arbitrary_types_allowed": True}


class ErrorDetail(BaseModel):
    """Standard error envelope returned on failures."""

    success: bool = False
    error: str          # machine-readable error code, e.g. INVALID_CREDENTIALS
    message: str        # human-readable description
    details: Any | None = None


# ── camelCase wire contracts ──────────────────────────────────────────────────

def to_camel(s: str) -> str:
    """snake_case → camelCase."""
    head, *rest = s.split("_")
    return head + "".join(w.capitalize() for w in rest)


class Wire(BaseModel):
    """
    Base for any response the TypeScript client consumes directly.

    `fontend/types/*.ts` declare camelCase fields, so a snake_case payload
    silently renders `undefined` in the UI rather than failing loudly. Deriving
    from this makes the alias generator do the translation once, instead of
    every React file mapping keys by hand.

    Accepts either spelling on input (`populate_by_name`), so internal callers
    can keep using Python names.
    """

    model_config = ConfigDict(
        alias_generator=to_camel, populate_by_name=True, from_attributes=True
    )
