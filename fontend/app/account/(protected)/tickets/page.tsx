"use client";

import { useCallback, useEffect, useState } from "react";
import { LifeBuoy, Loader2, Plus, X } from "lucide-react";

import { Button } from "@/components/ui/button";
import { createOwnerTicket, fetchOwnerTickets } from "@/lib/owner";
import type { SupportTicket } from "@/types/owner";

/** Support Tickets — contact the platform team from your account. */
export default function TicketsPage() {
  const [tickets, setTickets] = useState<SupportTicket[] | null>(null);
  const [showForm, setShowForm] = useState(false);

  const load = useCallback(async () => {
    try {
      setTickets(await fetchOwnerTickets());
    } catch {
      setTickets([]);
    }
  }, []);

  useEffect(() => {
    load();
  }, [load]);

  async function handleCreate(input: {
    subject: string;
    category: string;
    message: string;
  }) {
    await createOwnerTicket({ ...input });
    setShowForm(false);
    await load();
  }

  return (
    <div className="mx-auto max-w-3xl space-y-6">
      <header className="flex items-center justify-between">
        <div>
          <h1 className="font-display text-2xl font-extrabold tracking-tight text-primary">
            Support Tickets
          </h1>
          <p className="mt-1 text-sm text-muted-foreground">
            Billing, technical or account questions — we respond within one business day.
          </p>
        </div>
        <Button onClick={() => setShowForm((v) => !v)}>
          {showForm ? <X className="h-4 w-4" /> : <Plus className="h-4 w-4" />}
          {showForm ? "Cancel" : "New ticket"}
        </Button>
      </header>

      {showForm && <NewTicketForm onSubmit={handleCreate} />}

      {tickets === null ? (
        <div className="flex justify-center rounded-card border border-border bg-white py-12 text-muted-foreground">
          <Loader2 className="h-5 w-5 animate-spin" aria-hidden="true" />
        </div>
      ) : tickets.length === 0 ? (
        <div className="flex flex-col items-center gap-3 rounded-card border border-dashed border-border bg-white px-6 py-14 text-center">
          <span className="flex h-12 w-12 items-center justify-center rounded-xl bg-accent-light text-accent">
            <LifeBuoy className="h-6 w-6" aria-hidden="true" />
          </span>
          <p className="text-sm text-muted-foreground">No tickets yet. Need help? Start one above.</p>
        </div>
      ) : (
        <ul className="space-y-3">
          {tickets.map((t) => (
            <li key={t.id} className="rounded-card border border-border bg-white p-5">
              <div className="flex items-start justify-between gap-4">
                <div>
                  <p className="font-display font-bold text-primary">{t.subject}</p>
                  <p className="mt-0.5 text-xs text-muted-foreground">
                    {t.category} · opened {new Date(t.createdAt).toLocaleDateString("en-IN")}
                    {t.tenantName ? ` · ${t.tenantName}` : ""}
                  </p>
                </div>
                <span
                  className={`shrink-0 rounded-full px-2.5 py-1 text-xs font-semibold ${
                    t.status === "RESOLVED" || t.status === "CLOSED"
                      ? "bg-success-light text-success-text"
                      : t.status === "OPEN"
                        ? "bg-warning-light text-warning-text"
                        : "bg-accent-light text-accent"
                  }`}
                >
                  {t.status.replace("_", " ")}
                </span>
              </div>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}

function NewTicketForm({
  onSubmit,
}: {
  onSubmit: (input: { subject: string; category: string; message: string }) => Promise<void>;
}) {
  const [subject, setSubject] = useState("");
  const [category, setCategory] = useState("BILLING");
  const [message, setMessage] = useState("");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function submit(e: React.FormEvent) {
    e.preventDefault();
    if (subject.trim().length < 3 || message.trim().length < 3) {
      setError("Add a subject (3+ chars) and a message.");
      return;
    }
    setBusy(true);
    setError(null);
    try {
      await onSubmit({ subject: subject.trim(), category, message: message.trim() });
      setSubject("");
      setMessage("");
    } catch (err) {
      setError(err instanceof Error ? err.message : "Could not create the ticket.");
    } finally {
      setBusy(false);
    }
  }

  return (
    <form
      onSubmit={submit}
      className="space-y-4 rounded-card border border-border bg-white p-5"
    >
      <div>
        <label className="mb-1.5 block text-[13px] font-medium text-[#334155]">Subject</label>
        <input
          className="h-11 w-full rounded-field border border-[#E2E8F0] bg-white px-3.5 text-sm focus:border-accent focus:outline-none focus:ring-3 focus:ring-accent/15"
          value={subject}
          onChange={(e) => setSubject(e.target.value)}
          placeholder="Invoice #INV-2026-000012 not found"
        />
      </div>
      <div>
        <label className="mb-1.5 block text-[13px] font-medium text-[#334155]">Category</label>
        <select
          className="h-11 w-full rounded-field border border-[#E2E8F0] bg-white px-3.5 text-sm focus:border-accent focus:outline-none focus:ring-3 focus:ring-accent/15"
          value={category}
          onChange={(e) => setCategory(e.target.value)}
        >
          <option value="BILLING">Billing</option>
          <option value="TECHNICAL">Technical</option>
          <option value="ACCOUNT">Account</option>
          <option value="OTHER">Other</option>
        </select>
      </div>
      <div>
        <label className="mb-1.5 block text-[13px] font-medium text-[#334155]">Message</label>
        <textarea
          className="min-h-[110px] w-full rounded-field border border-[#E2E8F0] bg-white px-3.5 py-2.5 text-sm focus:border-accent focus:outline-none focus:ring-3 focus:ring-accent/15"
          value={message}
          onChange={(e) => setMessage(e.target.value)}
          placeholder="Describe the issue…"
        />
      </div>
      {error && <p className="text-xs font-medium text-destructive-text">{error}</p>}
      <Button type="submit" loading={busy} loadingText="Submitting…">Submit ticket</Button>
    </form>
  );
}
