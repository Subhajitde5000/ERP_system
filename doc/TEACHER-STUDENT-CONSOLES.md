# Teacher & Student consoles — deployment and verification

> Covers **C-TC-01 … C-TC-22** (Teacher) and **C-ST-01 … C-ST-20** (Student):
> 42 of the 211 pages in `complete_webpage_developer_assignment.md`, and the
> whole learner-facing half of the academic core.
>
> Companions: `ARCHITECTURE.md` §1 (the three guards), `role_based_system_design.md`
> §4.5 / §4.9 (what each role may do), `MANUAL.md` §7 (operator view).

---

## 1. What was built

Both consoles are **standalone authenticated production routes**. Neither
reads a `lib/*-data.ts` fixture, and neither uses the demo `getSession`. They
write to the canonical ERP tables, so attendance marked by a teacher is the
same `attendance_records` the HOD reports on, and a result a student reads is
the same `student_results` the Exam Controller compiled.

| Layer | Teacher | Student |
|---|---|---|
| ORM | `app/models/teaching.py` (shared) | same |
| Scope | `app/services/teacher_scope_service.py` → `TeacherScope` | → `StudentScope` |
| Service | `app/services/teacher_service.py` | `app/services/student_service.py` |
| Schemas | `app/schemas/teacher.py` | `app/schemas/student.py` |
| Router | `app/routers/teacher.py` (`/api/v1/teacher`) | `app/routers/student.py` (`/api/v1/student`) |
| Guard | `get_current_tenant_user_teacher` | `get_current_tenant_user_student` |
| Client | `fontend/lib/teacher.ts` | `fontend/lib/student.ts` |
| UI | `fontend/components/teacher/*` | `fontend/components/student/*` |
| Routes | `fontend/app/teacher/*` (23) | `fontend/app/student/*` (21) |
| Tests | `backend/tests/test_teacher_console.py` (74) | `backend/tests/test_student_console.py` (70) |

`app/models/teaching.py` models tables that **already existed** in
`database/database.sql` — questions, answers, milestones, submission files and
reviews, content items, discussion replies and votes, attendance leaves and
the fee ledger. They simply had no SQLAlchemy model, which is why both
consoles were previously stuck on fixtures.

---

## 2. The authorization model

`ARCHITECTURE.md` §1 splits authorization into three questions that are
routinely conflated. Both consoles answer all three, in order:

| Guard | Question | Where | Failure |
|---|---|---|---|
| RolesGuard | May a TEACHER call this endpoint at all? | `dependencies/auth.py` | **403** |
| ModuleGuard | Is this module on for the tenant? | tenant module flags | **403** |
| ScopeGuard | Is class `c-42` one of *this* teacher's? | `teacher_scope_service.py` | **404** |

**ScopeGuard returns 404, not 403.** A 403 on `/teacher/assignments/{id}`
confirms the assignment exists, which is enough to enumerate another
department's coursework by walking ids. For a resource keyed to a person, an
out-of-scope read must be indistinguishable from a missing one.

### Teacher scope

Resolved per request, never from a JWT claim or a query parameter:

* `teacher_subjects` → the subjects, and the classes those subjects belong to;
* `classes.class_teacher_id` → the classes the teacher owns outright.

The second grant is deliberately wider than the first, and only one feature
uses it: **student leave review (C-TC-06)**. A subject teacher sees a learner
for one period and has no standing to excuse them from the whole timetable, so
`/teacher/attendance/leaves` is scoped to owned classes and returns an empty
board — not a 403 — for a subject-only teacher.

A teacher with neither gets a **403 with an actionable message** ("ask your HOD
to assign you to a subject") rather than an empty console that looks like a
data-loading bug.

The role guard admits `TEACHER`, `MENTOR` and `HOD`. All three hold
`teacher_subjects` rows and are fenced to exactly the subjects they are
assigned, so admitting them widens nothing — and gating the UI more tightly
than the API would bounce a mentor the backend would have served. The frontend
gate (`InstitutionRoleConsole requiredRole={["TEACHER","MENTOR","HOD"]}`)
matches the API guard for that reason.

### Student scope

§4.9 gives a learner **own data only**, and that is enforced *structurally*:

> **No student endpoint takes a student id.**

`StudentScopeService` resolves the caller's ACTIVE enrolment — one class, one
academic year, and the subjects taught to it — and every query filters on it.
There is no parameter to tamper with. A regression test asserts this by walking
the router and failing on any `{student_id}` path segment.

Where an id *is* taken (an exam, an assignment, a result), the row is loaded
and then checked against the caller's class, returning 404 when it belongs to
someone else.

---

## 3. Exam integrity

The attempt engine is the one place a student writes to a graded table. Three
rules make it safe:

**The clock is the server's.** `exam_attempts.started_at` plus the exam
duration is the deadline, capped by the shared `window_end_at`. The attempt
screen receives `expires_at` *and* `server_time` together and drives its
countdown from the offset between them, so moving the device clock changes
nothing — and `submit` re-checks the deadline regardless, marking a late
submission `auto_submitted = true` rather than rejecting it. A student must
always be able to hand in.

**The answer key never leaves the server.** `_attempt_screen` selects
`QuestionOption.id`, `question_id`, `text` and `sort_order` column-by-column
rather than `select(QuestionOption)`, so `is_correct` cannot reach the client
by accident. `StudentAttemptQuestionOption` has exactly three fields, and a
test asserts that.

**Negative marking bites a wrong answer, never a blank one.** On submit,
objective questions are scored from the key; an unanswered question scores
zero rather than the negative mark, so skipping is free and guessing is not.

Descriptive answers stay `score IS NULL` until a teacher opens them, and the
attempt total is always re-derived from the answers — never accepted from the
client — so a mis-sent payload cannot invent a score the per-question marks do
not support.

---

## 4. Result visibility — two gates

A published result reaches a student only when **both** are true:

```sql
result_publications.approval_status     = 'APPROVED'   -- the Principal (C-PR-04)
result_publications.is_visible_to_students = TRUE      -- the controller (C-EC-08)
```

Either alone must not reveal marks. Per-question exam review is a third,
independent gate: `exams.allow_review` (teacher-controlled) *and*
`exams.status = 'RESULTS_RELEASED'`.

---

## 5. Schema changes

Everything both consoles read already exists in `database.sql`. Two gaps had
to be closed for a database built purely from the Alembic chain:

1. **Policy columns.** `assignments.allow_late_submission`,
   `late_penalty_percent`, `max_file_size_mb`, `allowed_file_types`,
   `instructions_url`; `submissions.text_response`, `is_late`,
   `late_by_minutes`, `feedback`, `version`.
2. **The version key.**

   ```sql
   CREATE UNIQUE INDEX uq_submissions__assignment_id_milestone_id_student_id_ve
     ON submissions (assignment_id, milestone_id, student_id, version)
     NULLS NOT DISTINCT;
   ```

   `NULLS NOT DISTINCT` matters: a top-level submission has `milestone_id IS
   NULL`, and a plain `UNIQUE` treats every NULL as distinct, which would let
   the same student submit the same version twice.

Applied by `database/update2.sql` **section 13** or Alembic
**`a2d4f6b8c013`**. Both are idempotent and safe on a database created from
`database.sql`, where the columns already exist.

One correction shipped with this work: `AttemptStatus.NOT_STARTED` was removed
from `app/models/principal.py`. It had no counterpart in the PostgreSQL
`attempt_status` enum, so persisting it would have failed at the driver. A
"not started" attempt is the *absence* of an `exam_attempts` row, not a value.

---

## 6. Deployment

```bash
# 1. Schema
psql -U erp_user -d erp_db -f database/update2.sql
#    …or, on the Alembic path:
cd backend && alembic upgrade head        # reaches a2d4f6b8c013

# 2. Backend
cd backend && pytest -q                   # 402 passed
python run.py

# 3. Frontend
cd fontend && npx tsc --noEmit && npm run lint && npm run build
npm start
```

### Role assignments

Both consoles need a live row in `role_assignments`. Unlike the HOD console,
neither needs a `scope_id`: the teacher fence comes from `teacher_subjects`
and the student fence from `student_enrollments`.

```sql
-- Teacher
INSERT INTO role_assignments (id, user_id, role_id, tenant_id, scope_type, is_active)
SELECT gen_random_uuid(), :user_id, r.id, :tenant_id, 'INSTITUTION', TRUE
  FROM roles r WHERE r.name = 'TEACHER';

-- …and at least one subject, or the console 403s with a message saying so:
INSERT INTO teacher_subjects (id, tenant_id, teacher_id, subject_id, role_in_subject)
VALUES (gen_random_uuid(), :tenant_id, :user_id, :subject_id, 'TEACHER');

-- Student: the role plus an ACTIVE enrolment in the current academic year.
```

---

## 7. Verification

| # | Check | Expected |
|---|---|---|
| 1 | `GET /api/v1/teacher/dashboard` without a token | 401 |
| 2 | Same with a STUDENT token | 403 "Teacher privileges are required" |
| 3 | Teacher with no `teacher_subjects` row | 403 naming the HOD page to fix it |
| 4 | `GET /teacher/examinations/{another dept's exam id}` | **404**, not 403 |
| 5 | `POST /teacher/attendance/sessions` twice for the same class/subject/date/period | 409 (unique key) |
| 6 | Mark a student who is not on the roster | 422 "not enrolled in this class" |
| 7 | Publish an exam whose questions total ≠ `total_marks` | 409 naming both figures |
| 8 | Publish an exam the Principal has not approved | 409 |
| 9 | Add a question after a student has started | 409 |
| 10 | Grade an answer above its question's marks | 422 |
| 11 | Approve a late submission | score reduced by `late_penalty_percent` |
| 12 | Edit another teacher's content | 403 (§4.5) |
| 13 | Post a teacher notice | `target_scope = CLASS`, `is_pinned = false` |
| 14 | `GET /api/v1/student/dashboard` with a TEACHER token | 403 |
| 15 | Student with no ACTIVE enrolment | 403 naming the fix |
| 16 | `PATCH /student/attempts/{another student's attempt}` | **404** |
| 17 | Inspect the attempt payload | no `is_correct` on any option |
| 18 | Submit after the deadline | accepted, `auto_submitted = true` |
| 19 | Save answers after the deadline | 409 "time is up" |
| 20 | Submit milestone 2 before 1 is approved | 409 naming milestone 1 |
| 21 | Submit a `.exe` to a pdf-only assignment | 422 listing the allowed types |
| 22 | Overlapping leave requests | 409 |
| 23 | Result approved but not released (or vice versa) | not listed |
| 24 | Any route with no token | 401 (parameterised over all 66) |

Checks 3–23 are covered by the 144 tests in `test_teacher_console.py` and
`test_student_console.py`; 1, 2, 14 and 24 are parameterised over every route
in both files.

---

## 8. What is deliberately absent

* **Teacher approval of their own exam schedule.** §4.3 gives that to the
  Principal. A teacher's exam is created `schedule_approval_status = 'PENDING'`
  and cannot be published until approved.
* **Pinned teacher notices.** Pinning is a leadership affordance; a class
  notice must not outrank the Principal's.
* **Cross-teacher moderation.** §4.5 allows a teacher to moderate their *own*
  threads. Department-wide moderation is the HOD console (C-HD-11).
* **Editing a colleague's content.** §4.5 says so explicitly; reading it is
  fine, editing is 403.
* **Student edits to name, roll number or class.** Those are institution
  records — `StudentProfileUpdate` carries only phone, address and photo.
* **Binary upload through the API.** `ARCHITECTURE.md` §11 puts files on S3
  behind a presigned PUT; the forms record a storage key so a 200 MB video
  never travels through the request pipeline.
