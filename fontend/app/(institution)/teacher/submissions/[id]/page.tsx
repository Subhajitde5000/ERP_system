import { notFound } from "next/navigation";
import type { Metadata } from "next";

import { InstitutionShell } from "@/components/dashboard/institution-shell";
import { SubmissionDetail } from "@/components/assignment/submission-detail";
import { assignmentPermissions } from "@/lib/assignment";
import { getSubmissionDetail } from "@/lib/assignment-data";

export const metadata: Metadata = {
  title: "Submission",
  description: "Review one student's submission.",
};

/**
 * C-TC-16 — Submission Detail.
 * "View one submission, files, add feedback, set score"
 *
 * The permission object is passed *into* the data layer, which returns
 * nothing unless the caller may review. A Student or Parent hitting this id
 * therefore gets a **404, not a 403**: the response is identical to a
 * non-existent submission, so the URL space can't be probed to discover
 * which classmates have submitted.
 *
 * That is stricter than the usual `PermissionDenied` card, and deliberately
 * so — every other guarded page in this app protects a *section*, whereas
 * this URL is one named student's work, marks and feedback.
 */
export default async function SubmissionDetailPage({
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

  return (
    <InstitutionShell search={search}>
      {({ session }) => {
        const perms = assignmentPermissions(session.roles);
        const detail = getSubmissionDetail(id, {
          canReview: perms.canReview,
        });
        if (!detail) notFound();

        return <SubmissionDetail detail={detail} />;
      }}
    </InstitutionShell>
  );
}
