"""Library API contract and invariant regression tests."""

import uuid
from types import SimpleNamespace

import pytest
from pydantic import ValidationError

from app.main import app
from app.schemas.library import ResourceIn
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
