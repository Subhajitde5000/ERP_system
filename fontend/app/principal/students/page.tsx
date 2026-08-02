import { PrincipalDirectoryPage } from "@/components/principal/directory";

/** C-PR-06 — live, read-only student directory with enrolment status. */
export default function PrincipalStudentsPage() {
  return <PrincipalDirectoryPage kind="students" />;
}
