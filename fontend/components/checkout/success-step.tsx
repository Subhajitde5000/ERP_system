"use client";

import Link from "next/link";
import { ArrowRight, CheckCircle2, FileText, PartyPopper } from "lucide-react";

import type { ProvisionResult } from "@/lib/signup";

/** Step 8 — Success page after automatic provisioning. */
export function SuccessStep({ result }: { result: ProvisionResult }) {
  return (
    <div className="animate-fade-up">
      <div className="rounded-card border border-border bg-white p-8 text-center shadow-card sm:p-10">
        <span className="mx-auto flex h-16 w-16 items-center justify-center rounded-full bg-success-light">
          <PartyPopper className="h-8 w-8 text-success-text" aria-hidden="true" />
        </span>
        <h1 className="mt-5 font-display text-3xl font-extrabold tracking-tight text-primary">
          Congratulations!
        </h1>
        <p className="mt-2 text-sm text-[#64748B]">
          Your institution has been created — the provisioning pipeline ran every step
          automatically.
        </p>

        <dl className="mx-auto mt-8 max-w-sm space-y-3 rounded-field bg-[#F8FAFC] p-5 text-left">
          <Row label="Institution" value={result.tenant.name} />
          <Row label="Login URL" value={result.tenant.loginUrl} mono />
          <Row
            label="Subscription"
            value={
              result.mode === "TRIAL"
                ? "Free Trial (14 days)"
                : `${result.subscription.status} plan · ${result.subscription.currency} ${result.subscription.amount}`
            }
          />
          {result.invoice ? (
            <Row label="Invoice" value={result.invoice.number} mono />
          ) : (
            <Row label="Invoice" value="Generated at first payment" />
          )}
        </dl>

        {result.invoice ? (
          <p className="mt-4 flex items-center justify-center gap-1.5 text-xs text-[#64748B]">
            <FileText className="h-3.5 w-3.5" aria-hidden="true" />
            {result.invoice.number} · subtotal {result.invoice.subtotal} + GST{" "}
            {result.invoice.taxAmount} · paid
          </p>
        ) : null}

        <div className="mt-8">
          <Link
            href={result.tenant.loginUrl}
            className="inline-flex h-12 items-center gap-2 rounded-field bg-accent px-7 text-sm font-semibold text-white shadow-accent transition hover:bg-accent-hover"
          >
            Go To Login <ArrowRight className="h-4 w-4" aria-hidden="true" />
          </Link>
          <p className="mt-4 flex items-center justify-center gap-1.5 text-xs text-[#64748B]">
            <CheckCircle2 className="h-3.5 w-3.5 text-success-text" aria-hidden="true" />
            A welcome email with your login link was sent to {result.adminEmail}.
          </p>
        </div>
      </div>
    </div>
  );
}

function Row({ label, value, mono }: { label: string; value: string; mono?: boolean }) {
  return (
    <div className="flex items-baseline justify-between gap-4 text-sm">
      <dt className="shrink-0 text-[#64748B]">{label}</dt>
      <dd className={`text-right font-semibold text-primary ${mono ? "font-mono text-[13px]" : ""}`}>
        {value}
      </dd>
    </div>
  );
}
