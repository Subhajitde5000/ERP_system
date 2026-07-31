import type { InstitutionRole } from "@/types/auth";
import type {
  SearchHit,
  SearchKind,
  SearchPermissions,
  SearchResults,
} from "@/types/search";
import { MAX_PER_KIND, MIN_QUERY_LENGTH, matches } from "./search";

import { getClassRoster } from "./attendance-data";
import { CLASSES } from "./timetable-data";
import { getNotices } from "./notice-data";
import { noticePermissions } from "./notices";
import { getThreads } from "./discussion-data";
import { discussionPermissions } from "./discussion";
import { getAllContent } from "./content-data";
import { getAllExams } from "./examination-data";
import { getOwnAssignments, getDepartmentAssignments } from "./assignment-data";
import { getStudentDetail } from "./student-detail-data";
import { getAllReceipts, getFeeAccountFor } from "./fee-data";
import { getStaffDirectory, getStaffDetail } from "./staff-detail-data";
import { getAuditLog } from "./audit-data";
import { staffDetailPermissions } from "./staff-detail";
import { getBookIds, getBook, getBookDetail } from "./library-data";
import { bookPermissions } from "./library";

/**
 * Global search aggregator — PAGE 17 (C-RB-17).
 *
 * ─────────────────────────────────────────────────────────────────────────────
 * TODO(Dev-A + Dev-B): replace with `GET /api/v1/search?q=&kinds=`.
 *
 * The real implementation should fan out **server-side**, one scoped query
 * per kind, and is the natural home for Postgres full-text search
 * (`to_tsvector`) or an external index. The client must never receive rows it
 * then filters — that is a leak, not a search.
 *
 * Until then this queries the same fixtures the module pages use, so a hit
 * can never describe a record that doesn't exist on the page it links to.
 * ─────────────────────────────────────────────────────────────────────────────
 */

/* ── Sources with no page of their own yet ──────────────────────────────── */

/**
 * Departments and subjects have no module page, so their rows live here.
 * Everything else is read from the module that owns it.
 * TODO(Dev-A): these become `departments` (§6.1) and `subjects` (§6.4).
 */
const DEPARTMENTS = [
  { id: "cse", name: "Computer Science & Engineering", code: "CSE", hod: "Kavita Menon" },
  { id: "ece", name: "Electronics & Communication", code: "ECE", hod: "Sunil Rao" },
  { id: "mech", name: "Mechanical Engineering", code: "MECH", hod: "Rajesh Verma" },
];

const SUBJECTS = [
  { code: "CS301", name: "Algorithms", dept: "CSE" },
  { code: "CS201", name: "Data Structures", dept: "CSE" },
  { code: "CS305", name: "Databases", dept: "CSE" },
  { code: "CS307", name: "Operating Systems", dept: "CSE" },
  { code: "MA101", name: "Discrete Mathematics", dept: "CSE" },
  { code: "EC202", name: "Signals & Systems", dept: "ECE" },
];

/** Placement companies and drives (§8.4). */
const COMPANIES = [
  { id: "co1", name: "Infosys", sector: "IT Services", roles: "Systems Engineer" },
  { id: "co2", name: "TCS", sector: "IT Services", roles: "Graduate Trainee" },
  { id: "co3", name: "Zoho", sector: "Product", roles: "Member Technical Staff" },
];

const DRIVES = [
  { id: "dr1", company: "Infosys", date: "20 Aug 2026", eligible: "CSE · ECE · IT", status: "UPCOMING" },
  { id: "dr2", company: "Zoho", date: "2 Sep 2026", eligible: "CSE only", status: "UPCOMING" },
  { id: "dr3", company: "TCS", date: "12 Jul 2026", eligible: "All branches", status: "COMPLETED" },
];

/** Admission applications (§8.6). */
const APPLICATIONS = [
  { id: "ap1", no: "ADM-2024-0142", name: "Aryan Mehta", email: "aryan.mehta@abc-college.edu", status: "SHORTLISTED" },
  { id: "ap2", no: "ADM-2024-0188", name: "Nikhil Joshi", email: "nikhil.joshi@gmail.com", status: "UNDER_REVIEW" },
  { id: "ap3", no: "ADM-2024-0203", name: "Sara Qureshi", email: "sara.q@gmail.com", status: "ADMITTED" },
];

/* ── Per-kind searchers ─────────────────────────────────────────────────── */

/**
 * Each searcher returns every match for its kind; scoping and capping happen
 * in `search()`. Splitting them this way mirrors the fan-out the backend will
 * do, one query per kind.
 */
type Searcher = (q: string, roles: InstitutionRole[]) => SearchHit[];

const SEARCHERS: Record<SearchKind, Searcher> = {
  STUDENT: (q) =>
    getClassRoster()
      .filter((s) => matches(s.name, q) || matches(s.rollNo, q))
      .map((s) => ({
        id: s.id,
        kind: "STUDENT" as const,
        title: s.name,
        subtitle: s.rollNo,
        meta: getStudentDetail(s.id)?.summary.className ?? null,
        href: `/students/${s.id}`,
        matchedOn: matches(s.rollNo, q) && !matches(s.name, q) ? s.rollNo : null,
      })),

  STAFF: (q) =>
    getStaffDirectory()
      .map((row) => {
        // Read the record the way the staff page does, so a hit can't
        // describe a person the detail page renders differently.
        const perms = staffDetailPermissions(["HR_MANAGER"]);
        const detail = getStaffDetail(row.id, perms);
        return detail?.summary ?? null;
      })
      .filter((s): s is NonNullable<typeof s> => s !== null)
      .filter(
        (s) =>
          matches(s.name, q) ||
          matches(s.employeeCode, q) ||
          matches(s.designation, q),
      )
      .map((s) => ({
        id: s.id,
        kind: "STAFF" as const,
        title: s.name,
        subtitle: `${s.designation} · ${s.departmentName}`,
        meta: s.employeeCode,
        href: `/staff/${s.id}`,
        matchedOn: matches(s.employeeCode, q) && !matches(s.name, q) ? s.employeeCode : null,
      })),

  // The admin's "Users" is staff + students in one list
  USER: (q, roles) =>
    [...SEARCHERS.STAFF(q, roles), ...SEARCHERS.STUDENT(q, roles)].map((h) => ({
      ...h,
      kind: "USER" as const,
    })),

  DEPARTMENT: (q) =>
    DEPARTMENTS.filter(
      (d) => matches(d.name, q) || matches(d.code, q) || matches(d.hod, q),
    ).map((d) => ({
      id: d.id,
      kind: "DEPARTMENT" as const,
      title: d.name,
      subtitle: `HOD ${d.hod}`,
      meta: d.code,
      href: "/settings/departments",
      matchedOn: matches(d.code, q) && !matches(d.name, q) ? d.code : null,
    })),

  CLASS: (q) =>
    CLASSES.filter(
      (c) => matches(c.name, q) || matches(c.departmentName, q),
    ).map((c) => ({
      id: c.id,
      kind: "CLASS" as const,
      title: `${c.name} · ${c.departmentName}`,
      subtitle: null,
      meta: null,
      href: `/timetable?class=${c.id}`,
      matchedOn: null,
    })),

  SUBJECT: (q) =>
    SUBJECTS.filter(
      (s) => matches(s.name, q) || matches(s.code, q),
    ).map((s) => ({
      id: s.code,
      kind: "SUBJECT" as const,
      title: s.name,
      subtitle: `${s.code} · ${s.dept}`,
      meta: null,
      href: `/content?subject=${s.code}`,
      // The code is already in the subtitle — restating it adds nothing
      matchedOn: null,
    })),

  // Notices are already role-scoped in their own data layer — search passes
  // the caller's roles through rather than reading the raw table, so a hit
  // can never surface a notice the Notice Board would hide.
  NOTICE: (q, roles) =>
    getNotices(noticePermissions(roles), roles[0] ?? "STUDENT")
      .filter((n) => matches(n.title, q) || matches(n.body, q))
      .map((n) => ({
        id: n.id,
        kind: "NOTICE" as const,
        title: n.title,
        subtitle: n.author.name,
        meta: n.targetName,
        href: `/notices/${n.id}`,
        matchedOn: !matches(n.title, q) ? "in the notice body" : null,
      })),

  // Rows come from the audit page's own data layer (§10.3), so search and
  // /audit-logs can't show two different histories.
  AUDIT_LOG: (q) =>
    getAuditLog()
      .filter(
        (l) =>
          matches(l.action, q) ||
          matches(l.actorName, q) ||
          matches(l.target, q),
      )
      .map((l) => ({
      id: l.id,
      kind: "AUDIT_LOG" as const,
      title: l.action.replace(/_/g, " ").toLowerCase(),
      subtitle: l.target,
      meta: l.actorName,
      href: "/audit-logs",
      matchedOn: null,
    })),

  ASSIGNMENT: (q) => {
    // Union of own + department, deduped — the caller's scope narrows it
    const seen = new Set<string>();
    return [...getOwnAssignments(), ...getDepartmentAssignments()]
      .filter((a) => {
        if (seen.has(a.id)) return false;
        seen.add(a.id);
        return matches(a.title, q) || matches(a.subjectCode, q);
      })
      .map((a) => ({
        id: a.id,
        kind: "ASSIGNMENT" as const,
        title: a.title,
        subtitle: `${a.subjectCode} · ${a.className}`,
        meta: a.teacherName,
        href: `/assignments/${a.id}`,
        matchedOn:
          matches(a.subjectCode, q) && !matches(a.title, q)
            ? a.subjectCode
            : null,
      }));
  },

  CONTENT: (q) =>
    getAllContent()
      .filter(
        (c) =>
          matches(c.title, q) ||
          matches(c.subjectCode, q) ||
          matches(c.chapter, q),
      )
      .map((c) => ({
        id: c.id,
        kind: "CONTENT" as const,
        title: c.title,
        subtitle: `${c.subjectCode} · ${c.chapter}`,
        meta: c.contentType,
        href: `/content?item=${c.id}`,
        matchedOn:
          matches(c.chapter, q) && !matches(c.title, q) ? c.chapter : null,
      })),

  // Same for discussion: `getThreads` filters by visible scope and tag.
  DISCUSSION: (q, roles) =>
    getThreads(discussionPermissions(roles))
      .filter(
        (t) =>
          matches(t.title, q) ||
          matches(t.body, q) ||
          t.tags.some((tag) => matches(tag, q)),
      )
      .map((t) => ({
        id: t.id,
        kind: "DISCUSSION" as const,
        title: t.title,
        subtitle: `${t.scopeName} · ${t.author.name}`,
        meta: `${t.replyCount} replies`,
        href: `/discussion/${t.id}`,
        matchedOn: !matches(t.title, q)
          ? t.tags.find((tag) => matches(tag, q)) ?? "in the thread body"
          : null,
      })),

  EXAM: (q) =>
    getAllExams()
      .filter((e) => matches(e.title, q) || matches(e.subjectCode, q))
      .map((e) => ({
        id: e.id,
        kind: "EXAM" as const,
        title: e.title,
        subtitle: `${e.subjectCode} · ${e.className}`,
        meta: e.status,
        href: `/examination/${e.id}`,
        matchedOn:
          matches(e.subjectCode, q) && !matches(e.title, q)
            ? e.subjectCode
            : null,
      })),

  // Results are published per exam, so a result hit is the exam's result view
  RESULT: (q) =>
    getAllExams()
      .filter(
        (e) =>
          (e.status === "RESULTS_RELEASED" || e.status === "COMPLETED") &&
          (matches(e.title, q) || matches(e.subjectCode, q)),
      )
      .map((e) => ({
        id: `r-${e.id}`,
        kind: "RESULT" as const,
        title: `Results — ${e.title}`,
        subtitle: `${e.subjectCode} · ${e.className}`,
        meta: e.status === "RESULTS_RELEASED" ? "Published" : "Awaiting release",
        href: `/results?exam=${e.id}`,
        matchedOn: null,
      })),

  FEE_ACCOUNT: (q) =>
    getClassRoster()
      .filter((s) => matches(s.name, q) || matches(s.rollNo, q))
      .map((s) => {
        const account = getFeeAccountFor(s.id);
        return {
          id: `fa-${s.id}`,
          kind: "FEE_ACCOUNT" as const,
          title: `${s.name} — fee account`,
          subtitle: s.rollNo,
          meta: account
            ? `₹${account.balanceDue.toLocaleString("en-IN")} due`
            : null,
          href: `/fees?student=${s.id}`,
          matchedOn: null,
        };
      }),

  // Receipts come from the finance module, so a search hit quotes the same
  // receipt number and amount the fee page prints.
  RECEIPT: (q) =>
    getAllReceipts()
      .filter(
        (r) =>
          matches(r.receiptNumber, q) ||
          matches(r.studentName, q) ||
          matches(r.rollNo, q),
      )
      .map((r) => ({
        id: r.receiptNumber,
        kind: "RECEIPT" as const,
        title: r.receiptNumber,
        subtitle: `${r.studentName} · ₹${r.amount.toLocaleString("en-IN")}`,
        meta: "Paid",
        href: `/fees?student=${r.studentId}`,
        matchedOn: matches(r.receiptNumber, q) ? r.receiptNumber : null,
      })),

  BOOK: (q) =>
    getBookIds()
      .map((id) => getBook(id))
      .filter((b): b is NonNullable<typeof b> => b !== undefined)
      .filter(
        (b) =>
          matches(b.title, q) ||
          b.authors.some((a) => matches(a, q)) ||
          matches(b.isbn, q),
      )
      .map((b) => ({
        id: b.id,
        kind: "BOOK" as const,
        title: b.title,
        subtitle: b.authors.join(", "),
        meta: `${b.availableCopies}/${b.totalCopies} available`,
        href: `/library/books/${b.id}`,
        matchedOn: matches(b.isbn, q)
          ? b.isbn
          : !matches(b.title, q)
            ? b.authors.find((a) => matches(a, q)) ?? null
            : null,
      })),

  BORROWER: (q) => {
    // Read through the library module with librarian rights — the only role
    // that reaches this kind, per PAGE 24.
    const perms = bookPermissions(["LIBRARIAN"]);
    const seen = new Set<string>();
    const out: SearchHit[] = [];

    for (const bookId of getBookIds()) {
      for (const copy of getBookDetail(bookId, perms)?.copies ?? []) {
        const loan = copy.currentIssue;
        if (!loan) continue;
        if (!matches(loan.borrowerName, q) && !matches(loan.borrowerRef, q)) {
          continue;
        }
        const key = `${loan.borrowerRef}-${copy.accessionNumber}`;
        if (seen.has(key)) continue;
        seen.add(key);

        out.push({
          id: key,
          kind: "BORROWER",
          title: loan.borrowerName,
          subtitle: `${loan.borrowerRef} · ${getBook(bookId)?.title ?? ""}`,
          meta: loan.isOverdue ? `${loan.overdueDays}d overdue` : "On loan",
          href: `/library/books/${bookId}`,
          matchedOn: matches(loan.borrowerRef, q) ? loan.borrowerRef : null,
        });
      }
    }

    return out;
  },

  COMPANY: (q) =>
    COMPANIES.filter(
      (c) => matches(c.name, q) || matches(c.sector, q) || matches(c.roles, q),
    ).map((c) => ({
      id: c.id,
      kind: "COMPANY" as const,
      title: c.name,
      subtitle: c.roles,
      meta: c.sector,
      href: "/placement/dashboard",
      matchedOn: null,
    })),

  DRIVE: (q) =>
    DRIVES.filter(
      (d) => matches(d.company, q) || matches(d.eligible, q),
    ).map((d) => ({
      id: d.id,
      kind: "DRIVE" as const,
      title: `${d.company} campus drive`,
      subtitle: `${d.date} · ${d.eligible}`,
      meta: d.status,
      href: "/placement/dashboard",
      matchedOn: null,
    })),

  LEAVE_RECORD: (q) =>
    getStaffDirectory()
      .flatMap((row) => {
        const perms = staffDetailPermissions(["HR_MANAGER"]);
        const detail = getStaffDetail(row.id, perms);
        return (detail?.leaveRequests ?? []).map((l) => ({
          staff: row,
          leave: l,
        }));
      })
      .filter(
        ({ staff, leave }) =>
          matches(staff.name, q) ||
          matches(leave.policyName, q) ||
          matches(leave.reason, q),
      )
      .map(({ staff, leave }) => ({
        id: `${staff.id}-${leave.id}`,
        kind: "LEAVE_RECORD" as const,
        title: `${staff.name} — ${leave.policyName}`,
        subtitle: leave.reason,
        meta: leave.status,
        href: `/staff/${staff.id}`,
        matchedOn: null,
      })),

  APPLICATION: (q) =>
    APPLICATIONS.filter(
      (a) => matches(a.name, q) || matches(a.email, q) || matches(a.no, q),
    ).map((a) => ({
      id: a.id,
      kind: "APPLICATION" as const,
      title: a.name,
      subtitle: a.email,
      meta: a.status,
      href: "/admission/dashboard",
      matchedOn: matches(a.no, q) ? a.no : matches(a.email, q) && !matches(a.name, q) ? a.email : null,
    })),
};

/**
 * Run a query for a set of permissions.
 *
 * Only the caller's own kinds are searched — nothing is fetched and then
 * filtered away, which is what makes this safe to mirror on the backend.
 */
export function search(
  query: string,
  perms: SearchPermissions,
  roles: InstitutionRole[],
): SearchResults {
  const q = query.trim();

  if (q.length < MIN_QUERY_LENGTH) {
    return { query: q, hits: [], total: 0, kinds: [] };
  }

  const hits: SearchHit[] = [];
  const kinds: SearchKind[] = [];
  let total = 0;

  // Permission order is display order, so the role's primary kind leads
  for (const scope of perms.scopes) {
    const found = SEARCHERS[scope.kind](q, roles);
    if (found.length === 0) continue;

    total += found.length;
    kinds.push(scope.kind);
    hits.push(...found.slice(0, MAX_PER_KIND));
  }

  return { query: q, hits, total, kinds };
}

/** How many more of a kind were hidden by the per-kind cap. */
export function overflowFor(
  kind: SearchKind,
  query: string,
  roles: InstitutionRole[],
): number {
  const q = query.trim();
  if (q.length < MIN_QUERY_LENGTH) return 0;
  return Math.max(0, SEARCHERS[kind](q, roles).length - MAX_PER_KIND);
}
