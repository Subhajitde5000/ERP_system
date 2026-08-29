"use client";

/**
 * C-IA-12 — Guardian (parent) links, the office side of the parent portal.
 *
 * Real data now: every row on this board is a `parent_student_links` record and every
 * button is a call to `/api/v1/institution/parent-links`. The three things the server
 * enforces and this page must respect:
 *
 *  * **school only** — creating a link for a college is a 409, so the button is
 *    replaced by the reason rather than left to fail;
 *  * **the activation code exists once** — it is returned on the response that
 *    created or reissued it and is never listable afterwards, so it is shown in a
 *    dialog meant to be read, copied or emailed, and it is gone when the dialog
 *    closes. Nothing here re-fetches it, and the DB column is cleared on claim;
 *  * **exactly one primary per student** — promoting a second demotes the first,
 *    which is why the flag is a checkbox on the row editor and not a badge.
 *
 * `access_scope` is the part an office gets wrong first, so the editor states the
 * consequence of each box: untick `finance` and that guardian sees no fees; clear
 * everything and the link grants nothing, which the server refuses rather than
 * silently reading as "the school default of everything".
 */

import { useMemo, useState } from "react";

import { cn, formatDate } from "@/lib/utils";
import {
  createGuardianLink,
  deleteGuardianLink,
  fetchGuardianLinks,
  fetchStudents,
  issueGuardianLinkCode,
  updateGuardianLink,
  type GuardianLinkBoard,
  type GuardianLinkCreate,
  type GuardianLinkRow,
  type GuardianLinkUpdate,
} from "@/lib/institution";
import { moduleLabel, PARENT_ACCESS_MODULES, PARENT_MODULE_OPTIONS } from "@/lib/parent";
import { APIError } from "@/lib/api-client";
import { useResource } from "@/hooks/use-resource";
import { FormAlert } from "@/components/auth/form-alert";
import { EmptyState } from "@/components/dashboard/primitives";
import { Button } from "@/components/ui/button";
import {
  FilterBar,
  FilterSelect,
  ResultCount,
  SearchBox,
} from "@/components/platform/list-filters";
import {
  CreateButton,
  DeleteDialog,
  Field,
  StructureCard,
  StructureChip,
  StructureDialog,
  StructureHeader,
  structureInput,
} from "./structure-bits";

const RELATIONS = ["Father", "Mother", "Guardian", "Sibling", "Uncle", "Aunt", "Grandparent", "Other"];

/** The board asks for a page this size; anything larger is narrowed, not paged. */
const BOARD_LIMIT = 200;

export function ParentLinks() {
  const board = useResource<GuardianLinkBoard>(() => fetchGuardianLinks({ limit: BOARD_LIMIT }), []);
  const roster = useResource(fetchStudents, []);
  const [query, setQuery] = useState("");
  const [status, setStatus] = useState("ALL");
  const [relation, setRelation] = useState("ALL");
  const [creating, setCreating] = useState(false);
  const [editing, setEditing] = useState<GuardianLinkRow | null>(null);
  const [unlinking, setUnlinking] = useState<GuardianLinkRow | null>(null);
  const [issued, setIssued] = useState<{ row: GuardianLinkRow; created: boolean } | null>(null);
  const [busy, setBusy] = useState(false);
  const [failure, setFailure] = useState<string | null>(null);
  const [notice, setNotice] = useState<string | null>(null);

  const rows = useMemo(() => board.data?.items ?? [], [board.data]);
  // §6.7 is school-only. An admin of a college gets the reason, not an empty table.
  const collegeTenant = board.data ? board.data.tenant_type !== "SCHOOL" : false;

  const shown = useMemo(() => {
    const q = query.trim().toLowerCase();
    return rows.filter((l) => {
      if (status !== "ALL" && l.status !== status) return false;
      if (relation !== "ALL" && l.relation !== relation) return false;
      if (!q) return true;
      return [l.parent_name, l.student_name, l.parent_email, l.student_roll_no, l.class_name]
        .filter((value): value is string => Boolean(value))
        .some((value) => value.toLowerCase().includes(q));
    });
  }, [rows, query, status, relation]);

  const relations = useMemo(
    () => [...new Set(rows.map((l) => l.relation))].sort(),
    [rows],
  );

  /** Linked students with no primary contact: alerts have no single recipient. */
  const withoutPrimary = useMemo(() => {
    const byStudent = new Map<string, GuardianLinkRow[]>();
    for (const l of rows) byStudent.set(l.student_id, [...(byStudent.get(l.student_id) ?? []), l]);
    return [...byStudent.values()]
      .filter((links) => !links.some((l) => l.is_primary && l.status === "ACTIVE"))
      .map((links) => links[0]!.student_name);
  }, [rows]);

  async function run(action: () => Promise<unknown>, then?: () => void) {
    setBusy(true);
    setFailure(null);
    try {
      await action();
      then?.();
      await board.reload();
    } catch (caught) {
      setFailure(messageOf(caught));
    } finally {
      setBusy(false);
    }
  }

  return (
    <div className="mx-auto w-full min-w-0 max-w-5xl">
      <StructureHeader
        title="Guardian links"
        description="Which guardian account sees which student, and which parts of the record they are allowed to open."
        action={
          !board.data || collegeTenant ? undefined : (
            <CreateButton label="Link a guardian" onClick={() => setCreating(true)} />
          )
        }
      />

      {board.error ? (
        <FormAlert variant="error" className="mb-4">
          {board.error}
        </FormAlert>
      ) : null}
      {failure ? (
        <FormAlert variant="error" className="mb-4">
          {failure}
        </FormAlert>
      ) : null}
      {notice ? (
        <FormAlert variant="info" className="mb-4">
          {notice}
        </FormAlert>
      ) : null}

      {collegeTenant && (
        <div className="mb-4 flex min-w-0 items-start gap-2.5 rounded-field border border-accent-border bg-accent-light px-3.5 py-3">
          <div className="min-w-0 text-[12px] leading-6 text-[#3730A3]">
            <p className="font-semibold">This institution is registered as a college.</p>
            <p>
              Guardian access is a school-type feature — students hold their own
              accounts here, so there is nothing to link. Existing rows below stay
              readable and removable so a tenant that changed type can still clean up
              what it made.
            </p>
          </div>
        </div>
      )}

      {board.data ? <Counts board={board.data} /> : null}

      {board.data && board.data.unlinked_count > 0 && !collegeTenant ? (
        <StructureCard className="mb-4">
          <h2 className="flex min-w-0 items-center gap-2 font-display text-[15px] font-bold text-foreground">
            {board.data.unlinked_count} student{board.data.unlinked_count === 1 ? "" : "s"} with no guardian
          </h2>
          <p className="mt-1 text-[12px] leading-6 text-muted-foreground">
            Nobody receives their absence alerts, marks or fee reminders.
          </p>
          <ul className="mt-2 flex min-w-0 flex-wrap gap-1.5">
            {board.data.unlinked.map((u) => (
              <li
                key={u.student_id}
                className="inline-flex shrink-0 items-center gap-1.5 rounded-full bg-warning-light px-2.5 py-1 text-[11px] font-medium text-[#B45309]"
              >
                {u.student_name}
                <span className="opacity-80">{u.class_name ?? "unassigned"}</span>
              </li>
            ))}
          </ul>
          {board.data.unlinked_count > board.data.unlinked.length ? (
            <p className="mt-2 text-[11px] text-muted-foreground">
              The {board.data.unlinked.length} listed first — the rest appear in the student roster.
            </p>
          ) : null}
        </StructureCard>
      ) : null}

      {withoutPrimary.length > 0 && (
        <FormAlert variant="error" className="mb-4">
          {withoutPrimary.join(", ")}{" "}
          {withoutPrimary.length === 1 ? "has" : "have"} linked guardians but no active primary
          contact. Attendance and fee reminders have no single recipient.
        </FormAlert>
      )}

      <StructureCard>
        <SearchBox
          id="pl-search"
          label="Search guardian links"
          value={query}
          onChange={setQuery}
          placeholder="Search by guardian, student, email or roll number…"
        />

        <FilterBar>
          <FilterSelect
            id="pl-status"
            label="Filter by status"
            value={status}
            onChange={setStatus}
            allLabel="Any status"
            options={[
              ["PENDING_CLAIM", "Waiting to be claimed"],
              ["ACTIVE", "Active"],
              ["SUSPENDED", "Suspended"],
            ]}
          />
          <FilterSelect
            id="pl-relation"
            label="Filter by relation"
            value={relation}
            onChange={setRelation}
            allLabel="Any relation"
            options={relations.map((r) => [r, r])}
          />
        </FilterBar>

        <ResultCount count={shown.length} noun="link" />

        {shown.length === 0 ? (
          <EmptyState
            message={
              board.loading
                ? "Loading guardian links…"
                : rows.length === 0
                  ? "No guardian accounts are linked yet. Link one and the school can send an activation code."
                  : "No links match these filters."
            }
          />
        ) : (
          <div className="-mx-1 overflow-x-auto px-1">
            <table className="w-full min-w-[760px] border-collapse">
              <caption className="sr-only">Guardian links — {shown.length} rows</caption>
              <thead>
                <tr className="border-b border-border">
                  {["Guardian", "Student", "Sees", "Status", "Ends", ""].map((h, i) => (
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
                    <th scope="row" className="py-3 pr-3 text-left align-top font-normal">
                      <span className="flex min-w-0 flex-wrap items-center gap-2">
                        <span className="min-w-0 truncate text-[13px] font-medium text-foreground">
                          {l.parent_name ?? l.parent_email ?? "Not yet claimed"}
                        </span>
                        {l.is_primary && <StructureChip tone="success">Primary</StructureChip>}
                      </span>
                      <span className="block truncate text-[11px] text-muted-foreground">
                        {l.relation}
                        {l.parent_email ? ` · ${l.parent_email}` : ""}
                        {l.parent_phone ? ` · ${l.parent_phone}` : ""}
                      </span>
                    </th>
                    <td className="py-3 pr-3 align-top">
                      <span className="block truncate text-[13px] text-foreground">{l.student_name}</span>
                      <span className="block font-mono text-[11px] text-muted-foreground">
                        {l.student_roll_no ?? "—"}
                        {l.class_name ? ` · ${l.class_name}` : ""}
                      </span>
                    </td>
                    <td className="py-3 pr-3 align-top">
                      <span className="flex min-w-0 flex-wrap gap-1">
                        {l.access_scope.map((module) => (
                          <span
                            key={module}
                            className="rounded-full bg-muted px-2 py-0.5 text-[10px] font-medium text-[#475569]"
                          >
                            {moduleLabel(module)}
                          </span>
                        ))}
                      </span>
                    </td>
                    <td className="py-3 pr-3 align-top">
                      <StructureChip
                        tone={
                          l.status === "ACTIVE"
                            ? "success"
                            : l.status === "SUSPENDED"
                              ? "danger"
                              : "warning"
                        }
                      >
                        {l.status === "PENDING_CLAIM"
                          ? "Waiting to claim"
                          : l.status === "ACTIVE"
                            ? "Active"
                            : "Suspended"}
                      </StructureChip>
                      {l.parent_is_active === false && l.status === "ACTIVE" ? (
                        <span className="mt-1 block text-[10px] text-destructive-text">
                          guardian account disabled
                        </span>
                      ) : null}
                    </td>
                    <td className="py-3 pr-3 align-top text-[12px] text-muted-foreground">
                      {l.access_upto ? formatDate(l.access_upto) : "no end date"}
                    </td>
                    <td className="py-3 align-top text-right">
                      <div className="flex justify-end gap-1">
                        {l.status === "PENDING_CLAIM" || l.status === "SUSPENDED" ? (
                          <button
                            type="button"
                            aria-label={
                              l.status === "PENDING_CLAIM"
                                ? `Resend the activation code for ${l.student_name}`
                                : `Restore access for ${l.parent_name ?? l.student_name}`
                            }
                            onClick={() =>
                              l.status === "PENDING_CLAIM"
                                ? run(async () => {
                                    const row = await issueGuardianLinkCode(l.id);
                                    setIssued({ row, created: false });
                                  })
                                : run(() => updateGuardianLink(l.id, { status: "ACTIVE" }))
                            }
                            disabled={busy}
                            className="rounded-lg px-2 py-1.5 text-[11px] font-semibold text-accent transition-colors hover:bg-accent-light disabled:opacity-60"
                          >
                            {l.status === "PENDING_CLAIM" ? "Send code" : "Restore"}
                          </button>
                        ) : null}
                        <button
                          type="button"
                          aria-label={`Edit the link between ${l.parent_name ?? "the guardian"} and ${l.student_name}`}
                          onClick={() => setEditing(l)}
                          className="rounded-lg p-1.5 text-muted-foreground transition-colors hover:bg-background focus-visible:outline-none focus-visible:ring-3 focus-visible:ring-accent/15"
                        >
                          <svg viewBox="0 0 24 24" className="h-4 w-4" fill="none" stroke="currentColor" strokeWidth="1.8" aria-hidden="true">
                            <path d="M12 20h9M16.5 3.5a2.1 2.1 0 0 1 3 3L7 19l-4 1 1-4Z" strokeLinecap="round" strokeLinejoin="round" />
                          </svg>
                        </button>
                        {!collegeTenant && (
                          <button
                            type="button"
                            aria-label={`Unlink ${l.parent_name ?? "guardian"} from ${l.student_name}`}
                            onClick={() => setUnlinking(l)}
                            className={cn(
                              "rounded-lg p-1.5 text-muted-foreground transition-colors",
                              "hover:bg-destructive-light hover:text-destructive-text focus-visible:outline-none focus-visible:ring-3 focus-visible:ring-accent/15",
                            )}
                          >
                            <svg viewBox="0 0 24 24" className="h-4 w-4" fill="none" stroke="currentColor" strokeWidth="1.8" aria-hidden="true">
                              <path d="M3 6h18M8 6V4h8v2m-9 0 1 14h8l1-14" strokeLinecap="round" strokeLinejoin="round" />
                            </svg>
                          </button>
                        )}
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
            {board.data && board.data.total > rows.length ? (
              <p className="mt-3 text-[11px] text-muted-foreground">
                Showing the {rows.length} most recent of {board.data.total} links — narrow
                the search to find an older one.
              </p>
            ) : null}
          </div>
        )}
      </StructureCard>

      <p className="mt-4 text-[11px] leading-6 text-muted-foreground">
        Unlinking stops the portal immediately and keeps the audit row: who granted it,
        who removed it and when. Suspension is the reversible one — use it for a
        dispute, and unlink only when the relationship has ended.
      </p>

      {creating ? (
        <LinkForm
          title="Link a guardian"
          submitLabel="Create link"
          busy={busy}
          students={(roster.data ?? []).map((s) => ({
            id: s.id,
            name: s.name,
            detail: `${s.roll_no ?? "no roll no"}${s.enrollment?.class_name ? ` · ${s.enrollment.class_name}` : ""}`,
          }))}
          onClose={() => setCreating(false)}
          onSubmit={async (payload) => {
            await run(async () => {
              const row = await createGuardianLink(payload);
              if (row.activation_code) setIssued({ row, created: true });
              else setNotice(`${row.student_name} is now linked to ${row.parent_name ?? row.parent_email}.`);
            }, () => setCreating(false));
          }}
        />
      ) : null}

      {editing ? (
        <LinkForm
          title={`Edit access — ${editing.student_name}`}
          submitLabel="Save changes"
          busy={busy}
          existing={editing}
          students={[]}
          onClose={() => setEditing(null)}
          onSubmit={async (payload) => {
            const patch: GuardianLinkUpdate = {
              relation: payload.relation,
              is_primary: payload.is_primary,
              access_scope: payload.access_scope,
              access_upto: payload.access_upto,
              note: payload.note,
              status: editing.status === "SUSPENDED" ? "SUSPENDED" : "ACTIVE",
            };
            await run(() => updateGuardianLink(editing.id, patch), () => setEditing(null));
          }}
        />
      ) : null}

      {issued ? (
        <CodeDialog
          row={issued.row}
          created={issued.created}
          onClose={() => {
            setIssued(null);
            setNotice(
              issued.created
                ? `The invitation for ${issued.row.student_name} is waiting on that code — it is not stored anywhere readable again.`
                : `A fresh code was sent to ${issued.row.parent_email}. The previous one no longer works.`,
            );
          }}
        />
      ) : null}

      {unlinking ? (
        <DeleteDialog
          entity="link"
          name={`${unlinking.parent_name ?? unlinking.parent_email ?? "the guardian"} → ${unlinking.student_name}`}
          blockedReason={null}
          busy={busy}
          onCancel={() => setUnlinking(null)}
          onConfirm={() =>
            run(async () => {
              await deleteGuardianLink(unlinking.id);
              setNotice(`Access removed for ${unlinking.student_name}. The audit row records it.`);
            }, () => setUnlinking(null))
          }
        />
      ) : null}
    </div>
  );
}

function Counts({ board }: { board: GuardianLinkBoard }) {
  const cells: [string, number, "success" | "warning" | "muted"][] = [
    ["Links", board.counts.total ?? board.total, "muted"],
    ["Waiting to claim", board.counts.PENDING_CLAIM ?? 0, "warning"],
    ["Active", board.counts.ACTIVE ?? 0, "success"],
    ["Suspended", board.counts.SUSPENDED ?? 0, "muted"],
  ];
  return (
    <div className="mb-4 grid min-w-0 grid-cols-2 gap-2 lg:grid-cols-4">
      {cells.map(([label, value, tone]) => (
        <div key={label} className="rounded-field border border-border bg-white px-3.5 py-3">
          <p className="text-[11px] font-semibold uppercase tracking-wide text-muted-foreground">{label}</p>
          <p
            className={cn(
              "mt-0.5 font-display text-[20px] font-bold",
              tone === "warning" ? "text-[#B45309]" : tone === "success" ? "text-[#15803D]" : "text-foreground",
            )}
          >
            {value}
          </p>
        </div>
      ))}
    </div>
  );
}

interface FormValue {
  student_id: string;
  relation: string;
  mode: "invite" | "account";
  parent_name: string;
  email: string;
  phone: string;
  is_primary: boolean;
  access_scope: string[];
  access_upto: string;
  note: string;
}

function emptyForm(): FormValue {
  return {
    student_id: "",
    relation: "Father",
    mode: "invite",
    parent_name: "",
    email: "",
    phone: "",
    is_primary: false,
    access_scope: [...PARENT_ACCESS_MODULES],
    access_upto: "",
    note: "",
  };
}

/**
 * One form for both create and edit. Editing drops the identity fields — a guardian
 * cannot be swapped on a link, since the link is the grant *to that person*; the
 * office unlinks and creates, which is also the only path that writes an honest
 * audit trail.
 */
function LinkForm({
  title,
  submitLabel,
  busy,
  students,
  existing,
  onClose,
  onSubmit,
}: {
  title: string;
  submitLabel: string;
  busy: boolean;
  students: { id: string; name: string; detail: string }[];
  existing?: GuardianLinkRow;
  onClose: () => void;
  onSubmit: (payload: GuardianLinkCreate) => Promise<void>;
}) {
  const [form, setForm] = useState<FormValue>(() =>
    existing
      ? {
          ...emptyForm(),
          student_id: existing.student_id,
          relation: existing.relation,
          is_primary: existing.is_primary,
          access_scope: existing.access_scope.length ? [...existing.access_scope] : [...PARENT_ACCESS_MODULES],
          access_upto: existing.access_upto ?? "",
          note: existing.note ?? "",
          email: existing.parent_email ?? "",
          parent_name: existing.parent_name ?? "",
          phone: existing.parent_phone ?? "",
        }
      : emptyForm(),
  );
  const [errors, setErrors] = useState<Record<string, string>>({});
  const [picker, setPicker] = useState("");
  const editingExisting = Boolean(existing);

  const matches = useMemo(() => {
    const q = picker.trim().toLowerCase();
    if (!q) return students.slice(0, 30);
    return students.filter((s) => `${s.name} ${s.detail}`.toLowerCase().includes(q)).slice(0, 30);
  }, [students, picker]);

  function set<K extends keyof FormValue>(key: K, value: FormValue[K]) {
    setForm((prev) => ({ ...prev, [key]: value }));
  }

  function toggleModule(module: string) {
    setForm((prev) => ({
      ...prev,
      access_scope: prev.access_scope.includes(module)
        ? prev.access_scope.filter((m) => m !== module)
        : [...prev.access_scope, module],
    }));
  }

  async function submit(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const next: Record<string, string> = {};
    if (!editingExisting && !form.student_id) next.student_id = "Choose the student";
    if (form.relation.trim().length < 2) next.relation = "Relation is required";
    if (!editingExisting && form.mode === "invite" && !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(form.email.trim()))
      next.email = "The guardian needs an email address to receive the code";
    if (!editingExisting && form.mode === "account" && form.parent_name.trim().length < 2)
      next.parent_name = "The account needs a display name";
    if (!form.access_scope.length) next.access_scope = "Pick at least one module — a link with none grants nothing";
    setErrors(next);
    if (Object.keys(next).length) return;

    await onSubmit({
      ...(editingExisting
        ? {}
        : {
            student_id: form.student_id,
            parent_user_id: null,
            create_account: form.mode === "account",
            send_email: true,
            parent_name: form.mode === "account" ? form.parent_name.trim() : null,
            email: form.email.trim() || null,
            phone: form.phone.trim() || null,
          }),
      relation: form.relation.trim(),
      is_primary: form.is_primary,
      access_scope: form.access_scope,
      access_upto: form.access_upto || null,
      note: form.note.trim() || null,
    } as GuardianLinkCreate);
  }

  return (
    <StructureDialog
      titleId="guardian-link-form"
      title={title}
      description={
        editingExisting
          ? "Who is linked cannot be changed here — unlink and create the new link so the removal and the grant are both recorded."
          : "Invite the guardian behind an activation code, or make their login now and let them set a password."
      }
      onClose={onClose}
      wide
    >
      <form onSubmit={submit} className="space-y-4">
        {!editingExisting ? (
          <>
            <Field id="gl-mode" label="How the guardian gets access">
              <div className="mt-1.5 flex flex-wrap gap-2" role="radiogroup" aria-label="Invitation method">
                {(
                  [
                    ["invite", "Send an activation code", "The row waits as PENDING_CLAIM; they choose their own password."],
                    ["account", "Create the login now", "An account is made and a set-password link is emailed, as staff invites work."],
                  ] as const
                ).map(([value, label, hint]) => (
                  <button
                    key={value}
                    type="button"
                    role="radio"
                    aria-checked={form.mode === value}
                    onClick={() => set("mode", value)}
                    className={cn(
                      "min-w-0 flex-1 rounded-field border px-3 py-2 text-left transition",
                      form.mode === value
                        ? "border-accent bg-accent-light"
                        : "border-border bg-white hover:border-accent-border",
                    )}
                  >
                    <span className="block text-[13px] font-semibold text-foreground">{label}</span>
                    <span className="mt-0.5 block text-[11px] leading-5 text-muted-foreground">{hint}</span>
                  </button>
                ))}
              </div>
            </Field>

            <Field id="gl-student" label="Student" error={errors.student_id}>
              <input
                id="gl-student-search"
                className={structureInput()}
                placeholder="Type a name, roll number or class…"
                value={picker}
                onChange={(e) => setPicker(e.target.value)}
                aria-label="Search the roster"
              />
              <select
                id="gl-student"
                size={6}
                className={cn(structureInput(), "h-40 py-2")}
                value={form.student_id}
                onChange={(e) => set("student_id", e.target.value)}
              >
                {matches.map((s) => (
                  <option key={s.id} value={s.id}>
                    {s.name} — {s.detail}
                  </option>
                ))}
                {matches.length === 0 ? <option value="">{students.length ? "No match" : "No students in the roster"}</option> : null}
              </select>
            </Field>
          </>
        ) : null}

        <div className="grid gap-4 sm:grid-cols-2">
          <Field id="gl-relation" label="Relation" error={errors.relation}>
            <input
              id="gl-relation"
              list="gl-relations"
              className={structureInput(Boolean(errors.relation))}
              value={form.relation}
              onChange={(e) => set("relation", e.target.value)}
            />
            <datalist id="gl-relations">
              {RELATIONS.map((r) => (
                <option key={r} value={r} />
              ))}
            </datalist>
          </Field>
          <Field id="gl-upto" label="Access ends" hint="Leave empty for the whole enrollment" optional>
            <input
              id="gl-upto"
              type="date"
              className={structureInput()}
              value={form.access_upto}
              onChange={(e) => set("access_upto", e.target.value)}
            />
          </Field>
        </div>

        {!editingExisting ? (
          <div className="grid gap-4 sm:grid-cols-2">
            <Field id="gl-email" label="Guardian email" error={errors.email} hint="This is the address the code is sent to">
              <input
                id="gl-email"
                type="email"
                className={structureInput(Boolean(errors.email))}
                value={form.email}
                onChange={(e) => set("email", e.target.value)}
                disabled={form.mode === "account" && false}
              />
            </Field>
            {form.mode === "account" ? (
              <Field id="gl-name" label="Guardian name" error={errors.parent_name}>
                <input
                  id="gl-name"
                  className={structureInput(Boolean(errors.parent_name))}
                  value={form.parent_name}
                  onChange={(e) => set("parent_name", e.target.value)}
                />
              </Field>
            ) : (
              <Field id="gl-phone" label="Phone" optional>
                <input
                  id="gl-phone"
                  className={structureInput()}
                  value={form.phone}
                  onChange={(e) => set("phone", e.target.value)}
                  placeholder="+91 98765 43210"
                />
              </Field>
            )}
          </div>
        ) : (
          <p className="rounded-field bg-muted px-3.5 py-2.5 text-[12px] leading-6 text-[#475569]">
            {existing!.parent_name ?? "Unclaimed"} · {existing!.parent_email ?? "no email"}
            {existing!.claimed_at ? ` · claimed ${formatDate(existing!.claimed_at)}` : " · not claimed yet"}
            {existing!.managed_by_name ? ` · set up by ${existing!.managed_by_name}` : ""}
          </p>
        )}

        <Field id="gl-modules" label="What this guardian can open" error={errors.access_scope}>
          <div className="mt-1.5 flex min-w-0 flex-wrap gap-2">
            {PARENT_MODULE_OPTIONS.map(({ key: module, label }) => {
              const on = form.access_scope.includes(module);
              return (
                <button
                  key={module}
                  type="button"
                  role="checkbox"
                  aria-checked={on}
                  onClick={() => toggleModule(module)}
                  className={cn(
                    "inline-flex shrink-0 items-center gap-1.5 rounded-full border px-3 py-1.5 text-[12px] font-medium transition",
                    on
                      ? "border-accent bg-accent text-white"
                      : "border-border bg-white text-muted-foreground hover:border-accent-border",
                  )}
                >
                  {label}
                </button>
              );
            })}
          </div>
          <ul className="mt-1.5 space-y-1 text-[11px] leading-5 text-muted-foreground">
            {PARENT_MODULE_OPTIONS.map(({ key, hint }) => (
              <li key={key}>
                <span className="font-semibold text-foreground">{moduleLabel(key)}</span> — {hint}
              </li>
            ))}
          </ul>
          <p className="mt-1.5 text-[11px] leading-5 text-muted-foreground">
            Attendance is the module that also lets a guardian file a leave for the child.
            Clearing one hides that tab from the family and the server refuses it — the
            student&apos;s own view is unaffected either way.
          </p>
        </Field>

        <Field id="gl-primary" label="Primary contact" hint="The one who receives attendance alerts and fee reminders. Promoting this guardian demotes the other.">
          <label htmlFor="gl-primary" className="mt-1.5 flex min-w-0 items-center gap-2 text-[13px] text-foreground">
            <input
              id="gl-primary"
              type="checkbox"
              className="h-4 w-4 rounded border-border accent-[#4F46E5]"
              checked={form.is_primary}
              onChange={(e) => set("is_primary", e.target.checked)}
            />
            Mark as the primary guardian for this student
          </label>
        </Field>

        <Field id="gl-note" label="Note for the office" hint="Visible to staff only. Custody and access orders belong here." optional>
          <textarea
            id="gl-note"
            className={cn(structureInput(), "h-20 py-2")}
            maxLength={1000}
            value={form.note}
            onChange={(e) => set("note", e.target.value)}
          />
        </Field>

        <div className="flex flex-wrap justify-end gap-2 pt-1">
          <button
            type="button"
            onClick={onClose}
            className="inline-flex h-10 items-center rounded-field border border-border px-4 text-[13px] font-medium text-[#475569] transition-colors hover:bg-background focus-visible:outline-none focus-visible:ring-3 focus-visible:ring-accent/15"
          >
            Cancel
          </button>
          <Button type="submit" loading={busy} loadingText="Saving…" className="w-auto px-4">
            {submitLabel}
          </Button>
        </div>
      </form>
    </StructureDialog>
  );
}

/**
 * The activation code, shown once. No copy-to-clipboard promise of "you can get it
 * back": `select` on the table returns it only on the response that minted it, and
 * the DB clears it when the guardian claims the link.
 */
function CodeDialog({ row, created, onClose }: { row: GuardianLinkRow; created: boolean; onClose: () => void }) {
  const [copied, setCopied] = useState(false);
  const code = row.activation_code ?? "";
  return (
    <StructureDialog
      titleId="guardian-code"
      title={created ? "Invitation created" : "New activation code"}
      description={`Write it down or send it to ${row.parent_email}. It is not shown again after this dialog closes — reissue a new one rather than hunting for this one.`}
      onClose={onClose}
    >
      <div className="flex min-w-0 flex-wrap items-center gap-3">
        <code className="min-w-0 flex-1 rounded-field bg-muted px-4 py-3 font-mono text-[18px] font-bold tracking-[0.18em] text-foreground">
          {code || "—"}
        </code>
        <button
          type="button"
          onClick={async () => {
            try {
              await navigator.clipboard.writeText(code);
              setCopied(true);
            } catch {
              setCopied(false);
            }
          }}
          className="inline-flex h-11 items-center rounded-field border border-border px-4 text-[13px] font-semibold text-muted-foreground transition hover:border-accent hover:text-accent"
        >
          {copied ? "Copied" : "Copy"}
        </button>
      </div>
      <p className="mt-3 text-[12px] leading-6 text-muted-foreground">
        {row.code_expires_at ? `Expires ${formatDate(row.code_expires_at)}.` : ""} A reissued
        code invalidates this one immediately, and nothing the guardian could not see
        before changes when it is sent again.
      </p>
      <div className="mt-5 flex justify-end">
        <Button type="button" onClick={onClose} className="w-auto px-4">
          Done
        </Button>
      </div>
    </StructureDialog>
  );
}

function messageOf(caught: unknown): string {
  if (caught instanceof APIError) return caught.message;
  return caught instanceof Error ? caught.message : "This could not be saved.";
}
