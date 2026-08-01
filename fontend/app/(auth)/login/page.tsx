import { headers } from "next/headers";
import { redirect } from "next/navigation";
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

  /*
   * `app.xyz.com` (and bare localhost, which resolves the same way) is the
   * platform console, not an institution. This page used to render a
   * half-platform variant of the tenant form — "Work email" wording, but it
   * still POSTed to the tenant endpoint with `tenantId: "app"`, which no
   * amount of correct credentials could authenticate. Platform staff live in
   * `platform_users` (DB §4.5), a different table with a different endpoint.
   *
   * Send them to the console's own sign-in instead.
   */
  if (tenant.isPlatform) redirect("/platform/login");

  return (
    <div className="flex min-h-screen flex-col bg-[#F8FAFC] lg:flex-row">
      <BrandingPanel />
      <MobileBanner />

      <main className="flex flex-1 items-start justify-center bg-white p-6 lg:items-center lg:bg-[#F8FAFC] lg:p-10">
        <div className="w-full max-w-[400px] animate-fade-up py-4 lg:py-0">
          <LoginForm tenant={tenant} />

          <p className="mt-6 text-center text-[11px] leading-relaxed text-[#475569]">
            Protected by tenant isolation · All logins are audited ·{" "}
            <span className="font-medium text-[#0F172A]">v0.1.0</span>
          </p>
        </div>
      </main>
    </div>
  );
}
