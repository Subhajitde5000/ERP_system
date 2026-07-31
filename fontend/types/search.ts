import type { LucideIcon } from "lucide-react";

/**
 * Global search contracts — role_based_shared_pages.md PAGE 17 (C-RB-17).
 *
 * Search has no table of its own: it queries the modules that already exist.
 * Like notifications (PAGE 15) and the calendar (PAGE 18), this is a
 * **content filter** — every role gets the same page, only the entity kinds
 * they may search differ.
 */

/**
 * Every entity kind named in the PAGE 17 matrix.
 * These map to the tables the backend will actually query.
 */
export type SearchKind =
  | "USER" // users (§5.5) — admin's "Users"
  | "STAFF" // users + staff_profiles (§8.5) — HR / HOD "Teachers"
  | "STUDENT" // users + student_enrollments (§6.6)
  | "DEPARTMENT" // departments (§6.1)
  | "CLASS" // classes (§6.3)
  | "SUBJECT" // subjects (§6.4)
  | "NOTICE" // notices (§7.4)
  | "AUDIT_LOG" // audit_logs (§10)
  | "ASSIGNMENT" // assignments (§7.3)
  | "CONTENT" // content_items (§7.6)
  | "DISCUSSION" // discussion_threads (§7.5)
  | "EXAM" // exams (§7.2)
  | "RESULT" // result_publications (§7.7)
  | "FEE_ACCOUNT" // fee_accounts (§9)
  | "RECEIPT" // fee_payments (§9)
  | "BOOK" // books (§8.1)
  | "BORROWER" // book_issues → users (§8.1)
  | "COMPANY" // placement_companies (§8.4)
  | "DRIVE" // placement_drives (§8.4)
  | "LEAVE_RECORD" // leave_requests (§8.5)
  | "APPLICATION"; // admission_applications (§8.6)

/** Display metadata for a kind — icon, label, and where a hit links to. */
export interface SearchKindMeta {
  label: string;
  /** Plural heading for the grouped results */
  plural: string;
  icon: LucideIcon;
  /** Tailwind tone key from the shared palette */
  tone: "accent" | "cyan" | "success" | "warning" | "danger" | "muted";
}

/**
 * What a role may search, and how far.
 *
 * PAGE 17 scopes several roles explicitly ("Students in own class", "…in own
 * dept"), so the scope note travels with the kind and is shown in the UI
 * rather than silently narrowing the results.
 */
export interface SearchScope {
  kind: SearchKind;
  /** e.g. "your classes", "your department" — omitted when unscoped */
  scopeNote?: string;
  /**
   * Fields PAGE 17 calls out explicitly, e.g. Librarian searches books
   * "by title/author/ISBN". Shown as a hint under the search box.
   */
  matchHint?: string;
}

export interface SearchPermissions {
  /** Entity kinds this role may search, in display order */
  scopes: SearchScope[];
  /** Placeholder tuned to what the role can actually find */
  placeholder: string;
  note: string;
}

/** One hit. `kind` decides the icon, heading group and link target. */
export interface SearchHit {
  id: string;
  kind: SearchKind;
  title: string;
  /** Second line — roll number, subject code, department, etc. */
  subtitle: string | null;
  /** Small trailing chip, e.g. a status or a date */
  meta: string | null;
  href: string;
  /**
   * The substring that matched, so the UI can explain *why* a row is here
   * even when the match was on a field that isn't displayed (an ISBN, say).
   */
  matchedOn: string | null;
}

export interface SearchResults {
  query: string;
  hits: SearchHit[];
  /** Total across every kind, before the per-kind cap */
  total: number;
  /** Kinds that produced at least one hit, in permission order */
  kinds: SearchKind[];
}
