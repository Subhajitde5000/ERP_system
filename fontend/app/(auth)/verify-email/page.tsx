"use client";

import { Suspense, useEffect, useState } from "react";
import { useSearchParams, useRouter } from "next/navigation";
import Link from "next/link";
import { MailCheck, ShieldCheck, XCircle } from "lucide-react";

import { BrandingPanel } from "@/components/auth/branding-panel";
import { MobileBanner } from "@/components/auth/mobile-banner";
import { Button } from "@/components/ui/button";
import { verifyOwnerEmail, resendOwnerVerification } from "@/lib/owner";

type State =
  | { kind: "verifying" }
  | { kind: "missing" }
  | { kind: "verified"; name: string }
  | { kind: "error"; message: string };

/**
 * Email verification — Step 2 of the owner journey. Reached from the link in
 * the verification email (or the dev "verify now" shortcut on the signup
 * success screen).
 */
export default function VerifyEmailPage() {
  // useSearchParams opts the tree into client-side rendering, so Next requires
  // a Suspense boundary or the static export of this route fails at build.
  return (
    <Suspense fallback={null}>
      <VerifyEmail />
    </Suspense>
  );
}

function VerifyEmail() {
  const params = useSearchParams();
  const router = useRouter();
  const token = params.get("token");
  const [state, setState] = useState<State>(
    token ? { kind: "verifying" } : { kind: "missing" },
  );

  useEffect(() => {
    if (!token) return;
    let mounted = true;
    (async () => {
      try {
        const owner = await verifyOwnerEmail(token);
        if (mounted) setState({ kind: "verified", name: owner.name });
      } catch (err) {
        if (!mounted) return;
        const msg = err instanceof Error ? err.message : "Verification failed";
        setState({ kind: "error", message: msg });
      }
    })();
    return () => {
      mounted = false;
    };
  }, [token]);

  return (
    <div className="flex min-h-screen flex-col bg-[#F8FAFC] lg:flex-row">
      <BrandingPanel />
      <MobileBanner />
      <main className="flex flex-1 items-start justify-center bg-white p-6 lg:items-center lg:bg-[#F8FAFC] lg:p-10">
        <div className="w-full max-w-[400px] animate-fade-up py-4 lg:py-0">
          {state.kind === "verifying" && <Card icon={<MailCheck />} title="Verifying your email…" body="One moment while we confirm your address." />}

          {state.kind === "missing" && (
            <Card
              icon={<MailCheck />}
              title="Check your email"
              body="Click the verification link in the email we sent to activate your account."
            />
          )}

          {state.kind === "verified" && (
            <div className="rounded-card bg-white p-0 lg:border lg:border-[#E2E8F0] lg:p-8 lg:shadow-card">
              <div className="mb-5 flex h-11 w-11 items-center justify-center rounded-xl bg-success-light text-success-text">
                <ShieldCheck className="h-5 w-5" aria-hidden="true" />
              </div>
              <h1 className="font-display text-[22px] font-bold text-[#0F172A]">
                Email verified
              </h1>
              <p className="mt-2 text-[13px] text-[#64748B]">
                Welcome, {state.name.split(" ")[0]}. Your account is active — sign in to reach
                your platform dashboard.
              </p>
              <div className="mt-6">
                <Button onClick={() => router.push("/account/login")}>Continue to sign in</Button>
              </div>
            </div>
          )}

          {state.kind === "error" && (
            <div className="rounded-card bg-white p-0 lg:border lg:border-[#E2E8F0] lg:p-8 lg:shadow-card">
              <div className="mb-5 flex h-11 w-11 items-center justify-center rounded-xl bg-destructive-light text-destructive-text">
                <XCircle className="h-5 w-5" aria-hidden="true" />
              </div>
              <h1 className="font-display text-[22px] font-bold text-[#0F172A]">
                Link invalid or expired
              </h1>
              <p className="mt-2 text-[13px] text-[#64748B]">{state.message}</p>
              <div className="mt-6 flex flex-col gap-2">
                <Button
                  onClick={async () => {
                    const email = window.prompt("Enter your account email to resend the link:");
                    if (email) await resendOwnerVerification(email);
                  }}
                >
                  Resend verification link
                </Button>
                <Link href="/account/login" className="text-center text-[12px] font-semibold text-accent hover:underline">
                  Back to sign in
                </Link>
              </div>
            </div>
          )}
        </div>
      </main>
    </div>
  );
}

function Card({ icon, title, body }: { icon: React.ReactNode; title: string; body: string }) {
  return (
    <div className="rounded-card bg-white p-0 lg:border lg:border-[#E2E8F0] lg:p-8 lg:shadow-card">
      <div className="mb-5 flex h-11 w-11 items-center justify-center rounded-xl bg-accent-light text-accent">
        {icon}
      </div>
      <h1 className="font-display text-[22px] font-bold text-[#0F172A]">{title}</h1>
      <p className="mt-2 text-[13px] text-[#64748B]">{body}</p>
    </div>
  );
}
