"use client";

import {
  LeadershipNoticeComposerPage,
  LeadershipNoticesPage,
  type LeadershipNoticesConfig,
} from "@/components/principal/notices";
import {
  createVicePrincipalNotice,
  fetchVicePrincipalNotice,
  fetchVicePrincipalNotices,
  fetchVicePrincipalNoticeTargets,
} from "@/lib/vice-principal";

const CONFIG: LeadershipNoticesConfig = {
  title: "Delegated notice board",
  subtitle: "Institution notices plus notices for your delegated departments and classes. You can post only to delegated departments or classes.",
  composeHref: "/vp/notices/new",
  canViewReadReceipts: false,
  allowedPostScopes: ["DEPARTMENT", "CLASS"],
  load: fetchVicePrincipalNotices,
  loadDetail: fetchVicePrincipalNotice,
  loadTargets: fetchVicePrincipalNoticeTargets,
  create: createVicePrincipalNotice,
};

/** C-VP-05 — no receipt data is rendered or received. */
export function VicePrincipalNoticesPage() {
  return <LeadershipNoticesPage config={CONFIG} />;
}

/** C-VP-06 — composer has no institution-wide option. */
export function VicePrincipalNoticeComposerPage() {
  return <LeadershipNoticeComposerPage config={CONFIG} />;
}
