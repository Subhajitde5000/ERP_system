import type { Metadata } from "next";

import { CheckoutFlow } from "@/components/checkout/checkout-flow";

export const metadata: Metadata = {
  title: "Start Free Trial / Buy Now",
  description:
    "Register your institution, choose a subdomain, pick a plan and pay — your institution is provisioned automatically.",
};

/**
 * Public signup — Steps 1–8 of the institution-admin journey.
 * `?plan=professional` pre-selects a plan; `?mode=trial` starts the free
 * trial; `?order=<id>&done=1` re-shows the success page after a refresh.
 */
export default async function SignupPage({
  searchParams,
}: {
  searchParams: Promise<{ plan?: string; mode?: string; order?: string; done?: string }>;
}) {
  const params = await searchParams;
  return (
    <CheckoutFlow
      initialPlan={params.plan ?? null}
      initialMode={params.mode === "trial" ? "TRIAL" : null}
      orderId={params.order ?? null}
    />
  );
}
