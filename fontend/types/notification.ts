import type { LucideIcon } from "lucide-react";

/**
 * Notification contracts — role_based_shared_pages.md PAGE 15 (C-RB-15).
 * Mirrors the `notifications` table in database_design_complete.md §10.1.
 */

/** `type` column (DB §10.1) — the broad category driving icon and colour. */
export type NotificationCategory =
  | "ATTENDANCE"
  | "EXAM"
  | "ASSIGNMENT"
  | "NOTICE"
  | "FEE"
  | "MILESTONE"
  | "SYSTEM";

/**
 * The concrete events from the PAGE 15 matrix.
 *
 * `<NotificationItem>` takes this as its `type` prop and derives the icon,
 * colour and deep-link from it — exactly as the doc specifies — so the item
 * component holds no role logic of its own.
 */
export type NotificationEvent =
  // Teacher
  | "SUBMISSION_RECEIVED"
  | "ASSIGNMENT_DEADLINE_NEAR"
  | "EXAM_STARTS_SOON"
  | "NOTICE_POSTED_TO_CLASS"
  // HOD
  | "TEACHER_MARKED_ATTENDANCE"
  | "EXAM_PUBLISHED_DEPT"
  | "RESULT_RELEASED_DEPT"
  | "DEPT_NOTICE"
  // Student
  | "ATTENDANCE_MARKED"
  | "EXAM_RESULT_RELEASED"
  | "ASSIGNMENT_REVIEWED"
  | "MILESTONE_UNLOCKED"
  | "NOTICE_POSTED"
  | "FEE_DUE"
  // Parent
  | "CHILD_ABSENT"
  | "CHILD_RESULT_RELEASED"
  | "CLASS_NOTICE"
  // Exam Controller
  | "EXAM_ATTEMPT_SUBMITTED"
  | "MALPRACTICE_FLAGGED"
  | "RESULT_COMPILATION_READY"
  // Accountant
  | "PAYMENT_RECEIVED"
  | "OVERDUE_FINE_TRIGGERED"
  | "INSTALLMENT_DUE_TOMORROW"
  // HR Manager
  | "LEAVE_REQUEST_SUBMITTED"
  | "PAYROLL_RUN_DUE"
  // Hostel Warden
  | "HOSTEL_STUDENT_ABSENT"
  | "HOSTEL_LEAVE_REQUEST"
  | "COMPLAINT_RAISED"
  // Institution Admin
  | "SUPPORT_TICKET_NEW"
  | "MODULE_TOGGLED"
  | "BULK_ENROLLMENT_DONE"
  // Placement Officer
  | "APPLICATION_SUBMITTED"
  | "DRIVE_CONFIRMED"
  | "OFFER_ACCEPTED"
  // Admission Officer
  | "ADMISSION_APPLICATION_RECEIVED"
  | "DOCUMENT_VERIFICATION_PENDING";

/** Static metadata per event — icon, colour, deep link, category. */
export interface EventMeta {
  category: NotificationCategory;
  icon: LucideIcon;
  /** Where clicking the notification takes you (DB §10.1 `data` deep-link) */
  href: string;
  /** Urgent events sit above the fold with an accent edge */
  urgent?: boolean;
}

export interface AppNotification {
  id: string;
  event: NotificationEvent;
  title: string;
  body: string;
  isRead: boolean;
  createdAt: string;
  /** Overrides the event's default deep link when the row targets a record */
  href?: string;
}

/** Grouping used by the inbox — today / earlier this week / older. */
export interface NotificationGroup {
  label: string;
  items: AppNotification[];
}
