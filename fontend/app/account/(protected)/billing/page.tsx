"use client";

import { useCallback, useEffect, useState } from "react";
import { Loader2 } from "lucide-react";

import {
  fetchOwnerInvoices,
  fetchOwnerPayments,
  fetchOwnerSubscriptions,
} from "@/lib/owner";
import { formatINR } from "@/lib/signup";
import type { OwnerInvoice, OwnerPayment, OwnerSubscription } from "@/types/owner";

/** Billing — Subscriptions, Invoices, Payments, all in one view. */
export default function BillingPage() {
  const [subs, setSubs] = useState<OwnerSubscription[] | null>(null);
  const [invoices, setInvoices] = useState<OwnerInvoice[] | null>(null);
  const [payments, setPayments] = useState<OwnerPayment[] | null>(null);

  const load = useCallback(async () => {
    const [s, i, p] = await Promise.allSettled([
      fetchOwnerSubscriptions(),
      fetchOwnerInvoices(),
      fetchOwnerPayments(),
    ]);
    if (s.status === "fulfilled") setSubs(s.value);
    if (i.status === "fulfilled") setInvoices(i.value);
    if (p.status === "fulfilled") setPayments(p.value);
  }, []);

  useEffect(() => {
    load();
  }, [load]);

  return (
    <div className="mx-auto max-w-5xl space-y-8">
      <header>
        <h1 className="font-display text-2xl font-extrabold tracking-tight text-primary">Billing</h1>
        <p className="mt-1 text-sm text-muted-foreground">
          Subscriptions, invoices and payments across all your institutions.
        </p>
      </header>

      <Section title="Subscriptions" loading={subs === null}>
        {subs && subs.length === 0 ? (
          <Empty text="No subscriptions yet." />
        ) : (
          <Table
            head={["Institution", "Plan", "Status", "Amount", "Renews"]}
            rows={(subs ?? []).map((s) => [
              s.tenantName,
              s.planName,
              <Pill key="s" status={s.status} />,
              formatINR(s.amount),
              s.endsAt ? new Date(s.endsAt).toLocaleDateString("en-IN") : "—",
            ])}
          />
        )}
      </Section>

      <Section title="Invoices" loading={invoices === null}>
        {invoices && invoices.length === 0 ? (
          <Empty text="No invoices yet." />
        ) : (
          <Table
            head={["Invoice", "Institution", "Status", "Issued", "Total", "Paid"]}
            rows={(invoices ?? []).map((inv) => [
              inv.invoiceNumber,
              inv.tenantName,
              <Pill key="i" status={inv.status} />,
              new Date(inv.issuedAt).toLocaleDateString("en-IN"),
              formatINR(inv.total),
              formatINR(inv.amountPaid),
            ])}
          />
        )}
      </Section>

      <Section title="Payments" loading={payments === null}>
        {payments && payments.length === 0 ? (
          <Empty text="No payments recorded yet." />
        ) : (
          <Table
            head={["Institution", "Method", "Status", "Amount", "Date"]}
            rows={(payments ?? []).map((p) => [
              p.tenantName ?? "—",
              p.method,
              <Pill key="p" status={p.status} />,
              formatINR(p.amount),
              new Date(p.createdAt).toLocaleDateString("en-IN"),
            ])}
          />
        )}
      </Section>
    </div>
  );
}

function Section({
  title,
  loading,
  children,
}: {
  title: string;
  loading: boolean;
  children: React.ReactNode;
}) {
  return (
    <section>
      <h2 className="mb-3 font-display text-lg font-bold text-primary">{title}</h2>
      {loading ? (
        <div className="flex justify-center rounded-card border border-border bg-white py-10 text-muted-foreground">
          <Loader2 className="h-5 w-5 animate-spin" aria-hidden="true" />
        </div>
      ) : (
        children
      )}
    </section>
  );
}

function Table({ head, rows }: { head: string[]; rows: React.ReactNode[][] }) {
  return (
    <div className="overflow-x-auto rounded-card border border-border bg-white">
      <table className="w-full text-left text-sm">
        <thead className="border-b border-border bg-[#F8FAFC] text-xs uppercase tracking-wide text-muted-foreground">
          <tr>
            {head.map((h) => (
              <th key={h} className="px-4 py-3 font-semibold">{h}</th>
            ))}
          </tr>
        </thead>
        <tbody>
          {rows.map((row, i) => (
            <tr key={i} className="border-b border-border last:border-0">
              {row.map((cell, j) => (
                <td key={j} className="px-4 py-3 text-[#334155]">{cell}</td>
              ))}
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}

function Pill({ status }: { status: string }) {
  const tone =
    status === "ACTIVE" || status === "PAID" || status === "SUCCEEDED"
      ? "bg-success-light text-success-text"
      : status === "TRIAL"
        ? "bg-warning-light text-warning-text"
        : status === "FAILED" || status === "OVERDUE" || status === "CANCELLED"
          ? "bg-destructive-light text-destructive-text"
          : "bg-muted text-muted-foreground";
  return <span className={`rounded-full px-2.5 py-1 text-xs font-semibold ${tone}`}>{status}</span>;
}

function Empty({ text }: { text: string }) {
  return (
    <div className="rounded-card border border-dashed border-border bg-white px-6 py-10 text-center text-sm text-muted-foreground">
      {text}
    </div>
  );
}
