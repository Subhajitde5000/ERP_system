"use client";

import { useCallback, useEffect, useState } from "react";

import { Card, ErrorState, Loading, PageHeader, inputClass, labelClass } from "@/components/admin/ui";
import { fetchSettings, updateSettings, type SettingsInfo } from "@/lib/institution";

export default function SettingsPage() {
  const [settings, setSettings] = useState<SettingsInfo | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const [msg, setMsg] = useState<string | null>(null);

  const load = useCallback(async () => {
    try {
      setSettings(await fetchSettings());
    } catch (err) {
      setError(err instanceof Error ? err.message : "Could not load settings.");
    }
  }, []);

  useEffect(() => {
    load();
  }, [load]);

  async function save(e: React.FormEvent) {
    e.preventDefault();
    if (!settings) return;
    setBusy(true);
    setMsg(null);
    try {
      const updated = await updateSettings({ timezone: settings.timezone, currency: settings.currency });
      setSettings(updated);
      setMsg("Settings saved.");
    } catch (err) {
      setError(err instanceof Error ? err.message : "Could not save settings.");
    } finally {
      setBusy(false);
    }
  }

  return (
    <div className="mx-auto max-w-2xl">
      <PageHeader title="Settings" subtitle="Institution-wide preferences." />
      {error ? <div className="mb-4"><ErrorState message={error} /></div> : null}
      {!settings ? <Loading /> : (
        <Card>
          <form onSubmit={save} className="space-y-4">
            <div>
              <label className={labelClass}>Timezone</label>
              <input className={inputClass} value={settings.timezone} onChange={(e) => setSettings({ ...settings, timezone: e.target.value })} />
            </div>
            <div>
              <label className={labelClass}>Currency</label>
              <input className={inputClass} value={settings.currency} onChange={(e) => setSettings({ ...settings, currency: e.target.value })} />
            </div>
            <div className="rounded-field bg-[#F8FAFC] px-4 py-3 text-xs text-muted-foreground">
              Onboarding {settings.onboarding_complete ? "complete" : "not finished"}.
            </div>
            {msg ? <p className="text-xs font-medium text-success-text">{msg}</p> : null}
            <button type="submit" disabled={busy} className="inline-flex h-11 items-center justify-center rounded-field bg-accent px-5 text-sm font-semibold text-white shadow-accent transition hover:bg-accent-hover disabled:opacity-60">
              {busy ? "Saving…" : "Save settings"}
            </button>
          </form>
        </Card>
      )}
    </div>
  );
}
