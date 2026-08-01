"""
Pydantic Schemas — Common API envelope

Every endpoint returns APIResponse so clients have a consistent shape.
Standard format from architecture doc:
  { "success": true, "data": {...}, "message": "..." }
  { "success": false, "error": "ERROR_CODE", "message": "..." }
"""

from typing import Any, Generic, TypeVar

from pydantic import BaseModel

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
