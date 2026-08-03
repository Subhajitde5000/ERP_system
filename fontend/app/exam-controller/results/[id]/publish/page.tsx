import { ExamControllerPublishPage } from "@/components/exam-controller/exam-controller-publish";

/** C-EC-08 — review and publish a compiled publication. */
export default function ExamControllerPublishRoute({
  params,
}: {
  params: { id: string };
}) {
  return <ExamControllerPublishPage id={params.id} />;
}
