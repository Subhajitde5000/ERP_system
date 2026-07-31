import {
  BadgeIndianRupee,
  Book,
  Boxes,
  Building2,
  CalendarClock,
  FileBadge,
  FileSpreadsheet,
  FileText,
  GraduationCap,
  Handshake,
  Library,
  Megaphone,
  MessagesSquare,
  Receipt,
  ScrollText,
  UserRound,
  Users,
} from "lucide-react";

import type { InstitutionRole } from "@/types/auth";
import type {
  SearchKind,
  SearchKindMeta,
  SearchPermissions,
  SearchScope,
} from "@/types/search";

/**
 * Global search role logic — role_based_shared_pages.md PAGE 17 (C-RB-17).
 *
 * "One URL. Results scoped by role." Every role gets the same page; the
 * *entity kinds* differ. Same content-filter pattern as notifications
 * (PAGE 15) and the calendar (PAGE 18) — a data table, not a view dispatch.
 *
 * PAGE 17 phrases several rows with a scope ("Students in own class",
 * "…in own dept"), so the narrowing travels with the kind and is stated in
 * the UI rather than applied invisibly.
 *
 * ── Deviations, flagged in the README ─────────────────────────────────────
 *
 * 1. PAGE 17 names 10 roles. The other 8 are resolved from §6 and from the
 *    page each role already owns: Mentor mirrors Teacher (teacher-level per
 *    §2.2), VP mirrors Principal, and Principal/Coordinator/Parent/Warden/
 *    Transport/Store get the kinds their own dashboards already surface.
 *    Nobody gets an empty search box — the doc says the bar is "available to
 *    all roles".
 *
 * 2. Every kind here is one the caller can already reach by navigating. Search
 *    is a shortcut, never a privilege escalation — e.g. the Teacher searches
 *    students in their own classes, matching PAGE 19's teacher tab set.
 *
 * TODO(Dev-B): the backend must apply the same scoping per kind. Search fans
 * out across modules, so an unscoped query is the easiest place to leak.
 */

const S = (
  kind: SearchKind,
  scopeNote?: string,
  matchHint?: string,
): SearchScope => ({ kind, scopeNote, matchHint });

const PERMISSIONS: Record<InstitutionRole, SearchPermissions> = {
  // "Users, departments, classes, subjects, notices, audit logs"
  INSTITUTION_ADMIN: {
    scopes: [
      S("USER", undefined, "name, email or employee code"),
      S("DEPARTMENT"),
      S("CLASS"),
      S("SUBJECT"),
      S("NOTICE"),
      S("AUDIT_LOG"),
    ],
    placeholder: "Search users, classes, subjects, notices…",
    note: "Everything across the institution.",
  },

  // "Students in own class, own assignments, own content, notices"
  TEACHER: teacherScopes(),
  // Mentor is teacher-level (§2.2) — same reach over their own groups
  MENTOR: teacherScopes(),

  // "Content (notes/videos), notices, discussion threads, exams"
  STUDENT: {
    scopes: [
      S("CONTENT", "your subjects"),
      S("NOTICE"),
      S("DISCUSSION"),
      S("EXAM", "your class"),
    ],
    placeholder: "Search notes, notices, discussions, exams…",
    note: "Study material, notices, discussions and your exams.",
  },

  // "Teachers, classes, assignments, results in own dept"
  HOD: {
    scopes: [
      S("STAFF", "your department", "name or employee code"),
      S("CLASS", "your department"),
      S("ASSIGNMENT", "your department"),
      S("RESULT", "your department"),
    ],
    placeholder: "Search teachers, classes, assignments, results…",
    note: "Your department's teachers, classes and coursework.",
  },

  // "Exams, students (by roll no), results"
  EXAM_CONTROLLER: {
    scopes: [
      S("EXAM"),
      S("STUDENT", undefined, "roll number"),
      S("RESULT"),
    ],
    placeholder: "Search exams, roll numbers, results…",
    note: "Exams, candidates and result publications.",
  },

  // "Students (by name/roll), fee accounts, receipts"
  ACCOUNTANT: {
    scopes: [
      S("STUDENT", undefined, "name or roll number"),
      S("FEE_ACCOUNT"),
      S("RECEIPT", undefined, "receipt number"),
    ],
    placeholder: "Search students, fee accounts, receipts…",
    note: "Student fee accounts and payment records.",
  },

  // "Books by title/author/ISBN, borrowers"
  LIBRARIAN: {
    scopes: [
      S("BOOK", undefined, "title, author or ISBN"),
      S("BORROWER", undefined, "name or roll number"),
    ],
    placeholder: "Search by title, author, ISBN or borrower…",
    note: "The catalogue and everyone currently holding a book.",
  },

  // "Students, companies, drives"
  PLACEMENT_OFFICER: {
    scopes: [S("STUDENT"), S("COMPANY"), S("DRIVE")],
    placeholder: "Search students, companies, drives…",
    note: "Candidates, recruiters and campus drives.",
  },

  // "Staff by name/employee code, leave records"
  HR_MANAGER: {
    scopes: [
      S("STAFF", undefined, "name or employee code"),
      S("LEAVE_RECORD"),
    ],
    placeholder: "Search staff or employee codes…",
    note: "Staff records and leave history.",
  },

  // "Applications by name/email/application no"
  ADMISSION_OFFICER: {
    scopes: [
      S("APPLICATION", undefined, "name, email or application number"),
    ],
    placeholder: "Search applications by name, email or number…",
    note: "Admission applications for the current cycle.",
  },

  /* ── Not in the PAGE 17 table — resolved from §6 ──────────────────────── */

  // §4.3: institution-wide academic authority, read-only
  PRINCIPAL: leadershipScopes(),
  // §5.3: Principal's scope minus final approval — same things to find
  VICE_PRINCIPAL: leadershipScopes(),

  // §4: schedules exams and timetables across classes
  ACADEMIC_COORDINATOR: {
    scopes: [S("EXAM"), S("CLASS"), S("SUBJECT"), S("NOTICE")],
    placeholder: "Search exams, classes, subjects…",
    note: "Scheduling: exams, classes and subjects.",
  },

  // Own child only, mirroring the parent views elsewhere
  PARENT: {
    scopes: [
      S("NOTICE"),
      S("EXAM", "your child's class"),
      S("RESULT", "your child"),
    ],
    placeholder: "Search notices, exams, results…",
    note: "Notices and your child's exams and results.",
  },

  // §5.1: residents of their blocks
  HOSTEL_WARDEN: {
    scopes: [S("STUDENT", "hostel residents", "name or room number"), S("NOTICE")],
    placeholder: "Search residents or rooms…",
    note: "Hostel residents and notices.",
  },

  // Route/stop assignments are per student
  TRANSPORT_MANAGER: {
    scopes: [S("STUDENT", "assigned to a route"), S("NOTICE")],
    placeholder: "Search students on your routes…",
    note: "Students assigned to transport routes.",
  },

  // §5.6: stock and requests, no people
  STORE_MANAGER: {
    scopes: [S("NOTICE")],
    placeholder: "Search notices…",
    note: "Notices. Inventory search lives in the Inventory module.",
  },
};

function teacherScopes(): SearchPermissions {
  return {
    scopes: [
      S("STUDENT", "your classes", "name or roll number"),
      S("ASSIGNMENT", "yours"),
      S("CONTENT", "yours"),
      S("NOTICE"),
    ],
    placeholder: "Search students, assignments, content, notices…",
    note: "Your students, coursework and notices.",
  };
}

function leadershipScopes(): SearchPermissions {
  return {
    scopes: [
      S("STAFF", undefined, "name or employee code"),
      S("STUDENT"),
      S("CLASS"),
      S("EXAM"),
      S("RESULT"),
      S("NOTICE"),
    ],
    placeholder: "Search staff, students, classes, exams…",
    note: "Institution-wide records, read-only.",
  };
}

/**
 * Searchable kinds for a set of roles.
 * Multi-role users get the union; the first occurrence wins, and an unscoped
 * grant supersedes a narrowed one (a user who is both Teacher and Principal
 * searches all students, not just their own classes).
 */
export function searchPermissions(
  roles: InstitutionRole[],
): SearchPermissions {
  const [first, ...rest] = roles;
  const base = PERMISSIONS[first ?? "STUDENT"];
  if (!rest.length) return base;

  return rest.reduce<SearchPermissions>((acc, role) => {
    const next = PERMISSIONS[role];
    const scopes = [...acc.scopes];

    for (const scope of next.scopes) {
      const at = scopes.findIndex((s) => s.kind === scope.kind);
      if (at === -1) scopes.push(scope);
      else if (!scope.scopeNote) scopes[at] = scope;
    }

    return {
      scopes,
      placeholder: "Search across everything you can see…",
      note: acc.note,
    };
  }, base);
}

/* ── Presentation ───────────────────────────────────────────────────────── */

export const KIND_META: Record<SearchKind, SearchKindMeta> = {
  USER: { label: "User", plural: "Users", icon: UserRound, tone: "accent" },
  STAFF: { label: "Staff", plural: "Staff", icon: Users, tone: "accent" },
  STUDENT: {
    label: "Student",
    plural: "Students",
    icon: GraduationCap,
    tone: "cyan",
  },
  DEPARTMENT: {
    label: "Department",
    plural: "Departments",
    icon: Building2,
    tone: "muted",
  },
  CLASS: { label: "Class", plural: "Classes", icon: Users, tone: "muted" },
  SUBJECT: {
    label: "Subject",
    plural: "Subjects",
    icon: Book,
    tone: "muted",
  },
  NOTICE: {
    label: "Notice",
    plural: "Notices",
    icon: Megaphone,
    tone: "warning",
  },
  AUDIT_LOG: {
    label: "Audit log",
    plural: "Audit logs",
    icon: ScrollText,
    tone: "muted",
  },
  ASSIGNMENT: {
    label: "Assignment",
    plural: "Assignments",
    icon: FileText,
    tone: "accent",
  },
  CONTENT: {
    label: "Content",
    plural: "Study material",
    icon: Book,
    tone: "success",
  },
  DISCUSSION: {
    label: "Thread",
    plural: "Discussions",
    icon: MessagesSquare,
    tone: "cyan",
  },
  EXAM: {
    label: "Exam",
    plural: "Exams",
    icon: FileSpreadsheet,
    tone: "danger",
  },
  RESULT: {
    label: "Result",
    plural: "Results",
    icon: GraduationCap,
    tone: "success",
  },
  FEE_ACCOUNT: {
    label: "Fee account",
    plural: "Fee accounts",
    icon: BadgeIndianRupee,
    tone: "warning",
  },
  RECEIPT: {
    label: "Receipt",
    plural: "Receipts",
    icon: Receipt,
    tone: "success",
  },
  BOOK: { label: "Book", plural: "Books", icon: Library, tone: "accent" },
  BORROWER: {
    label: "Borrower",
    plural: "Borrowers",
    icon: UserRound,
    tone: "cyan",
  },
  COMPANY: {
    label: "Company",
    plural: "Companies",
    icon: Handshake,
    tone: "accent",
  },
  DRIVE: {
    label: "Drive",
    plural: "Placement drives",
    icon: Boxes,
    tone: "cyan",
  },
  LEAVE_RECORD: {
    label: "Leave",
    plural: "Leave records",
    icon: CalendarClock,
    tone: "warning",
  },
  APPLICATION: {
    label: "Application",
    plural: "Applications",
    icon: FileBadge,
    tone: "accent",
  },
};

/** Shortest query worth running — one character matches half the institution. */
export const MIN_QUERY_LENGTH = 2;

/** Per-kind cap, so one noisy kind can't bury the rest. */
export const MAX_PER_KIND = 5;

/**
 * Case- and accent-insensitive substring test.
 * Also strips punctuation so "978-0262046305" matches "9780262046305" — a
 * user typing an ISBN or a receipt number rarely reproduces the hyphens.
 */
export function matches(haystack: string | null | undefined, needle: string) {
  if (!haystack) return false;
  const norm = (v: string) =>
    v
      .toLowerCase()
      .normalize("NFD")
      .replace(/[\u0300-\u036f]/g, "")
      .replace(/[^a-z0-9]/g, "");
  return norm(haystack).includes(norm(needle));
}

/**
 * A representative example per kind, so an empty search box still teaches
 * what it can do. Presentation only — the values are drawn from the same
 * fixtures the searchers read.
 */
export function exampleFor(kind: SearchKind): string | null {
  const samples: Partial<Record<SearchKind, string>> = {
    STUDENT: "Aryan",
    STAFF: "Priya",
    USER: "Priya",
    BOOK: "Algorithms",
    SUBJECT: "CS301",
    EXAM: "Mid-term",
    NOTICE: "exam",
    CONTENT: "Binary",
    DISCUSSION: "quicksort",
    APPLICATION: "ADM-2024",
    COMPANY: "Infosys",
    DEPARTMENT: "CSE",
  };
  return samples[kind] ?? null;
}

/**
 * Split a string around the matched run so the UI can bold it.
 * Falls back to a single unmatched chunk when the hit came from punctuation
 * normalisation (e.g. an ISBN typed without hyphens).
 */
export function highlight(
  text: string,
  query: string,
): { text: string; hit: boolean }[] {
  const at = text.toLowerCase().indexOf(query.toLowerCase().trim());
  if (at === -1 || !query.trim()) return [{ text, hit: false }];

  return [
    { text: text.slice(0, at), hit: false },
    { text: text.slice(at, at + query.trim().length), hit: true },
    { text: text.slice(at + query.trim().length), hit: false },
  ].filter((p) => p.text.length > 0);
}
