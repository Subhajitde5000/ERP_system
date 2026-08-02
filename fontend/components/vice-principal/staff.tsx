"use client";

import { LeadershipStaffDirectoryPage } from "@/components/principal/directory";
import {
  fetchVicePrincipalStaff,
  fetchVicePrincipalStaffDetail,
} from "@/lib/vice-principal";

/** C-VP-07 — profiles are restricted to delegated departments server-side. */
export function VicePrincipalStaffPage() {
  return (
    <LeadershipStaffDirectoryPage
      config={{
        title: "Delegated staff directory",
        subtitle: "Academic staff in your delegated departments. This directory is read-only.",
        load: fetchVicePrincipalStaff,
        loadDetail: fetchVicePrincipalStaffDetail,
      }}
    />
  );
}
