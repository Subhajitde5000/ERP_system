import type { Metadata } from "next";

import { PricingPage } from "@/components/checkout/pricing-page";

export const metadata: Metadata = {
  title: "Pricing — start free, scale when you're ready",
  description:
    "Starter, Professional and Enterprise plans plus a build-your-own option. Every plan includes the 8 core academic modules.",
};

/** Public pricing page — the middle of the Features → Pricing → Book Demo funnel. */
export default function Pricing() {
  return <PricingPage />;
}
