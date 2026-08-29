import type { Metadata } from "next";

import { ParentLinks } from "@/components/structure/parent-links";

export const metadata: Metadata = {
  title: "Guardian links",
  description: "Link guardian accounts to students and set what each one may open.",
};

/** C-IA-12 — the office half of the parent portal (school tenants only). */
export default function AdminGuardianLinksRoute() {
  return <ParentLinks />;
}
