"use client";

import { useCallback, useEffect, useState } from "react";
import { Lock, Puzzle } from "lucide-react";

import { Card, ErrorState, Loading, PageHeader } from "@/components/admin/ui";
import { fetchModules, toggleModule, type ModuleRow } from "@/lib/institution";

export default function ModulesPage() {
  const [modules, setModules] = useState<ModuleRow[] | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [pending, setPending] = useState<string | null>(null);

  const load = useCallback(async () => {
    try {
      setModules(await fetchModules());
      setError(null);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Could not load modules.");
    }
  }, []);

  useEffect(() => {
    load();
  }, [load]);

  async function toggle(m: ModuleRow) {
    if (m.is_core) return;
    setPending(m.key);
    try {
      await toggleModule(m.key, !m.is_enabled);
      await load();
    } catch (err) {
      setError(err instanceof Error ? err.message : "Could not change the module — it may not be in your plan.");
    } finally {
      setPending(null);
    }
  }

  return (
    <div className="mx-auto max-w-3xl">
      <PageHeader title="Modules" subtitle="Eight core modules are always on. Toggle optional modules — plan-gated." />

      {error ? <div className="mb-4"><ErrorState message={error} /></div> : null}

      {modules === null ? <Loading /> : (
        <ul className="space-y-3">
          {modules.map((m) => {
            const disabled = pending === m.key;
            return (
              <li key={m.key}>
                <Card className="!p-4">
                  <div className="flex items-center justify-between gap-4">
                    <div className="flex items-center gap-3">
                      <span className={`inline-flex rounded-xl p-2.5 ${m.is_enabled ? "bg-accent-light text-accent" : "bg-muted text-muted-foreground"}`}>
                        <Puzzle className="h-5 w-5" aria-hidden="true" />
                      </span>
                      <div>
                        <p className="font-display font-bold text-primary">
                          {m.name}
                          {m.is_core ? (
                            <span className="ml-2 rounded-full bg-success-light px-2 py-0.5 text-[10px] font-bold uppercase text-success-text">Core</span>
                          ) : null}
                        </p>
                        <p className="text-xs text-muted-foreground">
                          {m.is_core ? "Always included" : m.is_enabled ? "Enabled" : m.price_monthly > 0 ? `₹${m.price_monthly}/mo add-on` : "Optional"}
                        </p>
                      </div>
                    </div>
                    {m.is_core ? (
                      <span className="inline-flex items-center gap-1 text-xs font-medium text-muted-foreground">
                        <Lock className="h-3.5 w-3.5" aria-hidden="true" /> Locked
                      </span>
                    ) : (
                      <button
                        type="button"
                        role="switch"
                        aria-checked={m.is_enabled}
                        disabled={disabled}
                        onClick={() => toggle(m)}
                        className={`relative h-6 w-11 shrink-0 rounded-full transition ${m.is_enabled ? "bg-accent" : "bg-[#CBD5E1]"} disabled:opacity-60`}
                      >
                        <span className={`absolute top-0.5 h-5 w-5 rounded-full bg-white shadow transition ${m.is_enabled ? "left-[22px]" : "left-0.5"}`} />
                      </button>
                    )}
                  </div>
                </Card>
              </li>
            );
          })}
        </ul>
      )}
    </div>
  );
}
