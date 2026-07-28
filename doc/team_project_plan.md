# ERP + LMS Platform — Team Project Plan
## 3-Developer Collaboration, Task Division & Merge Schedule

> Project: xyz.com Multi-Tenant ERP + LMS  
> Team Size: 3 Developers  
> Total Duration: 18 Weeks (4.5 Months)  
> References: Role-Based System Design v1.0 · Developer Deployment Guide v1.0 · Database Design v2.0

---

## Table of Contents

1. [Developer Profiles & Responsibilities](#1-developer-profiles--responsibilities)
2. [Project Division Strategy](#2-project-division-strategy)
3. [Branch & Git Strategy](#3-branch--git-strategy)
4. [Week-by-Week Full Schedule](#4-week-by-week-full-schedule)
5. [Developer A — Full Task List](#5-developer-a--full-task-list)
6. [Developer B — Full Task List](#6-developer-b--full-task-list)
7. [Developer C — Full Task List](#7-developer-c--full-task-list)
8. [All Merge Points (Master Schedule)](#8-all-merge-points-master-schedule)
9. [Daily Standup Template](#9-daily-standup-template)
10. [Code Review Rules](#10-code-review-rules)
11. [Environment & Deployment Ownership](#11-environment--deployment-ownership)
12. [Shared Contracts (API + Types)](#12-shared-contracts-api--types)
13. [Risk & Dependency Map](#13-risk--dependency-map)
14. [Definition of Done (DoD)](#14-definition-of-done-dod)
15. [Milestone Checklist Summary](#15-milestone-checklist-summary)

---

## 1. Developer Profiles & Responsibilities

| | Developer A | Developer B | Developer C |
|---|---|---|---|
| **Nickname** | Dev-A | Dev-B | Dev-C |
| **Primary Focus** | Backend Core + DevOps | Backend Modules + API | Frontend (All Roles) |
| **Owns** | Auth · RBAC · Multi-tenancy · DB · CI/CD · Infra | All module APIs (attendance → inventory) | All UI screens · Role-aware navigation · State management |
| **Secondary** | Code reviews · DB migrations · Seeds | API contracts · Queue jobs · File storage | UI component library · Form validation · API integration |
| **Git Role** | Merge master (approves PRs to `main`) | PR author (module branches) | PR author (frontend branches) |
| **Standup Lead** | Monday · Wednesday | Tuesday | Thursday · Friday |

---

## 2. Project Division Strategy

The project is split into **3 vertical lanes** that run in parallel after Week 2.

```
Week 1-2: ALL THREE work together on foundation
          ↓
Week 3+:  Three parallel lanes diverge

┌─────────────────────────────────────────────────────┐
│                    LANE A (Dev-A)                    │
│  Foundation · Auth · RBAC · DB · DevOps · Infra     │
├─────────────────────────────────────────────────────┤
│                    LANE B (Dev-B)                    │
│  All Backend Module APIs (15 modules)               │
├─────────────────────────────────────────────────────┤
│                    LANE C (Dev-C)                    │
│  All Frontend UI Screens (all roles, all modules)   │
└─────────────────────────────────────────────────────┘
         ↓              ↓              ↓
    Merge Points at end of each Sprint (every 2 weeks)
```

**Why this split:**
- Dev-A's foundation work (auth, RBAC, DB) is a blocker for both B and C — so A leads in Week 1-2 to unblock others
- Dev-B builds API endpoints that Dev-C consumes — B stays 1 sprint ahead of C
- Dev-C can start UI shell and static screens in Week 2 before APIs are ready (mock data), then wire real APIs as B delivers them

---

## 3. Branch & Git Strategy

### 3.1 Branch Naming

```
main                          → production-ready code only
develop                       → integration branch (all merges go here first)

# Dev-A branches
feature/A-foundation          → monorepo + docker + prisma setup
feature/A-auth                → JWT auth system
feature/A-rbac                → roles, guards, permissions
feature/A-tenant              → multi-tenancy middleware
feature/A-devops              → CI/CD, docker, AWS infra

# Dev-B branches
feature/B-attendance          → attendance module API
feature/B-examination         → examination module API
feature/B-assignment          → assignment + milestone API
feature/B-notice              → notice board API
feature/B-discussion          → discussion forum API
feature/B-content             → content upload API
feature/B-results             → results + grade card API
feature/B-timetable           → timetable API
feature/B-library             → library module API
feature/B-hostel              → hostel module API
feature/B-transport           → transport module API
feature/B-placement           → placement module API
feature/B-hr                  → HR module API
feature/B-admission           → admission module API
feature/B-inventory           → inventory module API
feature/B-finance             → fee + finance API

# Dev-C branches
feature/C-ui-shell            → layout, sidebar, navigation
feature/C-auth-ui             → login, forgot password screens
feature/C-dashboard           → role-aware dashboards
feature/C-attendance-ui       → attendance screens
feature/C-exam-ui             → exam screens
feature/C-assignment-ui       → assignment + milestone screens
feature/C-notice-ui           → notice board screens
feature/C-discussion-ui       → discussion forum screens
feature/C-content-ui          → content screens
feature/C-results-ui          → results screens
feature/C-timetable-ui        → timetable screens
feature/C-settings-ui         → settings + module toggle screens
feature/C-optional-modules-ui → library, hostel, transport, placement, hr, admission, inventory screens
feature/C-finance-ui          → fee screens
```

### 3.2 PR Rules

```
Every PR must:
  ✅ Target `develop` branch (never directly to `main`)
  ✅ Have at least 1 reviewer (Dev-A reviews all PRs)
  ✅ Pass all CI checks (lint + test + build)
  ✅ Include a short description of what changed
  ✅ Reference the task ID from this document (e.g. "Closes A-07")
  ✅ Have no merge conflicts with `develop`

PR size limit:
  ⚠ Max 400 lines changed per PR
  ⚠ Split large features into smaller PRs (e.g. "exam-create" + "exam-attempt" as separate PRs)

`main` merges:
  ✅ Only Dev-A merges `develop` → `main`
  ✅ Only at scheduled Merge Points (see Section 8)
  ✅ Must be tagged: v0.1.0, v0.2.0, etc.
```

### 3.3 Commit Message Format

```
type(scope): short description

Types:  feat | fix | refactor | test | docs | chore | style
Scope:  auth | rbac | tenant | attendance | exam | assignment |
        notice | discussion | content | results | timetable |
        library | hostel | transport | placement | hr | admission |
        inventory | finance | ui | devops | db

Examples:
  feat(auth): add JWT refresh token rotation
  feat(attendance): add bulk mark attendance endpoint
  fix(exam): fix timer not stopping on tab close
  feat(ui): add module-aware sidebar navigation
  chore(db): add index on attendance_records student_id
  docs(rbac): update permission matrix for HOD role
```

---

## 4. Week-by-Week Full Schedule

```
WEEK  DEV-A                          DEV-B                          DEV-C
────  ─────────────────────────────  ─────────────────────────────  ─────────────────────────────
 1    Monorepo setup                 Monorepo setup (join A)        Monorepo setup (join A)
      Docker Compose local stack     Read all 3 design docs         Read all 3 design docs
      Prisma schema (all 100 tables) Write shared TypeScript types  Next.js project setup
      DB migrations + seed           API contract doc draft         Tailwind + shadcn/ui setup
                                                                    Auth pages (static)

 2    JWT Auth (login/refresh/logout) Review A's auth code          UI shell: layout + sidebar
      AuthGuard + RolesGuard          Postman collection setup      Role-aware dashboard skeleton
      ModuleGuard                     Review API contracts          usePermission hook
      TenantMiddleware                                              Zustand auth store
      AuditInterceptor                                             API client (Axios + interceptors)

◆ MERGE POINT 1 (End Week 2): Foundation merge to `develop`
  All three merge their Week 1-2 work. Dev-A reviews. Team does integration check.

 3    Multi-tenant Prisma extension   Attendance module API         Auth UI wiring (real API)
      Permission service              - POST /attendance/sessions   Dashboard wiring
      User management API             - PATCH /sessions/:id/records Module-aware sidebar (real data)
      Role assignment API             - GET /my-attendance          Settings page skeleton

 4    Department API                  Attendance reports API        Attendance UI — Teacher
      Class + Subject API             - GET /reports/dept           - Mark attendance screen
      Academic Year API               - GET /reports/class          - Session list
      Student enrollment API          - Low attendance alerts job   Attendance UI — Student
      Tenant module toggle API                                      - View own attendance + %

◆ MERGE POINT 2 (End Week 4): Institution Setup + Attendance merged
  B merges attendance API. C merges attendance UI. A merges institution structure APIs.

 5    Examination module foundation   Examination API Part 1        Examination UI — Teacher
      - Exam CRUD                     - POST /exams                 - Create exam form
      - Question CRUD                 - POST /exams/:id/questions   - Add questions
      File upload (S3 presign)        - POST /questions/:id/options - Publish exam
      Storage service                 - PATCH /exams/:id/publish

 6    Notification service setup      Examination API Part 2        Examination UI — Student
      FCM integration                 - POST /exams/:id/attempt     - Exam attempt screen (timed)
      BullMQ queue setup              - PATCH /attempts/:id/answer  - Question navigation
      In-app notification model       - POST /attempts/:id/submit   - Submit confirmation
                                      - Auto-grade MCQ job

◆ MERGE POINT 3 (End Week 6): Examination merged
  B merges exam APIs. C merges exam UI. A merges notifications + file storage.

 7    Assignment module support       Assignment API                Assignment UI — Teacher
      - Milestone unlock logic        - POST /assignments           - Create assignment
      - Submission review service     - POST /assignments/:id/      - Create milestones
      Results module foundation         milestones                  - View submissions
                                      - GET /assignments/class/:id

 8    Results compilation service     Assignment API Part 2         Assignment UI — Student
      Grade card PDF generation       - POST /submissions           - Submit assignment
      (BullMQ job)                    - PATCH /submissions/:id/     - View milestone stages
      Result publication service        review                      - Resubmit flow
                                      - Milestone unlock trigger    Results UI — Student
                                                                    - View results
                                                                    - Download grade card

◆ MERGE POINT 4 (End Week 8): Assignment + Results merged
  B merges assignment APIs. C merges assignment + results UI. A merges results service.

 9    Timetable service               Notice Board API              Notice Board UI
      Notification delivery jobs      - POST /notices               - Post notice (teacher/admin)
      Email service (SES)             - GET /notices/my             - Notice feed (student)
                                      Discussion Forum API          - Notice detail + attachments
                                      - POST /threads               Discussion UI
                                      - POST /threads/:id/replies   - Thread list
                                      - PATCH /votes                - Reply + upvote
                                                                    - Post thread

10    Content upload service          Content API                   Content UI — Teacher
      Signed URL generation           - POST /content               - Upload file
      HOD / Principal analytics       - GET /content/subject/:id    - Manage content list
      API                             Timetable API                 Content UI — Student
                                      - GET /timetable/class/:id    - Browse by subject/chapter
                                      - GET /timetable/teacher      Timetable UI
                                                                    - Weekly view (student)
                                                                    - Teacher schedule

◆ MERGE POINT 5 (End Week 10): Core LMS complete merge
  All core modules merged. Full integration test. Tag: v0.1.0 (Core LMS complete)

11    Institution Admin settings UI   Library module API            Settings UI — Module toggle
      (review C's settings work)      - Books CRUD                  - Enable/disable modules
      Library module backend          - Issue / return              - Role assignment UI
      Hostel module backend           - Overdue alerts              Library UI
                                      Hostel module API             - Book search + issue
                                      - Room allotment              Hostel UI — Student
                                      - Hostel attendance           - View room + allotment

12    Transport module backend        Transport API                 Transport UI — Student
      Placement module backend        - Routes + stops              - View route + stop
                                      - Student assignment          Placement UI — Student
                                      Placement API                 - Browse drives
                                      - Drives + applications       - Apply to drive
                                      - Interview rounds            Placement UI — Officer
                                                                    - Manage drives
                                                                    - Track applications

◆ MERGE POINT 6 (End Week 12): Optional Modules Batch 1 merged
  Library, Hostel, Transport, Placement merged. Integration test.

13    HR module backend               HR API                        HR UI — HR Manager
      Admission module backend        - Staff profiles              - Staff management
                                      - Leave management            - Leave approvals
                                      - Payroll + payslips          - Payroll screen
                                      Admission API                 Admission UI
                                      - Applications intake         - Application list
                                      - Document verification       - Merit list
                                      - Merit list generation       - Enroll student flow

14    Inventory module backend        Inventory API                 Inventory UI
      Finance (Fee) module backend    - Stock in/out                - Stock management
                                      - Purchase orders             - PO creation
                                      Finance API                   Finance UI — Accountant
                                      - Fee structure setup         - Fee collection screen
                                      - Fee payment recording       - Defaulter report
                                      - Installment management      - Receipt generation
                                      - Scholarship grants          Finance UI — Student/Parent
                                                                    - View fee account
                                                                    - View receipts

◆ MERGE POINT 7 (End Week 14): All Modules complete. Tag: v0.2.0 (Full Feature Complete)

15    AWS infrastructure (Terraform)  API performance optimization  UI performance optimization
      ECS setup + task definitions    - Add missing indexes         - Lazy load modules
      RDS + ElastiCache setup         - Query optimization          - Code splitting
      S3 bucket policies              - Rate limiting middleware    - Image optimization
      CloudFront distribution         - API response caching        - PWA setup

16    CI/CD pipeline (GitHub Actions) End-to-end API tests          UI integration tests
      Staging environment deploy      - Postman/Jest test suite     - Cypress E2E tests
      Monitoring (CloudWatch+Sentry)  - Load testing (k6)           - Cross-browser testing
      SSL + domain setup              Fix bugs from testing         Fix bugs from testing
      Secrets management (SSM)

◆ MERGE POINT 8 (End Week 16): Infrastructure + Tests complete. Tag: v0.3.0 (Staging ready)

17    Production deployment           Final bug fixes               Final UI fixes
      Data migration scripts          Performance profiling         Accessibility audit
      Backup strategy setup           API documentation (Swagger)   Mobile responsiveness
      Security audit                                                Final UI polish

18    Go-live preparation             Support documentation          User guide / help content
      Disaster recovery test          API changelog                 Onboarding screens
      Final production deploy         Hotfix process setup          Final QA sign-off

◆ MERGE POINT 9 (End Week 18): PRODUCTION RELEASE. Tag: v1.0.0
```

---

## 5. Developer A — Full Task List

**Role:** Backend Core + DevOps + Team Lead  
**Branch prefix:** `feature/A-*`

### Phase 1 — Foundation (Weeks 1–2)

| Task ID | Task | Est. Days | Output |
|---|---|---|---|
| A-01 | Initialize Turborepo monorepo with pnpm workspaces | 0.5 | `/erp-lms/` root |
| A-02 | Set up `apps/api` NestJS project structure | 1 | NestJS app running |
| A-03 | Set up `apps/web` Next.js 14 project structure | 0.5 | Next.js app running |
| A-04 | Create `packages/shared-types` with all TypeScript types | 1 | Shared type package |
| A-05 | Docker Compose for local dev (Postgres + Redis) | 0.5 | `docker-compose.yml` |
| A-06 | Write complete Prisma schema (all 100 tables) | 2 | `schema.prisma` |
| A-07 | Run first DB migration + verify all tables created | 0.5 | Migration 001 |
| A-08 | Write Prisma seed file (roles, modules, platform user) | 1 | `seed.ts` |
| A-09 | Implement JWT auth: login, refresh token, logout | 1.5 | `auth.module.ts` |
| A-10 | Implement `AuthGuard` (validate JWT on every request) | 0.5 | `auth.guard.ts` |
| A-11 | Implement `TenantMiddleware` (subdomain → tenant_id) | 1 | `tenant.middleware.ts` |
| A-12 | Implement `RolesGuard` + `@RequirePermission` decorator | 1 | `roles.guard.ts` |
| A-13 | Implement `ModuleGuard` (check module enabled per tenant) | 0.5 | `module.guard.ts` |
| A-14 | Implement `AuditInterceptor` (log all write actions) | 1 | `audit.interceptor.ts` |
| A-15 | Implement `TenantPrismaService` (auto-scope all queries) | 1 | `tenant-prisma.service.ts` |
| A-16 | Implement Redis service + caching layer | 0.5 | `redis.service.ts` |
| A-17 | Global exception filter + response transform interceptor | 0.5 | `filters/` |
| A-18 | Write unit tests for auth + RBAC guards | 1 | `*.spec.ts` |

**→ Deliverable by End Week 2:** Full auth + RBAC system. Every route protected. Tenant isolated. Ready for Dev-B to build on top.

---

### Phase 2 — Institution Structure APIs (Weeks 3–4)

| Task ID | Task | Est. Days | Output |
|---|---|---|---|
| A-19 | User management API (CRUD + invite + deactivate) | 1.5 | `users.controller.ts` |
| A-20 | Role assignment API (assign / revoke roles) | 1 | `role-assignments.controller.ts` |
| A-21 | Department API (CRUD, assign HOD) | 1 | `departments.controller.ts` |
| A-22 | Academic Year API (CRUD, set current year) | 0.5 | `academic-years.controller.ts` |
| A-23 | Class API (CRUD, assign class teacher) | 1 | `classes.controller.ts` |
| A-24 | Subject API (CRUD, assign teachers) | 1 | `subjects.controller.ts` |
| A-25 | Student enrollment API (enroll, transfer, drop) | 1 | `enrollments.controller.ts` |
| A-26 | Parent–student link API (school type only) | 0.5 | `parent-links.controller.ts` |
| A-27 | Tenant module toggle API (enable/disable with role activation) | 1 | `tenant-modules.controller.ts` |
| A-28 | Institution settings API (get/set key-value settings) | 0.5 | `settings.controller.ts` |
| A-29 | Platform-level tenant management (Super Admin CRUD) | 1 | `tenants.controller.ts` |
| A-30 | Subscription + plan management API | 1 | `subscriptions.controller.ts` |

**→ Deliverable by End Week 4:** Institution can be fully set up — departments, classes, subjects, users, roles all configurable via API.

---

### Phase 3 — Support Services (Weeks 5–10)

| Task ID | Task | Est. Days | Output |
|---|---|---|---|
| A-31 | S3 presigned URL service (upload + download) | 1 | `storage.service.ts` |
| A-32 | File access control (signed GET URLs, 15 min TTL) | 0.5 | `storage.controller.ts` |
| A-33 | BullMQ setup + queue definitions | 1 | `queues/` |
| A-34 | FCM push notification service | 1 | `fcm.service.ts` |
| A-35 | AWS SES email service | 0.5 | `mail.service.ts` |
| A-36 | In-app notification service + controller | 1 | `notifications.module.ts` |
| A-37 | Device token registration API | 0.5 | `device-tokens.controller.ts` |
| A-38 | Results compilation service (aggregate exam scores) | 1.5 | `results.service.ts` |
| A-39 | Grade card PDF generation job (BullMQ + pdfkit) | 1.5 | `grade-card.processor.ts` |
| A-40 | Result publication API (release results to students) | 1 | `results.controller.ts` |
| A-41 | HOD/Principal analytics API (attendance + result reports) | 1.5 | `analytics.controller.ts` |
| A-42 | Timetable conflict detection service | 1 | `timetable.service.ts` |
| A-43 | Low-attendance alert cron job (daily) | 0.5 | `attendance-alert.cron.ts` |
| A-44 | Exam status cron job (PUBLISHED → ONGOING → COMPLETED) | 0.5 | `exam-status.cron.ts` |
| A-45 | Bulk notification job (send to entire class/dept) | 1 | `bulk-notify.processor.ts` |

**→ Deliverable by End Week 10:** All support services live. Notifications, file uploads, reports, grade cards, cron jobs all working.

---

### Phase 4 — DevOps & Infrastructure (Weeks 15–17)

| Task ID | Task | Est. Days | Output |
|---|---|---|---|
| A-46 | Dockerfiles for API and web (prod-optimized) | 0.5 | `Dockerfile` x2 |
| A-47 | AWS Terraform: VPC + subnets + security groups | 1 | `infra/terraform/` |
| A-48 | AWS Terraform: RDS PostgreSQL (Multi-AZ) | 0.5 | `rds.tf` |
| A-49 | AWS Terraform: ElastiCache Redis | 0.5 | `elasticache.tf` |
| A-50 | AWS Terraform: S3 bucket + CloudFront | 0.5 | `s3.tf` + `cloudfront.tf` |
| A-51 | AWS Terraform: ECS cluster + Fargate services | 1 | `ecs.tf` |
| A-52 | AWS Terraform: ALB + target groups | 0.5 | `alb.tf` |
| A-53 | GitHub Actions CI pipeline (lint + test + build) | 1 | `.github/workflows/ci.yml` |
| A-54 | GitHub Actions CD pipeline (build image + deploy ECS) | 1 | `.github/workflows/deploy.yml` |
| A-55 | Staging environment full deploy + smoke test | 1 | Staging live |
| A-56 | AWS SSM Parameter Store for all secrets | 0.5 | Secrets configured |
| A-57 | CloudWatch dashboards + alarms | 0.5 | Monitoring live |
| A-58 | Sentry error tracking integration (API + web) | 0.5 | Error tracking |
| A-59 | Production deployment + DNS setup | 1 | `*.xyz.com` live |
| A-60 | Backup strategy: RDS automated backups + S3 versioning | 0.5 | Backup configured |

**→ Deliverable by End Week 17:** Full production infrastructure. Auto-deploy on push to main.

---

### Phase 5 — Week 18

| Task ID | Task | Est. Days |
|---|---|---|
| A-61 | Final security audit (SQL injection, auth bypass checks) | 1 |
| A-62 | Disaster recovery test (restore from backup) | 0.5 |
| A-63 | Production go-live + monitoring watch | 0.5 |
| A-64 | Hotfix process documentation | 0.5 |

**Total Dev-A Tasks: 64 tasks across 18 weeks**

---

## 6. Developer B — Full Task List

**Role:** All Backend Module APIs  
**Branch prefix:** `feature/B-*`  
**Depends on:** Dev-A completing A-01 through A-18 (foundation) before B can start module work

### Module API Order (build in this sequence — each depends on the previous)

```
Attendance → Examination → Assignment → Notice → Discussion →
Content → Results → Timetable → Library → Hostel → Transport →
Placement → HR → Admission → Inventory → Finance
```

### Phase 1 — Shared Setup (Week 1–2, with Dev-A)

| Task ID | Task | Est. Days |
|---|---|---|
| B-01 | Read all 3 design docs. Map every API endpoint needed | 1 |
| B-02 | Write API contracts doc (`packages/shared-types/api-contracts.ts`) | 1 |
| B-03 | Set up Postman collection with all endpoints (empty stubs) | 0.5 |
| B-04 | Review Dev-A's Prisma schema — flag any missing fields | 0.5 |
| B-05 | Review Dev-A's RBAC setup — confirm permission checks for all modules | 0.5 |

---

### Phase 2 — Core Module APIs (Weeks 3–10)

#### Attendance Module (Week 3–4)

| Task ID | Task | Est. Days | Endpoint |
|---|---|---|---|
| B-06 | Create attendance session | 0.5 | `POST /attendance/sessions` |
| B-07 | Bulk mark attendance records | 0.5 | `PATCH /attendance/sessions/:id/records` |
| B-08 | Get session with records | 0.5 | `GET /attendance/sessions/:id` |
| B-09 | Get student's own attendance | 0.5 | `GET /attendance/my` |
| B-10 | Get class attendance report | 1 | `GET /attendance/reports/class/:id` |
| B-11 | Get department attendance report | 1 | `GET /attendance/reports/dept/:id` |
| B-12 | Apply/approve/reject leave request | 0.5 | `POST /attendance/leaves` |
| B-13 | Get students below attendance threshold | 0.5 | `GET /attendance/low-attendance` |
| B-14 | Lock attendance session | 0.5 | `PATCH /attendance/sessions/:id/lock` |
| B-15 | Write unit tests for attendance service | 1 | `attendance.service.spec.ts` |

#### Examination Module (Weeks 5–6)

| Task ID | Task | Est. Days | Endpoint |
|---|---|---|---|
| B-16 | Create exam (DRAFT) | 0.5 | `POST /examination/exams` |
| B-17 | Update exam details | 0.5 | `PATCH /examination/exams/:id` |
| B-18 | Add questions to exam | 0.5 | `POST /examination/exams/:id/questions` |
| B-19 | Add options to question | 0.5 | `POST /examination/questions/:id/options` |
| B-20 | Create exam sections | 0.5 | `POST /examination/exams/:id/sections` |
| B-21 | Publish exam | 0.5 | `PATCH /examination/exams/:id/publish` |
| B-22 | Get exam list for class/student | 0.5 | `GET /examination/exams` |
| B-23 | Start exam attempt | 1 | `POST /examination/exams/:id/attempt` |
| B-24 | Save answer during attempt | 0.5 | `PATCH /examination/attempts/:id/answer` |
| B-25 | Submit exam attempt | 1 | `POST /examination/attempts/:id/submit` |
| B-26 | Auto-grade MCQ (BullMQ job, triggered on submit) | 1 | Queue job |
| B-27 | Get attempt results (student view) | 0.5 | `GET /examination/attempts/:id/result` |
| B-28 | Grade descriptive answers (teacher) | 0.5 | `PATCH /examination/answers/:id/grade` |
| B-29 | Hall allocation for offline exam | 0.5 | `POST /examination/exams/:id/halls` |
| B-30 | Log malpractice event | 0.5 | `POST /examination/attempts/:id/malpractice` |
| B-31 | Release exam results | 0.5 | `PATCH /examination/exams/:id/release-results` |
| B-32 | Write unit tests for examination service | 1 | `examination.service.spec.ts` |

#### Assignment + Milestone Module (Weeks 7–8)

| Task ID | Task | Est. Days | Endpoint |
|---|---|---|---|
| B-33 | Create assignment (REGULAR or MILESTONE type) | 0.5 | `POST /assignment/assignments` |
| B-34 | Add milestones to an assignment | 0.5 | `POST /assignment/assignments/:id/milestones` |
| B-35 | Publish assignment | 0.5 | `PATCH /assignment/assignments/:id/publish` |
| B-36 | Get assignments for a class | 0.5 | `GET /assignment/assignments/class/:id` |
| B-37 | Get student's assignments | 0.5 | `GET /assignment/my-assignments` |
| B-38 | Submit assignment (with files) | 1 | `POST /assignment/submissions` |
| B-39 | Get submissions for an assignment (teacher) | 0.5 | `GET /assignment/assignments/:id/submissions` |
| B-40 | Review submission (approve/reject/request resubmit) | 1 | `PATCH /assignment/submissions/:id/review` |
| B-41 | Milestone unlock trigger (fire after approval) | 1 | Queue job |
| B-42 | Get next unlocked milestone for student | 0.5 | `GET /assignment/assignments/:id/next-milestone` |
| B-43 | Write unit tests for assignment service | 1 | `assignment.service.spec.ts` |

#### Notice Board Module (Week 9)

| Task ID | Task | Est. Days | Endpoint |
|---|---|---|---|
| B-44 | Create notice (scoped to institution/dept/class) | 0.5 | `POST /notice/notices` |
| B-45 | Get notices for current user (auto-scoped) | 0.5 | `GET /notice/notices/my` |
| B-46 | Mark notice as read | 0.5 | `POST /notice/notices/:id/read` |
| B-47 | Pin / unpin notice | 0.5 | `PATCH /notice/notices/:id/pin` |
| B-48 | Delete / expire notice | 0.5 | `DELETE /notice/notices/:id` |
| B-49 | Get notice read receipts (admin) | 0.5 | `GET /notice/notices/:id/reads` |

#### Discussion Forum Module (Week 9)

| Task ID | Task | Est. Days | Endpoint |
|---|---|---|---|
| B-50 | Create discussion thread | 0.5 | `POST /discussion/threads` |
| B-51 | Get threads (scoped to class/subject/dept) | 0.5 | `GET /discussion/threads` |
| B-52 | Get thread detail with replies | 0.5 | `GET /discussion/threads/:id` |
| B-53 | Post reply to thread | 0.5 | `POST /discussion/threads/:id/replies` |
| B-54 | Upvote thread or reply | 0.5 | `POST /discussion/votes` |
| B-55 | Mark reply as accepted answer | 0.5 | `PATCH /discussion/replies/:id/accept` |
| B-56 | Pin / lock / delete thread (teacher) | 0.5 | `PATCH /discussion/threads/:id` |

#### Content Upload Module (Week 10)

| Task ID | Task | Est. Days | Endpoint |
|---|---|---|---|
| B-57 | Get presigned S3 URL for upload | 0.5 | `POST /content/presign` |
| B-58 | Create content item record (after S3 upload) | 0.5 | `POST /content/items` |
| B-59 | Get content list (by subject, chapter, type) | 0.5 | `GET /content/items` |
| B-60 | Get signed download URL | 0.5 | `GET /content/items/:id/url` |
| B-61 | Update content item metadata | 0.5 | `PATCH /content/items/:id` |
| B-62 | Delete content item (soft) | 0.5 | `DELETE /content/items/:id` |
| B-63 | Log content access (view/download) | 0.5 | Background service |

#### Timetable Module (Week 10)

| Task ID | Task | Est. Days | Endpoint |
|---|---|---|---|
| B-64 | Create timetable slot | 0.5 | `POST /timetable/slots` |
| B-65 | Bulk create slots for a class | 0.5 | `POST /timetable/slots/bulk` |
| B-66 | Get class timetable | 0.5 | `GET /timetable/class/:id` |
| B-67 | Get teacher schedule | 0.5 | `GET /timetable/teacher/my` |
| B-68 | Create substitution for a date | 0.5 | `POST /timetable/substitutions` |
| B-69 | Check teacher conflict (same slot, different class) | 0.5 | Validation service |

---

### Phase 3 — Optional Module APIs (Weeks 11–14)

#### Library Module (Week 11)

| Task ID | Task | Est. Days |
|---|---|---|
| B-70 | Books CRUD (add, edit, search, deactivate) | 1 |
| B-71 | Book copies management (add accession numbers) | 0.5 |
| B-72 | Issue book to student/staff | 1 |
| B-73 | Return book + fine calculation | 1 |
| B-74 | Overdue list + notify borrowers (cron) | 0.5 |
| B-75 | E-resources upload + list | 0.5 |

#### Hostel Module (Week 11)

| Task ID | Task | Est. Days |
|---|---|---|
| B-76 | Hostel blocks + rooms CRUD | 0.5 |
| B-77 | Student room allotment | 1 |
| B-78 | Hostel daily attendance mark | 0.5 |
| B-79 | Leave request (apply/approve/reject) | 0.5 |
| B-80 | Hostel complaints (submit/resolve) | 0.5 |

#### Transport Module (Week 12)

| Task ID | Task | Est. Days |
|---|---|---|
| B-81 | Routes + stops CRUD | 0.5 |
| B-82 | Vehicle + driver management | 0.5 |
| B-83 | Assign student to route + stop | 0.5 |
| B-84 | Get student's transport details | 0.5 |

#### Placement Module (Week 12)

| Task ID | Task | Est. Days |
|---|---|---|
| B-85 | Company management CRUD | 0.5 |
| B-86 | Placement drive CRUD | 1 |
| B-87 | Drive eligibility setup | 0.5 |
| B-88 | Student application (apply/withdraw) | 0.5 |
| B-89 | Shortlist / reject applicants | 0.5 |
| B-90 | Interview rounds management | 1 |
| B-91 | Offer letter issue + status tracking | 0.5 |
| B-92 | Placement statistics report | 0.5 |

#### HR Module (Week 13)

| Task ID | Task | Est. Days |
|---|---|---|
| B-93 | Staff profile CRUD | 1 |
| B-94 | Leave policy setup | 0.5 |
| B-95 | Leave request (apply/approve/reject) | 1 |
| B-96 | Salary structure setup per staff | 1 |
| B-97 | Monthly payroll run + payslip generation | 1.5 |
| B-98 | Appraisal cycle + individual appraisal | 1 |
| B-99 | Staff documents upload + list | 0.5 |

#### Admission Module (Week 13)

| Task ID | Task | Est. Days |
|---|---|---|
| B-100 | Admission cycle CRUD | 0.5 |
| B-101 | Public application form submission | 1 |
| B-102 | Document upload for application | 0.5 |
| B-103 | Application review + status update | 0.5 |
| B-104 | Merit list generation | 1 |
| B-105 | Convert admitted applicant to enrolled student | 1 |

#### Inventory Module (Week 14)

| Task ID | Task | Est. Days |
|---|---|---|
| B-106 | Inventory categories + items CRUD | 0.5 |
| B-107 | Stock in transaction | 0.5 |
| B-108 | Stock out (issue to dept) | 0.5 |
| B-109 | Low stock alert | 0.5 |
| B-110 | Vendor management CRUD | 0.5 |
| B-111 | Purchase order create + approve | 1 |
| B-112 | Mark PO as delivered + auto stock-in | 0.5 |

#### Finance / Fee Module (Week 14)

| Task ID | Task | Est. Days |
|---|---|---|
| B-113 | Fee structure + fee heads setup | 1 |
| B-114 | Auto-create student fee accounts on enrollment | 0.5 |
| B-115 | Generate installment schedule | 0.5 |
| B-116 | Record fee payment + generate receipt | 1 |
| B-117 | Apply scholarship / concession | 0.5 |
| B-118 | Fee defaulter report | 0.5 |
| B-119 | Student fee account summary | 0.5 |
| B-120 | Overdue fine calculation (cron) | 0.5 |

---

### Phase 4 — Testing & Optimization (Weeks 15–16)

| Task ID | Task | Est. Days |
|---|---|---|
| B-121 | End-to-end Postman test suite for all 100+ endpoints | 2 |
| B-122 | Jest integration tests for all module services | 2 |
| B-123 | k6 load testing (100 concurrent users) | 1 |
| B-124 | Add missing DB indexes identified from query analysis | 0.5 |
| B-125 | Redis caching for frequently called read endpoints | 1 |
| B-126 | API rate limiting per tenant | 0.5 |
| B-127 | Swagger / OpenAPI documentation for all endpoints | 1 |

### Phase 5 — Weeks 17–18

| Task ID | Task | Est. Days |
|---|---|---|
| B-128 | Fix bugs from E2E and load testing | 2 |
| B-129 | API changelog documentation | 0.5 |
| B-130 | Support runbook (common API error resolutions) | 0.5 |

**Total Dev-B Tasks: 130 tasks across 18 weeks**

---

## 7. Developer C — Full Task List

**Role:** All Frontend UI Screens  
**Branch prefix:** `feature/C-*`  
**Strategy:** Build with mock data first (Week 2–3), wire real APIs as Dev-B delivers them

### Phase 1 — Foundation UI (Weeks 1–2)

| Task ID | Task | Est. Days | Output |
|---|---|---|---|
| C-01 | Next.js 14 App Router project setup | 0.5 | `apps/web/` |
| C-02 | Tailwind CSS + shadcn/ui install + theme config | 0.5 | `tailwind.config.ts` |
| C-03 | Define design tokens (colors, fonts, spacing) | 0.5 | `globals.css` |
| C-04 | Build base UI components (Button, Input, Card, Table, Modal, Badge, Alert) | 2 | `components/ui/` |
| C-05 | Build layout shell (topbar + sidebar + content area) | 1 | `components/layout/` |
| C-06 | Login page (email + password form) | 0.5 | `app/(auth)/login/page.tsx` |
| C-07 | Forgot password + reset password pages | 0.5 | `app/(auth)/` |
| C-08 | Zustand auth store (user, roles, enabledModules) | 1 | `store/auth.ts` |
| C-09 | Axios API client (base URL, auth header, error handler) | 0.5 | `lib/api.ts` |
| C-10 | `usePermission(module, action)` hook | 0.5 | `hooks/usePermission.ts` |
| C-11 | Module-aware sidebar (shows/hides based on enabled modules) | 1 | `components/layout/Sidebar.tsx` |
| C-12 | Role-aware dashboard skeleton (different layout per role) | 1 | `app/(institution)/dashboard/` |

---

### Phase 2 — Institution Setup UI (Weeks 3–4)

| Task ID | Task | Est. Days |
|---|---|---|
| C-13 | Institution Admin — Department management page | 1 |
| C-14 | Institution Admin — Class management page | 1 |
| C-15 | Institution Admin — Subject management page | 1 |
| C-16 | Institution Admin — User management (list + invite + roles) | 1.5 |
| C-17 | Institution Admin — Academic year setup | 0.5 |
| C-18 | Institution Admin — Settings → Module toggle page | 1.5 |
| C-19 | Institution Admin — Role assignment UI (assign roles to users) | 1 |
| C-20 | Principal dashboard (attendance overview + result summary) | 1 |
| C-21 | HOD dashboard (department stats) | 1 |
| C-22 | Student profile page (own profile view + edit) | 0.5 |
| C-23 | Reusable `<DataTable>` component with pagination + search + sort | 1.5 |
| C-24 | Reusable `<StatsCard>` + `<ChartWidget>` components | 1 |
| C-25 | Toast notification system (success, error, info) | 0.5 |
| C-26 | Confirmation modal component (used across all delete/publish actions) | 0.5 |

---

### Phase 3 — Core Module UIs (Weeks 5–10)

#### Attendance UI (Week 3–4, alongside B)

| Task ID | Task | Est. Days | Role |
|---|---|---|---|
| C-27 | Attendance — Teacher: select class + subject + date | 0.5 | Teacher |
| C-28 | Attendance — Teacher: student list with P/A/L toggle | 1 | Teacher |
| C-29 | Attendance — Teacher: submit + lock session | 0.5 | Teacher |
| C-30 | Attendance — Student: view own attendance by subject | 0.5 | Student |
| C-31 | Attendance — Student: attendance percentage bar chart | 0.5 | Student |
| C-32 | Attendance — HOD: department report table + export | 1 | HOD |
| C-33 | Attendance — Student: apply leave request form | 0.5 | Student |
| C-34 | Attendance — Parent: view child attendance | 0.5 | Parent |

#### Examination UI (Weeks 5–6)

| Task ID | Task | Est. Days | Role |
|---|---|---|---|
| C-35 | Exam — Teacher: create exam form (title, type, schedule) | 1 | Teacher |
| C-36 | Exam — Teacher: add questions (MCQ + descriptive) | 1.5 | Teacher |
| C-37 | Exam — Teacher: preview + publish exam | 0.5 | Teacher |
| C-38 | Exam — Teacher: view submissions + grade descriptive | 1 | Teacher |
| C-39 | Exam — Teacher: results overview dashboard | 0.5 | Teacher |
| C-40 | Exam — Student: upcoming exams list | 0.5 | Student |
| C-41 | Exam — Student: exam attempt screen (full-screen, timer) | 2 | Student |
| C-42 | Exam — Student: question navigation panel (left sidebar) | 1 | Student |
| C-43 | Exam — Student: submit confirmation modal | 0.5 | Student |
| C-44 | Exam — Student: view result + answer review | 1 | Student |
| C-45 | Exam — Student: grade card view + download | 0.5 | Student |

#### Assignment + Milestone UI (Weeks 7–8)

| Task ID | Task | Est. Days | Role |
|---|---|---|---|
| C-46 | Assignment — Teacher: create assignment form | 1 | Teacher |
| C-47 | Assignment — Teacher: add milestones (drag to reorder) | 1 | Teacher |
| C-48 | Assignment — Teacher: view all submissions table | 1 | Teacher |
| C-49 | Assignment — Teacher: review submission (approve/reject) | 1 | Teacher |
| C-50 | Assignment — Student: assignment list with status | 0.5 | Student |
| C-51 | Assignment — Student: assignment detail + file upload | 1 | Student |
| C-52 | Assignment — Student: milestone progress stepper | 1 | Student |
| C-53 | Assignment — Student: resubmit on rejection | 0.5 | Student |
| C-54 | File uploader component (drag & drop, progress bar, S3) | 1.5 | Shared |

#### Notice Board UI (Week 9)

| Task ID | Task | Est. Days | Role |
|---|---|---|---|
| C-55 | Notice — Admin/Teacher: compose + post notice form | 1 | Admin/Teacher |
| C-56 | Notice — Admin/Teacher: scope selector (institution/dept/class) | 0.5 | Admin/Teacher |
| C-57 | Notice — All: notice feed with pinned at top | 1 | All |
| C-58 | Notice — All: notice detail page + attachment download | 0.5 | All |
| C-59 | Notice — Admin: read receipts count view | 0.5 | Admin |

#### Discussion Forum UI (Week 9)

| Task ID | Task | Est. Days | Role |
|---|---|---|---|
| C-60 | Discussion — All: thread list (scoped to class/subject) | 1 | All |
| C-61 | Discussion — All: post new thread form | 0.5 | All |
| C-62 | Discussion — All: thread detail + replies | 1 | All |
| C-63 | Discussion — All: upvote button (threads + replies) | 0.5 | All |
| C-64 | Discussion — Teacher: mark reply as accepted answer | 0.5 | Teacher |
| C-65 | Discussion — Teacher: pin / lock / delete thread | 0.5 | Teacher |

#### Content Upload UI (Week 10)

| Task ID | Task | Est. Days | Role |
|---|---|---|---|
| C-66 | Content — Teacher: upload content (file + metadata) | 1 | Teacher |
| C-67 | Content — Teacher: manage content list (edit/hide/delete) | 0.5 | Teacher |
| C-68 | Content — Student: browse by subject → chapter → type | 1 | Student |
| C-69 | Content — Student: video player (for VIDEO type) | 1 | Student |
| C-70 | Content — Student: PDF viewer (in-browser) | 1 | Student |
| C-71 | Content — Student: download file (signed URL) | 0.5 | Student |

#### Timetable UI (Week 10)

| Task ID | Task | Est. Days | Role |
|---|---|---|---|
| C-72 | Timetable — Student: weekly grid view | 1 | Student |
| C-73 | Timetable — Teacher: own schedule view | 1 | Teacher |
| C-74 | Timetable — Coordinator: create/edit slots | 1.5 | Coordinator |
| C-75 | Timetable — Coordinator: add substitution | 0.5 | Coordinator |

#### Results UI (Week 8)

| Task ID | Task | Est. Days | Role |
|---|---|---|---|
| C-76 | Results — Student: result list by publication | 0.5 | Student |
| C-77 | Results — Student: subject-wise breakdown chart | 1 | Student |
| C-78 | Results — Student: grade card PDF download | 0.5 | Student |
| C-79 | Results — Exam Controller: publish result action | 0.5 | Exam Controller |
| C-80 | Results — Principal: class-wise result summary | 1 | Principal |
| C-81 | Results — Parent: child result view | 0.5 | Parent |

---

### Phase 4 — Optional Module UIs (Weeks 11–14)

#### Library UI (Week 11)

| Task ID | Task | Est. Days |
|---|---|---|
| C-82 | Librarian: book catalogue (list + add + edit) | 1 |
| C-83 | Librarian: issue book form | 0.5 |
| C-84 | Librarian: return book + fine display | 0.5 |
| C-85 | Librarian: overdue list | 0.5 |
| C-86 | Student: search catalogue + view issued books | 0.5 |

#### Hostel UI (Week 11)

| Task ID | Task | Est. Days |
|---|---|---|
| C-87 | Warden: room list + allotment management | 1 |
| C-88 | Warden: hostel daily attendance mark | 0.5 |
| C-89 | Warden: leave request approvals | 0.5 |
| C-90 | Warden: complaints board | 0.5 |
| C-91 | Student: view room details + leave request form | 0.5 |

#### Transport UI (Week 12)

| Task ID | Task | Est. Days |
|---|---|---|
| C-92 | Transport Manager: route + stop management | 1 |
| C-93 | Transport Manager: vehicle + driver management | 0.5 |
| C-94 | Transport Manager: student assignment to route | 0.5 |
| C-95 | Student/Parent: view bus route + stop + timing | 0.5 |

#### Placement UI (Week 12)

| Task ID | Task | Est. Days |
|---|---|---|
| C-96 | Placement Officer: company management | 0.5 |
| C-97 | Placement Officer: drive creation + eligibility setup | 1 |
| C-98 | Placement Officer: applicant tracking board | 1 |
| C-99 | Placement Officer: interview round management | 0.5 |
| C-100 | Placement Officer: offer letter management | 0.5 |
| C-101 | Student: browse + apply to drives | 1 |
| C-102 | Student: track application status | 0.5 |
| C-103 | Placement dashboard (statistics + charts) | 1 |

#### HR UI (Week 13)

| Task ID | Task | Est. Days |
|---|---|---|
| C-104 | HR Manager: staff list + profile management | 1 |
| C-105 | HR Manager: leave policy setup | 0.5 |
| C-106 | HR Manager: leave approval queue | 0.5 |
| C-107 | HR Manager: salary structure per staff | 1 |
| C-108 | HR Manager: run payroll + payslip list | 1 |
| C-109 | Staff: apply for leave form | 0.5 |
| C-110 | Staff: view own payslips | 0.5 |
| C-111 | HR Manager: appraisal cycle management | 0.5 |

#### Admission UI (Week 13)

| Task ID | Task | Est. Days |
|---|---|---|
| C-112 | Public admission form (outside login wall) | 1.5 |
| C-113 | Admission Officer: application list + filters | 1 |
| C-114 | Admission Officer: review application + verify docs | 0.5 |
| C-115 | Admission Officer: merit list view + publish | 0.5 |
| C-116 | Admission Officer: enroll admitted student | 0.5 |

#### Inventory UI (Week 14)

| Task ID | Task | Est. Days |
|---|---|---|
| C-117 | Store Manager: item catalogue management | 0.5 |
| C-118 | Store Manager: stock in / stock out forms | 1 |
| C-119 | Store Manager: low stock alerts dashboard | 0.5 |
| C-120 | Store Manager: vendor management | 0.5 |
| C-121 | Store Manager: purchase order create + track | 1 |

#### Finance / Fee UI (Week 14)

| Task ID | Task | Est. Days |
|---|---|---|
| C-122 | Accountant: fee structure setup | 1 |
| C-123 | Accountant: record fee payment form | 1 |
| C-124 | Accountant: receipt generation + print view | 0.5 |
| C-125 | Accountant: fee defaulter report | 0.5 |
| C-126 | Accountant: scholarship grant form | 0.5 |
| C-127 | Student/Parent: fee account summary | 0.5 |
| C-128 | Student/Parent: installment schedule + paid history | 0.5 |

---

### Phase 5 — Testing, Polish, PWA (Weeks 15–18)

| Task ID | Task | Est. Days |
|---|---|---|
| C-129 | Cypress E2E tests (login, attendance, exam, assignment flows) | 2 |
| C-130 | Cross-browser testing (Chrome, Firefox, Safari) | 1 |
| C-131 | Mobile responsiveness audit + fixes (all screens) | 2 |
| C-132 | PWA setup (manifest, service worker, offline page) | 1 |
| C-133 | Accessibility audit (WCAG 2.1 AA) + fixes | 1 |
| C-134 | Page load performance audit (Lighthouse) + fixes | 1 |
| C-135 | In-app notification bell + real-time feed (Socket.IO) | 1 |
| C-136 | Onboarding screens for new institution (first-time setup wizard) | 1 |
| C-137 | Help / FAQ page | 0.5 |
| C-138 | Final UI QA sign-off with all role logins | 1 |

**Total Dev-C Tasks: 138 tasks across 18 weeks**

---

## 8. All Merge Points (Master Schedule)

These are the scheduled times when all three developers merge their branches into `develop`, do integration testing together, and tag a release.

---

### ◆ MERGE POINT 1 — End of Week 2
**Tag:** `v0.0.1-foundation`  
**What merges:**

| Developer | Branch | What's included |
|---|---|---|
| Dev-A | `feature/A-foundation` + `feature/A-auth` + `feature/A-rbac` + `feature/A-tenant` | Full auth, RBAC, multi-tenancy, DB schema, seeds |
| Dev-B | `feature/B-api-contracts` | Shared TypeScript types + API contract doc |
| Dev-C | `feature/C-ui-shell` + `feature/C-auth-ui` | Next.js shell, login page, sidebar skeleton, auth store |

**Integration Check (all 3 do together, ~2 hours):**
- [ ] `docker-compose up` starts cleanly
- [ ] `POST /auth/login` returns JWT
- [ ] Frontend login page calls real API and stores token
- [ ] Sidebar renders with core module links
- [ ] Role-guard blocks unauthorized routes
- [ ] `tenant_id` correctly scoped in DB queries

---

### ◆ MERGE POINT 2 — End of Week 4
**Tag:** `v0.0.2-institution-setup`  
**What merges:**

| Developer | Branch | What's included |
|---|---|---|
| Dev-A | `feature/A-institution` | User mgmt, dept, class, subject, enrollment, module toggle APIs |
| Dev-B | `feature/B-attendance` | Full attendance API |
| Dev-C | `feature/C-settings-ui` + `feature/C-attendance-ui` + `feature/C-dashboard` | Settings screens, attendance UI, dashboards |

**Integration Check:**
- [ ] Institution Admin can create dept → class → subject
- [ ] Admin can invite teacher + student users
- [ ] Admin can assign roles to users
- [ ] Module toggle enables/disables sidebar items
- [ ] Teacher can mark attendance for a class
- [ ] Student sees their own attendance with percentage
- [ ] HOD sees department attendance report

---

### ◆ MERGE POINT 3 — End of Week 6
**Tag:** `v0.0.3-examination`  
**What merges:**

| Developer | Branch | What's included |
|---|---|---|
| Dev-A | `feature/A-notifications` + `feature/A-storage` | FCM, SES, BullMQ, S3 presign |
| Dev-B | `feature/B-examination` | Full exam + quiz API |
| Dev-C | `feature/C-exam-ui` | Full exam UI (teacher create + student attempt) |

**Integration Check:**
- [ ] Teacher creates MCQ exam and publishes it
- [ ] Student sees published exam, starts attempt, answers questions
- [ ] Timer counts down; auto-submits on expiry
- [ ] MCQ auto-graded immediately on submit
- [ ] Teacher grades descriptive answers
- [ ] Results released and student notified (push)
- [ ] File upload to S3 works via presigned URL

---

### ◆ MERGE POINT 4 — End of Week 8
**Tag:** `v0.0.4-assignment-results`  
**What merges:**

| Developer | Branch | What's included |
|---|---|---|
| Dev-A | `feature/A-results` | Results compilation, grade card PDF generation |
| Dev-B | `feature/B-assignment` + `feature/B-results` | Assignment/milestone API + results API |
| Dev-C | `feature/C-assignment-ui` + `feature/C-results-ui` | Assignment UI + results UI |

**Integration Check:**
- [ ] Teacher creates milestone assignment with 3 stages
- [ ] Student submits milestone 1; teacher approves
- [ ] Milestone 2 unlocks automatically; student is notified
- [ ] After all milestones approved, final score assigned
- [ ] Results published; grade card PDF generated and downloadable
- [ ] Parent can view child's results

---

### ◆ MERGE POINT 5 — End of Week 10
**Tag:** `v0.1.0` ← **Core LMS Complete**  
**What merges:**

| Developer | Branch | What's included |
|---|---|---|
| Dev-A | Analytics API + cron jobs | HOD/Principal analytics, low-attendance cron, exam status cron |
| Dev-B | `feature/B-notice` + `feature/B-discussion` + `feature/B-content` + `feature/B-timetable` | All remaining core module APIs |
| Dev-C | `feature/C-notice-ui` + `feature/C-discussion-ui` + `feature/C-content-ui` + `feature/C-timetable-ui` | All remaining core module UIs |

**Integration Check (full Core LMS test):**
- [ ] Complete flow: Dept → Class → Subject → Teacher → Student
- [ ] All 8 core modules working end-to-end
- [ ] All 6 core roles (Institution Admin, Principal, HOD, Teacher, Student, Parent) log in and see correct UI
- [ ] Module toggle correctly hides/shows navigation
- [ ] Push notifications received on test device
- [ ] Low-attendance cron fires and notifies correctly
- [ ] Content upload, view, and download working

---

### ◆ MERGE POINT 6 — End of Week 12
**Tag:** `v0.1.1-optional-batch1`  
**What merges:**

| Developer | Branch | What's included |
|---|---|---|
| Dev-A | Infrastructure review + optional module support | |
| Dev-B | `feature/B-library` + `feature/B-hostel` + `feature/B-transport` + `feature/B-placement` | Library, Hostel, Transport, Placement APIs |
| Dev-C | `feature/C-library-ui` + `feature/C-hostel-ui` + `feature/C-transport-ui` + `feature/C-placement-ui` | Library, Hostel, Transport, Placement UIs |

**Integration Check:**
- [ ] Enable Library module → Librarian role appears
- [ ] Issue + return book flow works with fine calculation
- [ ] Hostel room allotment → student sees room
- [ ] Student assigned to transport route → sees stop + timing
- [ ] Placement drive created → student applies → shortlisted → offer issued

---

### ◆ MERGE POINT 7 — End of Week 14
**Tag:** `v0.2.0` ← **Full Feature Complete**  
**What merges:**

| Developer | Branch | What's included |
|---|---|---|
| Dev-A | Finance module backend support | |
| Dev-B | `feature/B-hr` + `feature/B-admission` + `feature/B-inventory` + `feature/B-finance` | HR, Admission, Inventory, Finance APIs |
| Dev-C | `feature/C-hr-ui` + `feature/C-admission-ui` + `feature/C-inventory-ui` + `feature/C-finance-ui` | HR, Admission, Inventory, Finance UIs |

**Integration Check (Full Platform Test):**
- [ ] All 15 modules working
- [ ] All 22 roles log in and see correct screens
- [ ] Fee payment flow end-to-end
- [ ] Payroll run generates payslips
- [ ] Admission → enrolled student appears in system
- [ ] Purchase order → stock received → inventory updated

---

### ◆ MERGE POINT 8 — End of Week 16
**Tag:** `v0.3.0` ← **Staging Ready**  
**What merges:**

| Developer | Branch | What's included |
|---|---|---|
| Dev-A | `feature/A-devops` | CI/CD, AWS infra, staging deploy, monitoring |
| Dev-B | Performance + test branches | Load tests, query optimization, Swagger docs |
| Dev-C | `feature/C-pwa` + test branches | PWA, Cypress E2E, responsive fixes |

**Integration Check:**
- [ ] Staging deploy succeeds via CI/CD
- [ ] All Cypress E2E tests pass on staging
- [ ] Load test: 100 concurrent users, p99 < 500ms
- [ ] Lighthouse score > 85 on all core pages
- [ ] No Sentry errors on staging smoke test

---

### ◆ MERGE POINT 9 — End of Week 18
**Tag:** `v1.0.0` ← **PRODUCTION RELEASE**  
**What merges:** Everything remaining → `main`

**Pre-go-live Checklist:**
- [ ] Security audit complete (OWASP Top 10 checked)
- [ ] All secrets in SSM Parameter Store (none in code)
- [ ] RDS automated backups verified
- [ ] DNS + SSL configured for `*.xyz.com`
- [ ] Disaster recovery drill completed
- [ ] All 3 developers have production access
- [ ] Rollback plan documented
- [ ] On-call rotation set up for first 48 hours

---

## 9. Daily Standup Template

Run every morning, 15 minutes max. Rotate lead per day (see Section 1).

```
FORMAT:

1. WHAT DID I COMPLETE YESTERDAY?
   (reference task IDs: e.g. "Completed B-23, B-24, B-25")

2. WHAT AM I WORKING ON TODAY?
   (reference task IDs: e.g. "Starting B-26 auto-grade job")

3. ANY BLOCKERS?
   (something stopping progress — needs help or decision)

4. UPCOMING MERGE DEPENDENCY?
   (if your work is about to unblock someone else, flag it)

EXAMPLE:
Dev-B: "Finished B-23 (start attempt) and B-24 (save answer).
        Today doing B-25 (submit attempt) and B-26 (auto-grade job).
        No blockers.
        Dev-C: your exam attempt UI (C-41) can start consuming
        POST /attempts once I push B-23 today."
```

---

## 10. Code Review Rules

### Who Reviews What

| PR Author | Reviewer | Notes |
|---|---|---|
| Dev-B (API) | Dev-A (required) + Dev-C (optional) | Dev-A checks guard usage, DB queries |
| Dev-C (UI) | Dev-A (required) + Dev-B (optional) | Dev-A checks API integration, security |
| Dev-A (foundation) | Dev-B + Dev-C both review | Foundation changes affect everyone |

### Review Checklist (for every PR)

**Security**
- [ ] All endpoints have `@RequirePermission` decorator
- [ ] All queries include `tenant_id` filter (never missing)
- [ ] No raw user input passed directly to DB queries
- [ ] File uploads validated for type and size
- [ ] No secrets or API keys in code

**Backend (Dev-B PRs)**
- [ ] Service layer has business logic (not in controller)
- [ ] DTOs have validation decorators (`@IsString`, `@IsUUID`, etc.)
- [ ] Errors return correct HTTP status codes
- [ ] Async functions properly awaited (no floating promises)
- [ ] BullMQ jobs have retry logic
- [ ] New tables have indexes defined
- [ ] Unit tests included for new service methods

**Frontend (Dev-C PRs)**
- [ ] `usePermission` called before rendering action buttons
- [ ] Loading and error states handled on all API calls
- [ ] No hardcoded tenant IDs or user IDs
- [ ] Forms have validation (zod schema)
- [ ] Responsive at 320px, 768px, 1280px widths
- [ ] No console.log left in code
- [ ] Components properly typed (no `any`)

---

## 11. Environment & Deployment Ownership

| Environment | Owner | URL | Deploy trigger |
|---|---|---|---|
| Local (each dev) | Each developer | `localhost:3000` / `localhost:4000` | Manual (`pnpm dev`) |
| Staging | Dev-A | `staging.xyz.com` | Auto on push to `develop` |
| Production | Dev-A | `*.xyz.com` | Manual (Dev-A only, after MP approval) |

### Environment Variable Ownership

| Variable Group | Owner | Storage |
|---|---|---|
| DB credentials | Dev-A | AWS SSM |
| JWT secrets | Dev-A | AWS SSM |
| AWS credentials | Dev-A | AWS SSM |
| FCM server key | Dev-A | AWS SSM |
| SES config | Dev-A | AWS SSM |
| `NEXT_PUBLIC_*` vars | Dev-C | `.env.local` (checked into CI secrets) |

---

## 12. Shared Contracts (API + Types)

These files are in `packages/shared-types/` and **owned jointly** — any change requires all 3 developers to agree.

```typescript
// packages/shared-types/roles.ts
export const ROLES = {
  SUPER_ADMIN: 'SUPER_ADMIN',
  INSTITUTION_ADMIN: 'INSTITUTION_ADMIN',
  PRINCIPAL: 'PRINCIPAL',
  VICE_PRINCIPAL: 'VICE_PRINCIPAL',
  HOD: 'HOD',
  TEACHER: 'TEACHER',
  MENTOR: 'MENTOR',
  ACADEMIC_COORDINATOR: 'ACADEMIC_COORDINATOR',
  EXAM_CONTROLLER: 'EXAM_CONTROLLER',
  ACCOUNTANT: 'ACCOUNTANT',
  LIBRARIAN: 'LIBRARIAN',
  STUDENT: 'STUDENT',
  PARENT: 'PARENT',
  HOSTEL_WARDEN: 'HOSTEL_WARDEN',
  TRANSPORT_MANAGER: 'TRANSPORT_MANAGER',
  PLACEMENT_OFFICER: 'PLACEMENT_OFFICER',
  HR_MANAGER: 'HR_MANAGER',
  ADMISSION_OFFICER: 'ADMISSION_OFFICER',
  STORE_MANAGER: 'STORE_MANAGER',
} as const;

export const MODULES = [
  'attendance', 'examination', 'assignment', 'notice',
  'discussion', 'content', 'results', 'timetable',
  'library', 'hostel', 'transport', 'placement',
  'hr', 'admission', 'inventory', 'finance',
] as const;

export type Role = typeof ROLES[keyof typeof ROLES];
export type ModuleKey = typeof MODULES[number];
```

```typescript
// packages/shared-types/api-contracts.ts
// Dev-B defines all request/response shapes here
// Dev-C imports them for type-safe API calls
// This is the single source of truth for API shapes

export interface AttendanceSessionDto { ... }
export interface ExamDto { ... }
export interface SubmissionDto { ... }
// ... all 100+ DTOs
```

**Rule:** If Dev-B changes an API response shape, they MUST update `api-contracts.ts` in the same PR. Dev-C will get a TypeScript error immediately if the contract breaks.

---

## 13. Risk & Dependency Map

### Critical Dependencies (things that block other devs)

```
A-06 (Prisma schema)
  → Blocks B-06 (attendance API)     [Dev-B cannot start until schema is merged]
  → Blocks C-08 (auth store types)   [Dev-C needs user type definitions]

A-09 (Auth system)
  → Blocks B-06 (all B APIs need auth guards)
  → Blocks C-06 wiring (login needs real endpoint)

A-11 (TenantMiddleware)
  → Blocks ALL of Dev-B's module APIs
  → Must be complete before any B branch starts

A-31 (S3 storage service)
  → Blocks B-57 (content presign)
  → Blocks C-54 (file uploader)
  → Blocks B-38 (submission file upload)
  [File upload is used in 4 modules — storage must come first]

B-06→B-15 (Attendance API)
  → Blocks C-27→C-34 (Attendance UI wiring)
  [C can build static UI but cannot wire until B delivers]

B-16→B-32 (Examination API)
  → Blocks C-35→C-45 (Exam UI wiring)

B-33→B-43 (Assignment API)
  → Blocks C-46→C-53 (Assignment UI wiring)
```

### Risk Register

| Risk | Probability | Impact | Mitigation |
|---|---|---|---|
| Dev-A's foundation delayed → blocks B and C | Medium | High | A prioritizes A-01 to A-18 strictly in Week 1-2. B and C do setup + docs in parallel. |
| DB schema changes mid-project | Medium | High | Schema locked after MP1. Any change needs all 3 to agree + migration written. |
| B delivers API late → C can't wire | Medium | Medium | C builds all UI with mock data first. Wiring is a separate task. |
| API contract breaks (B changes response) | Medium | Medium | Shared-types contract file. TypeScript catches breaks immediately. |
| Exam timer / real-time state bugs | High | High | Dev-B uses Redis for timer (server-side). Client timer is display only. |
| S3 upload size / timeout issues | Low | Medium | Set max file size per module (10MB default). Use multipart for videos. |
| Optional module UI piling up in Week 11-14 | High | Medium | C starts optional module skeletons in Week 9-10 during slower core phases. |

---

## 14. Definition of Done (DoD)

A task is **Done** only when ALL of the following are true:

### For Backend Tasks (Dev-A, Dev-B)
- [ ] Code written and works locally
- [ ] Unit tests written (min 1 test per service method)
- [ ] API tested in Postman and returns correct response
- [ ] Correct HTTP status codes (200/201/400/401/403/404/500)
- [ ] Permission guard applied (`@RequirePermission`)
- [ ] Module guard applied if optional module
- [ ] `tenant_id` scoping verified (cannot access other tenant's data)
- [ ] Audit log entry created for write operations
- [ ] Prisma migration written if schema changed
- [ ] PR opened, CI passing, reviewed and approved
- [ ] Merged to `develop`

### For Frontend Tasks (Dev-C)
- [ ] Component/page built and renders correctly
- [ ] Works on mobile (min 375px) and desktop (1280px)
- [ ] Loading state shown while API is pending
- [ ] Error state shown if API fails (toast or inline error)
- [ ] Permission check applied (button/section hidden if no permission)
- [ ] Form validation working (zod schema)
- [ ] No TypeScript errors (`any` not used)
- [ ] No console warnings or errors
- [ ] Tested with at least 2 different roles to confirm correct visibility
- [ ] PR opened, CI passing, reviewed and approved
- [ ] Merged to `develop`

---

## 15. Milestone Checklist Summary

| Milestone | Week | Tag | Key Deliverable | Owner |
|---|---|---|---|---|
| Foundation complete | 2 | v0.0.1 | Auth + RBAC + DB + UI shell | All 3 |
| Institution setup | 4 | v0.0.2 | Full institution structure + Attendance | All 3 |
| Examination complete | 6 | v0.0.3 | Online exam flow end-to-end | All 3 |
| Assignment + Results | 8 | v0.0.4 | Milestone tasks + grade cards | All 3 |
| Core LMS complete | 10 | **v0.1.0** | All 8 core modules + all core roles | All 3 |
| Optional Modules Batch 1 | 12 | v0.1.1 | Library, Hostel, Transport, Placement | All 3 |
| Full Feature Complete | 14 | **v0.2.0** | All 15 modules + all 22 roles | All 3 |
| Staging Ready | 16 | v0.3.0 | CI/CD + AWS + tests passing | All 3 |
| **Production Release** | 18 | **v1.0.0** | Live at xyz.com | All 3 |

---

## Quick Reference Card

```
┌─────────────────────────────────────────────────────────────────────┐
│                    3-DEV QUICK REFERENCE                            │
├──────────────┬──────────────────────┬─────────────────────────────┤
│   Dev-A      │       Dev-B           │          Dev-C              │
│  (Backend)   │    (Module APIs)      │        (Frontend)           │
├──────────────┼──────────────────────┼─────────────────────────────┤
│ Foundation   │ All 15 module APIs    │ All UI screens              │
│ Auth / RBAC  │ (16 modules total     │ (all roles, all modules)    │
│ Multi-tenant │  including finance)   │                             │
│ DB schema    │ BullMQ jobs           │ shadcn/ui components        │
│ CI/CD + AWS  │ API tests + Swagger   │ Zustand + React Query       │
├──────────────┼──────────────────────┼─────────────────────────────┤
│ 64 tasks     │ 130 tasks             │ 138 tasks                   │
├──────────────┴──────────────────────┴─────────────────────────────┤
│ MERGE POINTS: Week 2 · 4 · 6 · 8 · 10 · 12 · 14 · 16 · 18        │
│ TAGS: v0.0.1 → v0.0.2 → v0.0.3 → v0.0.4 → v0.1.0 →              │
│       v0.1.1 → v0.2.0 → v0.3.0 → v1.0.0                          │
│ BRANCH TO: `develop` always. Dev-A merges develop → main.          │
└─────────────────────────────────────────────────────────────────────┘
```

---

*Document version: 1.0 | Team: 3 Developers | Duration: 18 Weeks*  
*Companion documents: Role-Based System Design v1.0 · Developer Deployment Guide v1.0 · Database Design v2.0*
