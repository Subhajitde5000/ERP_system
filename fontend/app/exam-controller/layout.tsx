"use client";

import { InstitutionRoleConsole } from "@/components/institution-console/institution-role-console";
import { ExamControllerShell } from "@/components/exam-controller/exam-controller-shell";

/** C-EC-01 … C-EC-10 examination operations console. */
export default function ExamControllerLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <InstitutionRoleConsole
      requiredRole="EXAM_CONTROLLER"
      loadingLabel="Loading exam controller console…"
      Shell={ExamControllerShell}
    >
      {children}
    </InstitutionRoleConsole>
  );
}
