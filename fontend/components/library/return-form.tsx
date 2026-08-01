"use client";

import { useState } from "react";
import Link from "next/link";
import { ArrowLeft, CheckCircle2, TriangleAlert, Undo2 } from "lucide-react";

import { cn, rupees } from "@/lib/utils";
import { CONDITION_LABELS, FINE_PER_DAY } from "@/lib/library";
import { usePreviewHref } from "@/lib/use-preview-href";
import { FormAlert } from "@/components/auth/form-alert";
import { Button } from "@/components/ui/button";
import {
  Field,
  InfoRow,
  StructureCard,
  StructureChip,
  structureInput,
} from "@/components/structure/structure-bits";
import type { BookCondition, ReturnContext } from "@/types/library";

/**
 * C-LB-05 — Return Book. "return book + fine display"
 *
 * The fine is the point of this screen, so it is recomputed on the server
 * from the due date rather than read off `book_issues.fine_amount`, which was
 * written when the loan started and is stale the moment the book is late.
 *
 * Condition is captured on the way back in: §8.1 makes `book_copies.condition`
 * the field that withdraws a copy from circulation, and a book returned
 * damaged must not be lent again.
 */
export function ReturnForm({ context }: { context: ReturnContext }) {
  const href = usePreviewHref();
  const { loan, fineDue } = context;

  const [condition, setCondition] = useState<BookCondition>("GOOD");
  const [finePaid, setFinePaid] = useState(fineDue > 0);
  const [notes, setNotes] = useState("");
  const [saving, setSaving] = useState(false);
  const [saved, setSaved] = useState<string | null>(null);

  function onSubmit(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    setSaving(true);
    window.setTimeout(() => {
      setSaving(false);
      setSaved(
        `PATCH /library/issues/${loan.id}/return { condition: "${condition}", fine_amount: ${fineDue}, fine_paid: ${finePaid}${notes ? `, notes: "${notes}"` : ""} } — API not connected yet (Dev-B, C-LB-05).`,
      );
    }, 400);
  }

  return (
    <div className="mx-auto w-full min-w-0 max-w-3xl">
      <Link
        href={href("/library/issues")}
        className="inline-flex items-center gap-1.5 text-[13px] font-medium text-muted-foreground transition-colors hover:text-accent"
      >
        <ArrowLeft className="h-4 w-4" aria-hidden="true" />
        Issued books
      </Link>

      <h1 className="mt-3 font-display text-[22px] font-bold text-foreground">
        Return a book
      </h1>
      <p className="mt-1 text-[13px] text-muted-foreground">
        Check the copy back in and settle any fine.
      </p>

      {saved && (
        <FormAlert variant="info" className="mt-4">
          {saved}
        </FormAlert>
      )}

      <div className="mt-4 grid min-w-0 gap-4">
        <StructureCard>
          <div className="flex min-w-0 flex-col gap-2 sm:flex-row sm:items-start sm:justify-between">
            <div className="min-w-0">
              <h2 className="font-display text-[15px] font-bold text-foreground">
                {loan.bookTitle}
              </h2>
              <p className="mt-0.5 break-words text-[12px] text-muted-foreground">
                {loan.accessionNumber} · {loan.borrowerName} ({loan.borrowerRef})
              </p>
            </div>
            <StructureChip tone={loan.isOverdue ? "danger" : "success"}>
              {loan.isOverdue
                ? `${loan.overdueDays} ${loan.overdueDays === 1 ? "day" : "days"} late`
                : "On time"}
            </StructureChip>
          </div>

          <dl className="mt-3 grid min-w-0 gap-x-4 gap-y-1.5 border-t border-border pt-3 sm:grid-cols-2">
            <InfoRow label="Issued">{loan.issuedAt.slice(0, 10)}</InfoRow>
            <InfoRow label="Due">{loan.dueDate}</InfoRow>
            <InfoRow label="Returning">{context.today}</InfoRow>
            <InfoRow label="Issued by">{loan.issuedByName}</InfoRow>
          </dl>
        </StructureCard>

        {/* The fine — the reason this screen exists */}
        <div
          className={cn(
            "min-w-0 rounded-field border p-4",
            fineDue > 0
              ? "border-destructive-border bg-white"
              : "border-border bg-white",
          )}
        >
          <div className="flex min-w-0 items-start gap-2">
            {fineDue > 0 ? (
              <TriangleAlert
                className="mt-0.5 h-4 w-4 shrink-0 text-destructive"
                aria-hidden="true"
              />
            ) : (
              <CheckCircle2
                className="mt-0.5 h-4 w-4 shrink-0 text-success"
                aria-hidden="true"
              />
            )}
            <div className="min-w-0">
              <p className="font-display text-[15px] font-bold text-foreground">
                {fineDue > 0 ? `Fine due: ${rupees(fineDue)}` : "No fine"}
              </p>
              <p className="mt-0.5 break-words text-[12px] text-muted-foreground">
                {fineDue > 0
                  ? `${loan.overdueDays} ${loan.overdueDays === 1 ? "day" : "days"} × ${rupees(FINE_PER_DAY)} per day. Recalculated today, so it may exceed the amount recorded when the book went out.`
                  : "The book is back within its loan period."}
              </p>
            </div>
          </div>
        </div>

        <form onSubmit={onSubmit} noValidate className="grid min-w-0 gap-4">
          <StructureCard>
            <h2 className="mb-3 font-display text-[15px] font-bold text-foreground">
              Check it in
            </h2>

            <Field
              id="ret-condition"
              label="Condition on return"
              hint="Damaged or lost withdraws the copy from circulation."
            >
              <select
                id="ret-condition"
                value={condition}
                onChange={(e) => setCondition(e.target.value as BookCondition)}
                className={structureInput()}
              >
                {(["GOOD", "FAIR", "DAMAGED", "LOST"] as BookCondition[]).map(
                  (c) => (
                    <option key={c} value={c}>
                      {CONDITION_LABELS[c]}
                    </option>
                  ),
                )}
              </select>
            </Field>

            {fineDue > 0 && (
              <div className="mt-4 flex min-w-0 items-start gap-2.5">
                <input
                  id="ret-fine-paid"
                  type="checkbox"
                  checked={finePaid}
                  onChange={(e) => setFinePaid(e.target.checked)}
                  className="mt-0.5 h-4 w-4 shrink-0 rounded border-border text-accent focus:ring-3 focus:ring-accent/15"
                />
                <label
                  htmlFor="ret-fine-paid"
                  className="min-w-0 text-[13px] text-foreground"
                >
                  Fine of {rupees(fineDue)} collected now
                  <span className="mt-0.5 block text-[12px] text-muted-foreground">
                    Leave unticked to record the return and keep the fine
                    outstanding against the borrower.
                  </span>
                </label>
              </div>
            )}

            <div className="mt-4">
              <Field id="ret-notes" label="Notes" optional>
                <textarea
                  id="ret-notes"
                  value={notes}
                  onChange={(e) => setNotes(e.target.value)}
                  rows={2}
                  placeholder="e.g. Cover corner bent"
                  className="mt-1.5 w-full min-w-0 rounded-field border border-border bg-white px-3 py-2 text-[14px] transition placeholder:text-[#94A3B8] focus:border-accent focus:outline-none focus:ring-3 focus:ring-accent/15"
                />
              </Field>
            </div>
          </StructureCard>

          <div className="flex min-w-0 flex-wrap items-center justify-end gap-2">
            <Link
              href={href("/library/issues")}
              className="inline-flex h-11 items-center rounded-field border border-border bg-white px-5 text-[14px] font-semibold text-foreground transition-colors hover:border-accent hover:text-accent"
            >
              Cancel
            </Link>
            <Button type="submit" loading={saving} className="w-auto px-5">
              <Undo2 className="h-4 w-4" aria-hidden="true" />
              Record return
            </Button>
          </div>
        </form>
      </div>
    </div>
  );
}
