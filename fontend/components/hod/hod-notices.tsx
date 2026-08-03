"use client";

import {
  LeadershipNoticeComposerPage,
  LeadershipNoticesPage,
  type LeadershipNoticesConfig,
} from "@/components/principal/notices";
import {
  createHodNotice,
  fetchHodNotice,
  fetchHodNotices,
  fetchHodNoticeTargets,
} from "@/lib/hod";

const CONFIG: LeadershipNoticesConfig = {
  title: "Department notices",
  subtitle: "Institution notices plus notices for your departments and classes. You can post only within your departments.",
  composeHref: "/hod/notices/new",
  canViewReadReceipts: false,
  canPin: false,
  allowedPostScopes: ["DEPARTMENT", "CLASS"],
  load: fetchHodNotices,
  loadDetail: fetchHodNotice,
  loadTargets: fetchHodNoticeTargets,
  create: createHodNotice,
};

/** C-HD-09. */
export function HodNoticesPage() { return <LeadershipNoticesPage config={CONFIG} />; }
/** C-HD-10. */
export function HodNoticeComposerPage() { return <LeadershipNoticeComposerPage config={CONFIG} />; }
