"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";

import { Button } from "@/components/ui/button";
import { useOwnerAuth } from "@/hooks/use-owner-auth";
import { changeOwnerPassword, updateOwnerProfile } from "@/lib/owner";

/** Profile — edit name and change password. */
export default function ProfilePage() {
  const { owner, logout } = useOwnerAuth();
  const router = useRouter();
  const [name, setName] = useState(owner?.name ?? "");
  const [nameBusy, setNameBusy] = useState(false);
  const [nameMsg, setNameMsg] = useState<{ ok: boolean; text: string } | null>(null);

  const [current, setCurrent] = useState("");
  const [next, setNext] = useState("");
  const [pwBusy, setPwBusy] = useState(false);
  const [pwMsg, setPwMsg] = useState<{ ok: boolean; text: string } | null>(null);

  async function saveName() {
    if (name.trim().length < 2) return;
    setNameBusy(true);
    setNameMsg(null);
    try {
      await updateOwnerProfile(name.trim());
      setNameMsg({ ok: true, text: "Name updated." });
    } catch (err) {
      setNameMsg({ ok: false, text: err instanceof Error ? err.message : "Could not update." });
    } finally {
      setNameBusy(false);
    }
  }

  async function savePassword() {
    if (next.length < 6) {
      setPwMsg({ ok: false, text: "New password must be at least 6 characters." });
      return;
    }
    setPwBusy(true);
    setPwMsg(null);
    try {
      await changeOwnerPassword(current, next);
      await logout();
      router.push("/account/login");
    } catch (err) {
      setPwMsg({ ok: false, text: err instanceof Error ? err.message : "Could not change password." });
      setPwBusy(false);
    }
  }

  return (
    <div className="mx-auto max-w-2xl space-y-8">
      <header>
        <h1 className="font-display text-2xl font-extrabold tracking-tight text-primary">Profile</h1>
        <p className="mt-1 text-sm text-muted-foreground">Your platform account details.</p>
      </header>

      <Card title="Account">
        <Row label="Email" value={owner?.email ?? "—"} />
        <Row label="Member since" value={owner ? new Date(owner.createdAt).toLocaleDateString("en-IN") : "—"} />
        <Row label="Email verified" value={owner?.isEmailVerified ? "Yes" : "No"} />
      </Card>

      <Card title="Display name">
        <div className="flex flex-col gap-3 sm:flex-row sm:items-end">
          <div className="flex-1">
            <label className="mb-1.5 block text-[13px] font-medium text-[#334155]">Full name</label>
            <input
              className="h-11 w-full rounded-field border border-[#E2E8F0] bg-white px-3.5 text-sm focus:border-accent focus:outline-none focus:ring-3 focus:ring-accent/15"
              value={name}
              onChange={(e) => setName(e.target.value)}
            />
          </div>
          <Button onClick={saveName} loading={nameBusy} loadingText="Saving…">Save</Button>
        </div>
        {nameMsg && <Msg msg={nameMsg} />}
      </Card>

      <Card title="Change password">
        <div className="space-y-3">
          <div>
            <label className="mb-1.5 block text-[13px] font-medium text-[#334155]">Current password</label>
            <input
              type="password"
              className="h-11 w-full rounded-field border border-[#E2E8F0] bg-white px-3.5 text-sm focus:border-accent focus:outline-none focus:ring-3 focus:ring-accent/15"
              value={current}
              onChange={(e) => setCurrent(e.target.value)}
              autoComplete="current-password"
            />
          </div>
          <div>
            <label className="mb-1.5 block text-[13px] font-medium text-[#334155]">New password</label>
            <input
              type="password"
              className="h-11 w-full rounded-field border border-[#E2E8F0] bg-white px-3.5 text-sm focus:border-accent focus:outline-none focus:ring-3 focus:ring-accent/15"
              value={next}
              onChange={(e) => setNext(e.target.value)}
              autoComplete="new-password"
            />
          </div>
          <Button onClick={savePassword} loading={pwBusy} loadingText="Updating…">Update password</Button>
          <p className="text-xs text-muted-foreground">
            Updating signs you out of every device for security.
          </p>
        </div>
        {pwMsg && <Msg msg={pwMsg} />}
      </Card>
    </div>
  );
}

function Card({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <section className="space-y-4 rounded-card border border-border bg-white p-5 sm:p-6">
      <h2 className="font-display text-base font-bold text-primary">{title}</h2>
      {children}
    </section>
  );
}

function Row({ label, value }: { label: string; value: string }) {
  return (
    <div className="flex items-center justify-between border-b border-border py-2.5 last:border-0">
      <span className="text-sm text-muted-foreground">{label}</span>
      <span className="text-sm font-medium text-foreground">{value}</span>
    </div>
  );
}

function Msg({ msg }: { msg: { ok: boolean; text: string } }) {
  return (
    <p className={`mt-3 text-xs font-medium ${msg.ok ? "text-success-text" : "text-destructive-text"}`}>
      {msg.text}
    </p>
  );
}
