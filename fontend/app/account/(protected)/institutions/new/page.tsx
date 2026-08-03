"use client";

import { Suspense, useEffect, useState } from "react";
import Link from "next/link";
import { useSearchParams } from "next/navigation";

import { CheckoutFlow } from "@/components/checkout/checkout-flow";
import { useOwnerAuth } from "@/hooks/use-owner-auth";
import { getOwnerAccessToken, refreshOwnerToken } from "@/lib/owner";

/**
 * "Create New Institution" — the in-dashboard institution checkout.
 *
 * Reuses the public CheckoutFlow verbatim (Choose Plan → Subdomain → Payment →
 * Provision), but runs against the owner-scoped endpoints so the provisioned
 * tenant is linked to this account and appears under "My Institutions".
 */
export default function NewInstitutionPage() {
  return (
    <Suspense
      fallback={
        <div className="flex min-h-[50vh] items-center justify-center text-sm text-muted-foreground">
          Loading checkout…
        </div>
      }
    >
      <NewInstitutionContent />
    </Suspense>
  );
}

function NewInstitutionContent() {
  const searchParams = useSearchParams();
  const plan = searchParams.get("plan");
  const mode = searchParams.get("mode");
  const order = searchParams.get("order");

  const { isAuthenticated } = useOwnerAuth();
  const [token, setToken] = useState<string | null>(null);

  useEffect(() => {
    let mounted = true;
    (async () => {
      let t = getOwnerAccessToken();
      if (!t) t = await refreshOwnerToken();
      if (mounted) setToken(t);
    })();
    return () => {
      mounted = false;
    };
  }, []);

  if (!isAuthenticated || !token) {
    return (
      <div className="flex min-h-[50vh] items-center justify-center text-sm text-muted-foreground">
        Loading checkout…
      </div>
    );
  }

  return (
    <div>
      <div className="mx-auto mb-2 max-w-3xl px-5 pt-6 sm:px-8">
        <Link
          href="/account"
          className="text-sm font-medium text-muted-foreground transition hover:text-accent"
        >
          ← Back to dashboard
        </Link>
      </div>
      <CheckoutFlow
        ownerToken={token}
        initialPlan={plan ?? null}
        initialMode={mode === "trial" ? "TRIAL" : null}
        orderId={order ?? null}
      />
    </div>
  );
}

