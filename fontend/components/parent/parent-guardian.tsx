"use client";

/**
 * C-PA-03 / C-PA-12 — the guardian's own account, and what the school can see of it.
 *
 * Only two fields are editable: phone and address. A name on this platform is the
 * identity printed on the admission record and quoted in the audit trail, so
 * changing it is an office job backed by documents — not a text box. The screen
 * says that plainly instead of leaving a greyed-out field to be discovered.
 *
 * The contact number is also the alert number, which is why saving a new one
 * clears its verified flag: an unverified number must not start receiving (or
 * miss) exam and absence alerts until the family confirms it.
 */

import { Card, EmptyState, PageHeader, inputClass, labelClass } from "@/components/admin/ui";
import { AsyncState, dateOnly, dateTime, statusLabel } from "@/components/principal/principal-ui";
import { useResource } from "@/hooks/use-resource";
import { fetchGuardianProfile, updateGuardianProfile } from "@/lib/parent";
import { useParentConsole } from "./parent-console-context";
import { moduleLabel } from "@/lib/parent";
import { ClaimByCode } from "./parent-family";
import { FactGrid, ListTable } from "./parent-shared";
import { useState } from "react";

export function ParentGuardianPage() {
  const profile = useResource(fetchGuardianProfile, []);
  const { data: roster } = useParentConsole();
  const [form, setForm] = useState<{ phone: string; address: string } | null>(null);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [saved, setSaved] = useState(false);

  const editing = form ?? (profile.data ? { phone: profile.data.phone ?? "", address: profile.data.address ?? "" } : null);

  async function save(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setBusy(true);
    setError(null);
    setSaved(false);
    try {
      const updated = await updateGuardianProfile({
        phone: (editing?.phone ?? "").trim() || null,
        address: (editing?.address ?? "").trim() || null,
      });
      profile.setData(updated);
      setForm(null);
      setSaved(true);
    } catch (caught) {
      setError(caught instanceof Error ? caught.message : "Your details could not be saved.");
    } finally {
      setBusy(false);
    }
  }

  return (
    <div className="mx-auto max-w-4xl">
      <PageHeader
        title="My details"
        subtitle="How the school reaches you, and what each of your children's links allows"
      />

      <AsyncState loading={profile.loading} error={profile.error} onRetry={profile.reload} loadingLabel="Loading your details…">
        {profile.data ? (
          <div className="space-y-6">
            <Card>
              <div className="flex flex-wrap items-start justify-between gap-3">
                <div className="min-w-0">
                  <p className="font-display text-lg font-bold text-primary">{profile.data.name}</p>
                  <p className="text-sm text-muted-foreground">
                    {profile.data.email ?? "No email on file"} · {profile.data.children_count} student
                    {profile.data.children_count === 1 ? "" : "s"} linked
                  </p>
                  <p className="mt-1 text-[11px] text-muted-foreground">
                    Last signed in {profile.data.last_login_at ? dateTime(profile.data.last_login_at) : "for the first time"}
                  </p>
                </div>
                {profile.data.can_edit_contact ? (
                  <button
                    type="button"
                    onClick={() => setForm(form ? null : { phone: profile.data!.phone ?? "", address: profile.data!.address ?? "" })}
                    className="inline-flex h-10 items-center rounded-field border border-border px-4 text-sm font-semibold text-muted-foreground transition hover:border-accent hover:text-accent"
                  >
                    {form ? "Close" : "Edit contact details"}
                  </button>
                ) : null}
              </div>

              {!form ? (
                <div className="mt-4">
                  <FactGrid
                    facts={[
                      ["Phone", profile.data.phone ?? "Not recorded"],
                      ["Address", profile.data.address ?? "Not recorded"],
                    ]}
                  />
                </div>
              ) : (
                <form onSubmit={save} className="mt-4 space-y-4 border-t border-border pt-4">
                  <div>
                    <label htmlFor="guardian-phone" className={labelClass}>
                      Phone
                    </label>
                    <input
                      id="guardian-phone"
                      className={inputClass}
                      value={editing?.phone ?? ""}
                      onChange={(event) => setForm({ ...(editing ?? { phone: "", address: "" }), phone: event.target.value })}
                      maxLength={20}
                      placeholder="+91 98765 43210"
                    />
                    <p className="mt-1 text-[11px] text-muted-foreground">
                      This is the number absence and exam alerts go to. Saving a new one clears its verified
                      status until you confirm it.
                    </p>
                  </div>
                  <div>
                    <label htmlFor="guardian-address" className={labelClass}>
                      Address
                    </label>
                    <textarea
                      id="guardian-address"
                      className={`${inputClass} min-h-24 py-3`}
                      value={editing?.address ?? ""}
                      onChange={(event) => setForm({ ...(editing ?? { phone: "", address: "" }), address: event.target.value })}
                      maxLength={2000}
                    />
                  </div>
                  {error ? (
                    <p role="alert" className="text-sm text-destructive-text">
                      {error}
                    </p>
                  ) : null}
                  {saved ? <p className="text-sm text-success-text">Saved.</p> : null}
                  <button
                    type="submit"
                    disabled={busy}
                    className="inline-flex h-11 items-center rounded-field bg-accent px-5 text-sm font-semibold text-white transition hover:bg-accent-hover disabled:opacity-60"
                  >
                    {busy ? "Saving…" : "Save"}
                  </button>
                </form>
              )}
            </Card>

            <Card>
              <h2 className="mb-3 font-display text-base font-bold text-primary">What the school shares with you</h2>
              {roster?.children.length ? (
                <ListTable
                  head={["Student", "Relation", "You can see", "Access ends"]}
                  rows={roster.children.map((child) => [
                    child.name,
                    child.relation,
                    child.is_live ? (
                      <span className="flex flex-wrap gap-1">
                        {child.access_scope.map((module) => (
                          <span key={module} className="rounded-full bg-muted px-2 py-0.5 text-[11px] font-bold text-muted-foreground">
                            {moduleLabel(module)}
                          </span>
                        ))}
                      </span>
                    ) : (
                      <span className="text-warning-text">Paused — {statusLabel(child.blocked_reason ?? "")}</span>
                    ),
                    child.access_upto ? dateOnly(child.access_upto) : "No end date",
                  ])}
                />
              ) : (
                <EmptyState text="No student is linked to your account yet." />
              )}
              <p className="mt-3 text-[11px] text-muted-foreground">
                These are set per child by the school, not by you. A second guardian of the same child can
                legitimately have a different list.
              </p>
            </Card>

            <Card>
              <h2 className="mb-2 font-display text-base font-bold text-primary">Another child at this school?</h2>
              <p className="mb-4 text-sm text-muted-foreground">
                If the office gave you an activation code for a sibling or a nephew, enter it here to link them
                to this account. One account can hold several children.
              </p>
              <ClaimByCode />
            </Card>
          </div>
        ) : null}
      </AsyncState>
    </div>
  );
}
