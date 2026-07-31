/**
 * Shared contracts for the "one URL, different tabs per role" detail pages —
 * role_based_shared_pages.md PAGE 19 (student) and PAGE 20 (staff).
 *
 * Both pages express their role matrix as a tab list, so the tab shape and the
 * layout that renders it live here rather than being written twice.
 */

export interface DetailTab<K extends string = string> {
  key: K;
  label: string;
  /** Clarifies a narrowed scope, e.g. "your department" for a HOD */
  scopeNote?: string;
}
