import { headers } from "next/headers";
import type { Metadata } from "next";

import { BrandingPanel } from "@/components/auth/branding-panel";
import { MobileBanner } from "@/components/auth/mobile-banner";
import { GuardianAccessForm } from "@/components/auth/guardian-access-form";
import { resolveTenant } from "@/lib/tenant";

export const metadata: Metadata = {
  title: "Open your parent portal",
  description: "Activate the guardian access code from your admission slip.",
  // Reached from a printed slip, not a search result — and a page where a code is
  // typed must not leak it through the referrer or the index.
  robots: { index: false, follow: false },
  referrer: "no-referrer",
};

/**
 * C-PA-12 — Guardian activation (`/guardian-access`).
 *
 * Public by necessity: the account this form creates does not exist yet, so there is
 * no session to authorise. It therefore carries no console layout, no nav and nothing
 * that could read tenant data — one form and two unauthenticated endpoints
 * (`/parent/access/check-code`, `/parent/access/activate`), both rate limited and both
 * returning less than they are asked for.
 *
 * `?code=` prefills the field when a school links a fresh page; the form never writes
 * the code back into the URL, and the invite email points here without one.
 */
export default async function GuardianAccessPage({
  searchParams,
}: {
  searchParams: Promise<{ tenant?: string; code?: string }>;
}) {
  const [headerList, params] = await Promise.all([headers(), searchParams]);
  const tenant = await resolveTenant(headerList.get("host"), params.tenant);
  const code = typeof params.code === "string" ? params.code : "";

  return (
    <div className="flex min-h-screen flex-col bg-[#F8FAFC] lg:flex-row">
      <BrandingPanel />
      <MobileBanner />

      <main className="flex flex-1 items-start justify-center bg-white p-6 lg:items-center lg:bg-[#F8FAFC] lg:p-10">
        <div className="w-full max-w-[400px] animate-fade-up py-4 lg:py-0">
          <GuardianAccessForm tenant={tenant} initialCode={code} />

          <p className="mt-6 text-center text-[11px] leading-relaxed text-[#475569]">
            Lost the code? The school office can reissue it · No payment is ever requested here
          </p>
        </div>
      </main>
    </div>
  );
}
