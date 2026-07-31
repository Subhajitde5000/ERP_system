import {
  AlertTriangle,
  BadgeIndianRupee,
  BellRing,
  BookOpenCheck,
  Boxes,
  CalendarClock,
  ClipboardCheck,
  FileCheck2,
  FilePlus2,
  FileSpreadsheet,
  Flag,
  Handshake,
  LifeBuoy,
  Lock,
  Megaphone,
  Receipt,
  ShieldAlert,
  Unlock,
  UserRoundPlus,
  Users,
  Wallet,
} from "lucide-react";

import type { InstitutionRole } from "@/types/auth";
import type {
  AppNotification,
  EventMeta,
  NotificationCategory,
  NotificationEvent,
  NotificationGroup,
} from "@/types/notification";
import type { Tone } from "@/types/dashboard";

/**
 * Notification logic — role_based_shared_pages.md PAGE 15.
 *
 * Two data tables, no role branching in components:
 *   EVENT_META   — icon / colour / deep link per event (the doc's `type` prop)
 *   ROLE_EVENTS  — which events each role receives (the PAGE 15 matrix)
 *
 * Unlike attendance or timetable, PAGE 15 says "same layout, different
 * notification types per role" — so this is a content filter, not a view
 * dispatch, and every role shares one inbox component.
 *
 * TODO(Dev-B): the backend already scopes /notifications by user, so this
 * mapping documents intent and drives the UI filters.
 */

/**
 * Human label for an event key, e.g. `EXAM_RESULT_RELEASED` → "Exam result
 * released". Derived rather than hand-listed so a new event can't ship
 * without one — used by the settings notification matrix (PAGE 16).
 */
export function eventLabel(event: NotificationEvent): string {
  const words = event.toLowerCase().replace(/_/g, " ");
  return words.charAt(0).toUpperCase() + words.slice(1);
}

export const EVENT_META: Record<NotificationEvent, EventMeta> = {
  // Teacher
  SUBMISSION_RECEIVED: { category: "ASSIGNMENT", icon: FilePlus2, href: "/assignments" },
  ASSIGNMENT_DEADLINE_NEAR: { category: "ASSIGNMENT", icon: CalendarClock, href: "/assignments" },
  EXAM_STARTS_SOON: { category: "EXAM", icon: FileSpreadsheet, href: "/examination", urgent: true },
  NOTICE_POSTED_TO_CLASS: { category: "NOTICE", icon: Megaphone, href: "/notices" },

  // HOD
  TEACHER_MARKED_ATTENDANCE: { category: "ATTENDANCE", icon: ClipboardCheck, href: "/attendance" },
  EXAM_PUBLISHED_DEPT: { category: "EXAM", icon: FileSpreadsheet, href: "/examination" },
  RESULT_RELEASED_DEPT: { category: "EXAM", icon: BookOpenCheck, href: "/results" },
  DEPT_NOTICE: { category: "NOTICE", icon: Megaphone, href: "/notices" },

  // Student
  ATTENDANCE_MARKED: { category: "ATTENDANCE", icon: ClipboardCheck, href: "/attendance" },
  EXAM_RESULT_RELEASED: { category: "EXAM", icon: BookOpenCheck, href: "/results", urgent: true },
  ASSIGNMENT_REVIEWED: { category: "ASSIGNMENT", icon: FileCheck2, href: "/assignments" },
  MILESTONE_UNLOCKED: { category: "MILESTONE", icon: Unlock, href: "/assignments" },
  NOTICE_POSTED: { category: "NOTICE", icon: Megaphone, href: "/notices" },
  FEE_DUE: { category: "FEE", icon: BadgeIndianRupee, href: "/fees", urgent: true },

  // Parent
  CHILD_ABSENT: { category: "ATTENDANCE", icon: AlertTriangle, href: "/attendance", urgent: true },
  CHILD_RESULT_RELEASED: { category: "EXAM", icon: BookOpenCheck, href: "/results" },
  CLASS_NOTICE: { category: "NOTICE", icon: Megaphone, href: "/notices" },

  // Exam Controller
  EXAM_ATTEMPT_SUBMITTED: { category: "EXAM", icon: FileSpreadsheet, href: "/examination" },
  MALPRACTICE_FLAGGED: { category: "EXAM", icon: Flag, href: "/examination", urgent: true },
  RESULT_COMPILATION_READY: { category: "EXAM", icon: BookOpenCheck, href: "/results" },

  // Accountant
  PAYMENT_RECEIVED: { category: "FEE", icon: Receipt, href: "/fees" },
  OVERDUE_FINE_TRIGGERED: { category: "FEE", icon: AlertTriangle, href: "/fees", urgent: true },
  INSTALLMENT_DUE_TOMORROW: { category: "FEE", icon: CalendarClock, href: "/fees" },

  // HR Manager
  LEAVE_REQUEST_SUBMITTED: { category: "SYSTEM", icon: CalendarClock, href: "/hr/dashboard" },
  PAYROLL_RUN_DUE: { category: "SYSTEM", icon: Wallet, href: "/hr/dashboard", urgent: true },

  // Hostel Warden
  HOSTEL_STUDENT_ABSENT: { category: "ATTENDANCE", icon: AlertTriangle, href: "/hostel/dashboard", urgent: true },
  HOSTEL_LEAVE_REQUEST: { category: "SYSTEM", icon: CalendarClock, href: "/hostel/dashboard" },
  COMPLAINT_RAISED: { category: "SYSTEM", icon: ShieldAlert, href: "/hostel/dashboard" },

  // Institution Admin
  SUPPORT_TICKET_NEW: { category: "SYSTEM", icon: LifeBuoy, href: "/support" },
  MODULE_TOGGLED: { category: "SYSTEM", icon: Lock, href: "/settings/modules" },
  BULK_ENROLLMENT_DONE: { category: "SYSTEM", icon: Users, href: "/users" },

  // Placement Officer
  APPLICATION_SUBMITTED: { category: "SYSTEM", icon: UserRoundPlus, href: "/placement/dashboard" },
  DRIVE_CONFIRMED: { category: "SYSTEM", icon: Handshake, href: "/placement/dashboard" },
  OFFER_ACCEPTED: { category: "SYSTEM", icon: Handshake, href: "/placement/dashboard" },

  // Admission Officer
  ADMISSION_APPLICATION_RECEIVED: { category: "SYSTEM", icon: UserRoundPlus, href: "/admission/dashboard" },
  DOCUMENT_VERIFICATION_PENDING: { category: "SYSTEM", icon: Boxes, href: "/admission/dashboard" },
};

/** The PAGE 15 matrix — which events each role receives. */
const ROLE_EVENTS: Record<InstitutionRole, NotificationEvent[]> = {
  TEACHER: [
    "SUBMISSION_RECEIVED",
    "ASSIGNMENT_DEADLINE_NEAR",
    "EXAM_STARTS_SOON",
    "NOTICE_POSTED_TO_CLASS",
  ],
  // Mentor is teacher-level and receives the same events
  MENTOR: [
    "SUBMISSION_RECEIVED",
    "ASSIGNMENT_DEADLINE_NEAR",
    "EXAM_STARTS_SOON",
    "NOTICE_POSTED_TO_CLASS",
  ],
  HOD: [
    "TEACHER_MARKED_ATTENDANCE",
    "EXAM_PUBLISHED_DEPT",
    "RESULT_RELEASED_DEPT",
    "DEPT_NOTICE",
  ],
  STUDENT: [
    "ATTENDANCE_MARKED",
    "EXAM_RESULT_RELEASED",
    "ASSIGNMENT_REVIEWED",
    "MILESTONE_UNLOCKED",
    "NOTICE_POSTED",
    "FEE_DUE",
  ],
  PARENT: ["CHILD_ABSENT", "CHILD_RESULT_RELEASED", "FEE_DUE", "CLASS_NOTICE"],
  EXAM_CONTROLLER: [
    "EXAM_ATTEMPT_SUBMITTED",
    "MALPRACTICE_FLAGGED",
    "RESULT_COMPILATION_READY",
  ],
  ACCOUNTANT: [
    "PAYMENT_RECEIVED",
    "OVERDUE_FINE_TRIGGERED",
    "INSTALLMENT_DUE_TOMORROW",
  ],
  HR_MANAGER: ["LEAVE_REQUEST_SUBMITTED", "PAYROLL_RUN_DUE"],
  HOSTEL_WARDEN: [
    "HOSTEL_STUDENT_ABSENT",
    "HOSTEL_LEAVE_REQUEST",
    "COMPLAINT_RAISED",
  ],
  INSTITUTION_ADMIN: [
    "SUPPORT_TICKET_NEW",
    "MODULE_TOGGLED",
    "BULK_ENROLLMENT_DONE",
  ],
  PLACEMENT_OFFICER: [
    "APPLICATION_SUBMITTED",
    "DRIVE_CONFIRMED",
    "OFFER_ACCEPTED",
  ],
  ADMISSION_OFFICER: [
    "ADMISSION_APPLICATION_RECEIVED",
    "DOCUMENT_VERIFICATION_PENDING",
  ],

  // ── Not in the PAGE 15 matrix ────────────────────────────────────────
  // These roles still have an inbox — every user does (DB §10.1) — but only
  // receive institution-wide notices until their events are specified.
  PRINCIPAL: ["DEPT_NOTICE", "RESULT_RELEASED_DEPT"],
  VICE_PRINCIPAL: ["DEPT_NOTICE"],
  ACADEMIC_COORDINATOR: ["NOTICE_POSTED_TO_CLASS", "TEACHER_MARKED_ATTENDANCE"],
  LIBRARIAN: ["NOTICE_POSTED"],
  TRANSPORT_MANAGER: ["NOTICE_POSTED"],
  STORE_MANAGER: ["NOTICE_POSTED"],
};

/** Events a set of roles receives — union for multi-role users. */
export function eventsForRoles(roles: InstitutionRole[]): NotificationEvent[] {
  const seen = new Set<NotificationEvent>();
  for (const role of roles) {
    for (const event of ROLE_EVENTS[role] ?? []) seen.add(event);
  }
  return [...seen];
}

/* ── Presentation helpers ───────────────────────────────────────────────── */

export const CATEGORY_TONE: Record<NotificationCategory, Tone> = {
  ATTENDANCE: "success",
  EXAM: "accent",
  ASSIGNMENT: "warning",
  NOTICE: "cyan",
  FEE: "danger",
  MILESTONE: "success",
  SYSTEM: "muted",
};

export const CATEGORY_LABELS: Record<NotificationCategory, string> = {
  ATTENDANCE: "Attendance",
  EXAM: "Exams",
  ASSIGNMENT: "Assignments",
  NOTICE: "Notices",
  FEE: "Fees",
  MILESTONE: "Milestones",
  SYSTEM: "System",
};

/** Icon fallback so an unknown event never crashes the row. */
export const FALLBACK_ICON = BellRing;

/** Categories present in a set of notifications, in display order. */
export function categoriesIn(
  items: AppNotification[],
): NotificationCategory[] {
  const order: NotificationCategory[] = [
    "ATTENDANCE",
    "EXAM",
    "ASSIGNMENT",
    "MILESTONE",
    "NOTICE",
    "FEE",
    "SYSTEM",
  ];
  const present = new Set(
    items.map((i) => EVENT_META[i.event]?.category ?? "SYSTEM"),
  );
  return order.filter((c) => present.has(c));
}

/** Fixed reference so server and client agree on "today". */
const NOW = Date.UTC(2026, 6, 29, 4, 30, 0);
const DAY = 24 * 60 * 60 * 1000;

/** Group an inbox into Today / This week / Earlier. */
export function groupByAge(items: AppNotification[]): NotificationGroup[] {
  const today: AppNotification[] = [];
  const week: AppNotification[] = [];
  const older: AppNotification[] = [];

  for (const item of items) {
    const age = NOW - new Date(item.createdAt).getTime();
    if (age < DAY) today.push(item);
    else if (age < 7 * DAY) week.push(item);
    else older.push(item);
  }

  return [
    { label: "Today", items: today },
    { label: "This week", items: week },
    { label: "Earlier", items: older },
  ].filter((g) => g.items.length > 0);
}
