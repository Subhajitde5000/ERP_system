"use client";

import { useEffect } from "react";
import Link from "next/link";
import { useParams } from "next/navigation";
import { ArrowLeft, Download, Receipt } from "lucide-react";

import { fetchStudentFees } from "@/lib/student";
import { Card, EmptyState, PageHeader } from "@/components/admin/ui";
import { useInstitutionAuth } from "@/hooks/use-institution-auth";
import { useResource } from "@/hooks/use-resource";
import { AsyncState, MetricCard, dateOnly, dateTime, statusLabel } from "@/components/principal/principal-ui";

function inr(amount: number): string {
  return `₹${amount.toLocaleString("en-IN", { minimumFractionDigits: 0 })}`;
}

/** C-ST-20 — own fee account: totals, installments, payments, scholarships. Offline/COD ERP — no online payment. */
export function StudentFeesPage() {
  const resource = useResource(fetchStudentFees, []);

  const notFound =
    resource.error && resource.error.includes("No fee account") ? resource.error : null;

  return (
    <div className="mx-auto max-w-5xl">
      <PageHeader title="My fee account" subtitle="Your fee structure, installments, payments and scholarships for the current year." />
      {notFound ? (
        <Card>
          <EmptyState text="No fee account has been set up for you this academic year. Contact the accounts office." />
        </Card>
      ) : (
        <AsyncState loading={resource.loading} error={resource.error} onRetry={resource.reload} loadingLabel="Loading your fee account…">
          {resource.data ? (
            <div className="space-y-6">
              <section className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
                <MetricCard label="Net payable" value={inr(resource.data.net_payable)} hint={`${resource.data.academic_year ?? "Current year"} fees`} />
                <MetricCard label="Paid so far" value={inr(resource.data.total_paid)} hint="All recorded receipts" tone="success" />
                <MetricCard
                  label="Balance due"
                  value={inr(resource.data.balance_due)}
                  hint={statusLabel(resource.data.status)}
                  tone={resource.data.balance_due > 0 ? "warning" : "success"}
                />
                <MetricCard
                  label="Concessions & scholarships"
                  value={inr(resource.data.concession_amount + resource.data.scholarship_amount)}
                  hint={`Gross fee ${inr(resource.data.total_fee)}`}
                />
              </section>

              <Card className="!p-0">
                <div className="border-b border-border px-5 py-4">
                  <h2 className="font-display text-base font-bold text-primary">Installments</h2>
                  <p className="mt-1 text-xs text-muted-foreground">Pay at the accounts office with your receipt number; online payment is not available yet.</p>
                </div>
                {resource.data.installments.length ? (
                  <div className="overflow-x-auto">
                    <table className="min-w-full text-sm">
                      <thead>
                        <tr className="border-b border-border text-left text-[11px] font-bold uppercase tracking-wide text-muted-foreground">
                          <th className="px-5 py-3">#</th>
                          <th className="px-5 py-3">Installment</th>
                          <th className="px-5 py-3">Due date</th>
                          <th className="px-5 py-3">Amount</th>
                          <th className="px-5 py-3">Paid</th>
                          <th className="px-5 py-3">Late fine</th>
                          <th className="px-5 py-3">Status</th>
                        </tr>
                      </thead>
                      <tbody className="divide-y divide-border">
                        {resource.data.installments.map((installment) => (
                          <tr key={installment.id}>
                            <td className="px-5 py-3 text-muted-foreground">{installment.installment_number}</td>
                            <td className="px-5 py-3 font-semibold text-primary">{installment.label}</td>
                            <td className="px-5 py-3 text-muted-foreground">{dateOnly(installment.due_date)}</td>
                            <td className="px-5 py-3 text-muted-foreground">{inr(installment.amount)}</td>
                            <td className="px-5 py-3 text-muted-foreground">{inr(installment.paid_amount)}</td>
                            <td className="px-5 py-3 text-muted-foreground">{installment.late_fine ? inr(installment.late_fine) : "—"}</td>
                            <td className="px-5 py-3">
                              <span
                                className={`rounded-full px-2.5 py-1 text-[11px] font-bold ${
                                  installment.status === "PAID"
                                    ? "bg-success-light text-success-text"
                                    : installment.status === "OVERDUE"
                                      ? "bg-destructive-light text-destructive-text"
                                      : installment.status === "WAIVED"
                                        ? "bg-muted text-muted-foreground"
                                        : "bg-warning-light text-warning-text"
                                }`}
                              >
                                {statusLabel(installment.status)}
                              </span>
                            </td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                ) : (
                  <div className="p-6">
                    <EmptyState text="No installment plan is set up yet." />
                  </div>
                )}
              </Card>

              {resource.data.grants.length ? (
                <Card>
                  <h2 className="font-display text-base font-bold text-primary">Scholarships</h2>
                  <ul className="mt-3 space-y-2">
                    {resource.data.grants.map((grant) => (
                      <li key={grant.id} className="flex items-center justify-between gap-3 rounded-field border border-border px-4 py-3 text-sm">
                        <div>
                          <p className="font-semibold text-primary">{grant.scholarship_name ?? "Scholarship"}</p>
                          <p className="text-xs text-muted-foreground">
                            Granted {dateTime(grant.granted_at)}
                            {grant.remarks ? ` · ${grant.remarks}` : ""}
                          </p>
                        </div>
                        <span className="font-bold text-success-text">−{inr(grant.amount_granted)}</span>
                      </li>
                    ))}
                  </ul>
                </Card>
              ) : null}

              <Card className="!p-0">
                <div className="border-b border-border px-5 py-4">
                  <h2 className="font-display text-base font-bold text-primary">Payment history</h2>
                </div>
                {resource.data.payments.length ? (
                  <div className="overflow-x-auto">
                    <table className="min-w-full text-sm">
                      <thead>
                        <tr className="border-b border-border text-left text-[11px] font-bold uppercase tracking-wide text-muted-foreground">
                          <th className="px-5 py-3">Receipt</th>
                          <th className="px-5 py-3">Date</th>
                          <th className="px-5 py-3">Mode</th>
                          <th className="px-5 py-3">Reference</th>
                          <th className="px-5 py-3 text-right">Amount</th>
                        </tr>
                      </thead>
                      <tbody className="divide-y divide-border">
                        {resource.data.payments.map((payment) => (
                          <tr key={payment.id}>
                            <td className="px-5 py-3 font-semibold text-primary">
                              <Link
                                href={`/student/fees/receipt/${payment.id}`}
                                className="text-accent hover:underline"
                                title="View / print receipt"
                              >
                                {payment.receipt_number}
                              </Link>
                            </td>
                            <td className="px-5 py-3 text-muted-foreground">{dateOnly(payment.payment_date)}</td>
                            <td className="px-5 py-3 text-muted-foreground">{statusLabel(payment.payment_mode)}</td>
                            <td className="px-5 py-3 text-muted-foreground">{payment.transaction_reference ?? "—"}</td>
                            <td className="px-5 py-3 text-right font-semibold text-primary">{inr(payment.amount)}</td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                ) : (
                  <div className="p-6">
                    <EmptyState text="No payments recorded yet." />
                  </div>
                )}
              </Card>
            </div>
          ) : null}
        </AsyncState>
      )}
    </div>
  );
}

/** C-ST-20 — printable / downloadable fee receipt for one recorded payment. */
export function StudentFeeReceiptPage() {
  const params = useParams<{ paymentId: string }>();
  const paymentId = params.paymentId;
  const { user } = useInstitutionAuth();
  const resource = useResource(fetchStudentFees, []);
  const payment = resource.data?.payments.find((row) => row.id === paymentId) ?? null;

  useEffect(() => {
    document.title = payment ? `Fee receipt — ${payment.receipt_number}` : "Fee receipt";
  }, [payment]);

  return (
    <div className="mx-auto max-w-2xl">
      <div className="mb-5 flex items-center justify-between gap-3 print:hidden">
        <PageHeader title="Fee receipt" subtitle="Print it or save it as a PDF from your browser." />
        <button
          type="button"
          onClick={() => window.print()}
          className="inline-flex h-10 items-center gap-2 rounded-field bg-accent px-4 text-sm font-semibold text-white shadow-accent transition hover:bg-accent-hover"
        >
          <Download className="h-4 w-4" /> Download
        </button>
      </div>
      <AsyncState loading={resource.loading} error={resource.error} onRetry={resource.reload} loadingLabel="Loading your receipt…">
        {resource.data ? (
          payment ? (
            <Card className="print:border-2 print:border-primary print:shadow-none">
              <div className="border-b-2 border-primary pb-4 text-center">
                <Receipt className="mx-auto h-8 w-8 text-accent" aria-hidden="true" />
                <h1 className="mt-2 font-display text-xl font-extrabold tracking-tight text-primary">Official fee receipt</h1>
                <p className="mt-1 text-xs font-semibold uppercase tracking-wide text-muted-foreground">
                  Receipt No. {payment.receipt_number}
                </p>
                {resource.data.academic_year ? (
                  <p className="mt-0.5 text-[11px] text-muted-foreground">Academic year {resource.data.academic_year}</p>
                ) : null}
              </div>
              <dl className="mt-4 grid gap-x-6 gap-y-2 text-sm sm:grid-cols-2">
                <div>
                  <dt className="font-medium text-muted-foreground">Student</dt>
                  <dd className="font-semibold text-primary">{user?.name ?? "—"}</dd>
                </div>
                <div>
                  <dt className="font-medium text-muted-foreground">Payment date</dt>
                  <dd className="font-semibold text-primary">{dateOnly(payment.payment_date)}</dd>
                </div>
                <div>
                  <dt className="font-medium text-muted-foreground">Payment mode</dt>
                  <dd className="font-semibold text-primary">{statusLabel(payment.payment_mode)}</dd>
                </div>
                <div>
                  <dt className="font-medium text-muted-foreground">Transaction reference</dt>
                  <dd className="font-semibold text-primary">{payment.transaction_reference ?? "—"}</dd>
                </div>
                {payment.notes ? (
                  <div className="sm:col-span-2">
                    <dt className="font-medium text-muted-foreground">Notes</dt>
                    <dd className="font-semibold text-primary">{payment.notes}</dd>
                  </div>
                ) : null}
              </dl>
              <table className="mt-4 min-w-full border-collapse text-sm">
                <thead>
                  <tr className="border-y-2 border-primary text-left text-[11px] font-bold uppercase tracking-wide text-muted-foreground">
                    <th className="py-2 pr-3">Towards</th>
                    <th className="py-2 text-right">Amount</th>
                  </tr>
                </thead>
                <tbody>
                  <tr>
                    <td className="py-2 pr-3 font-medium text-primary">
                      Tuition &amp; fees — {resource.data.academic_year ?? "current academic year"}
                    </td>
                    <td className="py-2 text-right font-semibold text-primary">{inr(payment.amount)}</td>
                  </tr>
                </tbody>
                <tfoot>
                  <tr className="border-t-2 border-primary font-bold text-primary">
                    <td className="py-2 pr-3">Total received</td>
                    <td className="py-2 text-right">{inr(payment.amount)}</td>
                  </tr>
                </tfoot>
              </table>
              <div className="mt-4 grid gap-2 border-t border-border pt-3 text-center text-xs font-semibold text-muted-foreground sm:grid-cols-2">
                <p>
                  Balance after this payment: <span className="text-primary">{inr(resource.data.balance_due)}</span>
                </p>
                <p>
                  Account status: <span className="text-primary">{statusLabel(resource.data.status)}</span>
                </p>
              </div>
              <p className="mt-4 text-center text-[11px] text-muted-foreground">
                Computer-generated receipt — no signature required.
              </p>
            </Card>
          ) : (
            <Card>
              <EmptyState text="This receipt was not found on your fee account." />
              <div className="mt-3 text-center">
                <Link href="/student/fees" className="inline-flex h-9 items-center gap-1.5 rounded-field border border-border px-4 text-xs font-semibold text-primary hover:border-accent hover:text-accent">
                  <ArrowLeft className="h-3.5 w-3.5" /> Back to my fee account
                </Link>
              </div>
            </Card>
          )
        ) : null}
      </AsyncState>
    </div>
  );
}
