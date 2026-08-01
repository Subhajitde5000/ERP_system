"use client";

import { useMemo, useState } from "react";
import Link from "next/link";
import { Info, Link2Off, Trash2, UserPlus } from "lucide-react";

import { cn, formatDate } from "@/lib/utils";
import { FormAlert } from "@/components/auth/form-alert";
import { EmptyState } from "@/components/dashboard/primitives";
import {
  FilterBar,
  FilterSelect,
  ResultCount,
  SearchBox,
} from "@/components/platform/list-filters";
import { Button } from "@/components/ui/button";
import {
  CreateButton,
  DeleteDialog,
  Field,
  ReadOnlyNote,
  StructureCard,
  StructureChip,
  StructureDialog,
  StructureHeader,
  structureInput,
} from "./structure-bits";
import type { ParentLinkBoard as Board, ParentLinkRow } from "@/types/structure";

/**
 * C-IA-12 — Parent–Student Links.
 * "Link parent accounts to student (**school only**)"
 *
 * The parenthetical is the whole shape of this page. §6.7 states
 * `parent_student_links` is "school type only" and §3 of the role design
 * lists PARENT as a school-type role, so a college tenant gets an
 * *explanation*, not an empty table — an admin staring at zero rows with no
 * reason would raise a ticket.
 *
 * `is_primary` matters more than it looks: it decides who receives the
 * attendance alert and the fee reminder, so exactly one link per student
 * carries it and promoting a second demotes the first.
 */
export function ParentLinks({
  board,
  students,
  canEdit,
}: {
  board: Board;
  /** Roster, for the student picker */
  students: { id: string; name: string; rollNo: string; className: string }[];
  /** §4.3: Principal / VP read the links; managing them is the Admin's. */
  canEdit: boolean;
}) {
  const [query, setQuery] = useState("");
  const [relation, setRelation] = useState("ALL");
  const [primaryOnly, setPrimaryOnly] = useState("ALL");
  const [creating, setCreating] = useState(false);
  const [unlinking, setUnlinking] = useState<ParentLinkRow | null>(null);
  const [notice, setNotice] = useState<string | null>(null);

  // Two independent reasons the levers disappear: the tenant is a college
  // (§6.7 is school-only) or the role only reads (§4.3). Either one is
  // enough, and they are explained separately because the fixes differ.
  const collegeTenant = board.tenantType !== "SCHOOL";
  const schoolOnly = collegeTenant || !canEdit;

  const shown = useMemo(() => {
    const q = query.trim().toLowerCase();
    return board.links.filter((l) => {
      if (relation !== "ALL" && l.relation !== relation) return false;
      if (primaryOnly === "PRIMARY" && !l.isPrimary) return false;
      if (primaryOnly === "SECONDARY" && l.isPrimary) return false;
      if (!q) return true;
      return (
        l.parentName.toLowerCase().includes(q) ||
        l.studentName.toLowerCase().includes(q) ||
        l.parentEmail.toLowerCase().includes(q) ||
        l.studentRollNo.toLowerCase().includes(q)
      );
    });
  }, [board.links, query, relation, primaryOnly]);

  const relations = useMemo(
    () => [...new Set(board.links.map((l) => l.relation))].sort(),
    [board.links],
  );

  /** Students with no link at all — the gap this page closes. */
  const withoutPrimary = useMemo(() => {
    const byStudent = new Map<string, ParentLinkRow[]>();
    for (const l of board.links) {
      byStudent.set(l.studentId, [...(byStudent.get(l.studentId) ?? []), l]);
    }
    return [...byStudent.entries()]
      .filter(([, links]) => !links.some((l) => l.isPrimary))
      .map(([studentId, links]) => ({
        studentId,
        studentName: links[0]!.studentName,
      }));
  }, [board.links]);

  return (
    <div className="mx-auto w-full min-w-0 max-w-5xl">
      <StructureHeader
        title="Parent links"
        description="Which parent account receives notices, attendance alerts and fee reminders for which student."
        action={
          schoolOnly ? (
            collegeTenant ? undefined : <ReadOnlyNote />
          ) : (
            <CreateButton label="Link a parent" onClick={() => setCreating(true)} />
          )
        }
      />

      {/* §6.7 is school-only. Say why, rather than showing an empty table. */}
      {collegeTenant && (
        <div className="mb-4 flex min-w-0 items-start gap-2.5 rounded-field border border-accent-border bg-accent-light px-3.5 py-3">
          <Info className="mt-0.5 h-4 w-4 shrink-0 text-accent" aria-hidden="true" />
          <div className="min-w-0 text-[12px] leading-6 text-[#3730A3]">
            <p className="font-semibold">
              This institution is registered as a college.
            </p>
            <p>
              Parent accounts are a school-type feature — students hold their
              own accounts here, so there is nothing to link. The records below
              are shown read-only; switch the tenant to a school to manage them.
            </p>
          </div>
        </div>
      )}

      {notice && (
        <FormAlert variant="info" className="mb-4">
          {notice}
        </FormAlert>
      )}

      {!schoolOnly && board.unlinked.length > 0 && (
        <StructureCard className="mb-4">
          <h2 className="flex min-w-0 items-center gap-2 font-display text-[15px] font-bold text-foreground">
            <Link2Off
              className="h-4 w-4 shrink-0 text-[#B45309]"
              aria-hidden="true"
            />
            {board.unlinked.length} students with no parent linked
          </h2>
          <p className="mt-1 text-[12px] leading-6 text-muted-foreground">
            Nobody receives their attendance alerts or fee reminders.
          </p>
          <ul className="mt-2 flex min-w-0 flex-wrap gap-1.5">
            {board.unlinked.map((u) => (
              <li
                key={u.studentId}
                className="inline-flex shrink-0 items-center gap-1.5 rounded-full bg-warning-light px-2.5 py-1 text-[11px] font-medium text-[#B45309]"
              >
                {u.studentName}
                <span className="opacity-80">{u.className}</span>
              </li>
            ))}
          </ul>
        </StructureCard>
      )}

      {withoutPrimary.length > 0 && (
        <FormAlert variant="error" className="mb-4">
          {withoutPrimary.map((s) => s.studentName).join(", ")}{" "}
          {withoutPrimary.length === 1 ? "has" : "have"} linked parents but no
          primary contact. Alerts have no single recipient.
        </FormAlert>
      )}

      <StructureCard>
        <SearchBox
          id="pl-search"
          label="Search parent links"
          value={query}
          onChange={setQuery}
          placeholder="Search by parent, student, email or roll number…"
        />

        <FilterBar>
          <FilterSelect
            id="pl-relation"
            label="Filter by relation"
            value={relation}
            onChange={setRelation}
            allLabel="Any relation"
            options={relations.map((r) => [r, r])}
          />
          <FilterSelect
            id="pl-primary"
            label="Filter by contact type"
            value={primaryOnly}
            onChange={setPrimaryOnly}
            allLabel="Any contact"
            options={[
              ["PRIMARY", "Primary contact"],
              ["SECONDARY", "Secondary contact"],
            ]}
          />
        </FilterBar>

        <ResultCount count={shown.length} noun="link" />

        {shown.length === 0 ? (
          <EmptyState
            message={
              board.links.length === 0
                ? "No parent accounts are linked yet."
                : "No links match these filters."
            }
          />
        ) : (
          <div className="-mx-1 overflow-x-auto px-1">
            <table className="w-full min-w-[720px] border-collapse">
              <caption className="sr-only">
                Parent–student links — {shown.length} rows
              </caption>
              <thead>
                <tr className="border-b border-border">
                  {[
                    "Parent",
                    "Relation",
                    "Student",
                    "Class",
                    "Linked",
                    "",
                  ].map((h, i) => (
                    <th
                      key={i}
                      scope="col"
                      className="py-2 pr-3 text-left text-[11px] font-semibold uppercase tracking-wide text-muted-foreground"
                    >
                      {h}
                    </th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {shown.map((l) => (
                  <tr key={l.id} className="border-b border-border last:border-0">
                    <th scope="row" className="py-3 pr-3 text-left align-top">
                      <span className="flex min-w-0 flex-wrap items-center gap-2">
                        <span className="min-w-0 truncate text-[13px] font-medium text-foreground">
                          {l.parentName}
                        </span>
                        {l.isPrimary && (
                          <StructureChip tone="success">Primary</StructureChip>
                        )}
                      </span>
                      <span className="block truncate text-[11px] font-normal text-muted-foreground">
                        {l.parentEmail}
                        {l.parentPhone && ` · ${l.parentPhone}`}
                      </span>
                    </th>
                    <td className="py-3 pr-3 align-top text-[12px] text-muted-foreground">
                      {l.relation}
                    </td>
                    <td className="py-3 pr-3 align-top">
                      <Link
                        href={`/students/${l.studentId}`}
                        className="block truncate rounded text-[13px] text-foreground transition-colors hover:text-accent focus-visible:outline-none focus-visible:ring-3 focus-visible:ring-accent/15"
                      >
                        {l.studentName}
                      </Link>
                      <span className="block font-mono text-[11px] text-muted-foreground">
                        {l.studentRollNo}
                      </span>
                    </td>
                    <td className="py-3 pr-3 align-top text-[12px] text-muted-foreground">
                      {l.studentClassName}
                    </td>
                    <td className="py-3 pr-3 align-top text-[12px] text-muted-foreground">
                      {formatDate(l.createdAt)}
                    </td>
                    <td className="py-3 align-top text-right">
                      {!schoolOnly && (
                        <button
                          type="button"
                          aria-label={`Unlink ${l.parentName} from ${l.studentName}`}
                          onClick={() => setUnlinking(l)}
                          className={cn(
                            "rounded-lg p-1.5 text-muted-foreground transition-colors",
                            "hover:bg-destructive-light hover:text-destructive-text focus-visible:outline-none focus-visible:ring-3 focus-visible:ring-accent/15",
                          )}
                        >
                          <Trash2 className="h-4 w-4" aria-hidden="true" />
                        </button>
                      )}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </StructureCard>

      <p className="mt-4 text-[12px] text-muted-foreground">
        One parent may be linked to several children, and a student may have
        both parents linked — only the primary contact receives alerts.
      </p>

      {creating && (
        <LinkParentDialog
          students={students}
          existing={board.links}
          onClose={() => setCreating(false)}
          onDone={(message) => {
            setCreating(false);
            setNotice(message);
          }}
        />
      )}

      {unlinking && (
        <DeleteDialog
          entity="link"
          name={`${unlinking.parentName} → ${unlinking.studentName}`}
          blockedReason={
            // Removing the only primary contact leaves nobody receiving
            // alerts — worth stopping, not just warning about.
            unlinking.isPrimary &&
            board.links.filter((l) => l.studentId === unlinking.studentId)
              .length > 1
              ? `${unlinking.parentName} is the primary contact for ${unlinking.studentName}. Promote another parent to primary first.`
              : null
          }
          onCancel={() => setUnlinking(null)}
          onConfirm={() => {
            const label = unlinking.parentName;
            setUnlinking(null);
            setNotice(
              `DELETE /parent-links/${unlinking.id} — API not connected yet (Dev-A, C-IA-12). ${label} would be unlinked.`,
            );
          }}
        />
      )}
    </div>
  );
}

/* ── Link a parent ──────────────────────────────────────────────────────── */

function LinkParentDialog({
  students,
  existing,
  onClose,
  onDone,
}: {
  students: { id: string; name: string; rollNo: string; className: string }[];
  existing: ParentLinkRow[];
  onClose: () => void;
  onDone: (message: string) => void;
}) {
  const [studentId, setStudentId] = useState(students[0]?.id ?? "");
  const [parentName, setParentName] = useState("");
  const [parentEmail, setParentEmail] = useState("");
  const [parentPhone, setParentPhone] = useState("");
  const [relation, setRelation] = useState("Father");
  const [isPrimary, setIsPrimary] = useState(true);
  const [errors, setErrors] = useState<Record<string, string>>({});
  const [busy, setBusy] = useState(false);

  const student = students.find((s) => s.id === studentId);
  const siblings = existing.filter((l) => l.studentId === studentId);
  const existingPrimary = siblings.find((l) => l.isPrimary);

  async function onSubmit(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    if (busy) return;

    const next: Record<string, string> = {};
    if (!studentId) next.student = "Choose a student";
    if (!parentName.trim()) next.parentName = "Enter the parent's name";

    if (!parentEmail.trim()) next.parentEmail = "Enter the parent's email";
    else if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(parentEmail))
      next.parentEmail = "That doesn't look like an email address";
    // UNIQUE (parent_id, student_id) — §6.7
    else if (
      siblings.some(
        (l) => l.parentEmail.toLowerCase() === parentEmail.trim().toLowerCase(),
      )
    )
      next.parentEmail = "That parent is already linked to this student";

    setErrors(next);
    if (Object.keys(next).length) return;

    setBusy(true);
    // TODO(Dev-A): POST /api/v1/parent-links — creates the PARENT user in
    // `users` (§5.5) if the email is new, the PARENT role assignment (§5.6),
    // and the `parent_student_links` row (§6.7). Setting `is_primary` must
    // clear the previous primary for that student in the same transaction.
    await new Promise((r) => setTimeout(r, 800));
    setBusy(false);
    onDone(
      `POST /parent-links { student_id: "${studentId}", email: "${parentEmail}", relation: "${relation}", is_primary: ${isPrimary} } — API not connected yet (Dev-A, C-IA-12).`,
    );
  }

  return (
    <StructureDialog
      titleId="link-parent-title"
      title="Link a parent"
      description="Creates the parent account if the email is new, and sends them an activation link."
      onClose={onClose}
      wide
    >
      <form onSubmit={onSubmit} noValidate className="space-y-4">
        <Field
          id="pl-student"
          label="Student"
          error={errors.student}
          hint={
            student
              ? `${student.className} · ${siblings.length} parent${siblings.length === 1 ? "" : "s"} already linked`
              : undefined
          }
        >
          <select
            id="pl-student"
            value={studentId}
            onChange={(e) => setStudentId(e.target.value)}
            className={structureInput(!!errors.student)}
          >
            {students.map((s) => (
              <option key={s.id} value={s.id}>
                {s.name} — {s.rollNo} · {s.className}
              </option>
            ))}
          </select>
        </Field>

        <div className="grid min-w-0 gap-4 sm:grid-cols-2">
          <Field id="pl-name" label="Parent name" error={errors.parentName}>
            <input
              id="pl-name"
              value={parentName}
              onChange={(e) => setParentName(e.target.value)}
              placeholder="Rajesh Mehta"
              className={structureInput(!!errors.parentName)}
            />
          </Field>

          <Field id="pl-form-relation" label="Relation">
            <select
              id="pl-form-relation"
              value={relation}
              onChange={(e) => setRelation(e.target.value)}
              className={structureInput()}
            >
              <option value="Father">Father</option>
              <option value="Mother">Mother</option>
              <option value="Guardian">Guardian</option>
            </select>
          </Field>
        </div>

        <div className="grid min-w-0 gap-4 sm:grid-cols-2">
          <Field id="pl-email" label="Email" error={errors.parentEmail}>
            <input
              id="pl-email"
              type="email"
              value={parentEmail}
              onChange={(e) => setParentEmail(e.target.value)}
              placeholder="parent@example.com"
              className={structureInput(!!errors.parentEmail)}
            />
          </Field>

          <Field id="pl-phone" label="Phone" optional>
            <input
              id="pl-phone"
              value={parentPhone}
              onChange={(e) => setParentPhone(e.target.value)}
              placeholder="+91 98860 21145"
              className={structureInput()}
            />
          </Field>
        </div>

        <label htmlFor="pl-form-primary" className="flex min-w-0 items-start gap-2.5">
          <input
            id="pl-form-primary"
            type="checkbox"
            checked={isPrimary}
            onChange={(e) => setIsPrimary(e.target.checked)}
            className="mt-0.5 h-4 w-4 shrink-0 rounded border-border text-accent focus:ring-3 focus:ring-accent/15"
          />
          <span className="min-w-0 text-[13px] text-[#334155]">
            Primary contact
            <span className="block text-[12px] text-muted-foreground">
              Receives attendance alerts and fee reminders.
              {isPrimary && existingPrimary && (
                <>
                  {" "}
                  <span className="font-medium text-[#B45309]">
                    {existingPrimary.parentName} is currently primary and would
                    be demoted.
                  </span>
                </>
              )}
            </span>
          </span>
        </label>

        {Object.keys(errors).length > 0 && (
          <FormAlert variant="error">
            Check the highlighted fields and try again.
          </FormAlert>
        )}

        <div className="flex flex-wrap justify-end gap-2 pt-1">
          <button
            type="button"
            onClick={onClose}
            className="inline-flex h-11 items-center rounded-field border border-border px-4 text-[14px] font-medium text-[#475569] transition-colors hover:bg-background focus-visible:outline-none focus-visible:ring-3 focus-visible:ring-accent/15"
          >
            Cancel
          </button>
          <Button
            type="submit"
            loading={busy}
            loadingText="Linking…"
            className="w-auto px-5"
          >
            <UserPlus className="h-4 w-4" aria-hidden="true" />
            Link parent
          </Button>
        </div>
      </form>
    </StructureDialog>
  );
}
