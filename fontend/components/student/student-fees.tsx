"use client";

import { fetchStudentFees } from "@/lib/student";
import { Card, EmptyState, PageHeader } from "@/components/admin/ui";
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
                            <td className="px-5 py-3 font-semibold text-primary">{payment.receipt_number}</td>
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
