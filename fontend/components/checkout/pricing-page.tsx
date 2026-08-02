"use client";

import Link from "next/link";
import { ArrowRight, Check, Loader2, Rocket, Sparkles } from "lucide-react";
import { useEffect, useState } from "react";

import { formatINR, getCatalog } from "@/lib/signup";
import type { Catalog, PlanInfo } from "@/lib/signup";
import { MarketingShell } from "@/components/marketing/marketing-shell";

/**
 * Public pricing page — Features / Pricing / Book Demo funnel.
 * Server-independent (client component) so it renders instantly; the
 * catalogue enriches from the API when available.
 */

const FALLBACK_PLANS: PlanInfo[] = [
  { id: "p1", name: "Starter", slug: "starter", maxStudents: 500, maxTeachers: 50, maxStorageGb: 10, priceMonthly: 4999, priceYearly: 49990, currency: "INR", allowedModules: [], isActive: true },
  { id: "p2", name: "Professional", slug: "professional", maxStudents: 5000, maxTeachers: 500, maxStorageGb: 200, priceMonthly: 7999, priceYearly: 79990, currency: "INR", allowedModules: [], isActive: true },
  { id: "p3", name: "Enterprise", slug: "enterprise", maxStudents: -1, maxTeachers: -1, maxStorageGb: 1000, priceMonthly: 19999, priceYearly: 199990, currency: "INR", allowedModules: [], isActive: true },
];

const HIGHLIGHTS: Record<string, string[]> = {
  starter: ["8 core modules", "500 students · 50 teachers", "10 GB storage", "Email support"],
  professional: ["14 modules included", "5,000 students · 500 teachers", "200 GB storage", "Priority support"],
  enterprise: ["All 16 modules", "Unlimited students & teachers", "1 TB storage", "Dedicated success manager"],
};

export function PricingPage() {
  const [catalog, setCatalog] = useState<Catalog | null>(null);
  const [cycle, setCycle] = useState<"MONTHLY" | "YEARLY">("MONTHLY");

  useEffect(() => {
    let cancelled = false;
    getCatalog()
      .then((c) => {
        if (!cancelled) setCatalog(c);
      })
      .catch(() => setCatalog(null));
    return () => {
      cancelled = true;
    };
  }, []);

  const plans = (catalog?.plans.length ? catalog.plans : FALLBACK_PLANS).filter((p) => p.isActive);

  return (
    <MarketingShell>
      <section className="mx-auto max-w-7xl px-5 pb-20 pt-12 sm:px-8 lg:px-10">
        <div className="mx-auto max-w-2xl text-center">
          <p className="text-sm font-bold uppercase tracking-[0.14em] text-accent">Pricing</p>
          <h1 className="mt-3 font-display text-4xl font-extrabold tracking-tight sm:text-5xl">
            Start free. Scale when you&apos;re ready.
          </h1>
          <p className="mt-4 text-base leading-7 text-[#475569]">
            Every plan includes the 8 core academic modules. Optional modules can be added
            a-la-carte with a custom plan.
          </p>

          <div className="mt-8 inline-flex rounded-field border border-border bg-white p-1" role="group" aria-label="Billing cycle">
            <button
              type="button"
              onClick={() => setCycle("MONTHLY")}
              className={`rounded-field px-4 py-2 text-sm font-semibold transition ${
                cycle === "MONTHLY" ? "bg-accent text-white shadow-accent" : "text-[#64748B]"
              }`}
            >
              Monthly
            </button>
            <button
              type="button"
              onClick={() => setCycle("YEARLY")}
              className={`rounded-field px-4 py-2 text-sm font-semibold transition ${
                cycle === "YEARLY" ? "bg-accent text-white shadow-accent" : "text-[#64748B]"
              }`}
            >
              Yearly <span className="ml-1 rounded-full bg-success-light px-1.5 py-0.5 text-[10px] font-bold text-success-text">Save 16%</span>
            </button>
          </div>
        </div>

        {!catalog && !plans.length ? (
          <p className="mt-16 flex items-center justify-center gap-2 text-sm text-[#64748B]">
            <Loader2 className="h-4 w-4 animate-spin" aria-hidden="true" /> Loading plans…
          </p>
        ) : (
          <div className="mt-12 grid gap-6 lg:grid-cols-4">
            {plans.map((plan) => {
              const price = cycle === "MONTHLY" ? plan.priceMonthly : plan.priceYearly;
              const highlights = HIGHLIGHTS[plan.slug] ?? [
                `${plan.maxStudents === -1 ? "Unlimited" : plan.maxStudents.toLocaleString("en-IN")} students`,
                `${plan.maxStorageGb} GB storage`,
              ];
              return (
                <div
                  key={plan.slug}
                  className={`flex flex-col rounded-card border p-6 transition hover:-translate-y-1 hover:shadow-card ${
                    plan.slug === "professional"
                      ? "border-accent bg-white shadow-accent/20"
                      : "border-border bg-white"
                  }`}
                >
                  {plan.slug === "professional" ? (
                    <p className="mb-3 inline-flex w-fit rounded-full bg-accent-light px-2.5 py-1 text-[11px] font-bold uppercase tracking-wide text-accent">
                      Most popular
                    </p>
                  ) : (
                    <p className="mb-3 text-[11px] font-bold uppercase tracking-wide text-[#94A3B8]">
                      {plan.name}
                    </p>
                  )}
                  <h2 className="font-display text-xl font-bold">{plan.name}</h2>
                  <p className="mt-3 font-display text-3xl font-extrabold">
                    {formatINR(price)}
                    <span className="text-sm font-medium text-[#64748B]">
                      {cycle === "MONTHLY" ? "/month" : "/year"}
                    </span>
                  </p>
                  <ul className="mt-5 flex-1 space-y-2.5">
                    {highlights.map((h) => (
                      <li key={h} className="flex items-start gap-2 text-sm text-[#475569]">
                        <span className="mt-0.5 flex h-4 w-4 shrink-0 items-center justify-center rounded-full bg-success-light text-success-text">
                          <Check className="h-3 w-3" aria-hidden="true" />
                        </span>
                        {h}
                      </li>
                    ))}
                  </ul>
                  <Link
                    href={`/signup?plan=${plan.slug}`}
                    className={`mt-6 inline-flex h-11 items-center justify-center gap-2 rounded-field px-4 text-sm font-semibold transition ${
                      plan.slug === "professional"
                        ? "bg-accent text-white shadow-accent hover:bg-accent-hover"
                        : "border border-border bg-white text-primary hover:border-accent hover:text-accent"
                    }`}
                  >
                    Buy Now <ArrowRight className="h-4 w-4" aria-hidden="true" />
                  </Link>
                </div>
              );
            })}

            {/* Build your own */}
            <div className="flex flex-col rounded-card border border-dashed border-accent-border bg-accent-light/60 p-6 transition hover:-translate-y-1 hover:shadow-card">
              <p className="mb-3 inline-flex w-fit rounded-full bg-secondary-light px-2.5 py-1 text-[11px] font-bold uppercase tracking-wide text-secondary-text">
                <Sparkles className="mr-1 h-3 w-3" aria-hidden="true" /> Flexible
              </p>
              <h2 className="font-display text-xl font-bold">Build Your Own Plan</h2>
              <p className="mt-3 text-sm leading-6 text-[#475569]">
                Pick exactly the modules you need and pay only for those — live price as you
                select.
              </p>
              <div className="mt-4 flex-1 rounded-field bg-white p-4 text-sm">
                <p className="text-[#64748B]">Optional modules from</p>
                <p className="font-display text-xl font-extrabold text-primary">
                  {formatINR(1500)}
                  <span className="text-sm font-medium text-[#64748B]">/mo each</span>
                </p>
                <p className="mt-1 text-xs text-[#64748B]">8 core modules always included</p>
              </div>
              <Link
                href="/signup?plan=custom"
                className="mt-6 inline-flex h-11 items-center justify-center gap-2 rounded-field border border-accent bg-white px-4 text-sm font-semibold text-accent transition hover:bg-accent hover:text-white"
              >
                Build Custom Plan <ArrowRight className="h-4 w-4" aria-hidden="true" />
              </Link>
            </div>
          </div>
        )}

        <div className="mt-12 rounded-card bg-primary p-6 text-center text-white sm:p-8">
          <h2 className="font-display text-2xl font-bold">Not sure where to start?</h2>
          <p className="mx-auto mt-2 max-w-xl text-sm leading-6 text-slate-300">
            Try every plan free for 14 days — no card required. Or book a demo and let our team
            map the right setup for your institution.
          </p>
          <div className="mt-6 flex flex-col justify-center gap-3 sm:flex-row">
            <Link
              href="/signup?mode=trial"
              className="inline-flex h-11 items-center justify-center gap-2 rounded-field bg-accent px-6 text-sm font-semibold text-white shadow-accent transition hover:bg-accent-hover"
            >
              Start Free Trial <ArrowRight className="h-4 w-4" aria-hidden="true" />
            </Link>
            <Link
              href="/contact"
              className="inline-flex h-11 items-center justify-center rounded-field border border-white/20 bg-white/5 px-6 text-sm font-semibold text-white transition hover:bg-white/10"
            >
              Book Demo
            </Link>
          </div>
        </div>
      </section>
    </MarketingShell>
  );
}
