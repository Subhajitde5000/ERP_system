import { notFound } from "next/navigation";
import type { Metadata } from "next";

import { InstitutionShell } from "@/components/dashboard/institution-shell";
import { PermissionDenied } from "@/components/shared/permission-denied";
import { StaffDetailView } from "@/components/staff/staff-detail-view";
import { staffDetailPermissions, visibleStaffTabs } from "@/lib/staff-detail";
import { getStaffDepartment, getStaffDetail } from "@/lib/staff-detail-data";

export const metadata: Metadata = { title: "Staff" };

/**
 * Staff detail — role_based_shared_pages.md PAGE 20 (C-RB-20).
 *
 * One URL; the role decides which tabs exist. Two guards run before any data
 * is fetched, both server-side:
 *
 *   1. no tabs           → 403 (13 of the 18 roles)
 *   2. department fence  → a HOD may only open staff in their own department
 *
 * The permission object is then passed *into* the data layer so sections the
 * caller isn't entitled to are never serialised — the PAGE 4 lesson that a
 * client-side mask still ships the value in the RSC payload.
 */
export default async function StaffDetailPage({
  params,
  searchParams,
}: {
  params: Promise<{ id: string }>;
  searchParams: Promise<{
    tenant?: string;
    role?: string;
    roles?: string;
    modules?: string;
  }>;
}) {
  const [{ id }, search] = await Promise.all([params, searchParams]);

  if (!getStaffDepartment(id)) notFound();

  return (
    <InstitutionShell search={search}>
      {({ session }) => {
        const perms = staffDetailPermissions(session.roles);
        const tabs = visibleStaffTabs(perms, session.enabledModules);

        if (perms.tabs.length === 0) {
          return (
            <PermissionDenied
              message={
                perms.deniedReason ?? "Staff records aren't part of your role."
              }
              backHref="/dashboard"
              backLabel="Back to Dashboard"
            />
          );
        }

        // HOD: "Attendance (own dept)" — the fence covers the whole record,
        // not just that one tab (§4.4 scope is "Own department only").
        const department = getStaffDepartment(id);
        if (perms.departmentScope && department !== perms.departmentScope) {
          return (
            <PermissionDenied
              message={`This staff member is not in your department. You can view ${perms.departmentScope} staff only.`}
              backHref="/dashboard"
              backLabel="Back to Dashboard"
            />
          );
        }

        // Every tab this role owns needs a module that's switched off (§3)
        if (tabs.length === 0) {
          return (
            <PermissionDenied
              message="The HR module is switched off for this institution, so staff records aren't available."
              backHref="/dashboard"
              backLabel="Back to Dashboard"
            />
          );
        }

        const detail = getStaffDetail(id, perms, tabs);
        if (!detail) notFound();

        return <StaffDetailView detail={detail} perms={perms} tabs={tabs} />;
      }}
    </InstitutionShell>
  );
}
