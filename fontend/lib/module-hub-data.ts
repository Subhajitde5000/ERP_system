import {
  BadgeIndianRupee,
  BedDouble,
  Book,
  Boxes,
  CalendarClock,
  CalendarPlus,
  FileBadge,
  FileCheck2,
  FileText,
  Handshake,
  MapPinned,
  PackageMinus,
  PackagePlus,
  ShieldAlert,
  TrendingUp,
  Truck,
  UserPlus,
  UserRoundPlus,
  Users,
  Wallet,
} from "lucide-react";

import type { ModuleKey } from "@/types/auth";
import type { Stat } from "@/types/dashboard";
import type { ModuleHub } from "@/types/module-hub";
import { compactRupees } from "./fee";
import { rupees } from "./utils";
import { moduleOwnerRole } from "./module-hub";
import { getLibraryCirculation } from "./library-data";
import { getHostelOccupancy } from "./hostel-data";
import { getStaffDirectory } from "./staff-detail-data";
import {
  getAdmissionFunnel,
  getHrLeaveStats,
  getInventoryStats,
  getPayrollStats,
  getPlacementStats,
  getRouteStats,
} from "./report-data";

/**
 * Module hub configs — the `/{module}/dashboard` pages (C-LB-01, C-HW-01,
 * C-TR-01, C-PL-01, C-HR-01, C-AD-01, C-SM-01).
 *
 * Every figure is read from the module that owns it, or from the shared
 * aggregates the reports page already uses — so the hub, the report and the
 * detail page can never disagree. Nothing new is invented here.
 *
 * `canManage` gates the action row: §3 activates exactly one role per optional
 * module, and §4.2 gives the Admin configuration rights. A Principal browsing
 * hostel occupancy gets the same figures without the "Allot room" button.
 */

const stat = (
  label: string,
  value: string,
  icon: Stat["icon"],
  extra: Partial<Stat> = {},
): Stat => ({ label, value, icon, ...extra });

function pctTone(pct: number, good = 85, fair = 70) {
  return pct >= good ? "success" : pct >= fair ? "warning" : "danger";
}

type Builder = (canManage: boolean) => ModuleHub;

const BUILDERS: Record<string, Builder> = {
  /* ── C-LB-01 Library ─────────────────────────────────────────────────── */
  library: (canManage) => {
    const c = getLibraryCirculation();
    const titles = c.byBook.length;
    const copies = c.byBook.reduce((a, b) => a + b.totalCopies, 0);

    return {
      key: "library",
      title: "Library",
      description: "Catalogue, circulation and overdue returns.",
      ownerRole: moduleOwnerRole("library"),
      stats: [
        stat("Titles", String(titles), Book, { tone: "accent" }),
        stat("Copies", String(copies), Book, {
          tone: "cyan",
          delta: { text: `${c.currentlyOut} on loan`, tone: "muted" },
        }),
        stat("Overdue", String(c.overdue), ShieldAlert, {
          tone: c.overdue ? "danger" : "success",
          delta: { text: `${c.overdueRate}% of live loans`, tone: "muted" },
        }),
        stat("Fines due", rupees(c.outstandingFines), BadgeIndianRupee, {
          tone: "warning",
        }),
      ],
      panels: [
        {
          kind: "table",
          title: "Catalogue",
          span: 7,
          columns: [
            { key: "title", label: "Title" },
            { key: "out", label: "On loan", numeric: true },
            { key: "copies", label: "Copies", numeric: true },
          ],
          rows: c.byBook.map((b) => ({
            title: b.title,
            out: String(b.currentlyOut),
            copies: String(b.totalCopies),
          })),
          // Each row links to the book detail page that already exists
          action: "Open",
        },
        {
          kind: "list",
          title: "Overdue now",
          span: 5,
          empty: "Nothing is overdue.",
          items: c.overdueLoans.map((l) => ({
            title: l.title,
            subtitle: `${l.borrowerName} · ${l.borrowerRef}`,
            meta: `${l.overdueDays}d · ${rupees(l.fineAmount)}`,
            tone: "danger" as const,
          })),
        },
      ],
      actions: canManage
        ? [
            { label: "Circulation report", icon: TrendingUp, href: "/reports", primary: true },
            { label: "Search catalogue", icon: Book, href: "/search?q=algorithms" },
          ]
        : [],
    };
  },

  /* ── C-HW-01 Hostel ──────────────────────────────────────────────────── */
  hostel: (canManage) => {
    const h = getHostelOccupancy();
    const low = [...h.residents].sort((a, b) => a.attendancePct - b.attendancePct);

    return {
      key: "hostel",
      title: "Hostel",
      description: "Occupancy, residents and nightly roll-call.",
      ownerRole: moduleOwnerRole("hostel"),
      stats: [
        stat("Occupancy", `${h.occupancyPct}%`, BedDouble, {
          tone: h.occupancyPct > 90 ? "warning" : "success",
          progress: { value: h.occupiedBeds, max: h.totalBeds },
        }),
        stat("Residents", String(h.occupiedBeds), Users, { tone: "accent" }),
        stat("Vacant beds", String(h.vacantBeds), BedDouble, {
          tone: h.vacantBeds ? "success" : "muted",
        }),
        stat("Blocks", String(h.byBlock.length), BedDouble, { tone: "muted" }),
      ],
      panels: [
        {
          kind: "bars",
          title: "Occupancy by block",
          span: 6,
          items: h.byBlock.map((b) => ({
            label: b.blockName,
            value: b.occupancyPct,
            tone: b.occupancyPct > 90 ? "warning" : ("accent" as const),
          })),
        },
        {
          kind: "list",
          title: "Lowest roll-call attendance",
          span: 6,
          empty: "No residents allotted yet.",
          items: low.slice(0, 5).map((r) => ({
            title: r.name,
            subtitle: `Room ${r.roomNumber}`,
            meta: `${r.attendancePct}%`,
            tone: pctTone(r.attendancePct, 85, 70) as "success" | "warning" | "danger",
          })),
        },
      ],
      actions: canManage
        ? [
            { label: "Review leave", icon: CalendarClock, href: "/leaves", primary: true },
            { label: "Occupancy report", icon: TrendingUp, href: "/reports" },
          ]
        : [],
    };
  },

  /* ── C-TR-01 Transport ───────────────────────────────────────────────── */
  transport: (canManage) => {
    const routes = getRouteStats();
    const assigned = routes.reduce((a, r) => a + r.students, 0);
    const capacity = routes.reduce((a, r) => a + r.capacity, 0);

    return {
      key: "transport",
      title: "Transport",
      description: "Routes, fleet and student assignments.",
      ownerRole: moduleOwnerRole("transport"),
      stats: [
        stat("Routes", String(routes.length), MapPinned, { tone: "accent" }),
        stat("Students", String(assigned), Users, { tone: "cyan" }),
        stat("Utilisation", `${Math.round((assigned / capacity) * 100)}%`, TrendingUp, {
          tone: "success",
          progress: { value: assigned, max: capacity },
        }),
        stat("Spare seats", String(capacity - assigned), Truck, { tone: "muted" }),
      ],
      panels: [
        {
          kind: "table",
          title: "Routes",
          span: 12,
          columns: [
            { key: "route", label: "Route" },
            { key: "vehicle", label: "Vehicle" },
            { key: "students", label: "Students", numeric: true },
            { key: "capacity", label: "Capacity", numeric: true },
            { key: "load", label: "Load", numeric: true },
          ],
          rows: routes.map((r) => ({
            route: `${r.code} · ${r.name}`,
            vehicle: r.vehicle,
            students: String(r.students),
            capacity: String(r.capacity),
            load: `${r.utilisationPct}%`,
          })),
        },
      ],
      actions: canManage
        ? [{ label: "Utilisation report", icon: TrendingUp, href: "/reports", primary: true }]
        : [],
    };
  },

  /* ── C-PL-01 Placement ───────────────────────────────────────────────── */
  placement: (canManage) => {
    const p = getPlacementStats();

    return {
      key: "placement",
      title: "Placement",
      description: "Drives, recruiters and offers for the current cycle.",
      ownerRole: moduleOwnerRole("placement"),
      stats: [
        stat("Placed", `${p.placedPct}%`, Handshake, {
          tone: pctTone(p.placedPct, 75, 55),
          ring: { value: p.placedPct, max: 100 },
        }),
        stat("Offers", String(p.offers), FileBadge, { tone: "success" }),
        stat("Avg package", `₹${p.avgPackage.toFixed(1)} LPA`, TrendingUp, {
          tone: "accent",
        }),
        stat("Recruiters", String(p.byCompany.length), Handshake, { tone: "muted" }),
      ],
      panels: [
        { kind: "funnel", title: "Placement funnel", span: 7, stages: p.funnel },
        {
          kind: "table",
          title: "Recruiters",
          span: 5,
          columns: [
            { key: "company", label: "Company" },
            { key: "offers", label: "Offers", numeric: true },
          ],
          rows: p.byCompany.map((c) => ({
            company: c.name,
            offers: String(c.offers),
          })),
        },
      ],
      actions: canManage
        ? [
            { label: "Eligible students", icon: Users, href: "/users", primary: true },
            { label: "Placement report", icon: TrendingUp, href: "/reports" },
          ]
        : [],
    };
  },

  /* ── C-HR-01 HR ──────────────────────────────────────────────────────── */
  hr: (canManage) => {
    const staff = getStaffDirectory();
    const active = staff.filter((s) => s.isActive);
    const pay = getPayrollStats();
    const leave = getHrLeaveStats();

    return {
      key: "hr",
      title: "HR",
      description: "Staff records, leave and payroll.",
      ownerRole: moduleOwnerRole("hr"),
      stats: [
        stat("Staff", String(staff.length), Users, {
          tone: "accent",
          delta: { text: `${active.length} active`, tone: "muted" },
        }),
        stat("Pending leave", String(leave.pending), CalendarClock, {
          tone: leave.pending ? "warning" : "success",
        }),
        stat("Monthly payroll", compactRupees(pay.net), Wallet, {
          tone: "cyan",
        }),
        stat("Leave utilisation", `${leave.utilisationPct}%`, TrendingUp, {
          tone: leave.utilisationPct > 80 ? "warning" : "success",
        }),
      ],
      panels: [
        {
          kind: "table",
          title: "Payroll by department",
          span: 7,
          columns: [
            { key: "dept", label: "Department" },
            { key: "staff", label: "Staff", numeric: true },
            { key: "net", label: "Net", numeric: true },
          ],
          rows: pay.byDepartment.map((d) => ({
            dept: d.name,
            staff: String(d.count),
            net: compactRupees(d.net),
          })),
        },
        {
          kind: "bars",
          title: "Leave utilisation by policy",
          span: 5,
          items: leave.byPolicy.map((x) => ({
            label: x.name,
            value: x.pct,
            tone: x.pct > 80 ? "warning" : ("accent" as const),
          })),
        },
      ],
      actions: canManage
        ? [
            { label: "Staff directory", icon: Users, href: "/users", primary: true },
            { label: "Leave requests", icon: CalendarClock, href: "/leaves" },
            { label: "HR reports", icon: TrendingUp, href: "/reports" },
          ]
        : [],
    };
  },

  /* ── C-AD-01 Admission ───────────────────────────────────────────────── */
  admission: (canManage) => {
    const a = getAdmissionFunnel();

    return {
      key: "admission",
      title: "Admission",
      description: "Application funnel for the current intake cycle.",
      ownerRole: moduleOwnerRole("admission"),
      stats: [
        stat("Applications", String(a.applications), UserRoundPlus, {
          tone: "accent",
        }),
        stat("Shortlisted", String(a.funnel[2]?.value ?? 0), FileCheck2, {
          tone: "cyan",
        }),
        stat("Admitted", String(a.admitted), FileBadge, { tone: "success" }),
        stat("Conversion", `${a.conversionPct}%`, TrendingUp, {
          tone: pctTone(a.conversionPct, 60, 40),
        }),
      ],
      panels: [
        { kind: "funnel", title: "Applicant funnel", span: 12, stages: a.funnel },
      ],
      actions: canManage
        ? [
            { label: "Newly enrolled", icon: Users, href: "/users", primary: true },
            { label: "Admission report", icon: TrendingUp, href: "/reports" },
          ]
        : [],
    };
  },

  /* ── C-SM-01 Inventory ───────────────────────────────────────────────── */
  inventory: (canManage) => {
    const inv = getInventoryStats();
    const low = inv.items.filter((i) => i.currentStock <= i.reorderLevel);

    return {
      key: "inventory",
      title: "Inventory",
      description: "Stock levels, movement and purchase orders.",
      ownerRole: moduleOwnerRole("inventory"),
      stats: [
        stat("Items", String(inv.itemCount), Boxes, { tone: "accent" }),
        stat("Low stock", String(low.length), ShieldAlert, {
          tone: low.length ? "danger" : "success",
        }),
        stat("Stock value", compactRupees(inv.stockValue), BadgeIndianRupee, {
          tone: "cyan",
        }),
        stat(
          "Open POs",
          String(inv.vendors.reduce((a, v) => a + v.pending, 0)),
          FileText,
          { tone: "warning" },
        ),
      ],
      panels: [
        {
          kind: "table",
          title: "Stock on hand",
          span: 7,
          columns: [
            { key: "item", label: "Item" },
            { key: "stock", label: "In stock", numeric: true },
            { key: "reorder", label: "Reorder at", numeric: true },
          ],
          rows: inv.items.map((i) => ({
            item: `${i.code} · ${i.name}`,
            stock: `${i.currentStock} ${i.unit}`,
            reorder: `${i.reorderLevel} ${i.unit}`,
          })),
        },
        {
          kind: "list",
          title: "Below reorder level",
          span: 5,
          empty: "Every item is above its reorder level.",
          items: low.map((i) => ({
            title: i.name,
            subtitle: i.code,
            meta: `${i.currentStock} / ${i.reorderLevel} ${i.unit}`,
            tone: "danger" as const,
          })),
        },
      ],
      actions: canManage
        ? [
            { label: "Stock in", icon: PackagePlus, href: "/reports", primary: true },
            { label: "Stock out", icon: PackageMinus, href: "/reports" },
          ]
        : [],
    };
  },
};

export function getModuleHub(key: ModuleKey, canManage: boolean): ModuleHub | undefined {
  return BUILDERS[key]?.(canManage);
}

/** Icons the shell needs for unbuilt deep links — kept for future wiring. */
export const HUB_ACTION_ICONS = {
  UserPlus,
  CalendarPlus,
};
