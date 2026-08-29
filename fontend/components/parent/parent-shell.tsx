"use client";

/**
 * Parent console chrome: navigation plus the child switcher.
 *
 * Two things make this shell different from every other console in the app:
 *
 * 1. the navigation is filtered by the active child's `access_scope`, because a
 *    tab that opens a 403 looks like a broken product — but the filter is a
 *    courtesy, not a control, since the server re-checks the same link row on
 *    every request;
 * 2. the switcher sits in the header, not in a page. A guardian with two
 *    children should never have to wonder whose attendance they are reading, and
 *    a screenshot of the wrong child's report card is exactly the accident this
 *    prevents.
 */

import {
  CalendarDays,
  ClipboardCheck,
  GraduationCap,
  IndianRupee,
  LayoutDashboard,
  Megaphone,
  Repeat2,
  School,
  UserRound,
} from "lucide-react";

import {
  InstitutionConsoleShell,
  type InstitutionConsoleNavItem,
} from "@/components/institution-console/institution-console-shell";
import { useParentConsole } from "./parent-console-context";

/** `module` is the `access_scope` key that must be granted for the tab to appear. */
interface ParentNavItem extends InstitutionConsoleNavItem {
  module?: string;
}

const NAVIGATION: ParentNavItem[] = [
  { label: "My family", href: "/parent/dashboard", icon: School },
  { label: "Today", href: "/parent/child", icon: LayoutDashboard },
  { label: "Attendance", href: "/parent/child/attendance", icon: ClipboardCheck, module: "attendance" },
  { label: "Leave", href: "/parent/child/leave", icon: CalendarDays, module: "attendance" },
  { label: "Timetable", href: "/parent/child/timetable", icon: CalendarDays, module: "timetable" },
  { label: "Exams & results", href: "/parent/child/results", icon: GraduationCap, module: "results" },
  { label: "Assignments", href: "/parent/child/assignments", icon: Repeat2, module: "assignment" },
  { label: "Notices", href: "/parent/child/notices", icon: Megaphone, module: "notice" },
  { label: "Fees", href: "/parent/child/fees", icon: IndianRupee, module: "finance" },
  { label: "My details", href: "/parent/guardian", icon: UserRound },
];

export function ParentShell({ children }: { children: React.ReactNode }) {
  const { activeChild } = useParentConsole();
  const scope = new Set(activeChild?.access_scope ?? []);
  // Ungranted tabs are hidden while a child is selected; before that first
  // response there is no scope to filter by, so only the ungated tabs show.
  const navigation = NAVIGATION.filter(
    (item) => !item.module || (activeChild ? scope.has(item.module) : false),
  );

  return (
    <InstitutionConsoleShell
      navigation={navigation}
      consoleTitle="Parent console"
      headerTitle={activeChild ? `${activeChild.name}'s record` : "My family"}
      roleLabel="Parent / Guardian"
    >
      <ChildSwitcher />
      {children}
    </InstitutionConsoleShell>
  );
}

function ChildSwitcher() {
  const { children: kids, blocked, activeChild, selectChild } = useParentConsole();
  if (!kids.length && !blocked.length) return null;

  return (
    <div className="mb-6 flex flex-wrap items-center gap-2">
      {kids.length > 1 ? (
        <div className="flex flex-wrap gap-2" role="tablist" aria-label="Choose which child to view">
          {kids.map((child) => {
            const active = child.student_id === activeChild?.student_id;
            return (
              <button
                key={child.student_id}
                type="button"
                role="tab"
                aria-selected={active}
                onClick={() => selectChild(child.student_id)}
                className={`inline-flex h-9 items-center gap-2 rounded-full border px-3 text-sm font-semibold transition ${
                  active
                    ? "border-accent bg-accent text-white"
                    : "border-border bg-white text-muted-foreground hover:border-accent hover:text-accent"
                }`}
              >
                {child.name}
                <span className={`text-[11px] ${active ? "text-white/80" : "text-muted-foreground"}`}>
                  {child.relation}
                </span>
              </button>
            );
          })}
        </div>
      ) : null}

      {activeChild?.access_upto ? (
        <span className="inline-flex h-9 items-center rounded-full bg-warning-light px-3 text-xs font-semibold text-warning-text">
          Access until {activeChild.access_upto}
        </span>
      ) : null}
      {activeChild && !activeChild.is_primary ? (
        <span className="inline-flex h-9 items-center rounded-full bg-muted px-3 text-xs font-semibold text-muted-foreground">
          Not the primary contact
        </span>
      ) : null}
      {blocked.length ? (
        <span className="inline-flex h-9 items-center rounded-full border border-border px-3 text-xs font-semibold text-muted-foreground">
          {blocked.length} link{blocked.length > 1 ? "s" : ""} paused by the school
        </span>
      ) : null}
    </div>
  );
}
