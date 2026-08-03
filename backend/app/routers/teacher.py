"""Teacher API (C-TC-01 … C-TC-22).

Every endpoint requires a live teaching role assignment.  ``TeacherService``
then resolves the caller's subject/class fence from the database and filters
every query on it — a route id is a selector, never authority.  Out-of-scope
ids return 404 rather than 403 so the URL space cannot be probed.
"""

from __future__ import annotations

import uuid
from datetime import date
from typing import Annotated

from fastapi import APIRouter, Depends, Query, status
from sqlalchemy.ext.asyncio import AsyncSession

from app.database import get_db
from app.dependencies.auth import get_current_tenant_user_teacher
from app.models.user import User
from app.schemas.common import APIResponse
from app.schemas.teacher import (
    APIResponseTeacherAssignmentDetail,
    APIResponseTeacherAssignmentPage,
    APIResponseTeacherAttemptDetail,
    APIResponseTeacherContentPage,
    APIResponseTeacherContentRow,
    APIResponseTeacherDashboard,
    APIResponseTeacherEmpty,
    APIResponseTeacherExamPage,
    APIResponseTeacherExamPaper,
    APIResponseTeacherExamResults,
    APIResponseTeacherExamRow,
    APIResponseTeacherLeavePage,
    APIResponseTeacherLeaveRow,
    APIResponseTeacherMarkContext,
    APIResponseTeacherNoticePage,
    APIResponseTeacherNoticeRow,
    APIResponseTeacherSchedule,
    APIResponseTeacherSessionDetail,
    APIResponseTeacherSessionPage,
    APIResponseTeacherSubmissionBoard,
    APIResponseTeacherSubmissionDetail,
    APIResponseTeacherThreadDetail,
    APIResponseTeacherThreadPage,
    TeacherAssignmentCreate,
    TeacherAssignmentUpdate,
    TeacherContentCreate,
    TeacherContentUpdate,
    TeacherExamCreate,
    TeacherExamUpdate,
    TeacherGradeRequest,
    TeacherLeaveDecision,
    TeacherNoticeCreate,
    TeacherQuestionCreate,
    TeacherReplyCreate,
    TeacherSessionCreate,
    TeacherSessionUpdate,
    TeacherSubmissionReview,
    TeacherThreadCreate,
    TeacherThreadModeration,
)
from app.services.teacher_service import TeacherService

router = APIRouter(prefix="/teacher", tags=["Teacher"])

Teacher = Annotated[User, Depends(get_current_tenant_user_teacher)]
DB = Annotated[AsyncSession, Depends(get_db)]


# ── C-TC-01 / C-TC-02 ────────────────────────────────────────────────────────


@router.get("/dashboard", response_model=APIResponseTeacherDashboard)
async def dashboard(db: DB, teacher: Teacher):
    return APIResponse(
        success=True,
        data=await TeacherService.dashboard(db, teacher),
        message="Teacher dashboard loaded",
    )


@router.get("/schedule", response_model=APIResponseTeacherSchedule)
async def schedule(db: DB, teacher: Teacher):
    return APIResponse(
        success=True, data=await TeacherService.schedule(db, teacher), message="Schedule loaded"
    )


# ── C-TC-03 … C-TC-05 attendance ─────────────────────────────────────────────


@router.get("/attendance/context", response_model=APIResponseTeacherMarkContext)
async def mark_context(
    db: DB,
    teacher: Teacher,
    subject_id: uuid.UUID | None = Query(default=None),
    class_id: uuid.UUID | None = Query(default=None),
    on_date: date | None = Query(default=None, alias="date"),
):
    return APIResponse(
        success=True,
        data=await TeacherService.mark_context(
            db, teacher, subject_id=subject_id, class_id=class_id, on_date=on_date
        ),
        message="Attendance sheet loaded",
    )


@router.post(
    "/attendance/sessions",
    response_model=APIResponseTeacherSessionDetail,
    status_code=status.HTTP_201_CREATED,
)
async def create_session(payload: TeacherSessionCreate, db: DB, teacher: Teacher):
    return APIResponse(
        success=True,
        data=await TeacherService.create_session(db, teacher, payload),
        message="Attendance recorded",
    )


@router.get("/attendance/sessions", response_model=APIResponseTeacherSessionPage)
async def sessions(
    db: DB,
    teacher: Teacher,
    class_id: uuid.UUID | None = Query(default=None),
    subject_id: uuid.UUID | None = Query(default=None),
    from_date: date | None = Query(default=None),
    to_date: date | None = Query(default=None),
    limit: int = Query(default=50, ge=1, le=100),
    offset: int = Query(default=0, ge=0),
):
    return APIResponse(
        success=True,
        data=await TeacherService.sessions(
            db,
            teacher,
            class_id=class_id,
            subject_id=subject_id,
            from_date=from_date,
            to_date=to_date,
            limit=limit,
            offset=offset,
        ),
        message="Attendance sessions loaded",
    )


@router.get(
    "/attendance/sessions/{session_id}", response_model=APIResponseTeacherSessionDetail
)
async def session_detail(session_id: uuid.UUID, db: DB, teacher: Teacher):
    return APIResponse(
        success=True,
        data=await TeacherService.session_detail(db, teacher, session_id),
        message="Session loaded",
    )


@router.patch(
    "/attendance/sessions/{session_id}", response_model=APIResponseTeacherSessionDetail
)
async def update_session(
    session_id: uuid.UUID, payload: TeacherSessionUpdate, db: DB, teacher: Teacher
):
    return APIResponse(
        success=True,
        data=await TeacherService.update_session(db, teacher, session_id, payload),
        message="Attendance updated",
    )


@router.post(
    "/attendance/sessions/{session_id}/lock", response_model=APIResponseTeacherSessionDetail
)
async def lock_session(session_id: uuid.UUID, db: DB, teacher: Teacher):
    return APIResponse(
        success=True,
        data=await TeacherService.lock_session(db, teacher, session_id),
        message="Session locked",
    )


# ── C-TC-06 student leave ────────────────────────────────────────────────────


@router.get("/attendance/leaves", response_model=APIResponseTeacherLeavePage)
async def leaves(
    db: DB,
    teacher: Teacher,
    status_filter: str | None = Query(default=None, alias="status"),
    class_id: uuid.UUID | None = Query(default=None),
    limit: int = Query(default=50, ge=1, le=100),
    offset: int = Query(default=0, ge=0),
):
    return APIResponse(
        success=True,
        data=await TeacherService.leaves(
            db, teacher, status_filter=status_filter, class_id=class_id, limit=limit, offset=offset
        ),
        message="Leave requests loaded",
    )


@router.patch("/attendance/leaves/{leave_id}", response_model=APIResponseTeacherLeaveRow)
async def decide_leave(
    leave_id: uuid.UUID, payload: TeacherLeaveDecision, db: DB, teacher: Teacher
):
    return APIResponse(
        success=True,
        data=await TeacherService.decide_leave(db, teacher, leave_id, payload),
        message="Leave request reviewed",
    )


# ── C-TC-07 … C-TC-11 examinations ───────────────────────────────────────────


@router.get("/examinations", response_model=APIResponseTeacherExamPage)
async def examinations(
    db: DB,
    teacher: Teacher,
    status_filter: str | None = Query(default=None, alias="status"),
    subject_id: uuid.UUID | None = Query(default=None),
    limit: int = Query(default=50, ge=1, le=100),
    offset: int = Query(default=0, ge=0),
):
    return APIResponse(
        success=True,
        data=await TeacherService.exams(
            db, teacher, status_filter=status_filter, subject_id=subject_id, limit=limit, offset=offset
        ),
        message="Examinations loaded",
    )


@router.post(
    "/examinations", response_model=APIResponseTeacherExamRow, status_code=status.HTTP_201_CREATED
)
async def create_exam(payload: TeacherExamCreate, db: DB, teacher: Teacher):
    return APIResponse(
        success=True,
        data=await TeacherService.create_exam(db, teacher, payload),
        message="Exam created",
    )


@router.get("/examinations/{exam_id}", response_model=APIResponseTeacherExamRow)
async def exam_detail(exam_id: uuid.UUID, db: DB, teacher: Teacher):
    return APIResponse(
        success=True,
        data=await TeacherService.exam_detail(db, teacher, exam_id),
        message="Exam loaded",
    )


@router.patch("/examinations/{exam_id}", response_model=APIResponseTeacherExamRow)
async def update_exam(
    exam_id: uuid.UUID, payload: TeacherExamUpdate, db: DB, teacher: Teacher
):
    return APIResponse(
        success=True,
        data=await TeacherService.update_exam(db, teacher, exam_id, payload),
        message="Exam updated",
    )


@router.get("/examinations/{exam_id}/questions", response_model=APIResponseTeacherExamPaper)
async def exam_paper(exam_id: uuid.UUID, db: DB, teacher: Teacher):
    return APIResponse(
        success=True,
        data=await TeacherService.exam_paper(db, teacher, exam_id),
        message="Question paper loaded",
    )


@router.post(
    "/examinations/{exam_id}/questions",
    response_model=APIResponseTeacherExamPaper,
    status_code=status.HTTP_201_CREATED,
)
async def add_question(
    exam_id: uuid.UUID, payload: TeacherQuestionCreate, db: DB, teacher: Teacher
):
    return APIResponse(
        success=True,
        data=await TeacherService.add_question(db, teacher, exam_id, payload),
        message="Question added",
    )


@router.delete(
    "/examinations/{exam_id}/questions/{question_id}", response_model=APIResponseTeacherExamPaper
)
async def delete_question(
    exam_id: uuid.UUID, question_id: uuid.UUID, db: DB, teacher: Teacher
):
    return APIResponse(
        success=True,
        data=await TeacherService.delete_question(db, teacher, exam_id, question_id),
        message="Question removed",
    )


@router.get("/examinations/{exam_id}/results", response_model=APIResponseTeacherExamResults)
async def exam_results(exam_id: uuid.UUID, db: DB, teacher: Teacher):
    return APIResponse(
        success=True,
        data=await TeacherService.exam_results(db, teacher, exam_id),
        message="Exam results loaded",
    )


@router.get("/attempts/{attempt_id}", response_model=APIResponseTeacherAttemptDetail)
async def attempt_detail(attempt_id: uuid.UUID, db: DB, teacher: Teacher):
    return APIResponse(
        success=True,
        data=await TeacherService.attempt_detail(db, teacher, attempt_id),
        message="Attempt loaded",
    )


@router.post("/attempts/{attempt_id}/grade", response_model=APIResponseTeacherAttemptDetail)
async def grade_attempt(
    attempt_id: uuid.UUID, payload: TeacherGradeRequest, db: DB, teacher: Teacher
):
    return APIResponse(
        success=True,
        data=await TeacherService.grade_attempt(db, teacher, attempt_id, payload),
        message="Answers graded",
    )


# ── C-TC-12 … C-TC-16 assignments ────────────────────────────────────────────


@router.get("/assignments", response_model=APIResponseTeacherAssignmentPage)
async def assignments(
    db: DB,
    teacher: Teacher,
    status_filter: str | None = Query(default=None, alias="status"),
    subject_id: uuid.UUID | None = Query(default=None),
    limit: int = Query(default=50, ge=1, le=100),
    offset: int = Query(default=0, ge=0),
):
    return APIResponse(
        success=True,
        data=await TeacherService.assignments(
            db, teacher, status_filter=status_filter, subject_id=subject_id, limit=limit, offset=offset
        ),
        message="Assignments loaded",
    )


@router.post(
    "/assignments",
    response_model=APIResponseTeacherAssignmentDetail,
    status_code=status.HTTP_201_CREATED,
)
async def create_assignment(payload: TeacherAssignmentCreate, db: DB, teacher: Teacher):
    return APIResponse(
        success=True,
        data=await TeacherService.create_assignment(db, teacher, payload),
        message="Assignment created",
    )


@router.get("/assignments/{assignment_id}", response_model=APIResponseTeacherAssignmentDetail)
async def assignment_detail(assignment_id: uuid.UUID, db: DB, teacher: Teacher):
    return APIResponse(
        success=True,
        data=await TeacherService.assignment_detail(db, teacher, assignment_id),
        message="Assignment loaded",
    )


@router.patch("/assignments/{assignment_id}", response_model=APIResponseTeacherAssignmentDetail)
async def update_assignment(
    assignment_id: uuid.UUID, payload: TeacherAssignmentUpdate, db: DB, teacher: Teacher
):
    return APIResponse(
        success=True,
        data=await TeacherService.update_assignment(db, teacher, assignment_id, payload),
        message="Assignment updated",
    )


@router.get(
    "/assignments/{assignment_id}/submissions", response_model=APIResponseTeacherSubmissionBoard
)
async def submissions(assignment_id: uuid.UUID, db: DB, teacher: Teacher):
    return APIResponse(
        success=True,
        data=await TeacherService.submissions(db, teacher, assignment_id),
        message="Submissions loaded",
    )


@router.get("/submissions/{submission_id}", response_model=APIResponseTeacherSubmissionDetail)
async def submission_detail(submission_id: uuid.UUID, db: DB, teacher: Teacher):
    return APIResponse(
        success=True,
        data=await TeacherService.submission_detail(db, teacher, submission_id),
        message="Submission loaded",
    )


@router.post(
    "/submissions/{submission_id}/review", response_model=APIResponseTeacherSubmissionDetail
)
async def review_submission(
    submission_id: uuid.UUID, payload: TeacherSubmissionReview, db: DB, teacher: Teacher
):
    return APIResponse(
        success=True,
        data=await TeacherService.review_submission(db, teacher, submission_id, payload),
        message="Submission reviewed",
    )


# ── C-TC-17 / C-TC-18 content ────────────────────────────────────────────────


@router.get("/content", response_model=APIResponseTeacherContentPage)
async def content(
    db: DB,
    teacher: Teacher,
    subject_id: uuid.UUID | None = Query(default=None),
    chapter: str | None = Query(default=None),
    limit: int = Query(default=50, ge=1, le=100),
    offset: int = Query(default=0, ge=0),
):
    return APIResponse(
        success=True,
        data=await TeacherService.content(
            db, teacher, subject_id=subject_id, chapter=chapter, limit=limit, offset=offset
        ),
        message="Content library loaded",
    )


@router.post(
    "/content", response_model=APIResponseTeacherContentRow, status_code=status.HTTP_201_CREATED
)
async def create_content(payload: TeacherContentCreate, db: DB, teacher: Teacher):
    return APIResponse(
        success=True,
        data=await TeacherService.create_content(db, teacher, payload),
        message="Content published",
    )


@router.patch("/content/{content_id}", response_model=APIResponseTeacherContentRow)
async def update_content(
    content_id: uuid.UUID, payload: TeacherContentUpdate, db: DB, teacher: Teacher
):
    return APIResponse(
        success=True,
        data=await TeacherService.update_content(db, teacher, content_id, payload),
        message="Content updated",
    )


@router.delete("/content/{content_id}", response_model=APIResponseTeacherEmpty)
async def delete_content(content_id: uuid.UUID, db: DB, teacher: Teacher):
    await TeacherService.delete_content(db, teacher, content_id)
    return APIResponse(success=True, data={}, message="Content removed")


# ── C-TC-19 / C-TC-20 notices ────────────────────────────────────────────────


@router.get("/notices", response_model=APIResponseTeacherNoticePage)
async def notices(
    db: DB,
    teacher: Teacher,
    limit: int = Query(default=50, ge=1, le=100),
    offset: int = Query(default=0, ge=0),
):
    return APIResponse(
        success=True,
        data=await TeacherService.notices(db, teacher, limit=limit, offset=offset),
        message="Notices loaded",
    )


@router.post(
    "/notices", response_model=APIResponseTeacherNoticeRow, status_code=status.HTTP_201_CREATED
)
async def create_notice(payload: TeacherNoticeCreate, db: DB, teacher: Teacher):
    return APIResponse(
        success=True,
        data=await TeacherService.create_notice(db, teacher, payload),
        message="Notice posted",
    )


# ── C-TC-21 / C-TC-22 discussion ─────────────────────────────────────────────


@router.get("/discussion", response_model=APIResponseTeacherThreadPage)
async def threads(
    db: DB,
    teacher: Teacher,
    query: str | None = Query(default=None),
    limit: int = Query(default=50, ge=1, le=100),
    offset: int = Query(default=0, ge=0),
):
    return APIResponse(
        success=True,
        data=await TeacherService.threads(db, teacher, query=query, limit=limit, offset=offset),
        message="Discussion threads loaded",
    )


@router.post(
    "/discussion",
    response_model=APIResponseTeacherThreadDetail,
    status_code=status.HTTP_201_CREATED,
)
async def create_thread(payload: TeacherThreadCreate, db: DB, teacher: Teacher):
    return APIResponse(
        success=True,
        data=await TeacherService.create_thread(db, teacher, payload),
        message="Thread created",
    )


@router.get("/discussion/{thread_id}", response_model=APIResponseTeacherThreadDetail)
async def thread_detail(thread_id: uuid.UUID, db: DB, teacher: Teacher):
    return APIResponse(
        success=True,
        data=await TeacherService.thread_detail(db, teacher, thread_id),
        message="Thread loaded",
    )


@router.post("/discussion/{thread_id}/replies", response_model=APIResponseTeacherThreadDetail)
async def reply_to_thread(
    thread_id: uuid.UUID, payload: TeacherReplyCreate, db: DB, teacher: Teacher
):
    return APIResponse(
        success=True,
        data=await TeacherService.reply_to_thread(db, teacher, thread_id, payload),
        message="Reply posted",
    )


@router.post(
    "/discussion/{thread_id}/replies/{reply_id}/accept",
    response_model=APIResponseTeacherThreadDetail,
)
async def accept_answer(
    thread_id: uuid.UUID, reply_id: uuid.UUID, db: DB, teacher: Teacher
):
    return APIResponse(
        success=True,
        data=await TeacherService.accept_answer(db, teacher, thread_id, reply_id),
        message="Answer accepted",
    )


@router.patch("/discussion/{thread_id}", response_model=APIResponseTeacherThreadDetail)
async def moderate_thread(
    thread_id: uuid.UUID, payload: TeacherThreadModeration, db: DB, teacher: Teacher
):
    return APIResponse(
        success=True,
        data=await TeacherService.moderate_thread(db, teacher, thread_id, payload),
        message="Thread updated",
    )
