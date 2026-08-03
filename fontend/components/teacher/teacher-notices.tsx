"use client";

import {
  LeadershipNoticeComposerPage,
  LeadershipNoticesPage,
  type LeadershipNoticesConfig,
} from "@/components/principal/notices";
import {
  createTeacherNotice,
  fetchTeacherNotice,
  fetchTeacherNoticeTargets,
  fetchTeacherNotices,
} from "@/lib/teacher";

/** Teachers read the same board and post class-scoped notices only. */
const CONFIG: LeadershipNoticesConfig = {
  title: "Notice board",
  subtitle: "Institution, department and class notices. You can post to the classes you teach.",
  composeHref: "/teacher/notices/new",
  canViewReadReceipts: false,
  canPin: false,
  allowedPostScopes: ["CLASS"],
  load: (filters) => fetchTeacherNotices({ query: filters.query, limit: filters.limit, offset: filters.offset }),
  loadDetail: fetchTeacherNotice,
  loadTargets: async () => ({
    departments: [],
    classes: (await fetchTeacherNoticeTargets()).map((target) => ({
      id: target.id,
      name: target.name,
      department_id: null,
      department_name: null,
    })),
  }),
  create: async (payload) => {
    if (!payload.target_id) throw new Error("Select the class receiving this notice.");
    return createTeacherNotice({
      title: payload.title,
      body: payload.body,
      class_id: payload.target_id,
      priority: payload.priority,
      expires_at: payload.expires_at ?? null,
    });
  },
};

/** C-TC-19. */
export function TeacherNoticesPage() { return <LeadershipNoticesPage config={CONFIG} />; }
/** C-TC-20. */
export function TeacherNoticeComposerPage() { return <LeadershipNoticeComposerPage config={CONFIG} />; }
