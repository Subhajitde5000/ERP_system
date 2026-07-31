import { headers } from "next/headers";
import type { Metadata } from "next";

import { BrandingPanel } from "@/components/auth/branding-panel";
import { LoginForm } from "@/components/auth/login-form";
import { MobileBanner } from "@/components/auth/mobile-banner";
import { resolveTenant } from "@/lib/tenant";

export const metadata: Metadata = {
  title: "Sign in",
  description: "Sign in to your xyz.com institution account.",
};

/**
 * Login page — xyz.com ERP + LMS
 * Split-screen layout per login_page_design.md §5.
 *
 * The tenant is resolved server-side from the Host header so the correct
 * institution badge is in the first paint (no flash of the wrong brand).
 * Locally, append ?tenant=abc-college to preview a specific institution.
 */
export default async function LoginPage({
  searchParams,
}: {
  searchParams: Promise<{ tenant?: string }>;
}) {
  const [headerList, params] = await Promise.all([headers(), searchParams]);
  const tenant = resolveTenant(headerList.get("host"), params.tenant);

  return (
    <div className="flex min-h-screen flex-col bg-[#F8FAFC] lg:flex-row">
      <BrandingPanel />
      <MobileBanner />

      <main className="flex flex-1 items-start justify-center bg-white p-6 lg:items-center lg:bg-[#F8FAFC] lg:p-10">
        <div className="w-full max-w-[400px] animate-fade-up py-4 lg:py-0">
          <LoginForm tenant={tenant} />

          <p className="mt-6 text-center text-[11px] leading-relaxed text-[#94A3B8]">
            Protected by tenant isolation · All logins are audited ·{" "}
            <span className="font-medium text-[#0F172A]">v0.1.0</span>
          </p>
        </div>
      </main>
    </div>
  );
}
