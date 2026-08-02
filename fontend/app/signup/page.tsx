import type { Metadata } from "next";

import { BrandingPanel } from "@/components/auth/branding-panel";
import { MobileBanner } from "@/components/auth/mobile-banner";
import { OwnerSignupForm } from "@/components/auth/owner-signup-form";

export const metadata: Metadata = {
  title: "Create your platform account",
  description:
    "Sign up once and manage every institution you own — billing, subscriptions, invoices and support.",
};

/**
 * Owner account sign-up — the AWS / Shopify / Zoho "create account" step.
 *
 * Previously this route was the anonymous institution checkout. Under the
 * account-holder model the account comes first: Sign Up → Verify Email →
 * Platform Dashboard → Create New Institution. The institution checkout now
 * lives at /account/institutions/new and reuses the same CheckoutFlow.
 */
export default function SignupPage() {
  return (
    <div className="flex min-h-screen flex-col bg-[#F8FAFC] lg:flex-row">
      <BrandingPanel />
      <MobileBanner />

      <main className="flex flex-1 items-start justify-center bg-white p-6 lg:items-center lg:bg-[#F8FAFC] lg:p-10">
        <div className="w-full max-w-[400px] animate-fade-up py-4 lg:py-0">
          <OwnerSignupForm />
          <p className="mt-6 text-center text-[11px] leading-relaxed text-[#475569]">
            One account · many institutions ·{" "}
            <span className="font-medium text-[#0F172A]">v0.2.0</span>
          </p>
        </div>
      </main>
    </div>
  );
}
