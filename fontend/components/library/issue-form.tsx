"use client";

import { useMemo, useState } from "react";
import Link from "next/link";
import { ArrowLeft, BookPlus, CheckCircle2, Info, TriangleAlert } from "lucide-react";

import { cn } from "@/lib/utils";
import {
  CONDITION_LABELS,
  addDays,
  findIssueProblems,
  hasBlockingIssueProblem,
} from "@/lib/library";
import { usePreviewHref } from "@/lib/use-preview-href";
import { FormAlert } from "@/components/auth/form-alert";
import { Button } from "@/components/ui/button";
import {
  Field,
  StructureCard,
  structureInput,
} from "@/components/structure/structure-bits";
import type { IssueFormContext } from "@/types/library";

/**
 * C-LB-04 — Issue Book. "issue book form"
 *
 * Copy first, then borrower, then the date: the copy fixes what is being lent,
 * and only then does "is this person allowed another one?" mean anything.
 *
 * Problems are surfaced as the librarian chooses rather than on submit — the
 * point is to steer the loan, not to reject it after the student has walked
 * to the desk.
 */
export function IssueForm({ context }: { context: IssueFormContext }) {
  const href = usePreviewHref();

  const [copyId, setCopyId] = useState("");
  const [borrowerId, setBorrowerId] = useState("");
  const [dueDate, setDueDate] = useState(
    addDays(context.today, context.loanDays),
  );
  const [errors, setErrors] = useState<Record<string, string>>({});
  const [saving, setSaving] = useState(false);
  const [saved, setSaved] = useState<string | null>(null);

  const copy = useMemo(
    () => context.copies.find((c) => c.copyId === copyId) ?? null,
    [context.copies, copyId],
  );
  const borrower = useMemo(
    () => context.borrowers.find((b) => b.id === borrowerId) ?? null,
    [context.borrowers, borrowerId],
  );

  const problems = useMemo(
    () =>
      findIssueProblems(
        {
          // Every copy in the picker is issuable by construction, so the
          // availability flag is true here; the checker still receives it so
          // the same function guards a hand-built payload.
          copy: copy
            ? {
                accessionNumber: copy.accessionNumber,
                condition: copy.condition,
                available: true,
              }
            : null,
          borrower: borrower
            ? {
                name: borrower.name,
                currentLoans: borrower.currentLoans,
                overdueLoans: borrower.overdueLoans,
              }
            : null,
          dueDate,
        },
        { today: context.today, borrowLimit: context.borrowLimit },
      ),
    [copy, borrower, dueDate, context.today, context.borrowLimit],
  );

  const blocked = hasBlockingIssueProblem(problems);

  function onSubmit(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    const next: Record<string, string> = {};
    if (!copyId) next.copy = "Choose the copy being lent.";
    if (!borrowerId) next.borrower = "Choose who is borrowing it.";
    if (!dueDate) next.dueDate = "Set a due date.";
    setErrors(next);
    if (Object.keys(next).length || blocked) return;

    setSaving(true);
    window.setTimeout(() => {
      setSaving(false);
      setSaved(
        `POST /library/issues { copy_id: "${copyId}", book_id: "${copy?.bookId}", borrower_id: "${borrowerId}", due_date: "${dueDate}" } — API not connected yet (Dev-B, C-LB-04). ${copy?.accessionNumber} would go to ${borrower?.name}.`,
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
        Issue a book
      </h1>
      <p className="mt-1 text-[13px] text-muted-foreground">
        One physical copy to one borrower. Availability is checked as you
        choose.
      </p>

      {saved && (
        <FormAlert variant="info" className="mt-4">
          {saved}
        </FormAlert>
      )}

      <form onSubmit={onSubmit} noValidate className="mt-4 grid min-w-0 gap-4">
        <StructureCard>
          <h2 className="mb-1 font-display text-[15px] font-bold text-foreground">
            1. Which copy
          </h2>
          <p className="mb-3 text-[12px] text-muted-foreground">
            {context.copies.length === 0
              ? "Every copy is currently out or withdrawn from circulation."
              : `${context.copies.length} ${context.copies.length === 1 ? "copy is" : "copies are"} on the shelf right now.`}
          </p>

          <Field id="issue-copy" label="Copy" error={errors.copy}>
            <select
              id="issue-copy"
              value={copyId}
              onChange={(e) => setCopyId(e.target.value)}
              className={structureInput(!!errors.copy)}
            >
              <option value="">Choose a copy...</option>
              {context.copies.map((c) => (
                <option key={c.copyId} value={c.copyId}>
                  {c.accessionNumber} — {c.bookTitle}
                  {c.condition !== "GOOD"
                    ? ` (${CONDITION_LABELS[c.condition].toLowerCase()})`
                    : ""}
                </option>
              ))}
            </select>
          </Field>

          {copy && (
            <p className="mt-2 break-words text-[12px] text-muted-foreground">
              {copy.authors.join(", ")}
              {copy.locationCode ? ` · shelf ${copy.locationCode}` : ""}
            </p>
          )}
        </StructureCard>

        {copy && (
          <StructureCard>
            <h2 className="mb-3 font-display text-[15px] font-bold text-foreground">
              2. Who is borrowing it
            </h2>

            <Field
              id="issue-borrower"
              label="Borrower"
              error={errors.borrower}
              hint={`Students and staff may both borrow. Limit ${context.borrowLimit} books each.`}
            >
              <select
                id="issue-borrower"
                value={borrowerId}
                onChange={(e) => setBorrowerId(e.target.value)}
                className={structureInput(!!errors.borrower)}
              >
                <option value="">Choose a borrower...</option>
                {context.borrowers.map((b) => (
                  <option key={b.id} value={b.id}>
                    {b.name} — {b.ref}
                    {b.currentLoans > 0 ? ` (${b.currentLoans} out` : ""}
                    {b.currentLoans > 0 && b.overdueLoans > 0
                      ? `, ${b.overdueLoans} late)`
                      : b.currentLoans > 0
                        ? ")"
                        : ""}
                  </option>
                ))}
              </select>
            </Field>

            <div className="mt-4">
              <Field
                id="issue-due"
                label="Due date"
                error={errors.dueDate}
                hint={`Default loan is ${context.loanDays} days.`}
              >
                <input
                  id="issue-due"
                  type="date"
                  value={dueDate}
                  onChange={(e) => setDueDate(e.target.value)}
                  className={structureInput(!!errors.dueDate)}
                />
              </Field>
            </div>
          </StructureCard>
        )}

        {problems.length > 0 && (
          <div
            className={cn(
              "min-w-0 rounded-field border p-4",
              blocked
                ? "border-destructive-border bg-white"
                : "border-warning-border bg-white",
            )}
          >
            <ul className="grid min-w-0 gap-2">
              {problems.map((p) => (
                <li key={p.kind} className="flex min-w-0 items-start gap-2">
                  <TriangleAlert
                    className={cn(
                      "mt-0.5 h-4 w-4 shrink-0",
                      p.blocking ? "text-destructive" : "text-warning",
                    )}
                    aria-hidden="true"
                  />
                  <p className="min-w-0 break-words text-[13px] text-foreground">
                    {p.message}{" "}
                    <span
                      className={cn(
                        "font-semibold",
                        p.blocking
                          ? "text-destructive-text"
                          : "text-warning-text",
                      )}
                    >
                      {p.blocking
                        ? "This must be resolved."
                        : "Allowed, but check it is intended."}
                    </span>
                  </p>
                </li>
              ))}
            </ul>
          </div>
        )}

        {copy && borrower && problems.length === 0 && (
          <p className="flex min-w-0 items-start gap-2 text-[13px] text-success-text">
            <CheckCircle2 className="mt-0.5 h-4 w-4 shrink-0" aria-hidden="true" />
            <span className="min-w-0 break-words">
              Ready to issue — {borrower.name} has no outstanding problems.
            </span>
          </p>
        )}

        <div className="flex min-w-0 flex-wrap items-center justify-between gap-3">
          <p className="flex min-w-0 items-start gap-2 text-[12px] text-muted-foreground">
            <Info className="mt-0.5 h-4 w-4 shrink-0" aria-hidden="true" />
            <span className="min-w-0">
              {context.borrowers.length} people may borrow.
            </span>
          </p>

          <div className="flex shrink-0 items-center gap-2">
            <Link
              href={href("/library/issues")}
              className="inline-flex h-11 items-center rounded-field border border-border bg-white px-5 text-[14px] font-semibold text-foreground transition-colors hover:border-accent hover:text-accent"
            >
              Cancel
            </Link>
            <Button type="submit" loading={saving} disabled={blocked} className="w-auto px-5">
              <BookPlus className="h-4 w-4" aria-hidden="true" />
              Issue book
            </Button>
          </div>
        </div>

        {blocked && (
          <p
            className="text-right text-[12px] font-medium text-destructive-text"
            role="status"
          >
            Resolve the problem above before issuing.
          </p>
        )}
      </form>
    </div>
  );
}
