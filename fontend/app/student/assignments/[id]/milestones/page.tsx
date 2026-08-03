import { redirect } from "next/navigation";

/**
 * C-ST-12 — Milestone Progress.
 *
 * The stepper lives on the assignment page because a milestone is *submitted*
 * from it: on a separate screen the learner would pick a stage here and upload
 * there, with no way to tell which stage is unlocked. The documented URL
 * forwards to the assignment it belongs to.
 */
export default async function StudentMilestonesRoute({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;
  redirect(`/student/assignments/${id}#milestones`);
}
