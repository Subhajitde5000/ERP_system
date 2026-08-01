import type { DetailTab } from "@/types/detail";

/** Tiny className joiner — avoids pulling in clsx for one helper. */
export function cn(...classes: Array<string | false | null | undefined>) {
  return classes.filter(Boolean).join(" ");
}

/**
 * "12 Aug 2026", always in IST.
 *
 * Slicing an ISO string or formatting without a timeZone renders UTC, which
 * shifts every Indian date by 5:30 — see PROJECT_MEMORY. One implementation is
 * shared by the profile, student-detail and staff-detail pages.
 */
export function formatDate(iso: string | null | undefined): string {
  if (!iso) return "—";
  return new Date(iso).toLocaleDateString("en-IN", {
    day: "numeric",
    month: "short",
    year: "numeric",
    timeZone: "Asia/Kolkata",
  });
}

/**
 * IST offset in minutes (UTC+5:30). India has one zone and no DST, so a fixed
 * offset is correct here — the app is single-country by design (§4.2 tenant
 * settings default the timezone to Asia/Kolkata).
 */
const IST_OFFSET_MINUTES = 330;

/**
 * `<input type="date">` + `<input type="time">` → a UTC ISO instant.
 *
 * The inverse of `formatDate`. Both inputs return a **wall-clock** value in
 * the user's own zone ("2026-07-31", "10:00"), so pasting them into
 * `` `${date}T${time}:00.000Z` `` claims 10:00 *UTC* — 15:30 IST. That shifted
 * every scheduled exam forward 5½ hours and made the C-EC-03 clash check
 * compare the wrong window, so a genuine double-booking passed as "no
 * clashes". Any form that collects a date and a time must come through here.
 */
export function istToIso(date: string, time: string): string {
  if (!date || !time) return "";
  const wall = Date.parse(`${date}T${time}:00.000Z`);
  if (Number.isNaN(wall)) return "";
  return new Date(wall - IST_OFFSET_MINUTES * 60_000).toISOString();
}

/**
 * The IST calendar date of an instant, as "YYYY-MM-DD".
 *
 * `iso.slice(0, 10)` reads the **UTC** day, which is the previous date for
 * anything before 05:30 IST. Comparing that against a locally-formed "today"
 * rejected a 01:00 IST exam as being in the past.
 */
export function istDate(iso: string): string {
  const d = new Date(iso);
  if (Number.isNaN(+d)) return "";
  // en-CA formats as YYYY-MM-DD, which sorts and compares lexicographically.
  return d.toLocaleDateString("en-CA", { timeZone: "Asia/Kolkata" });
}

/** "Jul 2026" — payslip and appraisal period headings. */
export function monthLabel(year: number, month: number): string {
  return new Date(Date.UTC(year, month - 1, 1)).toLocaleDateString("en-IN", {
    month: "short",
    year: "numeric",
    timeZone: "Asia/Kolkata",
  });
}

/**
 * ₹ with Indian digit grouping.
 *
 * The sign goes outside the symbol: `Math.round(-10000).toLocaleString()`
 * returns "-10,000", which naively interpolated renders "₹-10,000" — the
 * minus inside the currency. Negative amounts are rare in this app but real
 * (an MRR delta on a downgrade, C-SL-04), and "-₹10,000" is the correct form.
 */
export function rupees(amount: number): string {
  const n = Math.round(amount);
  return `${n < 0 ? "-" : ""}₹${Math.abs(n).toLocaleString("en-IN")}`;
}

/** Day counts may be halves (`leave_requests.total_days` is NUMERIC(4,1)). */
export function days(value: number): string {
  return value % 1 === 0 ? String(value) : value.toFixed(1);
}

/**
 * Union two tab lists for a multi-role user.
 * First occurrence wins, and a wider grant (no scope note) supersedes a
 * narrowed one — a user who is both HOD and Principal sees institution scope.
 */
export function mergeTabLists<K extends string, T extends DetailTab<K>>(
  acc: T[],
  next: T[],
): T[] {
  const merged = [...acc];

  for (const tab of next) {
    const existing = merged.findIndex((t) => t.key === tab.key);
    if (existing === -1) merged.push(tab);
    else if (!tab.scopeNote) merged[existing] = tab;
  }

  return merged;
}
