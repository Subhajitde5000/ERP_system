# 🧪 Developer Test Guide — xyz.com ERP + LMS Platform
### Full System Testing Reference · v1.0 · 2026-08-07

> **Who is this for?** A developer, QA engineer, or technical tester who is testing the platform for the first time.
> Read this document top-to-bottom before touching the browser. It tells you every role, every login, what is live, what is NOT yet wired, and exactly how to test each piece.

---

## 📋 Table of Contents

1. [System Overview & Architecture](#1-system-overview--architecture)
2. [Prerequisites & Setup](#2-prerequisites--setup)
3. [Seeded Test Credentials (Quick Reference)](#3-seeded-test-credentials-quick-reference)
4. [Login Systems — Three Separate Entry Points](#4-login-systems--three-separate-entry-points)
5. [Role 1: Platform Owner (Customer)](#5-role-1-platform-owner-customer)
6. [Role 2: Institution Admin](#6-role-2-institution-admin)
7. [Role 3: Principal](#7-role-3-principal)
8. [Role 4: Vice Principal](#8-role-4-vice-principal)
9. [Role 5: Head of Department (HOD)](#9-role-5-head-of-department-hod)
10. [Role 6: Academic Coordinator](#10-role-6-academic-coordinator)
11. [Role 7: Exam Controller](#11-role-7-exam-controller)
12. [Role 8: Teacher](#12-role-8-teacher)
13. [Role 9: Student](#13-role-9-student)
14. [Role 10: Platform Staff (Super Admin / Support / Sales / Finance)](#14-role-10-platform-staff)
15. [Module Status Matrix — What is LIVE vs NOT READY](#15-module-status-matrix)
16. [API Health & Smoke Tests](#16-api-health--smoke-tests)
17. [Known Limitations & Not-Yet-Wired Features](#17-known-limitations--not-yet-wired-features)
18. [Error Reference](#18-error-reference)

---

## 1. System Overview & Architecture

```
Frontend    → Next.js 16 (App Router) + React 19 + Tailwind   → http://localhost:3000
Backend     → FastAPI + SQLAlchemy 2 (async) + asyncpg        → http://localhost:8000
Database    → PostgreSQL 15+ (106 tables, 22 roles, 16 modules)
```

**Three completely separate login systems (three JWT types — tokens do NOT cross between systems):**

| System | Who uses it | Login URL | JWT Type | Console |
|---|---|---|---|---|
| **Owner / Customer** | Business owners who bought the product | `/account/login` | `owner` | `/account/*` |
| **Institution Member** | Admin, Principal, Teachers, Students etc. | `/login` (with `slug`) | `tenant` | `/admin/*`, `/principal/*`, `/vp/*`, `/hod/*`, `/teacher/*`, `/student/*` |
| **Platform Staff** | xyz.com employees (Super Admin, Support…) | `/platform/login` | `platform` | `/platform/*` |

> ⚠️ **Important:** Using an owner token on a tenant endpoint returns `401`. These are three isolated security domains by design.

---

## 2. Prerequisites & Setup

### 2.1 Start the System

```bash
# Step 1: Database
psql -U erp_user -d erp_db -f database/database.sql
psql -U erp_user -d erp_db -f database/update.sql
psql -U erp_user -d erp_db -f database/update2.sql

# Step 2: Backend
cd backend
.venv\Scripts\activate          # Windows
pip install -r requirements.txt
python scripts/seed_data.py     # Creates all test users/roles/data
python run.py                   # Starts on :8000

# Step 3: Frontend
cd fontend
npm ci
npm run dev                     # Starts on :3000
```

### 2.2 Verify the System is Running

```bash
GET http://localhost:8000/health
# Expected: { "status": "healthy" }
```

Also browse to: `http://localhost:8000/docs`
- If you see the Swagger UI → backend is up and `APP_DEBUG=true`
- All API routes are documented and testable here

---

## 3. Seeded Test Credentials (Quick Reference)

These are created automatically by `python scripts/seed_data.py`.

### Platform Staff (login at `/platform/login`)
| Name | Email | Password | Role |
|---|---|---|---|
| Super Admin | `admin@xyz.com` | `adminpassword123` | SUPER_ADMIN |
| Support Lead | `support@xyz.com` | `supportpassword123` | SUPPORT_STAFF |
| Sales Executive | `sales@xyz.com` | `salespassword123` | SALES_EXECUTIVE |
| Finance Manager | `finance@xyz.com` | `financepassword123` | FINANCE_MANAGER |

### Demo Institution (slug: `abc-college`)
| Name | Email | Password | Role |
|---|---|---|---|
| Meera Sharma | `admin@abc-college.edu` | `adminpassword123` | INSTITUTION_ADMIN |

> **Note:** Other institution roles (Principal, VP, HOD, Teacher, Student, Coordinator, Exam Controller) must be **created by the Institution Admin** through the Staff/Student invite flow. They are NOT pre-seeded. See Role 2 testing for how to create them.

### Platform Owner Account
> ⚠️ No owner account is pre-seeded. You must create one through the signup flow. See Role 1.

---

## 4. Login Systems — Three Separate Entry Points

### 4.1 Institution Member Login (`/login`)
Used by: Admin, Principal, VP, HOD, Teacher, Student, Coordinator, Exam Controller

```
URL:   http://localhost:3000/login
Body:  { slug: "abc-college", identifier: "<email or roll_no>", password: "..." }
```

- `identifier` can be an **email** OR a **roll number** (for students)
- After login, the user is redirected based on their **highest role**:
  - `INSTITUTION_ADMIN` → `/admin/dashboard`
  - `PRINCIPAL` → `/principal/dashboard`
  - `VICE_PRINCIPAL` → `/vp/dashboard`
  - `HOD` → `/hod/dashboard`
  - `TEACHER` → `/teacher/dashboard`
  - `STUDENT` → `/student/dashboard`
  - `COORDINATOR` → `/coordinator/dashboard`
  - `EXAM_CONTROLLER` → `/exam-controller/dashboard`

### 4.2 Owner / Customer Login (`/account/login`)
```
URL:   http://localhost:3000/account/login
Flow:  Signup → Email Verify → Login
```

### 4.3 Platform Staff Login (`/platform/login`)
```
URL:   http://localhost:3000/platform/login
```

---

## 5. Role 1: Platform Owner (Customer)

**What is this role?** A business owner (e.g., "Rahul") who signs up on xyz.com, pays for a subscription, and provisions one or more institutions under their account. This is the **billing/account layer**.

### 5.1 How to Create an Owner Account

1. Go to `http://localhost:3000` (marketing home page)
2. Click **"Start free"** or **"Get Started"** → redirects to `/signup`
3. Fill in: name, email, password
4. Submit → backend returns a verification token (`APP_DEBUG=true` shows it in the API response or check `/account/login` for the email link)
5. Verify email: `GET /api/v1/owner/verify-email?token=<token>`
6. Now login at `/account/login` with your email + password
7. You land on `/account` — the **Owner Dashboard**

### 5.2 What the Owner Can Do (All LIVE ✅)

| Feature | Where | How to Test |
|---|---|---|
| **Dashboard** | `/account` | See institution list, billing summary, subscription status |
| **Create New Institution** | `/account` → "New institution" | Fill name, slug, type → Choose plan → Checkout (mock payment) |
| **View Institutions** | `/account/institutions` | List all owned institutions with status |
| **Billing Summary** | `/account/billing` | See active subscriptions, invoices |
| **Support Tickets** | `/account/tickets` | Create a ticket, view history |
| **Profile** | `/account/profile` | Update name, email, password |

### 5.3 Creating a New Institution (Step-by-Step)

1. From `/account` click **"New Institution"**
2. Enter institution name (e.g., `Green College`), slug (`green`), type (SCHOOL / COLLEGE / UNIVERSITY)
3. Choose a plan: **Starter** (₹4,999/mo), **Professional** (₹7,999/mo), **Enterprise** (₹19,999/mo)
4. Coupon codes to test: `WELCOME10` (10% off), `LAUNCH500` (₹500 off)
5. Click **Checkout** → mock payment succeeds automatically (no real payment gateway in dev)
6. Institution is provisioned — admin invited via email (check `outbox_emails` table in dev)

> ⚠️ **Email in dev:** Email is NOT sent to inbox in dev mode. The set-password link for the institution admin is queued in the `outbox_emails` table. Run a DB query to find it:
> ```sql
> SELECT * FROM outbox_emails ORDER BY created_at DESC LIMIT 5;
> ```

---

## 6. Role 2: Institution Admin

**What is this role?** The person who manages the entire institution — structure, staff, students, modules, settings.

**Login:** `http://localhost:3000/login`
```
slug:       abc-college
identifier: admin@abc-college.edu
password:   adminpassword123
```
**Lands on:** `/admin/dashboard`

### 6.1 What the Admin Can Do (All LIVE ✅)

#### Dashboard (`/admin/dashboard`)
- See live counts: academic years, departments, classes, subjects, staff, students
- See enabled modules
- See onboarding checklist state

**Test:** After login, verify the counts update as you add data below.

---

#### Academic Years (`/admin/academic-years`)
1. Click **"Add year"**
2. Enter: Name = `2026-27`, Start = `2026-07-01`, End = `2027-06-30`
3. Tick **"Set as current year"**
4. Click **Submit**
5. ✅ Year appears in list with "Current" badge
6. **Test:** Try to delete the current year → should be blocked
7. **Test:** Add a second year → uncheck "current" from it → verify only one "current" exists

---

#### Departments (`/admin/departments`)
1. Click **"Add department"**
2. Name: `Computer Science & Engineering`, Code: `CSE`
3. Click **Submit**
4. ✅ Department card appears
5. Repeat: Add `Electronics` (`ECE`), `Mathematics` (`MATH`)
6. **Test:** Try to delete a department that has classes → should be blocked with an error
7. **Test:** Delete an empty department → should succeed

---

#### Staff (`/admin/staff`)

**Single invite:**
1. Click **"Invite"**
2. Fill: Name, Email, Phone, Role = `Teacher`
3. Click **"Send invite"**
4. ✅ Staff member appears in list with "Pending" status (password not set yet)
5. Find the set-password link in `outbox_emails` table → use it to set password

**Role types to test (invite one of each):**

| Role to Invite | Special Field | Notes |
|---|---|---|
| `Teacher` | Department (optional) | Can teach subjects |
| `Principal` | None | Gets `/principal/*` access |
| `Vice Principal` | **Department (required)** | Must have at least one delegated dept |
| `HOD` | Department (required) | Department Head — gets `/hod/*` access |
| `Academic Coordinator` | None | Gets `/coordinator/*` access |
| `Exam Controller` | None | Gets `/exam-controller/*` access |
| `Accountant` | None | Requires Finance module enabled |
| `Librarian` | None | Requires Library module enabled |

**Bulk Upload:**
1. Click **"Bulk upload"** → Download CSV template
2. Fill in rows with: `name`, `email`, `role`, `phone`, `department_code`
3. Upload → verify success count and any error rows listed with row numbers

**Assign extra roles (after creation):**
1. Find the staff card → click role buttons (`+ hod`, `+ teacher`, etc.)
2. For Vice Principal: use **"Delegate VP department"** selector on staff card

**Deactivate staff:**
1. Find staff card → toggle active status
2. ✅ That person cannot login while deactivated

---

#### Students (`/admin/students`)

> ⚠️ **Prerequisite:** You must have an Academic Year AND a Class before adding students.
> **`/admin/classes` frontend page is NOT yet built** (backend exists). Create classes via API first — see [Known Limitations](#17-known-limitations--not-yet-wired-features).

**Single add:**
1. Click **"Add student"**
2. Fill: Name, Roll No (unique per institution), Email (optional), Gender, Date of Birth
3. Click **Submit**

**Bulk upload:**
1. CSV headers: `name`, `roll_no`, `email`, `gender`, `date_of_birth`, `class_code`
2. Test with a duplicate roll number → should show that row as failed

---

#### Modules (`/admin/modules`)
1. View the 8 **Core modules** — they are greyed out / always on (cannot toggle off)
2. View **Optional modules** — try to toggle one on
   - **Starter plan:** toggling optional modules returns 402
   - **Professional plan:** Finance module can be toggled on
3. **Test:** Toggle Finance module ON → dashboard should reflect it
4. **Test:** Toggle Library (optional) on Starter plan → expect: `402 Module not included in your plan`

---

#### Settings (`/admin/settings`)
1. Set Timezone to `Asia/Kolkata`
2. Set Currency to `INR`
3. Click **Save**
4. ✅ Reload → values persist

---

#### Profile (`/admin/profile`)
1. Update Institution name, address, city, phone, website
2. Click **Save**
3. ✅ Verify update appears on dashboard

---

## 7. Role 3: Principal

**What is this role?** Institution-wide academic oversight. Approves exam schedules and result publications. Cannot be bypassed by the Vice Principal.

**Login:** `/login` with the email + password set from the Principal invite
**Lands on:** `/principal/dashboard`

> ⚠️ **Prerequisite:** Institution Admin must have invited a `Principal` role user. That user must have set their password via the invite email link found in `outbox_emails`.

### 7.1 What the Principal Can Do (All LIVE ✅)

| Page | What It Shows | Key Action to Test |
|---|---|---|
| `/principal/dashboard` | Attendance %, pending exam approvals, pending result approvals, staff leave, notice count | Verify counts change as exams are created |
| `/principal/attendance` | Department/class attendance with date range | Filter by date + Export CSV |
| `/principal/examinations` | All exam schedules; PENDING queue | **Approve / Reject** an exam schedule |
| `/principal/results` | Result publication queue | **Approve** a result publication |
| `/principal/staff` | Read-only staff directory | Verify CANNOT edit |
| `/principal/students` | Read-only student directory | Verify CANNOT edit |
| `/principal/notices` | All notices + compose | Post a notice institution-wide |
| `/principal/timetable` | Read-only timetable | Filter by class + Export CSV |
| `/principal/reports` | Attendance + results + combined | Export CSV |

**Test the Exam Approval Flow:**
1. Teacher creates an exam (see Role 8)
2. Exam Controller submits it for approval (see Role 7/11)
3. Principal sees it with status **PENDING** in `/principal/examinations`
4. Click exam → click **"Approve"** (with optional note) → status becomes `APPROVED`
5. Or click **"Reject"** → status becomes `REJECTED`
6. Every decision is written to `audit_logs` table (verify with SQL: `SELECT * FROM audit_logs ORDER BY created_at DESC LIMIT 5;`)

---

## 8. Role 4: Vice Principal

**What is this role?** Delegated department-scoped oversight. Can only see data from the departments they are assigned to. **Cannot** do final exam approval or result publication approval.

**Login:** `/login` with VP credentials
**Lands on:** `/vp/dashboard`

> ⚠️ **Prerequisite:** VP without a department scope → **403 error** on every VP endpoint. Admin MUST assign at least one department.

### 8.1 What the VP Can Do (All LIVE ✅)

| Page | What VP Can Do | What VP CANNOT Do |
|---|---|---|
| `/vp/dashboard` | Metrics for delegated departments | Institution-wide metrics |
| `/vp/attendance` | Department/class attendance + CSV | Non-delegated department data |
| `/vp/examinations` | View exam schedules in scope | **Approve/reject** exams (Principal only) |
| `/vp/results` | View result summaries in scope | **Approve** publications (Principal only) |
| `/vp/notices` | View all + post to own departments | Institution-wide notices (server blocks 403) |
| `/vp/staff` | Read-only staff in delegated depts | Staff outside delegated departments |

**Test the scope restriction:**
1. Assign VP to `CSE` department only
2. Login as VP → navigate to `/vp/attendance` → should only show CSE data
3. Try to post a notice to `ECE` → server should return 403

---

## 9. Role 5: Head of Department (HOD)

**What is this role?** Runs their department — attendance, assignments, exams, teachers, mentors, notices, discussion moderation, timetable.

**Login:** `/login` with HOD credentials
**Lands on:** `/hod/dashboard`

> ⚠️ **Prerequisite:** HOD without a department → 403 on every HOD endpoint.

### 9.1 What the HOD Can Do (All LIVE ✅)

#### Dashboard (`/hod/dashboard`)
Department KPIs: attendance %, pending assignments, results, exams, notice count.

#### Attendance (`/hod/attendance` and `/hod/attendance/report`)
- Class heatmap, per-student/subject records, date range, Export CSV

#### Examinations + Results
- Department-only schedules/results, Export CSV
- Cannot do final approval (Principal only)

#### Assignments (`/hod/assignments`)
- Department assignments overview and pending review status

#### Teachers (`/hod/teachers`)
- Subject staffing within department
- **Test:** Remove a teacher-subject link → teacher account stays active

#### Mentors (`/hod/mentors`) ← Important to test!
- Assign one mentor per student per academic year
- **Test:**
  1. Assign Mentor A to Student X → success
  2. Try to assign Mentor B to Student X → should fail (duplicate constraint)
  3. Use **"Reassign"** → moves to Mentor B, previous assignment ends

#### Notices (`/hod/notices` and `/hod/notices/new`)
- View institution feed + post to own department/class only
- **Test:** Try to post institution-wide → server blocks (403)

#### Discussion (`/hod/discussion`)
- **Pin** a thread → stays at top for students
- **Lock** a thread → no new replies
- **Soft-delete** a post → hidden from students, logged in audit

#### Timetable (`/hod/timetable`)
- Read-only classes in HOD's department

---

## 10. Role 6: Academic Coordinator

**What is this role?** Manages timetable, substitutions, academic calendar, and institution-wide notices.

**Login:** `/login` with Coordinator credentials
**Lands on:** `/coordinator/dashboard`

### 10.1 What the Coordinator Can Do

> ⚠️ **Status:** Backend endpoints fully implemented (`/api/v1/coordinator/*`). Frontend pages exist at `/coordinator/*`. Test each page and confirm data loads from the real backend (not demo data).

| Page | Feature |
|---|---|
| `/coordinator/dashboard` | Overview metrics |
| `/coordinator/timetable` | View + create/edit timetable slots |
| `/coordinator/substitutions` | Assign substitute teacher when regular teacher is absent |
| `/coordinator/calendar` | Create holidays, exam days, special events |
| `/coordinator/notices` | Post institution-wide notices |
| `/coordinator/students` | View student roster |
| `/coordinator/import` | Data import functionality |

**Test substitution flow:**
1. Select: date, class, period, original teacher, substitute teacher
2. Save → substitution appears in timetable for that day

---

## 11. Role 7: Exam Controller

**What is this role?** Manages the full examination workflow — schedules, hall allocations, monitoring, grade cards, result publications, malpractice. Submits exams to Principal for final approval.

**Login:** `/login` with Exam Controller credentials
**Lands on:** `/exam-controller/dashboard`

### 11.1 What the Exam Controller Can Do (Backend LIVE ✅)

| Page | Feature | Test Action |
|---|---|---|
| `/exam-controller/dashboard` | Live exam metrics | Verify counts are real |
| `/exam-controller/schedule` | Create + manage exam schedules | Create → Submit for approval |
| `/exam-controller/halls` | Hall allocations | Create hall + assign students |
| `/exam-controller/monitor` | Live exam monitoring | Check present students |
| `/exam-controller/malpractice` | Log malpractice incidents | Record an incident |
| `/exam-controller/results` | Enter results + create publications | Forward publication to Principal |
| `/exam-controller/grade-cards` | Generate grade cards | Works after Principal approves publication |
| `/exam-controller/reports` | Exam performance reports | Export CSV |

**Test Clash Check:**
1. Create two exams for the same class at the same time
2. Run clash check → should flag the conflict

---

## 12. Role 8: Teacher

**What is this role?** Marks attendance, creates exams/assignments, grades submissions, manages content, posts notices, moderates discussions.

**Login:** `/login` with Teacher credentials
**Lands on:** `/teacher/dashboard`

### 12.1 What the Teacher Can Do (Backend LIVE ✅)

| Page | Feature | Test Action |
|---|---|---|
| `/teacher/dashboard` | Classes today, pending submissions, upcoming exams | Verify real data |
| `/teacher/attendance` | Mark attendance for a class session | Mark Present/Absent/Late → Save → Reopen (upsert behavior) |
| `/teacher/examinations` | Create exams, add questions | Create exam + question bank |
| `/teacher/assignments` | Create assignments, view + grade submissions | Create → student submits → teacher grades |
| `/teacher/submissions` | All pending submissions | Review and grade |
| `/teacher/content` | Upload study materials | Create content item |
| `/teacher/schedule` | Personal teaching timetable | View assigned periods |
| `/teacher/notices` | Post notices to assigned classes | Create notice → verify on student board |
| `/teacher/discussion` | Threaded discussions | Create thread, reply, moderate |

**Test Attendance Upsert:**
1. Mark a session → save
2. Reopen the same session (same class + date + period) → existing marks load
3. Change one student's mark → save → verify update persists

---

## 13. Role 9: Student

**What is this role?** Views their own attendance, exams, results, assignments, timetable, fees, notices, discussions, and content. Everything scoped to the student's active enrollment.

**Login:** `/login`
```
slug:       abc-college
identifier: <roll_number or email>
password:   <set from invite or set-password link>
```
**Lands on:** `/student/dashboard`

> ⚠️ **Prerequisite:** Student must be added AND enrolled into a class for the current academic year. Without enrollment, dashboard is empty.

### 13.1 What the Student Can Do (Backend LIVE ✅)

| Page | Feature |
|---|---|
| `/student/dashboard` | Today's timetable, attendance %, upcoming exams, recent notices |
| `/student/attendance` | Personal attendance by subject + calendar heatmap |
| `/student/examinations` | Upcoming and past exams |
| `/student/examinations/<id>` | Take an online exam (within time window) |
| `/student/results` | Published results (after Principal approval) |
| `/student/assignments` | Assignments with due dates |
| `/student/assignments/<id>` | Submit an assignment |
| `/student/content` | Study materials from teachers |
| `/student/timetable` | Weekly class timetable |
| `/student/notices` | Institution, department, class notices |
| `/student/discussion` | Create/reply to threads, vote on posts |
| `/student/fees` | Fee dues + payment history (requires Finance module ON) |
| `/student/profile` | Update name, phone, address |

**Test the Full Exam Flow:**
1. Teacher creates an online exam
2. Exam Controller submits for approval
3. Principal approves
4. Student navigates to `/student/examinations` → "Start Exam" button appears at exam time
5. Answer questions → system logs tab-switches (anti-cheat mechanism)
6. Submit → wait for result publication
7. After Exam Controller publishes + Principal approves → result appears at `/student/results`

**Test Discussion Flow:**
1. Student creates a thread in a subject
2. Another student or teacher replies
3. Student votes (upvote/downvote) on a reply
4. HOD pins or locks the thread

---

## 14. Role 10: Platform Staff

**What is this role?** xyz.com's internal employees managing the platform itself.

**Login:** `http://localhost:3000/platform/login`

### 14.1 Platform Staff Roles

| Role | Email | Password | Access |
|---|---|---|---|
| Super Admin | `admin@xyz.com` | `adminpassword123` | Full platform control — tenants, plans, billing, platform users |
| Support Staff | `support@xyz.com` | `supportpassword123` | Read any institution to resolve tickets |
| Sales Executive | `sales@xyz.com` | `salespassword123` | Trials, conversions, subscription management |
| Finance Manager | `finance@xyz.com` | `financepassword123` | Platform invoicing and revenue |

> ⚠️ **Frontend Status:** Platform auth backend (`/api/v1/platform/auth/*`) is fully live. Platform staff console pages at `/app/(auth)/platform/` — test each page and note what is connected vs placeholder.

---

## 15. Module Status Matrix

### ✅ LIVE — Fully connected frontend + real backend

| Role / Console | Routes | Status |
|---|---|---|
| Institution Admin console | `/admin/*` | ✅ All 8 pages live |
| Principal console | `/principal/*` | ✅ All 9 pages live |
| Vice Principal console | `/vp/*` | ✅ All 6 pages live |
| HOD console | `/hod/*` | ✅ All 10 pages live |
| Teacher console | `/teacher/*` | ✅ All 9 pages live |
| Student console | `/student/*` | ✅ All 11 pages live |
| Academic Coordinator console | `/coordinator/*` | ✅ Backend live, frontend present |
| Exam Controller console | `/exam-controller/*` | ✅ Backend live, frontend present |
| Owner console | `/account/*` | ✅ All pages live |
| Platform staff auth | `/platform/login` | ✅ Auth live |

### 🟡 BACKEND READY — Frontend page not yet built

| Feature | Backend Endpoint | What's Missing |
|---|---|---|
| Classes management UI | `GET/POST /institution/classes` | `/admin/classes` page NOT built |
| Subjects management UI | `GET/POST /institution/subjects` | `/admin/subjects` page NOT built |
| Student enrollment UI | `POST /institution/enrollments` | Enrollment form NOT connected in frontend |
| Staff role per-id API | `PUT /institution/staff/:id/roles` | Available via API only |
| Staff deactivate per-id | `PUT /institution/staff/:id/active` | Available via API only |

### ❌ NOT READY — Demo/Preview pages (reads from in-memory fixtures, NOT the database)

These pages exist under `(institution)/*` and **render for visual preview only**. Do NOT test these as real features.

| Module | Preview Path | Required For Production | Status |
|---|---|---|---|
| Library | `(institution)/library/*` | Library module + Librarian role | ❌ Not wired |
| Hostel | `(institution)/hostel/*` | Hostel module + Hostel Warden role | ❌ Not wired |
| Transport | `(institution)/transport/*` | Transport module + Transport Manager | ❌ Not wired |
| HR / Payroll | `(institution)/hr/*` | HR module + HR Manager | ❌ Not wired |
| Admission | `(institution)/admission/*` | Admission module + Admission Officer | ❌ Not wired |
| Finance (full UI) | `(institution)/finance/*` | Finance module + Accountant | ❌ Not wired (student fees API exists) |
| Placement | `(institution)/placement/*` | Placement module + Placement Officer | ❌ Not wired |
| Inventory | `(institution)/inventory/*` | Inventory module + Store Manager | ❌ Not wired |
| Parent Portal | — | Parent role | ❌ Not built at all |

> **How to identify a demo page:** If it loads without you being logged in, or shows "fake" data instantly, or the URL contains `(institution)/` — it is a preview page using `lib/*-data.ts` fixtures.

---

## 16. API Health & Smoke Tests

### Health Check
```http
GET http://localhost:8000/health
# Expected: { "status": "healthy" }
```

### Public Module Catalogue
```http
GET http://localhost:8000/api/v1/public/catalog
# Expected: list of 16 modules
```

### Institution Login
```http
POST http://localhost:8000/api/v1/tenant/auth/login
Content-Type: application/json

{
  "slug": "abc-college",
  "identifier": "admin@abc-college.edu",
  "password": "adminpassword123"
}
# Expected: { "success": true, "data": { "access_token": "..." } }
```

### Admin Dashboard (use token from above)
```http
GET http://localhost:8000/api/v1/institution/dashboard
Authorization: Bearer <token>
# Expected: live department/class/student counts
```

### Platform Staff Login
```http
POST http://localhost:8000/api/v1/platform/auth/login
Content-Type: application/json

{
  "email": "admin@xyz.com",
  "password": "adminpassword123"
}
# Expected: platform JWT
```

### Owner Signup + Verify + Login
```http
# 1. Signup (with APP_DEBUG=true, response contains verification_token)
POST http://localhost:8000/api/v1/owner/signup
{ "name": "Test Owner", "email": "test@example.com", "password": "Test@1234" }

# 2. Verify
GET http://localhost:8000/api/v1/owner/verify-email?token=<token>

# 3. Login
POST http://localhost:8000/api/v1/owner/login
{ "email": "test@example.com", "password": "Test@1234" }
```

### Run Backend Unit Tests
```bash
cd backend
pytest -q
# Covers: provisioning pipeline, gapless invoicing, owner signup→verify→login, RBAC guard, plan-gated modules
```

---

## 17. Known Limitations & Not-Yet-Wired Features

| # | Limitation | Impact | Workaround |
|---|---|---|---|
| 1 | **`/admin/classes` page** not built in frontend | Cannot create classes from UI | `POST /api/v1/institution/classes` via Swagger at `/docs` |
| 2 | **`/admin/subjects` page** not built in frontend | Cannot assign subjects from UI | `POST /api/v1/institution/subjects` via API |
| 3 | **Student enrollment UI** not connected | Cannot enroll a student via UI | `POST /api/v1/institution/enrollments` via API |
| 4 | **Email delivery** not configured in dev | Staff/owner invite links not sent to inbox | Query `outbox_emails` table in PostgreSQL |
| 5 | **Payment gateway** is mocked | No real payment processing | Mock auto-succeeds in dev; real gateway needed for production |
| 6 | **`(institution)/*` pages** use fixture data | 8+ module pages are UI previews only | Do not test as real features |
| 7 | **Parent role** not built | No parent portal exists | N/A |
| 8 | **Redis** not required in dev | No caching/rate-limit backing | All endpoints still work without Redis |
| 9 | **HOD console** requires `update2.sql` applied | Mentor partial-unique index must exist | Run `psql -f database/update2.sql` |
| 10 | **VP scope** requires at least one department delegation | VP without departments → 403 on all VP endpoints | Always assign a department when creating VP |

---

## 18. Error Reference

| HTTP Code | Typical Message | Cause | Fix |
|---|---|---|---|
| `401` | "Could not validate credentials" | Token missing, expired, or wrong type for endpoint | Re-login; use correct login URL for this role |
| `403` | "Institution admin privileges are required" | User lacks INSTITUTION_ADMIN role | Grant role or use correct account |
| `403` | "Principal privileges are required" | User is not a Principal (VP cannot approve) | Login as Principal |
| `403` | "No active department scope" | VP has no delegated department | Admin must assign a department delegation |
| `403` | "HOD assignment not found" | HOD user has no department | Admin must set HOD on a department |
| `402` | "Module not included in your plan" | Optional module not in subscription | Upgrade plan or use Professional/Enterprise |
| `404` | "Academic year not found" | No current year set | Admin must create + set current academic year |
| `409` | "Slug already taken" | Duplicate institution slug | Use a different slug |
| `422` | Validation Error | Missing/wrong request body fields | Check API schema at `/docs` |

---

## 📊 Testing Progress Checklist

Copy this and check off items as you test:

### Platform Layer
- [ ] Backend health check passes (`/health`)
- [ ] Swagger UI loads at `localhost:8000/docs`
- [ ] Platform staff login works for all 4 roles
- [ ] Owner signup → email verify → login flow complete
- [ ] Owner can create a new institution (mock checkout)
- [ ] Coupon codes work (WELCOME10, LAUNCH500)

### Institution Setup (as Admin)
- [ ] Institution Admin login works (abc-college)
- [ ] Academic year created and set as current
- [ ] At least 2 departments created
- [ ] Principal invited and set password via link in `outbox_emails`
- [ ] VP invited with at least one department delegation
- [ ] HOD invited with department assignment
- [ ] Teacher invited and set password
- [ ] Coordinator invited
- [ ] Exam Controller invited
- [ ] Student added (via API: `POST /institution/classes` first)
- [ ] Student enrolled into a class (via API)
- [ ] Module toggle tested (optional module → 402 on Starter plan)
- [ ] Bulk staff CSV upload tested
- [ ] Institution profile and settings saved

### Role Testing
- [ ] Principal dashboard loads with real data
- [ ] Principal can approve/reject an exam schedule
- [ ] Principal can approve a result publication
- [ ] VP dashboard scoped to delegated department only
- [ ] VP CANNOT approve exams (no button / 403)
- [ ] HOD dashboard loads with department data
- [ ] HOD mentor assignment works (one per student per year)
- [ ] HOD mentor duplicate → rejected
- [ ] HOD discussion moderation (pin, lock, delete) works
- [ ] Teacher marks attendance for a class (upsert tested)
- [ ] Teacher creates an assignment
- [ ] Student submits the assignment
- [ ] Teacher grades the submission
- [ ] Exam Controller creates an exam and submits for approval
- [ ] Principal approves the exam
- [ ] Exam Controller enters results and forwards for publication
- [ ] Principal approves result publication
- [ ] Student views their published result
- [ ] Student tab-switch logged during online exam

### Security Checks
- [ ] Owner token rejected on tenant endpoint → 401
- [ ] Platform token rejected on tenant endpoint → 401
- [ ] VP sees only delegated department data
- [ ] VP institution-wide notice post → 403
- [ ] HOD without department → 403
- [ ] Student cannot access teacher endpoints → 403

### Export / CSV
- [ ] Principal attendance CSV export works
- [ ] Principal exam schedule CSV export works
- [ ] HOD attendance CSV export works
- [ ] Coordinator timetable export works

---

_This guide covers the 106-table schema, `update2.sql` / Alembic head `e7f2a6c3b904`, and all live consoles._
_ERP Platform v1.5 · Last updated: 2026-08-07_
