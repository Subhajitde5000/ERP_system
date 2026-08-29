"use client";

/**
 * C-PA-10 / C-PA-11 — notices and fees for one child.
 *
 * Notices are the child's own board, not a guardian broadcast: the server applies
 * the student's visibility rules (institution / department / class scope), so a
 * notice addressed to one section never appears on another family's screen. The
 * "read" tick is deliberately missing — it measures whether the *student* looked,
 * and checking it from a parent account would falsify a number the school uses.
 *
 * Fees are the most sensitive thing in this portal: money, in one number, on a
 * screen a sibling may be holding. That is why `finance` is a module of its own
 * on the link (a school can give one parent attendance and the other the fees),
 * and why the balance arrives already filtered server-side rather than hidden by CSS.
 */

import { useState } from "react";

import { Card, EmptyState } from "@/components/admin/ui";
import { AsyncState, MetricCard, dateOnly, statusLabel } from "@/components/principal/principal-ui";
import { useResource } from "@/hooks/use-resource";
import { fetchChildFees, fetchChildNotices } from "@/lib/parent";
import { useParentConsole } from "./parent-console-context";
import { ChildGate, FactGrid, ListTable } from "./parent-shared";

function useChildId() {
  const { activeChild } = useParentConsole();
  return activeChild?.student_id ?? "";
}

export function ParentChildNoticesPage() {
  const childId = useChildId();
  const [query, setQuery] = useState("");
  const resource = useResource(
    () =>
      childId
        ? fetchChildNotices(childId, { query: query.trim() || undefined, limit: 100 })
        : Promise.reject(new Error("no child")),
    [childId, query],
  );

  return (
    <ChildGate module="notice" title="{child}'s notices" subtitle="Circulars addressed to the class or the whole school">
      <div className="mb-4 flex flex-wrap items-center gap-3">
        <input
          type="search"
          value={query}
          onChange={(event) => setQuery(event.target.value)}
          placeholder="Search this board"
          aria-label="Search notices"
          className="h-10 w-full max-w-xs rounded-field border border-border bg-white px-3 text-sm text-primary placeholder:text-muted-foreground focus:border-accent focus:outline-none"
        />
        {resource.data ? (
          <span className="text-xs font-semibold text-muted-foreground">
            {resource.data.unread_count} unread · {resource.data.total} shown
          </span>
        ) : null}
      </div>
      <AsyncState loading={resource.loading} error={resource.error} onRetry={resource.reload} loadingLabel="Loading notices…">
        {resource.data?.items.length ? (
          <div className="space-y-3">
            {resource.data.items.map((notice) => (
              <Card key={notice.id} className={notice.is_pinned ? "border-accent-border bg-accent-light/40" : ""}>
                <div className="flex flex-wrap items-baseline justify-between gap-2">
                  <p className="font-display text-base font-bold text-primary">{notice.title}</p>
                  <div className="flex flex-wrap items-center gap-2 text-[11px]">
                    {notice.priority !== "NORMAL" ? (
                      <span
                        className={`rounded-full px-2.5 py-1 font-bold ${
                          notice.priority === "URGENT"
                            ? "bg-destructive-light text-destructive-text"
                            : "bg-warning-light text-warning-text"
                        }`}
                      >
                        {statusLabel(notice.priority)}
                      </span>
                    ) : null}
                    {notice.is_pinned ? (
                      <span className="rounded-full bg-accent-light px-2.5 py-1 font-bold text-accent">Pinned</span>
                    ) : null}
                    <span className="text-muted-foreground">{dateOnly(notice.published_at)}</span>
                  </div>
                </div>
                <p className="mt-2 whitespace-pre-wrap text-sm text-muted-foreground">{notice.body}</p>
                <p className="mt-3 text-[11px] text-muted-foreground">
                  {[notice.author_name && `From ${notice.author_name}`, notice.target_name && `${notice.target_scope} · ${notice.target_name}`, notice.expires_at && `expires ${dateOnly(notice.expires_at)}`]
                    .filter(Boolean)
                    .join(" · ") || "School notice board"}
                </p>
              </Card>
            ))}
          </div>
        ) : (
          <Card>
            <EmptyState text={query ? "No notice matches that search." : "Nothing has been posted to this board yet."} />
          </Card>
        )}
      </AsyncState>
    </ChildGate>
  );
}

export function ParentChildFeesPage() {
  const childId = useChildId();
  const resource = useResource(
    () => (childId ? fetchChildFees(childId) : Promise.reject(new Error("no child"))),
    [childId],
  );

  return (
    <ChildGate module="finance" title="{child}'s fees" subtitle="The account as the accounts department has it">
      <AsyncState loading={resource.loading} error={resource.error} onRetry={resource.reload} loadingLabel="Loading the fee account…">
        {resource.data ? (
          <div className="space-y-6">
            <section className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
              <MetricCard label="Net payable" value={rupees(resource.data.net_payable)} hint={resource.data.academic_year ?? "this year"} />
              <MetricCard label="Paid" value={rupees(resource.data.total_paid)} tone="success" hint="All receipts" />
              <MetricCard
                label="Balance due"
                value={rupees(resource.data.balance_due)}
                tone={resource.data.balance_due > 0 ? "warning" : "success"}
                hint={statusLabel(resource.data.status)}
              />
              <MetricCard
                label="Waived / scholarship"
                value={rupees(resource.data.concession_amount + resource.data.scholarship_amount)}
                hint="Applied by the school"
              />
            </section>

            <Card className="!p-0">
              <p className="border-b border-border px-5 py-4 font-display text-base font-bold text-primary">
                Instalments
              </p>
              <ListTable
                head={["Instalment", "Amount", "Due", "Paid", "Status"]}
                rows={resource.data.installments.map((item) => [
                  <span key="label">
                    {item.label}
                    <span className="block text-[11px] font-normal text-muted-foreground">#{item.installment_number}</span>
                  </span>,
                  rupees(item.amount),
                  dateOnly(item.due_date),
                  rupees(item.paid_amount),
                  <span
                    key="status"
                    className={`rounded-full px-2.5 py-1 text-[11px] font-bold ${
                      item.status === "PAID"
                        ? "bg-success-light text-success-text"
                        : item.status === "OVERDUE"
                          ? "bg-destructive-light text-destructive-text"
                          : "bg-warning-light text-warning-text"
                    }`}
                  >
                    {statusLabel(item.status)}
                    {item.late_fine ? ` · +${rupees(item.late_fine)}` : ""}
                  </span>,
                ])}
              />
            </Card>

            <Card className="!p-0">
              <p className="border-b border-border px-5 py-4 font-display text-base font-bold text-primary">
                Receipts
              </p>
              <ListTable
                head={["Receipt", "Date", "Mode", "Reference", "Amount"]}
                rows={resource.data.payments.map((payment) => [
                  payment.receipt_number,
                  dateOnly(payment.payment_date),
                  statusLabel(payment.payment_mode),
                  payment.transaction_reference ?? "—",
                  rupees(payment.amount),
                ])}
              />
            </Card>

            {resource.data.grants.length ? (
              <Card>
                <p className="mb-3 font-display text-base font-bold text-primary">Scholarships applied</p>
                <FactGrid
                  facts={resource.data.grants.flatMap((grant) => [
                    [grant.scholarship_name ?? "Grant", `${rupees(grant.amount_granted)} · ${dateOnly(grant.granted_at)}`],
                  ])}
                />
              </Card>
            ) : null}

            <p className="text-[11px] text-muted-foreground">
              Payment is not accepted here, and the balance shown is the accounts department&rsquo;s figure — if
              you have paid and it still shows dues, take the receipt number to the office and it will be
              reconciled on the same screen you are reading.
            </p>
          </div>
        ) : null}
      </AsyncState>
    </ChildGate>
  );
}

/** Rupees without paise: a fee demand with ".00" on it reads like an invoice error. */
function rupees(value: number): string {
  return `₹${Number(value || 0).toLocaleString("en-IN", { maximumFractionDigits: 0 })}`;
}
