"""Library API contract and invariant regression tests."""

import uuid
from datetime import date, timedelta
from decimal import Decimal
from types import SimpleNamespace
from unittest.mock import AsyncMock, MagicMock

import pytest
from fastapi import HTTPException
from pydantic import ValidationError

from app.main import app
from app.models.library import BookCondition
from app.schemas.library import IssueIn, ResourceIn, ReturnIn
from app.services.library_service import LibraryService


def test_library_routes_are_registered():
    paths = app.openapi()["paths"]
    expected = {
        "/api/v1/library/dashboard",
        "/api/v1/library/books",
        "/api/v1/library/books/{book_id}",
        "/api/v1/library/books/{book_id}/copies",
        "/api/v1/library/issues",
        "/api/v1/library/issues/{issue_id}/return",
        "/api/v1/library/borrowers",
        "/api/v1/library/e-resources",
    }
    assert expected <= set(paths)


def test_resource_requires_exactly_one_source():
    with pytest.raises(ValidationError):
        ResourceIn(title="No source", resourceType="LINK")
    with pytest.raises(ValidationError):
        ResourceIn(title="Two sources", resourceType="LINK", url="https://example.com", fileKey="library/x.pdf")
    row = ResourceIn(title="Valid", resourceType="EBOOK", fileKey="library/x.pdf")
    assert row.file_key == "library/x.pdf"


def test_book_circulation_counts_exclude_withdrawn_copies():
    book = SimpleNamespace(
        id=uuid.uuid4(), title="Distributed Systems", authors=["A. Author"], isbn=None,
        publisher=None, edition=None, publication_year=2026, subject_area="Computing",
        language="English", location_code="CS-1", cover_image_url=None, is_active=True,
        total_copies=8, available_copies=3,
    )
    result = LibraryService.book_row(book, unavailable=2)
    assert result.issued_copies == 3
    assert result.unavailable_copies == 2


async def test_issue_locks_and_updates_one_available_copy(monkeypatch):
    tenant_id, actor_id, borrower_id, copy_id, book_id = [uuid.uuid4() for _ in range(5)]
    actor = SimpleNamespace(id=actor_id, tenant_id=tenant_id)
    borrower = SimpleNamespace(id=borrower_id)
    copy = SimpleNamespace(
        id=copy_id,
        book_id=book_id,
        is_available=True,
        condition=BookCondition.GOOD,
    )
    expected = SimpleNamespace(id=uuid.uuid4())
    db = MagicMock()
    db.scalar = AsyncMock(side_effect=[copy, borrower, 0])
    db.commit = AsyncMock()
    db.rollback = AsyncMock()
    db.add = MagicMock()
    monkeypatch.setattr(LibraryService, "access", AsyncMock(return_value=True))
    monkeypatch.setattr(LibraryService, "settings", AsyncMock(return_value=(3, Decimal("5"))))
    monkeypatch.setattr(LibraryService, "_loan_query", AsyncMock(return_value=[expected]))

    result = await LibraryService.issue(
        db,
        actor,
        IssueIn(copyId=copy_id, borrowerId=borrower_id, dueDate=date.today() + timedelta(days=14)),
    )

    assert result is expected
    assert copy.is_available is False
    issued = db.add.call_args.args[0]
    assert issued.tenant_id == tenant_id
    assert issued.copy_id == copy_id
    assert issued.borrower_id == borrower_id
    db.commit.assert_awaited_once()


async def test_issue_rejects_borrower_at_configured_limit(monkeypatch):
    ids = [uuid.uuid4() for _ in range(5)]
    tenant_id, actor_id, borrower_id, copy_id, book_id = ids
    actor = SimpleNamespace(id=actor_id, tenant_id=tenant_id)
    copy = SimpleNamespace(id=copy_id, book_id=book_id, is_available=True, condition=BookCondition.GOOD)
    db = MagicMock()
    db.scalar = AsyncMock(side_effect=[copy, SimpleNamespace(id=borrower_id), 3])
    db.add = MagicMock()
    monkeypatch.setattr(LibraryService, "access", AsyncMock(return_value=True))
    monkeypatch.setattr(LibraryService, "settings", AsyncMock(return_value=(3, Decimal("5"))))

    with pytest.raises(HTTPException) as raised:
        await LibraryService.issue(
            db,
            actor,
            IssueIn(copyId=copy_id, borrowerId=borrower_id, dueDate=date.today() + timedelta(days=1)),
        )
    assert raised.value.status_code == 409
    assert "3-book limit" in raised.value.detail
    db.add.assert_not_called()


async def test_return_computes_fine_and_restores_copy(monkeypatch):
    tenant_id, actor_id, issue_id, copy_id, book_id, borrower_id = [uuid.uuid4() for _ in range(6)]
    actor = SimpleNamespace(id=actor_id, tenant_id=tenant_id)
    issue = SimpleNamespace(
        id=issue_id,
        copy_id=copy_id,
        book_id=book_id,
        borrower_id=borrower_id,
        due_date=date.today() - timedelta(days=4),
        returned_at=None,
        fine_amount=Decimal("0"),
        fine_paid=False,
        fine_paid_at=None,
        returned_to=None,
        notes=None,
    )
    copy = SimpleNamespace(condition=BookCondition.GOOD, is_available=False)
    expected = SimpleNamespace(id=issue_id)
    db = MagicMock()
    db.scalar = AsyncMock(side_effect=[issue, copy])
    db.commit = AsyncMock()
    db.rollback = AsyncMock()
    monkeypatch.setattr(LibraryService, "access", AsyncMock(return_value=True))
    monkeypatch.setattr(LibraryService, "settings", AsyncMock(return_value=(3, Decimal("5"))))
    monkeypatch.setattr(LibraryService, "_loan_query", AsyncMock(return_value=[expected]))

    result = await LibraryService.return_book(db, actor, issue_id, ReturnIn(finePaid=True))

    assert result is expected
    assert issue.fine_amount == Decimal("20")
    assert issue.fine_paid is True
    assert issue.returned_to == actor_id
    assert issue.returned_at is not None
    assert copy.is_available is True
    db.commit.assert_awaited_once()
