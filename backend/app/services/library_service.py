"""Library business logic with tenant isolation and transactional circulation."""

from __future__ import annotations

import uuid
from datetime import date, datetime, timezone
from decimal import Decimal

from fastapi import HTTPException, status
from sqlalchemy import and_, func, or_, select
from sqlalchemy.exc import IntegrityError
from sqlalchemy.ext.asyncio import AsyncSession

from app.models.billing import TenantModule, TenantSetting
from app.models.library import Book, BookCondition, BookCopy, BookIssue, EResource
from app.models.role import Role, RoleAssignment
from app.models.user import User
from app.schemas.library import (
    BookDetail, BookIn, BookRow, BookUpdate, BorrowerRow, Catalogue, Circulation,
    CopyIn, CopyRow, Dashboard, IssueIn, LoanRow, ResourceIn, ResourceRow, ReturnIn,
)

DEFAULT_LOAN_DAYS = 14
DEFAULT_BORROW_LIMIT = 3
DEFAULT_FINE_PER_DAY = Decimal("5.00")
MANAGER_ROLES = {"LIBRARIAN", "INSTITUTION_ADMIN"}
BORROWER_ROLES = {
    "STUDENT", "TEACHER", "MENTOR", "HOD", "PRINCIPAL", "VICE_PRINCIPAL",
    "INSTITUTION_ADMIN", "EXAM_CONTROLLER", "ACADEMIC_COORDINATOR", "ACCOUNTANT",
    "LIBRARIAN", "HOSTEL_WARDEN", "TRANSPORT_MANAGER", "PLACEMENT_OFFICER",
    "HR_MANAGER", "ADMISSION_OFFICER", "STORE_MANAGER",
}


def _not_found(label: str = "Book") -> HTTPException:
    return HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail=f"{label} not found")


class LibraryService:
    @staticmethod
    async def commit(db: AsyncSession, conflict: str) -> None:
        """Commit once and translate database race/integrity failures consistently."""
        try:
            await db.commit()
        except IntegrityError as exc:
            await db.rollback()
            raise HTTPException(status_code=409, detail=conflict) from exc

    @staticmethod
    async def access(db: AsyncSession, user: User, *, manage: bool = False) -> bool:
        enabled = await db.scalar(select(TenantModule.is_enabled).where(
            TenantModule.tenant_id == user.tenant_id,
            TenantModule.module_key == "library",
        ))
        if enabled is not True:
            raise HTTPException(status_code=403, detail="Library module is not enabled")
        role_names = set((await db.execute(
            select(Role.name).join(RoleAssignment, RoleAssignment.role_id == Role.id).where(
                RoleAssignment.user_id == user.id,
                RoleAssignment.tenant_id == user.tenant_id,
                RoleAssignment.is_active.is_(True),
                or_(RoleAssignment.expires_at.is_(None), RoleAssignment.expires_at > datetime.now(timezone.utc)),
            )
        )).scalars().all())
        can_manage = bool(role_names & MANAGER_ROLES)
        if manage and not can_manage:
            raise HTTPException(status_code=403, detail="Librarian privileges are required")
        return can_manage

    @staticmethod
    def book_row(book: Book, unavailable: int = 0) -> BookRow:
        return BookRow(
            id=book.id, title=book.title, authors=book.authors, isbn=book.isbn,
            publisher=book.publisher, edition=book.edition, publication_year=book.publication_year,
            subject_area=book.subject_area, language=book.language, location_code=book.location_code,
            cover_image_url=book.cover_image_url, is_active=book.is_active,
            total_copies=book.total_copies, available_copies=book.available_copies,
            issued_copies=max(0, book.total_copies - book.available_copies - unavailable),
            unavailable_copies=unavailable,
        )

    @staticmethod
    async def catalogue(db: AsyncSession, user: User, *, query: str | None, subject: str | None,
                        available: bool | None, limit: int, offset: int) -> Catalogue:
        can_manage = await LibraryService.access(db, user)
        filters = [Book.tenant_id == user.tenant_id]
        if not can_manage:
            filters.append(Book.is_active.is_(True))
        if query:
            pattern = f"%{query.strip().lower()}%"
            filters.append(or_(func.lower(Book.title).like(pattern), func.lower(func.array_to_string(Book.authors, " ")).like(pattern), func.lower(func.coalesce(Book.isbn, "")).like(pattern)))
        if subject:
            filters.append(Book.subject_area == subject)
        if available is True:
            filters.append(Book.available_copies > 0)
        if available is False:
            filters.append(Book.available_copies == 0)
        total = int(await db.scalar(select(func.count()).select_from(Book).where(*filters)) or 0)
        books = list((await db.execute(select(Book).where(*filters).order_by(Book.title).limit(limit).offset(offset))).scalars().all())
        unavailable: dict[uuid.UUID, int] = {}
        if books:
            unavailable = dict((await db.execute(
                select(BookCopy.book_id, func.count()).where(
                    BookCopy.book_id.in_([book.id for book in books]),
                    BookCopy.condition.in_([BookCondition.DAMAGED, BookCondition.LOST]),
                ).group_by(BookCopy.book_id)
            )).all())
        subjects = list((await db.execute(select(Book.subject_area).where(Book.tenant_id == user.tenant_id, Book.is_active.is_(True), Book.subject_area.is_not(None)).distinct().order_by(Book.subject_area))).scalars().all())
        return Catalogue(items=[LibraryService.book_row(b, unavailable.get(b.id, 0)) for b in books], total=total, limit=limit, offset=offset, subjects=subjects, can_manage=can_manage)

    @staticmethod
    def clean_book_payload(payload: BookIn | BookUpdate) -> dict:
        data = payload.model_dump()
        data["title"] = data["title"].strip()
        data["authors"] = [author.strip() for author in data["authors"] if author.strip()]
        if not data["authors"]:
            raise HTTPException(422, detail="At least one author is required")
        if data.get("isbn"):
            data["isbn"] = data["isbn"].replace(" ", "").upper()
        return data

    @staticmethod
    async def create_book(db: AsyncSession, user: User, payload: BookIn) -> BookDetail:
        await LibraryService.access(db, user, manage=True)
        data = LibraryService.clean_book_payload(payload)
        if data.get("isbn"):
            duplicate = await db.scalar(select(Book.id).where(Book.tenant_id == user.tenant_id, Book.isbn == data["isbn"]))
            if duplicate:
                raise HTTPException(409, detail="A book with this ISBN already exists")
        row = Book(id=uuid.uuid4(), tenant_id=user.tenant_id, total_copies=0, available_copies=0, **data)
        db.add(row)
        await LibraryService.commit(db, "Book ISBN already exists")
        await db.refresh(row)
        return BookDetail(book=LibraryService.book_row(row), copies=[], issues=[], can_manage=True)

    @staticmethod
    async def _book(db: AsyncSession, user: User, book_id: uuid.UUID) -> Book:
        row = await db.scalar(select(Book).where(Book.id == book_id, Book.tenant_id == user.tenant_id))
        if not row:
            raise _not_found()
        return row

    @staticmethod
    async def book_detail(db: AsyncSession, user: User, book_id: uuid.UUID) -> BookDetail:
        can_manage = await LibraryService.access(db, user)
        book = await LibraryService._book(db, user, book_id)
        if not can_manage and not book.is_active:
            raise _not_found()
        own = await LibraryService._loan_query(db, user, borrower_id=user.id, book_id=book.id, active=True, limit=1)
        if not can_manage:
            return BookDetail(book=LibraryService.book_row(book), own_loan=own[0] if own else None, can_manage=False)
        copies = list((await db.execute(select(BookCopy).where(BookCopy.tenant_id == user.tenant_id, BookCopy.book_id == book.id).order_by(BookCopy.accession_number))).scalars().all())
        issues = await LibraryService._loan_query(db, user, book_id=book.id, limit=200)
        unavailable = sum(1 for c in copies if c.condition in {BookCondition.DAMAGED, BookCondition.LOST})
        return BookDetail(book=LibraryService.book_row(book, unavailable), copies=[CopyRow.model_validate(c) for c in copies], issues=issues, can_manage=True)

    @staticmethod
    async def update_book(db: AsyncSession, user: User, book_id: uuid.UUID, payload: BookUpdate) -> BookDetail:
        await LibraryService.access(db, user, manage=True)
        book = await LibraryService._book(db, user, book_id)
        data = LibraryService.clean_book_payload(payload)
        for key, value in data.items():
            setattr(book, key, value)
        await LibraryService.commit(db, "Book ISBN already exists")
        return await LibraryService.book_detail(db, user, book_id)

    @staticmethod
    async def add_copy(db: AsyncSession, user: User, book_id: uuid.UUID, payload: CopyIn) -> CopyRow:
        await LibraryService.access(db, user, manage=True)
        await LibraryService._book(db, user, book_id)
        accession = payload.accession_number.strip().upper()
        duplicate = await db.scalar(select(BookCopy.id).where(BookCopy.tenant_id == user.tenant_id, BookCopy.accession_number == accession))
        if duplicate:
            raise HTTPException(409, detail="Accession number already exists")
        row = BookCopy(id=uuid.uuid4(), tenant_id=user.tenant_id, book_id=book_id, accession_number=accession, condition=BookCondition(payload.condition), is_available=payload.condition in {"GOOD", "FAIR"})
        db.add(row)
        await LibraryService.commit(db, "Accession number already exists")
        await db.refresh(row)
        return CopyRow.model_validate(row)

    @staticmethod
    async def set_condition(db: AsyncSession, user: User, copy_id: uuid.UUID, condition: str) -> CopyRow:
        await LibraryService.access(db, user, manage=True)
        copy = await db.scalar(select(BookCopy).where(BookCopy.id == copy_id, BookCopy.tenant_id == user.tenant_id).with_for_update())
        if not copy:
            raise _not_found("Copy")
        active = await db.scalar(select(BookIssue.id).where(BookIssue.copy_id == copy.id, BookIssue.returned_at.is_(None)))
        if active and condition in {"DAMAGED", "LOST"}:
            raise HTTPException(409, detail="Return the copy before taking it out of circulation")
        copy.condition = BookCondition(condition)
        copy.is_available = not active and condition in {"GOOD", "FAIR"}
        await LibraryService.commit(db, "Copy condition could not be updated")
        await db.refresh(copy)
        return CopyRow.model_validate(copy)

    @staticmethod
    async def settings(db: AsyncSession, tenant_id: uuid.UUID) -> tuple[int, Decimal]:
        rows = dict((await db.execute(select(TenantSetting.key, TenantSetting.value).where(TenantSetting.tenant_id == tenant_id, TenantSetting.key.in_(["library.borrow_limit", "library.fine_per_day"])))).all())
        try: limit = max(1, int(rows.get("library.borrow_limit", DEFAULT_BORROW_LIMIT)))
        except ValueError: limit = DEFAULT_BORROW_LIMIT
        try: fine = max(Decimal("0"), Decimal(rows.get("library.fine_per_day", DEFAULT_FINE_PER_DAY)))
        except Exception: fine = DEFAULT_FINE_PER_DAY
        return limit, fine

    @staticmethod
    async def issue(db: AsyncSession, user: User, payload: IssueIn) -> LoanRow:
        await LibraryService.access(db, user, manage=True)
        if payload.due_date <= date.today():
            raise HTTPException(422, detail="Due date must be in the future")
        copy = await db.scalar(select(BookCopy).where(BookCopy.id == payload.copy_id, BookCopy.tenant_id == user.tenant_id).with_for_update())
        if not copy:
            raise _not_found("Copy")
        if not copy.is_available or copy.condition not in {BookCondition.GOOD, BookCondition.FAIR}:
            raise HTTPException(409, detail="Copy is not available for issue")
        borrower = await db.scalar(select(User).where(User.id == payload.borrower_id, User.tenant_id == user.tenant_id, User.is_active.is_(True), User.deleted_at.is_(None)).with_for_update())
        if not borrower:
            raise _not_found("Borrower")
        limit, _ = await LibraryService.settings(db, user.tenant_id)
        held = int(await db.scalar(select(func.count()).select_from(BookIssue).where(BookIssue.tenant_id == user.tenant_id, BookIssue.borrower_id == borrower.id, BookIssue.returned_at.is_(None))) or 0)
        if held >= limit:
            raise HTTPException(409, detail=f"Borrower has reached the {limit}-book limit")
        issue = BookIssue(id=uuid.uuid4(), tenant_id=user.tenant_id, copy_id=copy.id, book_id=copy.book_id, borrower_id=borrower.id, issued_by=user.id, due_date=payload.due_date, notes=payload.notes)
        copy.is_available = False
        db.add(issue)
        await LibraryService.commit(db, "Copy is already on loan")
        rows = await LibraryService._loan_query(db, user, issue_id=issue.id, limit=1)
        return rows[0]

    @staticmethod
    async def return_book(db: AsyncSession, user: User, issue_id: uuid.UUID, payload: ReturnIn) -> LoanRow:
        await LibraryService.access(db, user, manage=True)
        issue = await db.scalar(select(BookIssue).where(BookIssue.id == issue_id, BookIssue.tenant_id == user.tenant_id).with_for_update())
        if not issue:
            raise _not_found("Loan")
        if issue.returned_at:
            raise HTTPException(409, detail="Book has already been returned")
        copy = await db.scalar(select(BookCopy).where(BookCopy.id == issue.copy_id).with_for_update())
        _, rate = await LibraryService.settings(db, user.tenant_id)
        overdue = max(0, (date.today() - issue.due_date).days)
        issue.fine_amount = rate * overdue
        issue.fine_paid = payload.fine_paid or issue.fine_amount == 0
        issue.fine_paid_at = datetime.now(timezone.utc) if issue.fine_paid and issue.fine_amount else None
        issue.returned_at = datetime.now(timezone.utc)
        issue.returned_to = user.id
        if payload.notes:
            issue.notes = f"{issue.notes}\n{payload.notes}".strip() if issue.notes else payload.notes
        copy.is_available = copy.condition in {BookCondition.GOOD, BookCondition.FAIR}
        await LibraryService.commit(db, "Loan could not be returned")
        rows = await LibraryService._loan_query(db, user, issue_id=issue.id, limit=1)
        return rows[0]

    @staticmethod
    async def _loan_query(db: AsyncSession, user: User, *, issue_id=None, borrower_id=None, book_id=None,
                          active: bool | None = None, overdue: bool = False, query: str | None = None,
                          limit: int = 100, offset: int = 0) -> list[LoanRow]:
        stmt = select(BookIssue, Book.title, BookCopy.accession_number, User.name, User.student_roll_no, User.employee_code).join(Book, Book.id == BookIssue.book_id).join(BookCopy, BookCopy.id == BookIssue.copy_id).join(User, User.id == BookIssue.borrower_id).where(BookIssue.tenant_id == user.tenant_id)
        if issue_id: stmt = stmt.where(BookIssue.id == issue_id)
        if borrower_id: stmt = stmt.where(BookIssue.borrower_id == borrower_id)
        if book_id: stmt = stmt.where(BookIssue.book_id == book_id)
        if active is True: stmt = stmt.where(BookIssue.returned_at.is_(None))
        if active is False: stmt = stmt.where(BookIssue.returned_at.is_not(None))
        if overdue: stmt = stmt.where(BookIssue.returned_at.is_(None), BookIssue.due_date < date.today())
        if query:
            p = f"%{query.lower()}%"
            stmt = stmt.where(or_(func.lower(Book.title).like(p), func.lower(User.name).like(p), func.lower(BookCopy.accession_number).like(p)))
        rows = (await db.execute(stmt.order_by(BookIssue.issued_at.desc()).limit(limit).offset(offset))).all()
        _, fine_rate = await LibraryService.settings(db, user.tenant_id)
        result = []
        for issue, title, accession, name, roll, employee in rows:
            days = max(0, (date.today() - issue.due_date).days) if issue.returned_at is None else 0
            fine = fine_rate * days if issue.returned_at is None else issue.fine_amount
            result.append(LoanRow(id=issue.id, copy_id=issue.copy_id, book_id=issue.book_id, book_title=title, accession_number=accession, borrower_id=issue.borrower_id, borrower_name=name, borrower_ref=roll or employee or str(issue.borrower_id)[:8], issued_at=issue.issued_at, due_date=issue.due_date, returned_at=issue.returned_at, fine_amount=fine, fine_paid=issue.fine_paid, is_overdue=days > 0, overdue_days=days))
        return result

    @staticmethod
    async def circulation(db: AsyncSession, user: User, *, overdue: bool, query: str | None, limit: int, offset: int) -> Circulation:
        await LibraryService.access(db, user, manage=True)
        filters = [BookIssue.tenant_id == user.tenant_id, BookIssue.returned_at.is_(None)]
        if overdue: filters.append(BookIssue.due_date < date.today())
        count_stmt = select(func.count()).select_from(BookIssue)
        if query:
            pattern = f"%{query.lower()}%"
            count_stmt = count_stmt.join(Book, Book.id == BookIssue.book_id).join(BookCopy, BookCopy.id == BookIssue.copy_id).join(User, User.id == BookIssue.borrower_id)
            filters.append(or_(func.lower(Book.title).like(pattern), func.lower(User.name).like(pattern), func.lower(BookCopy.accession_number).like(pattern)))
        total = int(await db.scalar(count_stmt.where(*filters)) or 0)
        items = await LibraryService._loan_query(db, user, active=True, overdue=overdue, query=query, limit=limit, offset=offset)
        overdue_count = int(await db.scalar(select(func.count()).select_from(BookIssue).where(BookIssue.tenant_id == user.tenant_id, BookIssue.returned_at.is_(None), BookIssue.due_date < date.today())) or 0)
        _, rate = await LibraryService.settings(db, user.tenant_id)
        overdue_dates = (await db.execute(select(BookIssue.due_date).where(BookIssue.tenant_id == user.tenant_id, BookIssue.returned_at.is_(None), BookIssue.due_date < date.today()))).scalars().all()
        accrued = sum((rate * (date.today() - due).days for due in overdue_dates), Decimal())
        closed_unpaid = await db.scalar(select(func.coalesce(func.sum(BookIssue.fine_amount), 0)).where(BookIssue.tenant_id == user.tenant_id, BookIssue.returned_at.is_not(None), BookIssue.fine_paid.is_(False)))
        return Circulation(items=items, total=total, limit=limit, offset=offset, overdue=overdue_count, outstanding_fines=accrued + Decimal(closed_unpaid or 0))

    @staticmethod
    async def borrowers(db: AsyncSession, user: User, query: str | None) -> list[BorrowerRow]:
        await LibraryService.access(db, user, manage=True)
        active_count = select(func.count()).select_from(BookIssue).where(BookIssue.borrower_id == User.id, BookIssue.returned_at.is_(None)).correlate(User).scalar_subquery()
        late_count = select(func.count()).select_from(BookIssue).where(BookIssue.borrower_id == User.id, BookIssue.returned_at.is_(None), BookIssue.due_date < date.today()).correlate(User).scalar_subquery()
        eligible = select(RoleAssignment.id).join(Role, Role.id == RoleAssignment.role_id).where(
            RoleAssignment.user_id == User.id,
            RoleAssignment.tenant_id == user.tenant_id,
            RoleAssignment.is_active.is_(True),
            or_(RoleAssignment.expires_at.is_(None), RoleAssignment.expires_at > datetime.now(timezone.utc)),
            Role.name.in_(BORROWER_ROLES),
        ).exists()
        stmt = select(User, active_count, late_count).where(User.tenant_id == user.tenant_id, User.is_active.is_(True), User.deleted_at.is_(None), eligible)
        if query:
            p = f"%{query.lower()}%"; stmt = stmt.where(or_(func.lower(User.name).like(p), func.lower(func.coalesce(User.student_roll_no, "")).like(p), func.lower(func.coalesce(User.employee_code, "")).like(p)))
        rows = (await db.execute(stmt.order_by(User.name).limit(50))).all()
        return [BorrowerRow(id=u.id, name=u.name, ref=u.student_roll_no or u.employee_code or str(u.id)[:8], current_loans=current, overdue_loans=late) for u, current, late in rows]

    @staticmethod
    async def dashboard(db: AsyncSession, user: User) -> Dashboard:
        can_manage = await LibraryService.access(db, user)
        counts = (await db.execute(select(func.count(Book.id), func.coalesce(func.sum(Book.total_copies), 0), func.coalesce(func.sum(Book.available_copies), 0)).where(Book.tenant_id == user.tenant_id, Book.is_active.is_(True)))).one()
        if not can_manage:
            own = await LibraryService._loan_query(db, user, borrower_id=user.id, active=True, limit=10)
            return Dashboard(titles=counts[0], copies=counts[1], available=counts[2], on_loan=len(own), overdue=sum(x.is_overdue for x in own), outstanding_fines=sum((x.fine_amount for x in own if not x.fine_paid), Decimal()), recent_loans=own, can_manage=False)
        desk = await LibraryService.circulation(db, user, overdue=False, query=None, limit=8, offset=0)
        return Dashboard(titles=counts[0], copies=counts[1], available=counts[2], on_loan=desk.total, overdue=desk.overdue, outstanding_fines=desk.outstanding_fines, recent_loans=desk.items, can_manage=True)

    @staticmethod
    async def resources(db: AsyncSession, user: User, query: str | None) -> list[ResourceRow]:
        await LibraryService.access(db, user)
        stmt = select(EResource, User.name).join(User, User.id == EResource.uploaded_by).where(EResource.tenant_id == user.tenant_id)
        if query: stmt = stmt.where(func.lower(EResource.title).like(f"%{query.lower()}%"))
        rows = (await db.execute(stmt.order_by(EResource.created_at.desc()).limit(200))).all()
        return [ResourceRow(id=r.id, title=r.title, resource_type=r.resource_type, url=r.url, file_key=r.file_key, subject_area=r.subject_area, uploaded_by_name=name, created_at=r.created_at) for r, name in rows]

    @staticmethod
    async def create_resource(db: AsyncSession, user: User, payload: ResourceIn) -> ResourceRow:
        await LibraryService.access(db, user, manage=True)
        row = EResource(id=uuid.uuid4(), tenant_id=user.tenant_id, uploaded_by=user.id, **payload.model_dump(mode="json"))
        db.add(row)
        await LibraryService.commit(db, "Resource could not be created")
        await db.refresh(row)
        return ResourceRow(id=row.id, title=row.title, resource_type=row.resource_type, url=row.url, file_key=row.file_key, subject_area=row.subject_area, uploaded_by_name=user.name, created_at=row.created_at)

    @staticmethod
    async def delete_resource(db: AsyncSession, user: User, resource_id: uuid.UUID) -> None:
        await LibraryService.access(db, user, manage=True)
        row = await db.scalar(select(EResource).where(EResource.id == resource_id, EResource.tenant_id == user.tenant_id))
        if not row: raise _not_found("Resource")
        await db.delete(row)
        await LibraryService.commit(db, "Resource could not be deleted")
