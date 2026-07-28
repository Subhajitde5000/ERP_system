# ERP + LMS Platform — Developer Working-Level System Design & Deployment Guide

> Based on: Role-Based System Design v1.0  
> Audience: Backend developers, frontend developers, DevOps engineers  
> Stack: Node.js (NestJS) · PostgreSQL · React (Next.js) · Redis · AWS

---

## Table of Contents

1. [System Architecture](#1-system-architecture)
2. [Tech Stack Decisions](#2-tech-stack-decisions)
3. [Repository Structure](#3-repository-structure)
4. [Database Design](#4-database-design)
5. [Multi-Tenancy Implementation](#5-multi-tenancy-implementation)
6. [Authentication & Authorization](#6-authentication--authorization)
7. [Module System Implementation](#7-module-system-implementation)
8. [API Design Standards](#8-api-design-standards)
9. [Core Module Implementation Plans](#9-core-module-implementation-plans)
10. [Frontend Architecture](#10-frontend-architecture)
11. [File Storage & Media](#11-file-storage--media)
12. [Notification System](#12-notification-system)
13. [Environment Setup](#13-environment-setup)
14. [Deployment Architecture](#14-deployment-architecture)
15. [CI/CD Pipeline](#15-cicd-pipeline)
16. [Developer Sprint Plan](#16-developer-sprint-plan)

---

## 1. System Architecture

### 1.1 High-Level Architecture

```
┌─────────────────────────────────────────────────────────────┐
│                        Internet                             │
└──────────────────────────┬──────────────────────────────────┘
                           │
                    ┌──────▼──────┐
                    │  CloudFront │  (CDN + SSL)
                    │   / Nginx   │
                    └──────┬──────┘
                           │
          ┌────────────────┼────────────────┐
          │                │                │
   ┌──────▼──────┐  ┌──────▼──────┐  ┌─────▼──────┐
   │  Next.js    │  │  NestJS     │  │  NestJS    │
   │  Frontend   │  │  REST API   │  │  WS Server │
   │  (Vercel /  │  │  (ECS)      │  │  (Socket)  │
   │   ECS)      │  └──────┬──────┘  └─────┬──────┘
   └─────────────┘         │               │
                           │               │
          ┌────────────────┼───────────────┘
          │                │
   ┌──────▼──────┐  ┌──────▼──────┐
   │  PostgreSQL │  │    Redis    │
   │  (RDS)      │  │  (ElastiC.) │
   └─────────────┘  └─────────────┘
          │
   ┌──────▼──────┐  ┌─────────────┐  ┌─────────────┐
   │  S3 Bucket  │  │     SES     │  │     FCM     │
   │  (Files)    │  │  (Email)    │  │  (Push)     │
   └─────────────┘  └─────────────┘  └─────────────┘
```

### 1.2 Request Lifecycle

```
Client Request
     │
     ▼
CloudFront / Nginx
     │
     ▼
API Gateway (NestJS global middleware)
     │
     ├─► TenantMiddleware     → extracts tenant_id from subdomain / JWT
     ├─► AuthGuard            → validates JWT, loads user + roles
     ├─► RolesGuard           → checks role permission for this route
     ├─► ModuleGuard          → checks module is enabled for this tenant
     │
     ▼
Controller → Service → Repository (Prisma)
     │
     ├─► All DB queries auto-scoped: WHERE tenant_id = :tid
     └─► Response → AuditLog (async, non-blocking)
```

---

## 2. Tech Stack Decisions

| Layer | Technology | Reason |
|---|---|---|
| Frontend | Next.js 14 (App Router) | SSR for SEO, RSC for speed, file-based routing |
| UI Library | Tailwind CSS + shadcn/ui | Rapid consistent UI |
| State | Zustand + React Query | Server state + client state separation |
| Backend | NestJS (Node.js) | Modules, DI, guards, decorators — maps 1:1 to RBAC needs |
| ORM | Prisma | Type-safe queries, migrations, multi-schema support |
| Database | PostgreSQL 15 (AWS RDS) | ACID, row-level security, schema isolation |
| Cache | Redis 7 (ElastiCache) | Sessions, permission cache, pub/sub for notifications |
| File Storage | AWS S3 + CloudFront | Scalable media, signed URLs for security |
| Auth | JWT (access + refresh) + bcrypt | Stateless, scalable |
| Email | AWS SES | Transactional emails |
| Push Notifications | Firebase FCM | Cross-platform mobile/web push |
| Real-time | Socket.IO (NestJS Gateway) | Live notifications, online exam proctoring |
| Queue | BullMQ (Redis-backed) | Async jobs: bulk email, PDF generation, report export |
| Containerization | Docker + Docker Compose | Dev parity with prod |
| Orchestration | AWS ECS Fargate | Serverless containers, auto-scaling |
| CI/CD | GitHub Actions | Automated test, build, deploy |
| Monitoring | AWS CloudWatch + Sentry | Logs, errors, performance |

---

## 3. Repository Structure

### 3.1 Monorepo Layout

```
erp-lms/
├── apps/
│   ├── api/                        # NestJS backend
│   │   ├── src/
│   │   │   ├── main.ts
│   │   │   ├── app.module.ts
│   │   │   ├── common/
│   │   │   │   ├── decorators/     # @Roles(), @Module(), @CurrentUser()
│   │   │   │   ├── guards/         # AuthGuard, RolesGuard, ModuleGuard
│   │   │   │   ├── middleware/     # TenantMiddleware
│   │   │   │   ├── interceptors/   # AuditInterceptor, TransformInterceptor
│   │   │   │   ├── filters/        # GlobalExceptionFilter
│   │   │   │   └── pipes/          # ValidationPipe
│   │   │   │
│   │   │   ├── auth/               # JWT auth, login, refresh, OTP
│   │   │   ├── tenant/             # Tenant CRUD, module toggle
│   │   │   ├── users/              # User management
│   │   │   ├── roles/              # RBAC engine
│   │   │   │
│   │   │   ├── modules/            # Each feature = NestJS module
│   │   │   │   ├── attendance/
│   │   │   │   ├── examination/
│   │   │   │   ├── assignment/
│   │   │   │   ├── notice/
│   │   │   │   ├── discussion/
│   │   │   │   ├── content/
│   │   │   │   ├── results/
│   │   │   │   ├── timetable/
│   │   │   │   ├── library/
│   │   │   │   ├── hostel/
│   │   │   │   ├── transport/
│   │   │   │   ├── placement/
│   │   │   │   ├── hr/
│   │   │   │   ├── admission/
│   │   │   │   └── inventory/
│   │   │   │
│   │   │   └── notifications/      # Push, email, in-app
│   │   │
│   │   ├── prisma/
│   │   │   ├── schema.prisma
│   │   │   └── migrations/
│   │   │
│   │   ├── Dockerfile
│   │   └── package.json
│   │
│   └── web/                        # Next.js frontend
│       ├── app/
│       │   ├── (platform)/         # Super Admin, Sales, Finance, Support
│       │   ├── (institution)/      # Institution Admin, Principal, etc.
│       │   │   ├── [role]/
│       │   │   │   ├── dashboard/
│       │   │   │   ├── attendance/
│       │   │   │   ├── examination/
│       │   │   │   └── ...
│       │   ├── auth/
│       │   └── layout.tsx
│       │
│       ├── components/
│       │   ├── ui/                 # shadcn/ui base components
│       │   ├── shared/             # Shared across roles
│       │   └── modules/            # Module-specific components
│       │
│       ├── lib/
│       │   ├── api.ts              # Axios instance with tenant header
│       │   ├── auth.ts             # Auth helpers
│       │   └── permissions.ts      # Client-side permission helpers
│       │
│       ├── store/                  # Zustand stores
│       ├── hooks/                  # Custom React hooks
│       ├── Dockerfile
│       └── package.json
│
├── packages/
│   ├── shared-types/               # TypeScript types shared between api + web
│   │   ├── roles.ts
│   │   ├── modules.ts
│   │   └── api-contracts.ts
│   │
│   └── config/                     # Shared ESLint, TSConfig, Prettier
│
├── infrastructure/
│   ├── terraform/                  # AWS infrastructure as code
│   │   ├── main.tf
│   │   ├── rds.tf
│   │   ├── ecs.tf
│   │   ├── s3.tf
│   │   └── variables.tf
│   │
│   └── docker/
│       └── docker-compose.yml      # Local dev stack
│
├── .github/
│   └── workflows/
│       ├── ci.yml
│       └── deploy.yml
│
├── package.json                    # Turborepo root
└── turbo.json
```

---

## 4. Database Design

### 4.1 Full Prisma Schema

```prisma
// prisma/schema.prisma

generator client {
  provider = "prisma-client-js"
}

datasource db {
  provider = "postgresql"
  url      = env("DATABASE_URL")
}

// ─── PLATFORM LAYER ───────────────────────────────────────────

model Tenant {
  id            String          @id @default(uuid())
  name          String
  slug          String          @unique          // subdomain: abc-college.xyz.com
  type          TenantType                       // SCHOOL | COLLEGE
  planId        String
  isActive      Boolean         @default(true)
  createdAt     DateTime        @default(now())
  updatedAt     DateTime        @updatedAt

  plan          Plan            @relation(fields: [planId], references: [id])
  users         User[]
  departments   Department[]
  academicYears AcademicYear[]
  tenantModules TenantModule[]
  auditLogs     AuditLog[]

  @@map("tenants")
}

enum TenantType {
  SCHOOL
  COLLEGE
}

model Plan {
  id          String   @id @default(uuid())
  name        String   // Basic | Standard | Premium
  maxStudents Int
  maxTeachers Int
  price       Decimal
  features    Json     // list of allowed modules
  tenants     Tenant[]

  @@map("plans")
}

// ─── USERS & ROLES ─────────────────────────────────────────────

model User {
  id             String           @id @default(uuid())
  tenantId       String?          // null = platform-level user
  name           String
  email          String
  phone          String?
  passwordHash   String
  avatarUrl      String?
  isActive       Boolean          @default(true)
  lastLoginAt    DateTime?
  createdAt      DateTime         @default(now())
  updatedAt      DateTime         @updatedAt

  tenant         Tenant?          @relation(fields: [tenantId], references: [id])
  roleAssignments RoleAssignment[]
  auditLogs      AuditLog[]

  @@unique([email, tenantId])
  @@map("users")
}

model Role {
  id          String           @id @default(uuid())
  name        String           @unique   // SUPER_ADMIN | TEACHER | STUDENT ...
  scopeLevel  ScopeLevel
  isPlatform  Boolean          @default(false)
  isOptional  Boolean          @default(false)  // true = only visible when module enabled
  moduleKey   String?          // which module activates this role

  assignments  RoleAssignment[]
  permissions  Permission[]

  @@map("roles")
}

enum ScopeLevel {
  PLATFORM
  INSTITUTION
  DEPARTMENT
  CLASS
  SUBJECT
  SELF
  CHILD
}

model RoleAssignment {
  id        String   @id @default(uuid())
  userId    String
  roleId    String
  tenantId  String
  scopeId   String?  // dept_id | class_id | subject_id depending on role scope
  createdAt DateTime @default(now())

  user      User     @relation(fields: [userId], references: [id])
  role      Role     @relation(fields: [roleId], references: [id])

  @@unique([userId, roleId, tenantId, scopeId])
  @@map("role_assignments")
}

model Permission {
  id        String   @id @default(uuid())
  roleId    String
  moduleKey String   // attendance | examination | assignment ...
  action    Action   // CREATE | READ | UPDATE | DELETE
  scope     String?  // own | dept | class | all

  role      Role     @relation(fields: [roleId], references: [id])

  @@unique([roleId, moduleKey, action])
  @@map("permissions")
}

enum Action {
  CREATE
  READ
  UPDATE
  DELETE
}

// ─── MODULE SYSTEM ─────────────────────────────────────────────

model Module {
  id          String         @id @default(uuid())
  key         String         @unique  // attendance | hostel | placement ...
  name        String
  description String
  isCore      Boolean        @default(false)

  tenantModules TenantModule[]

  @@map("modules")
}

model TenantModule {
  id          String   @id @default(uuid())
  tenantId    String
  moduleKey   String
  isEnabled   Boolean  @default(false)
  enabledAt   DateTime?
  enabledById String?

  tenant      Tenant   @relation(fields: [tenantId], references: [id])

  @@unique([tenantId, moduleKey])
  @@map("tenant_modules")
}

// ─── INSTITUTION STRUCTURE ─────────────────────────────────────

model Department {
  id        String   @id @default(uuid())
  tenantId  String
  name      String
  code      String
  hodId     String?

  tenant    Tenant   @relation(fields: [tenantId], references: [id])
  classes   Class[]

  @@unique([tenantId, code])
  @@map("departments")
}

model Class {
  id           String     @id @default(uuid())
  tenantId     String
  departmentId String
  name         String     // "FY-B.Sc-A" | "Grade 10 - B"
  academicYearId String

  department   Department @relation(fields: [departmentId], references: [id])
  subjects     Subject[]
  students     StudentClass[]

  @@map("classes")
}

model Subject {
  id        String   @id @default(uuid())
  tenantId  String
  classId   String
  name      String
  code      String
  teacherId String?

  class     Class    @relation(fields: [classId], references: [id])

  @@map("subjects")
}

model StudentClass {
  id        String   @id @default(uuid())
  studentId String
  classId   String

  class     Class    @relation(fields: [classId], references: [id])

  @@unique([studentId, classId])
  @@map("student_classes")
}

model AcademicYear {
  id        String   @id @default(uuid())
  tenantId  String
  name      String   // "2024-25"
  startDate DateTime
  endDate   DateTime
  isCurrent Boolean  @default(false)

  tenant    Tenant   @relation(fields: [tenantId], references: [id])

  @@map("academic_years")
}

// ─── CORE MODULES: ATTENDANCE ──────────────────────────────────

model AttendanceSession {
  id          String    @id @default(uuid())
  tenantId    String
  classId     String
  subjectId   String?
  teacherId   String
  date        DateTime  @db.Date
  sessionType String    // LECTURE | LAB | PERIOD_1 ...
  createdAt   DateTime  @default(now())

  records     AttendanceRecord[]

  @@unique([classId, subjectId, date, sessionType])
  @@map("attendance_sessions")
}

model AttendanceRecord {
  id          String            @id @default(uuid())
  tenantId    String
  sessionId   String
  studentId   String
  status      AttendanceStatus
  remarks     String?

  session     AttendanceSession @relation(fields: [sessionId], references: [id])

  @@unique([sessionId, studentId])
  @@map("attendance_records")
}

enum AttendanceStatus {
  PRESENT
  ABSENT
  LATE
  EXCUSED
}

// ─── CORE MODULES: EXAMINATION ─────────────────────────────────

model Exam {
  id             String      @id @default(uuid())
  tenantId       String
  title          String
  subjectId      String
  classId        String
  type           ExamType    // MCQ | DESCRIPTIVE | MIXED
  totalMarks     Int
  passingMarks   Int
  duration       Int         // minutes
  scheduledAt    DateTime
  status         ExamStatus  @default(DRAFT)
  createdById    String
  createdAt      DateTime    @default(now())

  questions      Question[]
  attempts       ExamAttempt[]

  @@map("exams")
}

enum ExamType {
  MCQ
  DESCRIPTIVE
  MIXED
  QUIZ
}

enum ExamStatus {
  DRAFT
  PUBLISHED
  ONGOING
  COMPLETED
  RESULTS_RELEASED
}

model Question {
  id          String       @id @default(uuid())
  examId      String
  text        String
  type        QuestionType // MCQ | SHORT | LONG
  marks       Int
  options     Json?        // [{id, text, isCorrect}] for MCQ
  imageUrl    String?
  order       Int

  exam        Exam         @relation(fields: [examId], references: [id])
  answers     Answer[]

  @@map("questions")
}

enum QuestionType {
  MCQ
  SHORT_ANSWER
  LONG_ANSWER
  TRUE_FALSE
}

model ExamAttempt {
  id           String       @id @default(uuid())
  tenantId     String
  examId       String
  studentId    String
  startedAt    DateTime
  submittedAt  DateTime?
  totalScore   Decimal?
  status       AttemptStatus @default(IN_PROGRESS)

  exam         Exam          @relation(fields: [examId], references: [id])
  answers      Answer[]

  @@unique([examId, studentId])
  @@map("exam_attempts")
}

enum AttemptStatus {
  IN_PROGRESS
  SUBMITTED
  GRADED
}

model Answer {
  id           String      @id @default(uuid())
  attemptId    String
  questionId   String
  textAnswer   String?
  selectedOption String?   // option id for MCQ
  score        Decimal?
  feedback     String?

  attempt      ExamAttempt @relation(fields: [attemptId], references: [id])
  question     Question    @relation(fields: [questionId], references: [id])

  @@unique([attemptId, questionId])
  @@map("answers")
}

// ─── CORE MODULES: ASSIGNMENT / MILESTONE ──────────────────────

model Assignment {
  id           String           @id @default(uuid())
  tenantId     String
  title        String
  description  String
  subjectId    String
  classId      String
  teacherId    String
  type         AssignmentType   // REGULAR | MILESTONE
  dueDate      DateTime
  totalMarks   Int
  createdAt    DateTime         @default(now())

  milestones   Milestone[]
  submissions  Submission[]

  @@map("assignments")
}

enum AssignmentType {
  REGULAR
  MILESTONE
}

model Milestone {
  id            String       @id @default(uuid())
  assignmentId  String
  title         String
  description   String
  order         Int
  dueDate       DateTime?

  assignment    Assignment   @relation(fields: [assignmentId], references: [id])
  submissions   Submission[]

  @@map("milestones")
}

model Submission {
  id            String           @id @default(uuid())
  tenantId      String
  assignmentId  String
  milestoneId   String?
  studentId     String
  fileUrls      String[]
  note          String?
  submittedAt   DateTime         @default(now())
  score         Decimal?
  feedback      String?
  status        SubmissionStatus @default(SUBMITTED)
  reviewedById  String?
  reviewedAt    DateTime?

  assignment    Assignment        @relation(fields: [assignmentId], references: [id])
  milestone     Milestone?        @relation(fields: [milestoneId], references: [id])

  @@unique([assignmentId, milestoneId, studentId])
  @@map("submissions")
}

enum SubmissionStatus {
  SUBMITTED
  UNDER_REVIEW
  APPROVED
  REJECTED
  RESUBMIT_REQUESTED
}

// ─── CORE MODULES: NOTICE BOARD ────────────────────────────────

model Notice {
  id          String       @id @default(uuid())
  tenantId    String
  title       String
  body        String
  authorId    String
  targetScope NoticeScope  // INSTITUTION | DEPARTMENT | CLASS
  targetId    String?      // dept_id or class_id if scoped
  attachments String[]
  publishedAt DateTime     @default(now())
  expiresAt   DateTime?
  isPinned    Boolean      @default(false)

  @@map("notices")
}

enum NoticeScope {
  INSTITUTION
  DEPARTMENT
  CLASS
  HOSTEL
  TRANSPORT
}

// ─── CORE MODULES: CONTENT UPLOAD ──────────────────────────────

model ContentItem {
  id          String      @id @default(uuid())
  tenantId    String
  title       String
  description String?
  subjectId   String
  classId     String
  teacherId   String
  type        ContentType // PDF | VIDEO | SLIDE | LINK | IMAGE
  fileUrl     String
  fileSize    Int?
  chapterTag  String?
  downloads   Int         @default(0)
  createdAt   DateTime    @default(now())

  @@map("content_items")
}

enum ContentType {
  PDF
  VIDEO
  SLIDE
  LINK
  IMAGE
  AUDIO
}

// ─── CORE MODULES: DISCUSSION FORUM ────────────────────────────

model DiscussionThread {
  id          String    @id @default(uuid())
  tenantId    String
  title       String
  body        String
  authorId    String
  scope       String    // CLASS | DEPT | SUBJECT
  scopeId     String
  isPinned    Boolean   @default(false)
  isLocked    Boolean   @default(false)
  upvotes     Int       @default(0)
  createdAt   DateTime  @default(now())

  replies     DiscussionReply[]

  @@map("discussion_threads")
}

model DiscussionReply {
  id        String           @id @default(uuid())
  tenantId  String
  threadId  String
  authorId  String
  body      String
  upvotes   Int              @default(0)
  createdAt DateTime         @default(now())

  thread    DiscussionThread @relation(fields: [threadId], references: [id])

  @@map("discussion_replies")
}

// ─── AUDIT LOGS ────────────────────────────────────────────────

model AuditLog {
  id        String   @id @default(uuid())
  tenantId  String?
  userId    String
  action    String   // CREATE_EXAM | DELETE_USER | ENABLE_MODULE ...
  entity    String   // Exam | User | TenantModule ...
  entityId  String?
  meta      Json?    // diff data, old/new values
  ipAddress String?
  userAgent String?
  createdAt DateTime @default(now())

  tenant    Tenant?  @relation(fields: [tenantId], references: [id])
  user      User     @relation(fields: [userId], references: [id])

  @@map("audit_logs")
}
```

---

## 5. Multi-Tenancy Implementation

### 5.1 Tenant Identification Strategy

Use **subdomain-based** tenant identification:

```
abc-college.xyz.com   →  tenant slug = "abc-college"
xyz-school.xyz.com    →  tenant slug = "xyz-school"
app.xyz.com           →  platform admin (no tenant)
```

### 5.2 TenantMiddleware (NestJS)

```typescript
// src/common/middleware/tenant.middleware.ts

import { Injectable, NestMiddleware, UnauthorizedException } from '@nestjs/common';
import { Request, Response, NextFunction } from 'express';
import { PrismaService } from '../prisma/prisma.service';
import { RedisService } from '../redis/redis.service';

@Injectable()
export class TenantMiddleware implements NestMiddleware {
  constructor(
    private prisma: PrismaService,
    private redis: RedisService,
  ) {}

  async use(req: Request, res: Response, next: NextFunction) {
    // Extract slug from subdomain: abc-college.xyz.com → abc-college
    const host = req.hostname;
    const slug = host.split('.')[0];

    // Platform routes skip tenant resolution
    if (slug === 'app' || slug === 'api') {
      req['tenantId'] = null;
      return next();
    }

    // Cache lookup first
    const cacheKey = `tenant:${slug}`;
    let tenant = await this.redis.get(cacheKey);

    if (!tenant) {
      tenant = await this.prisma.tenant.findUnique({
        where: { slug, isActive: true },
        select: { id: true, type: true, slug: true },
      });

      if (!tenant) throw new UnauthorizedException('Institution not found');

      await this.redis.setex(cacheKey, 300, JSON.stringify(tenant)); // 5 min cache
    } else {
      tenant = JSON.parse(tenant);
    }

    req['tenantId'] = tenant.id;
    req['tenantType'] = tenant.type;
    next();
  }
}
```

### 5.3 Tenant-Scoped Prisma Extension

```typescript
// src/common/prisma/tenant-prisma.service.ts

import { Injectable, Scope } from '@nestjs/common';
import { REQUEST } from '@nestjs/core';
import { Inject } from '@nestjs/common';
import { PrismaClient } from '@prisma/client';

@Injectable({ scope: Scope.REQUEST })
export class TenantPrismaService {
  private client: PrismaClient;

  constructor(@Inject(REQUEST) private request: any) {
    const tenantId = request.tenantId;

    // Use Prisma middleware to auto-inject tenantId on all queries
    this.client = new PrismaClient().$extends({
      query: {
        $allModels: {
          async $allOperations({ args, query, model }) {
            // Auto-scope all queries to current tenant
            const tenantScopedModels = [
              'User', 'Department', 'Class', 'Subject',
              'AttendanceSession', 'AttendanceRecord',
              'Exam', 'ExamAttempt', 'Assignment', 'Submission',
              'Notice', 'ContentItem', 'DiscussionThread',
            ];

            if (tenantId && tenantScopedModels.includes(model)) {
              if (args.where) {
                args.where.tenantId = tenantId;
              } else {
                args.where = { tenantId };
              }
            }

            return query(args);
          },
        },
      },
    }) as any;
  }

  get db() {
    return this.client;
  }
}
```

---

## 6. Authentication & Authorization

### 6.1 Auth Flow

```
POST /auth/login
     │
     ├── Validate email + password (bcrypt)
     ├── Load user roles for this tenant
     ├── Generate accessToken (15 min) + refreshToken (7 days)
     ├── Store refreshToken in Redis: key = refresh:{userId}
     └── Return { accessToken, refreshToken, user, roles, enabledModules }

POST /auth/refresh
     ├── Validate refreshToken from Redis
     ├── Issue new accessToken
     └── Rotate refreshToken (one-time use)

POST /auth/logout
     └── Delete refreshToken from Redis
```

### 6.2 JWT Payload Structure

```typescript
interface JwtPayload {
  sub: string;          // user id
  tenantId: string | null;
  email: string;
  roles: string[];      // ['TEACHER', 'MENTOR']
  scopeIds: {           // scoped resource IDs per role
    TEACHER: string[];  // subject IDs
    HOD: string[];      // dept IDs
  };
  iat: number;
  exp: number;
}
```

### 6.3 AuthGuard

```typescript
// src/common/guards/auth.guard.ts

import {
  Injectable, CanActivate, ExecutionContext, UnauthorizedException
} from '@nestjs/common';
import { JwtService } from '@nestjs/jwt';
import { Reflector } from '@nestjs/core';

@Injectable()
export class AuthGuard implements CanActivate {
  constructor(
    private jwt: JwtService,
    private reflector: Reflector,
  ) {}

  async canActivate(context: ExecutionContext): Promise<boolean> {
    const isPublic = this.reflector.get('isPublic', context.getHandler());
    if (isPublic) return true;

    const request = context.switchToHttp().getRequest();
    const token = this.extractToken(request);
    if (!token) throw new UnauthorizedException('No token provided');

    try {
      const payload = await this.jwt.verifyAsync(token);
      request.user = payload;
      return true;
    } catch {
      throw new UnauthorizedException('Invalid or expired token');
    }
  }

  private extractToken(request: any): string | null {
    const [type, token] = request.headers.authorization?.split(' ') ?? [];
    return type === 'Bearer' ? token : null;
  }
}
```

### 6.4 RolesGuard

```typescript
// src/common/guards/roles.guard.ts

import {
  Injectable, CanActivate, ExecutionContext, ForbiddenException
} from '@nestjs/common';
import { Reflector } from '@nestjs/core';
import { PermissionService } from '../services/permission.service';

@Injectable()
export class RolesGuard implements CanActivate {
  constructor(
    private reflector: Reflector,
    private permService: PermissionService,
  ) {}

  async canActivate(context: ExecutionContext): Promise<boolean> {
    const required = this.reflector.getAllAndOverride<{
      module: string;
      action: string;
    }>('requiredPermission', [context.getHandler(), context.getClass()]);

    if (!required) return true;

    const request = context.switchToHttp().getRequest();
    const { user, tenantId } = request;

    const hasPermission = await this.permService.check({
      userId: user.sub,
      tenantId,
      moduleKey: required.module,
      action: required.action,
    });

    if (!hasPermission) throw new ForbiddenException('Insufficient permissions');
    return true;
  }
}
```

### 6.5 Permission Decorator

```typescript
// src/common/decorators/permission.decorator.ts

import { SetMetadata } from '@nestjs/common';

export const RequirePermission = (module: string, action: string) =>
  SetMetadata('requiredPermission', { module, action });

// Usage in controllers:
// @RequirePermission('attendance', 'CREATE')
// @Post('mark')
// markAttendance() {}
```

### 6.6 ModuleGuard

```typescript
// src/common/guards/module.guard.ts

@Injectable()
export class ModuleGuard implements CanActivate {
  constructor(
    private reflector: Reflector,
    private redis: RedisService,
    private prisma: PrismaService,
  ) {}

  async canActivate(context: ExecutionContext): Promise<boolean> {
    const moduleKey = this.reflector.get<string>('moduleKey', context.getHandler());
    if (!moduleKey) return true;

    const request = context.switchToHttp().getRequest();
    const { tenantId } = request;

    // Core modules always enabled
    const coreModules = [
      'attendance', 'examination', 'assignment',
      'notice', 'discussion', 'content', 'results', 'timetable'
    ];
    if (coreModules.includes(moduleKey)) return true;

    // Check Redis cache
    const cacheKey = `module:${tenantId}:${moduleKey}`;
    let isEnabled = await this.redis.get(cacheKey);

    if (isEnabled === null) {
      const record = await this.prisma.tenantModule.findUnique({
        where: { tenantId_moduleKey: { tenantId, moduleKey } },
      });
      isEnabled = record?.isEnabled ? 'true' : 'false';
      await this.redis.setex(cacheKey, 60, isEnabled);
    }

    if (isEnabled !== 'true') {
      throw new ForbiddenException(`Module '${moduleKey}' is not enabled for this institution`);
    }

    return true;
  }
}
```

---

## 7. Module System Implementation

### 7.1 Module Toggle Service

```typescript
// src/tenant/tenant-module.service.ts

@Injectable()
export class TenantModuleService {
  constructor(
    private prisma: PrismaService,
    private redis: RedisService,
    private roleService: RoleService,
  ) {}

  async toggleModule(tenantId: string, moduleKey: string, enable: boolean, adminId: string) {
    // Update DB
    const record = await this.prisma.tenantModule.upsert({
      where: { tenantId_moduleKey: { tenantId, moduleKey } },
      update: { isEnabled: enable, enabledAt: enable ? new Date() : null, enabledById: adminId },
      create: { tenantId, moduleKey, isEnabled: enable, enabledAt: enable ? new Date() : null, enabledById: adminId },
    });

    // Invalidate Redis cache
    await this.redis.del(`module:${tenantId}:${moduleKey}`);

    // If enabling: ensure the module's optional role exists for this tenant
    if (enable) {
      await this.roleService.activateModuleRole(tenantId, moduleKey);
    }

    // If disabling: revoke all role assignments for that module's role
    if (!enable) {
      await this.roleService.revokeModuleRole(tenantId, moduleKey);
    }

    return record;
  }

  async getEnabledModules(tenantId: string): Promise<string[]> {
    const records = await this.prisma.tenantModule.findMany({
      where: { tenantId, isEnabled: true },
      select: { moduleKey: true },
    });

    const coreModules = [
      'attendance', 'examination', 'assignment',
      'notice', 'discussion', 'content', 'results', 'timetable'
    ];

    return [...coreModules, ...records.map(r => r.moduleKey)];
  }
}
```

### 7.2 Module-to-Role Mapping

```typescript
// src/roles/module-role-map.ts

export const MODULE_ROLE_MAP: Record<string, string> = {
  library:   'LIBRARIAN',
  hostel:    'HOSTEL_WARDEN',
  transport: 'TRANSPORT_MANAGER',
  placement: 'PLACEMENT_OFFICER',
  hr:        'HR_MANAGER',
  admission: 'ADMISSION_OFFICER',
  inventory: 'STORE_MANAGER',
};
```

---

## 8. API Design Standards

### 8.1 URL Conventions

```
GET    /api/v1/{module}/{resource}           List
POST   /api/v1/{module}/{resource}           Create
GET    /api/v1/{module}/{resource}/:id       Get one
PATCH  /api/v1/{module}/{resource}/:id       Update
DELETE /api/v1/{module}/{resource}/:id       Delete

Examples:
POST   /api/v1/attendance/sessions
PATCH  /api/v1/attendance/sessions/:id/records
GET    /api/v1/examination/exams
POST   /api/v1/examination/exams/:id/publish
GET    /api/v1/assignment/assignments/:id/submissions
```

### 8.2 Standard Response Envelope

```typescript
// Success
{
  "success": true,
  "data": { ... },
  "meta": {               // for paginated lists
    "total": 120,
    "page": 1,
    "perPage": 20,
    "totalPages": 6
  }
}

// Error
{
  "success": false,
  "error": {
    "code": "FORBIDDEN",
    "message": "You do not have permission to mark attendance for this class",
    "details": []
  }
}
```

### 8.3 Sample Controller Pattern

```typescript
// src/modules/attendance/attendance.controller.ts

@Controller('attendance')
@UseGuards(AuthGuard, RolesGuard, ModuleGuard)
@SetMetadata('moduleKey', 'attendance')
export class AttendanceController {
  constructor(private attendanceService: AttendanceService) {}

  // Teacher marks attendance
  @Post('sessions')
  @RequirePermission('attendance', 'CREATE')
  async createSession(
    @Body() dto: CreateSessionDto,
    @CurrentUser() user: JwtPayload,
    @TenantId() tenantId: string,
  ) {
    return this.attendanceService.createSession(tenantId, user.sub, dto);
  }

  // Student views own attendance
  @Get('my')
  @RequirePermission('attendance', 'READ')
  async getMyAttendance(@CurrentUser() user: JwtPayload, @TenantId() tenantId: string) {
    return this.attendanceService.getStudentAttendance(tenantId, user.sub);
  }

  // HOD / Principal views department report
  @Get('reports/department/:deptId')
  @RequirePermission('attendance', 'READ')
  async getDeptReport(
    @Param('deptId') deptId: string,
    @CurrentUser() user: JwtPayload,
    @TenantId() tenantId: string,
  ) {
    return this.attendanceService.getDeptReport(tenantId, deptId, user);
  }
}
```

---

## 9. Core Module Implementation Plans

### 9.1 Attendance Module

**Service responsibilities:**
- `createSession(tenantId, teacherId, { classId, subjectId, date, sessionType })` → creates session
- `bulkMarkRecords(sessionId, records[])` → upserts attendance per student
- `getStudentAttendance(tenantId, studentId, filters)` → own records + percentage
- `getDeptReport(tenantId, deptId)` → aggregated per class/subject
- `getLowAttendanceAlerts(tenantId)` → students below threshold (e.g., 75%)

**Background jobs:**
- Daily cron: compute attendance percentage per student, send alerts to parents if below threshold

---

### 9.2 Examination Module

**Service flow for online exam:**

```
Teacher creates exam (DRAFT)
       ↓
Teacher adds questions
       ↓
Teacher publishes (PUBLISHED)  →  Students see exam in their dashboard
       ↓
scheduledAt reached  →  Exam goes ONGOING  (cron job)
       ↓
Student starts attempt  →  ExamAttempt created, timer starts (Redis TTL)
       ↓
Student submits OR timer expires  →  Attempt SUBMITTED
       ↓
Auto-grade MCQ (immediate)
Manual grade descriptive (teacher reviews)
       ↓
Teacher releases results  →  Exam status = RESULTS_RELEASED
       ↓
Students notified, grade cards generated (BullMQ job)
```

**Anti-cheat measures:**
- Tab-switch detection (frontend focus events)
- Timer in Redis (cannot be manipulated by client)
- One active attempt per student per exam (DB unique constraint)

---

### 9.3 Assignment & Milestone Module

**Milestone unlock logic:**

```typescript
async approveSubmission(submissionId: string, reviewerId: string) {
  const submission = await this.prisma.submission.update({
    where: { id: submissionId },
    data: { status: 'APPROVED', reviewedById: reviewerId, reviewedAt: new Date() },
    include: { milestone: { include: { assignment: { include: { milestones: true } } } } },
  });

  // Find next milestone in order
  const milestones = submission.milestone.assignment.milestones
    .sort((a, b) => a.order - b.order);
  const currentIndex = milestones.findIndex(m => m.id === submission.milestoneId);
  const nextMilestone = milestones[currentIndex + 1];

  if (nextMilestone) {
    // Notify student: next milestone unlocked
    await this.notificationService.send({
      userId: submission.studentId,
      title: 'Milestone approved!',
      body: `Next milestone unlocked: ${nextMilestone.title}`,
      type: 'MILESTONE_UNLOCKED',
    });
  }
}
```

---

### 9.4 Notice Board Module

**Targeting logic:**

```typescript
// When fetching notices for a user, compute which scopes they belong to
async getNoticesForUser(tenantId: string, userId: string): Promise<Notice[]> {
  const user = await this.getUserContext(userId); // loads class, dept, roles

  const scopeFilters = [
    { targetScope: 'INSTITUTION', targetId: null },
    { targetScope: 'DEPARTMENT', targetId: user.departmentId },
    { targetScope: 'CLASS', targetId: user.classId },
  ];

  // Add hostel/transport scopes if applicable
  if (user.hostelRoomId) scopeFilters.push({ targetScope: 'HOSTEL', targetId: user.hostelId });
  if (user.transportRouteId) scopeFilters.push({ targetScope: 'TRANSPORT', targetId: user.routeId });

  return this.prisma.notice.findMany({
    where: {
      tenantId,
      OR: scopeFilters,
      expiresAt: { gte: new Date() },
    },
    orderBy: [{ isPinned: 'desc' }, { publishedAt: 'desc' }],
  });
}
```

---

## 10. Frontend Architecture

### 10.1 Route Structure (Next.js App Router)

```
app/
├── (auth)/
│   ├── login/page.tsx
│   └── forgot-password/page.tsx
│
├── (platform)/                      # app.xyz.com
│   ├── layout.tsx                   # platform shell, requires PLATFORM role
│   ├── dashboard/page.tsx
│   ├── institutions/page.tsx
│   ├── billing/page.tsx
│   └── settings/page.tsx
│
└── (institution)/                   # [slug].xyz.com
    ├── layout.tsx                   # institution shell, loads enabled modules
    ├── dashboard/page.tsx           # role-aware dashboard
    │
    ├── attendance/
    │   ├── page.tsx                 # teacher: mark | student: view own
    │   └── reports/page.tsx         # HOD/Principal only
    │
    ├── examination/
    │   ├── page.tsx
    │   ├── [examId]/
    │   │   ├── page.tsx             # teacher: manage | student: attempt
    │   │   └── results/page.tsx
    │   └── create/page.tsx
    │
    ├── assignment/
    │   ├── page.tsx
    │   ├── [assignmentId]/
    │   │   ├── page.tsx
    │   │   └── milestones/page.tsx
    │   └── create/page.tsx
    │
    ├── notice/page.tsx
    ├── discussion/page.tsx
    ├── content/page.tsx
    ├── results/page.tsx
    ├── timetable/page.tsx
    │
    ├── settings/                    # Institution Admin only
    │   ├── modules/page.tsx         # THE MODULE TOGGLE PAGE
    │   ├── departments/page.tsx
    │   ├── users/page.tsx
    │   └── academic-year/page.tsx
    │
    └── [module]/                    # Optional modules load dynamically
        └── page.tsx
```

### 10.2 Permission Hook (Client-Side)

```typescript
// hooks/usePermission.ts

import { useAuthStore } from '@/store/auth';

export function usePermission(moduleKey: string, action: string): boolean {
  const { permissions, enabledModules } = useAuthStore();

  if (!enabledModules.includes(moduleKey)) return false;

  return permissions.some(
    p => p.moduleKey === moduleKey && p.action === action
  );
}

// Usage:
// const canMark = usePermission('attendance', 'CREATE');
// const canView = usePermission('hostel', 'READ');
```

### 10.3 Module-Aware Navigation

```typescript
// components/shared/Sidebar.tsx

const ALL_NAV_ITEMS = [
  { key: 'attendance',  label: 'Attendance',  icon: 'clipboard-check', core: true },
  { key: 'examination', label: 'Examination', icon: 'writing',          core: true },
  { key: 'assignment',  label: 'Assignments', icon: 'flag',             core: true },
  { key: 'notice',      label: 'Notice Board',icon: 'bell',             core: true },
  { key: 'discussion',  label: 'Discussions', icon: 'messages',         core: true },
  { key: 'content',     label: 'Content',     icon: 'file-upload',      core: true },
  { key: 'results',     label: 'Results',     icon: 'chart-bar',        core: true },
  { key: 'timetable',   label: 'Timetable',   icon: 'calendar',         core: true },
  { key: 'library',     label: 'Library',     icon: 'books',            core: false },
  { key: 'hostel',      label: 'Hostel',      icon: 'home',             core: false },
  { key: 'transport',   label: 'Transport',   icon: 'bus',              core: false },
  { key: 'placement',   label: 'Placement',   icon: 'briefcase',        core: false },
  { key: 'hr',          label: 'HR',          icon: 'users',            core: false },
  { key: 'admission',   label: 'Admission',   icon: 'user-plus',        core: false },
  { key: 'inventory',   label: 'Inventory',   icon: 'package',          core: false },
];

export function Sidebar() {
  const { enabledModules } = useAuthStore();

  const visibleItems = ALL_NAV_ITEMS.filter(
    item => item.core || enabledModules.includes(item.key)
  );

  return (
    <nav>
      {visibleItems.map(item => (
        <NavItem key={item.key} {...item} />
      ))}
    </nav>
  );
}
```

---

## 11. File Storage & Media

### 11.1 Upload Flow

```
Client selects file
       ↓
POST /api/v1/storage/presign
  { fileType, fileName, module: 'content' }
       ↓
API generates S3 presigned PUT URL (5 min TTL)
Returns: { uploadUrl, fileKey }
       ↓
Client uploads directly to S3 (no API bandwidth used)
       ↓
Client calls POST /api/v1/content/items
  { ..., fileKey }
       ↓
API saves ContentItem record with fileKey
```

### 11.2 S3 Bucket Structure

```
s3://erp-lms-media/
├── tenants/
│   └── {tenantId}/
│       ├── content/          # lecture notes, slides, videos
│       ├── submissions/      # assignment file uploads
│       ├── exam-assets/      # question paper images
│       ├── notice-attachments/
│       └── avatars/
```

### 11.3 File Access Control

All S3 objects are **private**. Frontend never receives a direct S3 URL.

```typescript
// Generate signed GET URL (15 min expiry)
async getSignedUrl(fileKey: string): Promise<string> {
  const command = new GetObjectCommand({
    Bucket: process.env.S3_BUCKET,
    Key: fileKey,
  });
  return getSignedUrl(this.s3Client, command, { expiresIn: 900 });
}
```

---

## 12. Notification System

### 12.1 Notification Types

| Event | Channel | Target |
|---|---|---|
| Attendance marked absent | Push + (optionally) SMS | Parent, Student |
| Exam published | Push + In-app | Students of that class |
| Exam result released | Push + Email | Students |
| Assignment created | In-app | Students |
| Milestone approved | Push + In-app | Student |
| Notice posted | In-app | Scoped recipients |
| Low attendance alert | Email | HOD, Student, Parent |
| Fee due reminder | Push + Email | Parent, Student |

### 12.2 Notification Service

```typescript
// src/notifications/notification.service.ts

@Injectable()
export class NotificationService {
  constructor(
    private fcm: FcmService,
    private mailer: MailService,
    private prisma: PrismaService,
    @InjectQueue('notifications') private queue: Queue,
  ) {}

  async send(payload: {
    userId: string;
    title: string;
    body: string;
    type: string;
    data?: Record<string, string>;
  }) {
    // 1. Save in-app notification
    await this.prisma.notification.create({
      data: {
        userId: payload.userId,
        title: payload.title,
        body: payload.body,
        type: payload.type,
        data: payload.data ?? {},
      },
    });

    // 2. Push via queue (non-blocking)
    await this.queue.add('push', payload, { attempts: 3, backoff: 2000 });
  }

  async sendBulk(userIds: string[], payload: Omit<typeof payload, 'userId'>) {
    // Chunked bulk push via BullMQ
    await this.queue.add('push-bulk', { userIds, ...payload });
  }
}
```

---

## 13. Environment Setup

### 13.1 Local Development Prerequisites

```
Node.js >= 20.x
pnpm >= 8.x
Docker Desktop
PostgreSQL 15 (via Docker)
Redis 7 (via Docker)
```

### 13.2 Clone & Install

```bash
# Clone
git clone https://github.com/your-org/erp-lms.git
cd erp-lms

# Install all workspaces
pnpm install

# Copy env files
cp apps/api/.env.example apps/api/.env
cp apps/web/.env.example apps/web/.env
```

### 13.3 Environment Variables

```bash
# apps/api/.env

# App
NODE_ENV=development
PORT=4000
API_URL=http://localhost:4000

# Database
DATABASE_URL=postgresql://erp_user:erp_pass@localhost:5432/erp_lms_dev

# Redis
REDIS_URL=redis://localhost:6379

# JWT
JWT_SECRET=your-super-secret-key-change-in-prod
JWT_EXPIRES_IN=15m
JWT_REFRESH_EXPIRES_IN=7d

# AWS
AWS_REGION=ap-south-1
AWS_ACCESS_KEY_ID=your-key
AWS_SECRET_ACCESS_KEY=your-secret
S3_BUCKET=erp-lms-media-dev

# Email (SES)
SES_FROM_EMAIL=noreply@xyz.com

# Firebase (Push)
FCM_SERVER_KEY=your-fcm-server-key
```

```bash
# apps/web/.env.local

NEXT_PUBLIC_API_URL=http://localhost:4000/api/v1
NEXT_PUBLIC_APP_DOMAIN=localhost
NEXT_PUBLIC_APP_NAME=EduPlatform
```

### 13.4 Docker Compose (Local Stack)

```yaml
# infrastructure/docker/docker-compose.yml

version: '3.9'

services:
  postgres:
    image: postgres:15-alpine
    environment:
      POSTGRES_USER: erp_user
      POSTGRES_PASSWORD: erp_pass
      POSTGRES_DB: erp_lms_dev
    ports:
      - "5432:5432"
    volumes:
      - postgres_data:/var/lib/postgresql/data

  redis:
    image: redis:7-alpine
    ports:
      - "6379:6379"

  api:
    build:
      context: ../../apps/api
      dockerfile: Dockerfile.dev
    ports:
      - "4000:4000"
    environment:
      DATABASE_URL: postgresql://erp_user:erp_pass@postgres:5432/erp_lms_dev
      REDIS_URL: redis://redis:6379
    volumes:
      - ../../apps/api/src:/app/src
    depends_on:
      - postgres
      - redis

  web:
    build:
      context: ../../apps/web
      dockerfile: Dockerfile.dev
    ports:
      - "3000:3000"
    environment:
      NEXT_PUBLIC_API_URL: http://localhost:4000/api/v1
    volumes:
      - ../../apps/web:/app
    depends_on:
      - api

volumes:
  postgres_data:
```

### 13.5 Bootstrap Commands

```bash
# Start local services
docker-compose -f infrastructure/docker/docker-compose.yml up -d postgres redis

# Run Prisma migrations
cd apps/api
npx prisma migrate dev --name init

# Seed roles, permissions, core modules
npx prisma db seed

# Start API (development)
pnpm --filter api dev

# Start Web (development)
pnpm --filter web dev
```

### 13.6 Prisma Seed File

```typescript
// apps/api/prisma/seed.ts

import { PrismaClient } from '@prisma/client';
import * as bcrypt from 'bcrypt';

const prisma = new PrismaClient();

async function main() {
  // Seed roles
  const roles = [
    { name: 'SUPER_ADMIN',          scopeLevel: 'PLATFORM',     isPlatform: true },
    { name: 'SUPPORT_STAFF',        scopeLevel: 'PLATFORM',     isPlatform: true },
    { name: 'SALES_EXECUTIVE',      scopeLevel: 'PLATFORM',     isPlatform: true },
    { name: 'FINANCE_MANAGER',      scopeLevel: 'PLATFORM',     isPlatform: true },
    { name: 'INSTITUTION_ADMIN',    scopeLevel: 'INSTITUTION' },
    { name: 'PRINCIPAL',            scopeLevel: 'INSTITUTION' },
    { name: 'VICE_PRINCIPAL',       scopeLevel: 'INSTITUTION',  isOptional: true },
    { name: 'HOD',                  scopeLevel: 'DEPARTMENT' },
    { name: 'TEACHER',              scopeLevel: 'SUBJECT' },
    { name: 'MENTOR',               scopeLevel: 'SELF',         isOptional: true },
    { name: 'ACADEMIC_COORDINATOR', scopeLevel: 'DEPARTMENT' },
    { name: 'EXAM_CONTROLLER',      scopeLevel: 'INSTITUTION' },
    { name: 'ACCOUNTANT',           scopeLevel: 'INSTITUTION' },
    { name: 'LIBRARIAN',            scopeLevel: 'INSTITUTION',  isOptional: true, moduleKey: 'library' },
    { name: 'STUDENT',              scopeLevel: 'SELF' },
    { name: 'PARENT',               scopeLevel: 'CHILD' },
    { name: 'HOSTEL_WARDEN',        scopeLevel: 'INSTITUTION',  isOptional: true, moduleKey: 'hostel' },
    { name: 'TRANSPORT_MANAGER',    scopeLevel: 'INSTITUTION',  isOptional: true, moduleKey: 'transport' },
    { name: 'PLACEMENT_OFFICER',    scopeLevel: 'INSTITUTION',  isOptional: true, moduleKey: 'placement' },
    { name: 'HR_MANAGER',           scopeLevel: 'INSTITUTION',  isOptional: true, moduleKey: 'hr' },
    { name: 'ADMISSION_OFFICER',    scopeLevel: 'INSTITUTION',  isOptional: true, moduleKey: 'admission' },
    { name: 'STORE_MANAGER',        scopeLevel: 'INSTITUTION',  isOptional: true, moduleKey: 'inventory' },
  ];

  for (const role of roles) {
    await prisma.role.upsert({
      where: { name: role.name },
      update: {},
      create: role as any,
    });
  }

  // Seed modules
  const modules = [
    { key: 'attendance',  name: 'Attendance',        isCore: true },
    { key: 'examination', name: 'Examination',        isCore: true },
    { key: 'assignment',  name: 'Assignments',        isCore: true },
    { key: 'notice',      name: 'Notice Board',       isCore: true },
    { key: 'discussion',  name: 'Discussion Forum',   isCore: true },
    { key: 'content',     name: 'Content Upload',     isCore: true },
    { key: 'results',     name: 'Results & Analytics',isCore: true },
    { key: 'timetable',   name: 'Timetable',          isCore: true },
    { key: 'library',     name: 'Library',            isCore: false },
    { key: 'hostel',      name: 'Hostel',             isCore: false },
    { key: 'transport',   name: 'Transport',          isCore: false },
    { key: 'placement',   name: 'Placement',          isCore: false },
    { key: 'hr',          name: 'HR',                 isCore: false },
    { key: 'admission',   name: 'Admission',          isCore: false },
    { key: 'inventory',   name: 'Inventory',          isCore: false },
  ];

  for (const m of modules) {
    await prisma.module.upsert({ where: { key: m.key }, update: {}, create: m });
  }

  // Seed super admin user
  const hash = await bcrypt.hash('Admin@123', 12);
  await prisma.user.upsert({
    where: { email_tenantId: { email: 'admin@xyz.com', tenantId: null } } as any,
    update: {},
    create: {
      name: 'Super Admin',
      email: 'admin@xyz.com',
      passwordHash: hash,
      tenantId: null,
    },
  });

  console.log('Seed complete ✓');
}

main().catch(console.error).finally(() => prisma.$disconnect());
```

---

## 14. Deployment Architecture

### 14.1 AWS Infrastructure Overview

```
Route 53
  └── *.xyz.com  →  CloudFront Distribution
                          │
              ┌───────────┴───────────┐
              │                       │
       /api/* →  ALB              /* →  S3 (Next.js static)
                  │                       or ECS (SSR)
          ┌───────┴───────┐
          │               │
       ECS Task        ECS Task
       (API #1)        (API #2)      ← auto-scaled
          │               │
          └───────┬───────┘
                  │
         RDS PostgreSQL (Multi-AZ)
         ElastiCache Redis (cluster)
         S3 (media storage)
         SES (email)
         FCM (push via Lambda)
```

### 14.2 Dockerfiles

```dockerfile
# apps/api/Dockerfile

FROM node:20-alpine AS builder
WORKDIR /app
COPY package*.json ./
RUN npm ci
COPY . .
RUN npx prisma generate
RUN npm run build

FROM node:20-alpine AS runner
WORKDIR /app
ENV NODE_ENV=production
COPY --from=builder /app/dist ./dist
COPY --from=builder /app/node_modules ./node_modules
COPY --from=builder /app/prisma ./prisma
EXPOSE 4000
CMD ["node", "dist/main.js"]
```

```dockerfile
# apps/web/Dockerfile

FROM node:20-alpine AS builder
WORKDIR /app
COPY package*.json ./
RUN npm ci
COPY . .
RUN npm run build

FROM node:20-alpine AS runner
WORKDIR /app
ENV NODE_ENV=production
COPY --from=builder /app/.next/standalone ./
COPY --from=builder /app/.next/static ./.next/static
COPY --from=builder /app/public ./public
EXPOSE 3000
CMD ["node", "server.js"]
```

### 14.3 ECS Task Definition (API)

```json
{
  "family": "erp-lms-api",
  "networkMode": "awsvpc",
  "requiresCompatibilities": ["FARGATE"],
  "cpu": "512",
  "memory": "1024",
  "containerDefinitions": [
    {
      "name": "api",
      "image": "{AWS_ACCOUNT_ID}.dkr.ecr.ap-south-1.amazonaws.com/erp-lms-api:latest",
      "portMappings": [{ "containerPort": 4000 }],
      "environment": [
        { "name": "NODE_ENV", "value": "production" }
      ],
      "secrets": [
        { "name": "DATABASE_URL",    "valueFrom": "arn:aws:ssm:...DATABASE_URL" },
        { "name": "JWT_SECRET",      "valueFrom": "arn:aws:ssm:...JWT_SECRET" },
        { "name": "REDIS_URL",       "valueFrom": "arn:aws:ssm:...REDIS_URL" }
      ],
      "logConfiguration": {
        "logDriver": "awslogs",
        "options": {
          "awslogs-group": "/ecs/erp-lms-api",
          "awslogs-region": "ap-south-1",
          "awslogs-stream-prefix": "api"
        }
      }
    }
  ]
}
```

---

## 15. CI/CD Pipeline

### 15.1 GitHub Actions — CI

```yaml
# .github/workflows/ci.yml

name: CI

on:
  push:
    branches: [main, develop]
  pull_request:
    branches: [main, develop]

jobs:
  test-api:
    runs-on: ubuntu-latest
    services:
      postgres:
        image: postgres:15
        env:
          POSTGRES_PASSWORD: test
          POSTGRES_DB: erp_test
        ports: ["5432:5432"]
      redis:
        image: redis:7
        ports: ["6379:6379"]

    steps:
      - uses: actions/checkout@v4
      - uses: actions/setup-node@v4
        with:
          node-version: '20'
          cache: 'pnpm'

      - run: pnpm install
      - run: pnpm --filter api run lint
      - run: pnpm --filter api run test
        env:
          DATABASE_URL: postgresql://postgres:test@localhost:5432/erp_test
          REDIS_URL: redis://localhost:6379
          JWT_SECRET: test-secret

  test-web:
    runs-on: ubuntu-latest
    steps:
      - uses: actions/checkout@v4
      - uses: actions/setup-node@v4
        with: { node-version: '20', cache: 'pnpm' }
      - run: pnpm install
      - run: pnpm --filter web run lint
      - run: pnpm --filter web run build
```

### 15.2 GitHub Actions — Deploy

```yaml
# .github/workflows/deploy.yml

name: Deploy

on:
  push:
    branches: [main]

jobs:
  deploy:
    runs-on: ubuntu-latest
    steps:
      - uses: actions/checkout@v4

      - name: Configure AWS credentials
        uses: aws-actions/configure-aws-credentials@v4
        with:
          aws-access-key-id: ${{ secrets.AWS_ACCESS_KEY_ID }}
          aws-secret-access-key: ${{ secrets.AWS_SECRET_ACCESS_KEY }}
          aws-region: ap-south-1

      - name: Login to ECR
        uses: aws-actions/amazon-ecr-login@v2

      - name: Build & push API image
        run: |
          docker build -t $ECR_REGISTRY/erp-lms-api:$GITHUB_SHA apps/api/
          docker push $ECR_REGISTRY/erp-lms-api:$GITHUB_SHA
          docker tag $ECR_REGISTRY/erp-lms-api:$GITHUB_SHA $ECR_REGISTRY/erp-lms-api:latest
          docker push $ECR_REGISTRY/erp-lms-api:latest
        env:
          ECR_REGISTRY: ${{ steps.login-ecr.outputs.registry }}

      - name: Run DB migrations
        run: |
          aws ecs run-task \
            --cluster erp-lms \
            --task-definition erp-lms-migrate \
            --launch-type FARGATE \
            --network-configuration "..."

      - name: Deploy to ECS
        uses: aws-actions/amazon-ecs-deploy-task-definition@v1
        with:
          task-definition: infrastructure/ecs/api-task-def.json
          service: erp-lms-api
          cluster: erp-lms
          wait-for-service-stability: true

      - name: Deploy web to Vercel
        uses: amondnet/vercel-action@v25
        with:
          vercel-token: ${{ secrets.VERCEL_TOKEN }}
          vercel-org-id: ${{ secrets.VERCEL_ORG_ID }}
          vercel-project-id: ${{ secrets.VERCEL_PROJECT_ID }}
          vercel-args: '--prod'
```

---

## 16. Developer Sprint Plan

### Phase 1 — Foundation (Weeks 1–3)

| Task | Owner | Days |
|---|---|---|
| Monorepo setup (Turborepo, pnpm) | DevOps | 1 |
| Docker Compose local stack | DevOps | 1 |
| Prisma schema: tenants, users, roles, permissions, modules | Backend | 2 |
| Seed file: all roles + core modules + super admin | Backend | 1 |
| TenantMiddleware + subdomain routing | Backend | 1 |
| JWT Auth (login, refresh, logout) | Backend | 2 |
| AuthGuard + RolesGuard + ModuleGuard | Backend | 2 |
| Permission decorator + service | Backend | 1 |
| Multi-tenant Prisma extension | Backend | 1 |
| AuditLog interceptor | Backend | 1 |
| Next.js project + Tailwind + shadcn setup | Frontend | 1 |
| Auth pages (login, forgot password) | Frontend | 2 |
| Auth store (Zustand) + API client (Axios) | Frontend | 1 |
| usePermission hook | Frontend | 1 |
| Dynamic sidebar (module-aware) | Frontend | 1 |

**Deliverable:** Working login → role-aware dashboard with sidebar. Module guard blocks disabled modules.

---

### Phase 2 — Institution Setup (Weeks 4–5)

| Task | Owner | Days |
|---|---|---|
| Tenant CRUD (Super Admin) | Backend | 2 |
| Module toggle API + cache invalidation | Backend | 2 |
| Department + Class + Subject CRUD | Backend | 2 |
| Academic Year management | Backend | 1 |
| User management + role assignment | Backend | 2 |
| Institution Admin dashboard (UI) | Frontend | 2 |
| Settings → Modules page (toggle UI) | Frontend | 2 |
| Department / Class / User management UI | Frontend | 3 |

**Deliverable:** Institution Admin can set up departments, classes, teachers, students, and toggle optional modules.

---

### Phase 3 — Core LMS Modules (Weeks 6–10)

| Module | Backend | Frontend | Days |
|---|---|---|---|
| Attendance (mark + view + reports) | 3 | 3 | 6 |
| Examination (create + attempt + grade) | 5 | 5 | 10 |
| Assignment + Milestone (create + submit + approve) | 4 | 4 | 8 |
| Content Upload (presign + list + download) | 2 | 2 | 4 |
| Notice Board (post + targeted view) | 2 | 2 | 4 |
| Discussion Forum (threads + replies + upvotes) | 2 | 2 | 4 |
| Results & Grade Cards | 3 | 3 | 6 |
| Timetable | 2 | 2 | 4 |

**Deliverable:** Full core LMS working for Teacher + Student + HOD + Principal flows.

---

### Phase 4 — ERP & Optional Modules (Weeks 11–15)

| Module | Days |
|---|---|
| Fee management (Accountant) | 5 |
| Library | 4 |
| Hostel | 4 |
| Transport | 4 |
| Placement | 4 |
| HR | 5 |
| Admission | 4 |
| Inventory | 3 |

**Deliverable:** All optional modules working. Institution Admin can enable/disable and use each one.

---

### Phase 5 — Notifications, Polish, Deployment (Weeks 16–18)

| Task | Days |
|---|---|
| Push notification setup (FCM) | 2 |
| Email notification (SES) | 2 |
| In-app notification bell | 2 |
| BullMQ job queues | 2 |
| AWS infrastructure (Terraform) | 3 |
| CI/CD pipeline (GitHub Actions) | 2 |
| Production deployment | 2 |
| Load testing + security audit | 3 |

**Deliverable:** Production system live on AWS. CI/CD automated. Monitoring active.

---

### Total Estimated Timeline

| Phase | Duration |
|---|---|
| Phase 1 — Foundation | 3 weeks |
| Phase 2 — Institution Setup | 2 weeks |
| Phase 3 — Core LMS | 5 weeks |
| Phase 4 — ERP & Optional Modules | 5 weeks |
| Phase 5 — Infra & Launch | 3 weeks |
| **Total** | **~18 weeks (4.5 months)** |

> Team assumption: 2 backend developers + 2 frontend developers + 1 DevOps.  
> With 3 full-stack developers, add 2–3 weeks buffer.

---

*Document version: 1.0 | Companion to: Role-Based System Design v1.0*  
*Platform: xyz.com ERP + LMS | Stack: NestJS · PostgreSQL · Next.js · AWS*
