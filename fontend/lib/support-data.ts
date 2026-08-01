import type {
  InstitutionSnapshot,
  SupportStats,
  TicketDetail,
  TicketPriority,
  TicketReply,
  TicketRow,
  TicketStatus,
} from "@/types/support";
import { byTriage, CURRENT_AGENT, isOpenTicket } from "./support";
import {
  getPlans,
  getTenant,
  getTenantAdminName,
  getTenants,
} from "./platform-data";
import { getAuditLog } from "./audit-data";

/**
 * Support data source — C-SP-01…C-SP-04.
 *
 * ─────────────────────────────────────────────────────────────────────────────
 * TODO(Dev-A): the platform support API (assignment doc §2.2):
 *
 *   GET   /api/v1/platform/tickets                 list + filters
 *   PATCH /api/v1/platform/tickets/:id             status / assignee
 *   GET   /api/v1/platform/tickets/:id             ticket + replies
 *   POST  /api/v1/platform/tickets/:id/reply       add a reply
 *   GET   /api/v1/platform/institutions/:id/readonly   C-SP-04 snapshot
 *
 * The read-only endpoint must be genuinely read-only server-side: §4.1 says
 * Support "cannot modify institution data or settings", so there is no
 * corresponding PATCH and the UI never offers one.
 *
 * Tenants come from `platform-data`, so a ticket can't reference an
 * institution the platform console doesn't list.
 * ─────────────────────────────────────────────────────────────────────────────
 */

const HOUR = 60 * 60 * 1000;
const DAY = 24 * HOUR;
/** Same T0 as every other fixture. */
const T0 = Date.UTC(2026, 6, 29);
const at = (hoursAgo: number) => new Date(T0 - hoursAgo * HOUR).toISOString();

/** "PAST DUE" → "Past due". Only the first word is capitalised. */
function sentenceCase(value: string): string {
  const lower = value.toLowerCase();
  return lower.charAt(0).toUpperCase() + lower.slice(1);
}

/* ── §4.6 support_tickets ───────────────────────────────────────────────── */

/**
 * [hoursAgo, tenantSlug, subject, priority, status, assigneeId|null]
 *
 * Deliberately spread across states so every filter has something to show and
 * the agent's primary actions are demoable: unassigned tickets to claim,
 * breaching ones to triage, and a couple already resolved.
 *
 * Who raised it is **not** in the seed: it is the tenant's Institution Admin,
 * read from `getTenantAdminName` (§5.5/§5.6). Typing the name per row let the
 * same institution appear under two different contacts across the Support,
 * Sales and Super Admin consoles.
 */
type Seed = [
  number,
  string,
  string,
  TicketPriority,
  TicketStatus,
  string | null,
];

const SEED: Seed[] = [
  [2, "metro-institute", "Teachers cannot mark attendance since this morning", "CRITICAL", "OPEN", null],
  [6, "abc-college", "Placement module missing after we enabled it", "HIGH", "IN_PROGRESS", "pu-2"],
  [9, "dps-school", "Bulk student import fails at row 240", "HIGH", "OPEN", "pu-2"],
  [26, "metro-institute", "Invoice shows last month's plan price", "MEDIUM", "IN_PROGRESS", "pu-3"],
  [30, "greenwood-high", "How do we extend our trial?", "LOW", "OPEN", null],
  [52, "nova-university", "SSO login loops back to the sign-in page", "CRITICAL", "IN_PROGRESS", "pu-2"],
  [70, "heritage-school", "Parent accounts not receiving notification emails", "MEDIUM", "OPEN", "pu-3"],
  // Resolved within the last day so "resolved today" isn't permanently 0 —
  // a KPI that never moves reads as broken (the fixture-state trap).
  [96, "metro-institute", "Request: raise student cap to 2500", "LOW", "RESOLVED", "pu-2"],
  [30, "abc-college", "Timetable clash report shows stale data", "MEDIUM", "RESOLVED", "pu-2"],
  [400, "dps-school", "Transport route CSV upload rejected", "LOW", "CLOSED", "pu-3"],
];

/** How long ago each resolved ticket was actually closed. */
const RESOLVED_HOURS_AGO: Record<number, number> = { 7: 5, 8: 20, 9: 300 };

/** `platform_users` ids → names, for the assignee join (§4.5). */
const AGENTS: Record<string, string> = {
  "pu-2": "Nandini Rao",
  "pu-3": "Imtiaz Khan",
};

/**
 * Reply threads.
 *
 * TODO(Dev-A): `ticket_replies` does not exist in §4.6 — see `types/support.ts`.
 * Keyed by ticket index so a thread can't drift from its ticket.
 * [hoursAgo, authorKind, body, isInternal]
 */
const REPLIES: Record<number, [number, "SUPPORT" | "INSTITUTION", string, boolean][]> = {
  1: [
    [5, "SUPPORT", "Thanks for flagging. I can see Placement is enabled on your plan — checking whether the role assignment ran.", false],
    [4, "SUPPORT", "Confirmed: the module toggle wrote, but no Placement Officer has been assigned yet, so nobody sees the nav item.", true],
    [3, "SUPPORT", "Your plan does include Placement. Someone needs the Placement Officer role assigned under Settings → Users before the section appears. Shall I walk you through it?", false],
    [1, "INSTITUTION", "That was it — assigned it to Vikram and the menu is there now. Thank you!", false],
  ],
  5: [
    [50, "INSTITUTION", "Around 40 staff are affected. Started after yesterday's maintenance window.", false],
    [48, "SUPPORT", "Looking now. Your SSO is Microsoft Entra ID — I suspect the reply URL changed.", false],
    [44, "SUPPORT", "Entra tenant returns AADSTS50011: redirect URI mismatch. Needs the new callback allow-listed on their side.", true],
  ],
  3: [
    [24, "INSTITUTION", "The amount on invoice INV-2026-118 is the old Standard price.", false],
    [20, "SUPPORT", "You upgraded mid-cycle, so that invoice covers the period before the change. The next one will show the new rate, prorated.", false],
  ],
  7: [
    [90, "SUPPORT", "Raised the cap to 2,500 on your Standard plan. No change to billing this cycle.", false],
    [88, "INSTITUTION", "Confirmed, thanks.", false],
  ],
};

function buildTickets(): TicketRow[] {
  const tenants = getTenants();

  return SEED.map(
    ([hoursAgo, slug, subject, priority, status, assignee], i) => {
      const tenant = tenants.find((t) => t.slug === slug);
      const resolved = status === "RESOLVED" || status === "CLOSED";
      const replies = REPLIES[i] ?? [];

      return {
        id: `tkt-${i + 1}`,
        reference: `TKT-${1040 + i}`,
        subject,
        description: DESCRIPTIONS[i] ?? subject,
        priority,
        status,
        tenantId: tenant?.id ?? `t-${slug}`,
        tenantName: tenant?.name ?? slug,
        tenantSlug: slug,
        raisedByName: getTenantAdminName(slug),
        raisedByRole: "Institution Admin",
        assignedToId: assignee,
        assignedToName: assignee ? (AGENTS[assignee] ?? null) : null,
        createdAt: at(hoursAgo),
        // Last touched = the newest reply, else when it was raised
        updatedAt: replies.length
          ? at(Math.min(...replies.map(([h]) => h)))
          : at(hoursAgo),
        // Resolved a few hours ago regardless of when it was raised — an old
        // ticket closed this morning is the normal case.
        resolvedAt: resolved ? at(RESOLVED_HOURS_AGO[i] ?? 6) : null,
        replyCount: replies.length,
        ageHours: hoursAgo,
      };
    },
  );
}

/** Longer body text, so the detail page isn't just the subject twice. */
const DESCRIPTIONS: Record<number, string> = {
  0: "Since about 08:00 IST none of our teachers can save attendance. The Mark Attendance screen loads, but submitting shows a spinner and never completes. Roughly 120 staff are affected across all departments. This is blocking today's records entirely.",
  1: "We enabled the Placement module from Settings → Modules two days ago. The toggle shows as on, but no Placement section appears in the sidebar for anyone, including me as admin.",
  2: "Uploading our student CSV fails consistently at row 240 with a generic error. The file has 1,418 rows and validated fine in the template checker. I can share the file if that helps.",
  3: "Invoice INV-2026-118 charges us the Standard rate, but we moved to Premium on the 3rd. Could you check whether the upgrade was applied before billing ran?",
  4: "Our 30-day trial ends next week and we are still evaluating. Is it possible to extend by a couple of weeks, and what happens to our data if we do not convert?",
  5: "Staff clicking Sign in with Microsoft are bounced back to the login page with no error. Started after yesterday's maintenance. Password login still works.",
  6: "Parents are not receiving the notification emails for attendance alerts. In-app notifications appear correctly. We have checked spam folders.",
  7: "We are approaching our 2,000 student limit ahead of next term's intake. Could the cap be raised to 2,500?",
  8: "The timetable conflict report lists six clashes that we already resolved last week. Refreshing does not clear them.",
  9: "Our transport route CSV is rejected with 'invalid stop order' even though the stop_order column is sequential from 1.",
};

/* ── Public reads ───────────────────────────────────────────────────────── */

export function getTickets(): TicketRow[] {
  return buildTickets().sort(byTriage);
}

export function getTicketIds(): string[] {
  return buildTickets().map((t) => t.id);
}

export function getTicket(id: string): TicketRow | undefined {
  return buildTickets().find((t) => t.id === id);
}

export function getTicketDetail(id: string): TicketDetail | undefined {
  const ticket = getTicket(id);
  if (!ticket) return undefined;

  const index = Number(id.replace("tkt-", "")) - 1;
  const replies: TicketReply[] = (REPLIES[index] ?? [])
    .map(([hoursAgo, authorKind, body, isInternal], i) => ({
      id: `${id}-r${i + 1}`,
      authorName:
        authorKind === "SUPPORT"
          ? (ticket.assignedToName ?? CURRENT_AGENT.name)
          : ticket.raisedByName,
      authorKind,
      authorRole: authorKind === "SUPPORT" ? "Support Staff" : ticket.raisedByRole,
      body,
      isInternal,
      createdAt: at(hoursAgo),
    }))
    // Oldest first — a thread reads top to bottom
    .sort((a, b) => a.createdAt.localeCompare(b.createdAt));

  return { ticket, replies };
}

/* ── C-SP-01 dashboard ──────────────────────────────────────────────────── */

export function getSupportStats(): SupportStats {
  const all = buildTickets();
  const open = all.filter(isOpenTicket);

  const byPriority = (["CRITICAL", "HIGH", "MEDIUM", "LOW"] as TicketPriority[]).map(
    (priority) => ({
      priority,
      count: open.filter((t) => t.priority === priority).length,
    }),
  );

  return {
    open: all.filter((t) => t.status === "OPEN").length,
    inProgress: all.filter((t) => t.status === "IN_PROGRESS").length,
    // "Today" is the last 24h against the fixture clock
    resolvedToday: all.filter(
      (t) => t.resolvedAt !== null && Date.parse(t.resolvedAt) > T0 - DAY,
    ).length,
    unassigned: open.filter((t) => t.assignedToId === null).length,
    mine: open.filter((t) => t.assignedToId === CURRENT_AGENT.id).length,
    byPriority,
    oldestOpen: [...open].sort((a, b) => b.ageHours - a.ageHours).slice(0, 5),
    myQueue: open
      .filter((t) => t.assignedToId === CURRENT_AGENT.id)
      .sort(byTriage),
  };
}

/* ── C-SP-04 read-only institution view ─────────────────────────────────── */

/**
 * A diagnostic snapshot, not the institution app behind a support login.
 *
 * §4.1 limits Support to "view institution data in read-only mode (for
 * debugging)". What debugging actually needs is configuration and health —
 * is the plan right, are modules on, are they over cap, what changed
 * recently. Student records, marks and fee accounts are none of a support
 * agent's business, so they are not in this payload at all.
 */
export function getInstitutionSnapshot(
  tenantId: string,
): InstitutionSnapshot | undefined {
  const tenant = getTenant(tenantId);
  if (!tenant) return undefined;

  const plan = getPlans().find((p) => p.slug === tenant.planSlug);
  const overStudents =
    plan !== undefined && plan.maxStudents !== -1 && tenant.studentCount > plan.maxStudents;
  const overStorage =
    plan !== undefined && tenant.storageUsedGb > plan.maxStorageGb;
  const modulesOutsidePlan = tenant.enabledModules.filter(
    (m) => plan !== undefined && !plan.allowedModules.includes(m),
  );

  return {
    tenantId: tenant.id,
    tenantName: tenant.name,
    tenantSlug: tenant.slug,
    type: tenant.type,
    planName: tenant.planName,
    isActive: tenant.isActive,
    status: tenant.status,
    createdAt: tenant.createdAt,

    // The checks an agent runs before reading any logs
    checks: [
      {
        label: "Sign-in enabled",
        value: tenant.isActive ? "Yes" : "No — tenant suspended",
        ok: tenant.isActive,
        hint: tenant.isActive
          ? undefined
          : "Every user is blocked until a Super Admin reactivates it.",
      },
      {
        label: "Subscription",
        value: sentenceCase(tenant.status.replace("_", " ")),
        ok: tenant.status === "ACTIVE" || tenant.status === "TRIAL",
        hint:
          tenant.status === "PAST_DUE"
            ? "Billing has failed; Finance owns the follow-up."
            : undefined,
      },
      {
        label: "Student capacity",
        value: `${tenant.studentCount.toLocaleString("en-IN")} of ${plan?.maxStudents === -1 ? "unlimited" : (plan?.maxStudents.toLocaleString("en-IN") ?? "—")}`,
        ok: !overStudents,
        hint: overStudents ? "Over the plan cap — new enrolments will fail." : undefined,
      },
      {
        label: "Storage",
        value: `${tenant.storageUsedGb} GB of ${plan?.maxStorageGb ?? 0} GB`,
        ok: !overStorage,
        hint: overStorage ? "Over quota — uploads will be rejected." : undefined,
      },
      {
        label: "Modules within plan",
        value: modulesOutsidePlan.length
          ? `${modulesOutsidePlan.length} outside the plan`
          : "All allowed",
        ok: modulesOutsidePlan.length === 0,
        hint: modulesOutsidePlan.length
          ? "These will stop working at the next plan sync."
          : undefined,
      },
    ],

    enabledModules: tenant.enabledModules,
    allowedModules: plan?.allowedModules ?? [],
    studentCount: tenant.studentCount,
    teacherCount: tenant.teacherCount,
    maxStudents: plan?.maxStudents ?? -1,
    maxTeachers: plan?.maxTeachers ?? -1,
    storageUsedGb: tenant.storageUsedGb,
    maxStorageGb: plan?.maxStorageGb ?? 0,

    // Only ABC College has a real audit trail in this app
    recentActivity:
      tenant.slug === "abc-college"
        ? getAuditLog().slice(0, 6).map((e) => ({
            id: e.id,
            action: e.action,
            target: e.target,
            actorName: e.actorName,
            createdAt: e.createdAt,
          }))
        : [],

    openTickets: buildTickets()
      .filter((t) => t.tenantId === tenant.id && isOpenTicket(t))
      .sort(byTriage),
  };
}
