import type { InstitutionRole } from "@/types/auth";
import type { AppNotification, NotificationEvent } from "@/types/notification";
import { eventsForRoles } from "./notification";

/**
 * Notification data source.
 *
 * ─────────────────────────────────────────────────────────────────────────────
 * TODO(Dev-B): replace with the real endpoints (PAGE 15, C-RB-15; dev §12).
 *
 *   GET   /api/v1/notifications?page=&unreadOnly=     inbox, scoped to caller
 *   GET   /api/v1/notifications/unread-count          badge count (Redis cached)
 *   PATCH /api/v1/notifications/:id/read              mark one read
 *   PATCH /api/v1/notifications/read-all              mark all read
 *
 * The backend scopes by `user_id`, so the client never sends a role filter —
 * `eventsForRoles()` documents which events reach whom and drives the demo.
 * ─────────────────────────────────────────────────────────────────────────────
 */

const MIN = 60 * 1000;
const HOUR = 60 * MIN;
const DAY = 24 * HOUR;
/** Fixed base time so server and client render identically. */
const T0 = Date.UTC(2026, 6, 29, 4, 30, 0);
const ago = (ms: number) => new Date(T0 - ms).toISOString();

/** Copy + age + read-state per event, so each inbox reads believably. */
const SAMPLES: Record<
  NotificationEvent,
  { title: string; body: string; age: number; read?: boolean; href?: string }
> = {
  SUBMISSION_RECEIVED: {
    title: "8 new submissions",
    body: "Binary Trees — Worksheet 3 (CS301 · FY-A) has submissions awaiting review.",
    age: 40 * MIN,
    href: "/assignments/as1",
  },
  ASSIGNMENT_DEADLINE_NEAR: {
    title: "Deadline tomorrow",
    body: "ER Diagram Lab (CS305 · FY-A) closes in 24 hours. 11 of 32 have submitted.",
    age: 3 * HOUR,
  },
  EXAM_STARTS_SOON: {
    title: "Exam starts in 30 minutes",
    body: "Mid-term Examination — Algorithms (CS301 · FY-A), Room 201.",
    age: 20 * MIN,
    href: "/examination/e1",
  },
  NOTICE_POSTED_TO_CLASS: {
    title: "Notice posted to FY-A",
    body: "Mid-term timetable released — from the Exam Cell.",
    age: 2 * DAY,
    read: true,
  },

  TEACHER_MARKED_ATTENDANCE: {
    title: "Attendance marked · CS301",
    body: "Priya Sharma submitted attendance for FY-A, Period 2.",
    age: 55 * MIN,
  },
  EXAM_PUBLISHED_DEPT: {
    title: "Exam published in CSE",
    body: "Unit Test 2 — Databases (CS305 · FY-A) is now visible to students.",
    age: 6 * HOUR,
  },
  RESULT_RELEASED_DEPT: {
    title: "Results released · CSE",
    body: "Internal Assessment 1 results are now visible to 320 students.",
    age: 2 * DAY,
    read: true,
  },
  DEPT_NOTICE: {
    title: "Department notice",
    body: "Kavita Menon posted formatting guidelines for project reports.",
    age: 3 * DAY,
    read: true,
  },

  ATTENDANCE_MARKED: {
    title: "Marked absent · CS301",
    body: "You were marked absent for Algorithms on 28 July, Period 2.",
    age: 5 * HOUR,
  },
  EXAM_RESULT_RELEASED: {
    title: "Results are out",
    body: "Internal Assessment 1 — you scored 268/400 (67%), grade B+.",
    age: 22 * HOUR,
  },
  ASSIGNMENT_REVIEWED: {
    title: "Resubmission requested",
    body: "Recursion Practice Set — Q4 and Q6 are missing trace tables.",
    age: 4 * DAY,
    read: true,
  },
  MILESTONE_UNLOCKED: {
    title: "Milestone approved",
    body: "Phase 1 — Proposal approved. Phase 2 is now unlocked.",
    age: 6 * DAY,
    read: true,
  },
  NOTICE_POSTED: {
    title: "New notice",
    body: "Mid-term Examination postponed to 12 August — from Deepak Iyer.",
    age: 2 * HOUR,
  },
  FEE_DUE: {
    title: "Fee due in 3 days",
    body: "₹5,000 second installment is due on 15 August.",
    age: 8 * HOUR,
  },

  CHILD_ABSENT: {
    title: "Ananya was absent today",
    body: "Marked absent for Mathematics, Period 2 on 28 July.",
    age: 90 * MIN,
  },
  CHILD_RESULT_RELEASED: {
    title: "Ananya's results are out",
    body: "Internal Assessment 1 — 87%, grade A. Grade card available.",
    age: 20 * HOUR,
  },
  CLASS_NOTICE: {
    title: "Notice for Class 8-B",
    body: "Parent-teacher meeting on Saturday at 10:00 AM.",
    age: 3 * DAY,
    read: true,
  },

  EXAM_ATTEMPT_SUBMITTED: {
    title: "18 attempts submitted",
    body: "Mid-term Examination — Algorithms: 18 of 32 candidates have submitted.",
    age: 15 * MIN,
    href: "/examination/e1",
  },
  MALPRACTICE_FLAGGED: {
    title: "Malpractice flagged",
    body: "Kiran Patel — 11 tab switches during CS301 Mid-term.",
    age: 35 * MIN,
    href: "/examination/e1",
  },
  RESULT_COMPILATION_READY: {
    title: "Ready to compile",
    body: "All subject marks are in for Mid-Term Results 2024-25.",
    age: 1 * DAY,
  },

  PAYMENT_RECEIVED: {
    title: "Payment received · ₹48,000",
    body: "Aryan Mehta (ROLL142) cleared the second installment.",
    age: 25 * MIN,
  },
  OVERDUE_FINE_TRIGGERED: {
    title: "Overdue fines applied",
    body: "Late fees added to 42 overdue installments.",
    age: 4 * HOUR,
  },
  INSTALLMENT_DUE_TOMORROW: {
    title: "68 installments due tomorrow",
    body: "Reminders have been queued for students and parents.",
    age: 2 * DAY,
    read: true,
  },

  LEAVE_REQUEST_SUBMITTED: {
    title: "Leave request · Priya Sharma",
    body: "Casual leave, 2–4 August. Awaiting your approval.",
    age: 70 * MIN,
  },
  PAYROLL_RUN_DUE: {
    title: "Payroll due in 3 days",
    body: "August payroll must be run before the 25th cut-off.",
    age: 1 * DAY,
  },

  HOSTEL_STUDENT_ABSENT: {
    title: "5 absent at night attendance",
    body: "Block A — 5 residents missing at the 9:30 PM check.",
    age: 10 * HOUR,
  },
  HOSTEL_LEAVE_REQUEST: {
    title: "Leave request · Aryan Mehta",
    body: "Room A-104, 2–4 August — family function.",
    age: 3 * HOUR,
  },
  COMPLAINT_RAISED: {
    title: "New complaint · Block C",
    body: "Hot water not working on the second floor.",
    age: 2 * DAY,
    read: true,
  },

  SUPPORT_TICKET_NEW: {
    title: "New support ticket",
    body: "Login issue reported by a Class 8 parent.",
    age: 50 * MIN,
  },
  MODULE_TOGGLED: {
    title: "Hostel module enabled",
    body: "Enabled by Meera Krishnan — the Hostel Warden role is now active.",
    age: 1 * DAY,
  },
  BULK_ENROLLMENT_DONE: {
    title: "Bulk enrollment complete",
    body: "30 students imported into FY-A. 2 rows skipped — duplicate roll numbers.",
    age: 5 * DAY,
    read: true,
  },

  APPLICATION_SUBMITTED: {
    title: "42 new applications",
    body: "Infosys campus drive — applications received today.",
    age: 2 * HOUR,
  },
  DRIVE_CONFIRMED: {
    title: "Infosys confirmed the drive",
    body: "20 August, on campus. Pre-placement talk on the 18th.",
    age: 1 * DAY,
  },
  OFFER_ACCEPTED: {
    title: "Offer accepted",
    body: "Rhea Kapoor accepted the Infosys offer.",
    age: 4 * DAY,
    read: true,
  },

  ADMISSION_APPLICATION_RECEIVED: {
    title: "15 applications today",
    body: "New admission applications are awaiting first review.",
    age: 45 * MIN,
  },
  DOCUMENT_VERIFICATION_PENDING: {
    title: "34 documents to verify",
    body: "Shortlisted applicants are waiting on document verification.",
    age: 1 * DAY,
  },
};

/**
 * Build the inbox for a set of roles.
 * Mirrors `GET /api/v1/notifications` — newest first.
 */
export function getNotifications(roles: InstitutionRole[]): AppNotification[] {
  return eventsForRoles(roles)
    .map((event, i) => {
      const s = SAMPLES[event];
      return {
        id: `n${i}-${event}`,
        event,
        title: s.title,
        body: s.body,
        isRead: s.read ?? false,
        createdAt: ago(s.age),
        href: s.href,
      };
    })
    .sort((a, b) => +new Date(b.createdAt) - +new Date(a.createdAt));
}

/** Mirrors `GET /api/v1/notifications/unread-count` (Redis cached). */
export function getUnreadCount(roles: InstitutionRole[]): number {
  return getNotifications(roles).filter((n) => !n.isRead).length;
}
