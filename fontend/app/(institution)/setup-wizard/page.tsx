import type { Metadata } from "next";

import { SetupWizard } from "@/components/setup/setup-wizard";

export const metadata: Metadata = {
  title: "Setup wizard",
  description: "Configure your institution — profile, structure, people and modules.",
};

/**
 * First-time setup wizard (Step 10). The Institution Admin lands here after
 * the first login instead of the dashboard; progress is saved server-side
 * after every step.
 */
export default function SetupWizardPage() {
  return <SetupWizard />;
}
