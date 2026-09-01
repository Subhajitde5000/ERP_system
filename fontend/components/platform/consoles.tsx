"use client";

/**
 * Live Super Admin consoles — C-SA-01 … C-SA-08.
 *
 * Each export here is deliberately thin: a hook for the data, `<Live>` for
 * loading/error, and the existing presentational component for the markup.
 * No page layout is re-declared — `InstitutionList`, `InstitutionDetail`,
 * `CreateInstitution`, `PlatformUsers` and `PlatformAuditView` render exactly
 * as they always have; these wrappers only replace the fixture arrays with
 * real API data and connect the action callbacks.
 *
 * The server pages stay in place for the shell, the role guard and metadata,
 * so `?role=` previewing still works. Security is not enforced here: the
 * backend rejects any non-Super-Admin token with 403 regardless of what the
 * browser renders.
 */

import { useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { Building2, Check, GraduationCap, LifeBuoy, Minus, Pencil, Plus, Wallet, X } from "lucide-react";

import { cn } from "@/lib/utils";
import { compactINR, planLimit } from "@/lib/platform";
import { moduleLabel, ROOT_DOMAIN_LABEL } from "@/lib/platform-shared";
import { ALL_MODULES } from "@/lib/session";
import { Card, Chip } from "@/components/dashboard/primitives";
import { StatsCard } from "@/components/dashboard/stats-card";
import { DashboardPanel } from "@/components/dashboard/panel";
import { CreateInstitution } from "./create-institution";
import { InstitutionDetail } from "./institution-detail";
import { InstitutionList } from "./institution-list";
import { PlatformAuditView } from "./platform-audit-view";
import { PlatformUsers } from "./platform-users";
import { TenantStateChip } from "./tenant-bits";
import { ActionBar, Live, useAction } from "./live";
import {
  usePlans,
  usePlatformSettings,
  usePlatformStats,
  usePlatformUsers,
  useAuditLogs,
  useTenantDetail,
  useTenants,
} from "@/hooks/use-platform-admin";
import {
  createPlatformUser,
  createPlan,
  createTenant,
  setTenantActive,
  updatePlan,
  updatePlatformSettings,
  updatePlatformUser,
  type UpdateSettingsInput,
} from "@/lib/platform-api";
import type { PlatformRole } from "@/types/auth";
import type { PlanRow, PlatformSettings } from "@/types/platform";
import type { ModuleKey } from "@/types/auth";
import type { Panel, Stat as DashStat } from "@/types/dashboard";

/* ── C-SA-01 · Dashboard ─────────────────────────────────────────────────── */

export function LiveDashboard() {
  const stats = usePlatformStats();

  return (
    <Live resource={stats} label="Loading platform stats…">
      {(s) => {
        const cards: DashStat[] = [
          {
            label: "Institutions",
            value: String(s.totalInstitutions),
            icon: Building2,
            tone: "accent",
            delta: {
              text: `${s.activeInstitutions} active · ${s.trialInstitutions} trial`,
              tone: "muted",
            },
          },
          {
            label: "Students",
            value: s.totalStudents.toLocaleString("en-IN"),
            icon: GraduationCap,
            tone: "cyan",
            delta: {
              text: `${s.totalTeachers.toLocaleString("en-IN")} teachers`,
              tone: "muted",
            },
          },
          {
            label: "MRR",
            value: compactINR(s.mrr),
            icon: Wallet,
            tone: "success",
            delta: { text: "from active subscriptions", tone: "muted" },
          },
          {
            label: "Open tickets",
            value: String(s.openTickets),
            icon: LifeBuoy,
            tone: s.criticalTickets ? "warning" : "muted",
            delta: {
              text: `${s.criticalTickets} high / urgent`,
              tone: s.criticalTickets ? "warning" : "muted",
            },
          },
        ];

        // DashboardPanel is data-driven: reuse its `trend` and `bars` kinds
        // instead of hand-rolling charts the institution side already has.
        const revenue: Panel = {
          kind: "trend",
          title: "Revenue · last 6 months",
          span: 6,
          points: s.revenueTrend.map((p) => p.amount),
          labels: s.revenueTrend.map((p) => p.label),
          unit: "₹",
          empty: "No paid invoices yet.",
        };

        const mix: Panel = {
          kind: "bars",
          title: "Institutions per plan",
          span: 6,
          items: s.planMix.map((m) => ({ label: m.plan, value: m.count })),
          empty: "No institutions yet.",
        };

        return (
          <div className="mx-auto w-full min-w-0 max-w-5xl">
            <div className="mb-4 min-w-0">
              <h1 className="font-display text-[22px] font-bold text-foreground">
                Platform dashboard
              </h1>
              <p className="mt-1 text-[13px] text-muted-foreground">
                Every institution on {ROOT_DOMAIN_LABEL}, at a glance.
              </p>
            </div>

            <div className="mb-4 grid min-w-0 gap-4 sm:grid-cols-2 lg:grid-cols-4">
              {cards.map((c) => (
                <StatsCard key={c.label} stat={c} />
              ))}
            </div>

            <div className="grid min-w-0 grid-cols-12 gap-4">
              <DashboardPanel panel={revenue} />
              <DashboardPanel panel={mix} />
            </div>

            <Card className="mt-4 min-w-0 p-5 sm:p-6">
              <h2 className="mb-3 font-display text-[15px] font-bold text-foreground">
                Newest institutions
              </h2>
              {s.recentTenants.length === 0 ? (
                <p className="text-[13px] text-muted-foreground">
                  Nothing signed up yet.
                </p>
              ) : (
                <ul className="divide-y divide-border">
                  {s.recentTenants.map((t) => (
                    <li
                      key={t.id}
                      className="flex min-w-0 items-center justify-between gap-3 py-2.5"
                    >
                      <Link
                        href={`/platform/institutions/${t.id}`}
                        className="min-w-0 truncate text-[13px] font-medium text-foreground transition-colors hover:text-accent"
                      >
                        {t.name}
                        <span className="ml-2 font-mono text-[11px] text-muted-foreground">
                          {t.slug}
                        </span>
                      </Link>
                      <TenantStateChip tenant={t} />
                    </li>
                  ))}
                </ul>
              )}
            </Card>
          </div>
        );
      }}
    </Live>
  );
}

/* ── C-SA-02 · Institution list ──────────────────────────────────────────── */

export function LiveInstitutionList() {
  const tenants = useTenants();
  const plans = usePlans();

  return (
    <Live resource={tenants} label="Loading institutions…">
      {(rows) => <InstitutionList tenants={rows} plans={plans.data ?? []} />}
    </Live>
  );
}

/* ── C-SA-03 · Institution detail ────────────────────────────────────────── */

export function LiveInstitutionDetail({ id }: { id: string }) {
  const detail = useTenantDetail(id);
  const plans = usePlans();
  const action = useAction();

  return (
    <Live resource={detail} label="Loading institution…">
      {(d, resource) => (
        <>
          <ActionBar action={action} />
          <InstitutionDetail
            detail={d}
            plans={plans.data ?? []}
            busy={action.busy}
            onSetActive={(next) =>
              void action
                .run(
                  () => setTenantActive(id, next),
                  next
                    ? `${d.tenant.name} reactivated.`
                    : `${d.tenant.name} suspended — every user is locked out.`,
                )
                .then((ok) => {
                  if (ok) void resource.reload();
                })
            }
          />
        </>
      )}
    </Live>
  );
}

/* ── C-SA-04 · Create institution ────────────────────────────────────────── */

export function LiveCreateInstitution() {
  const plans = usePlans();
  const tenants = useTenants();
  const router = useRouter();

  return (
    <Live resource={plans} label="Loading plans…">
      {(planRows) => (
        <CreateInstitution
          plans={planRows}
          existing={tenants.data ?? []}
          onCreate={async (input) => {
            const created = await createTenant({ ...input, type: input.type });
            // Refresh the list so the slug-collision check sees the new tenant.
            void tenants.reload();
            router.prefetch(`/platform/institutions/${created.tenant.id}`);
            return (
              `${created.tenant.name} created. An activation email was sent to ` +
              `${created.adminEmail}; they sign in at ${created.loginUrl}.`
            );
          }}
        />
      )}
    </Live>
  );
}

/* ── C-SA-05 · Plans ─────────────────────────────────────────────────────── */

export function LivePlans() {
  const plans = usePlans();
  const action = useAction();
  const [editing, setEditing] = useState<PlanRow | null | "new">(null);

  return (
    <Live resource={plans} label="Loading plans…">
      {(rows, resource) => (
        <div className="mx-auto w-full min-w-0 max-w-5xl">
          <ActionBar action={action} />
          {editing !== null && (
            <PlanEditor
              key={editing === "new" ? "new" : editing.id}
              plan={editing === "new" ? null : editing}
              busy={action.busy}
              onCancel={() => setEditing(null)}
              onSubmit={(input) =>
                void action.run(
                  () => editing === "new" ? createPlan(input) : updatePlan(editing.id, input),
                  editing === "new" ? `${input.name} plan created.` : `${input.name} plan updated.`,
                ).then((ok) => {
                  if (ok) {
                    setEditing(null);
                    void resource.reload();
                  }
                })
              }
            />
          )}
          <div className="mb-4 min-w-0">
            <div className="flex flex-wrap items-start justify-between gap-3">
              <div>
                <h1 className="font-display text-[22px] font-bold text-foreground">Plans</h1>
                <p className="mt-1 text-[13px] text-muted-foreground">Set pricing, capacity, modules and signup availability.</p>
              </div>
              <button type="button" onClick={() => setEditing("new")} className="inline-flex h-9 items-center gap-1.5 rounded-field bg-accent px-4 text-[13px] font-semibold text-white transition hover:bg-accent-hover focus-visible:outline-none focus-visible:ring-3 focus-visible:ring-accent/20">
                <Plus className="h-4 w-4" aria-hidden="true" /> Create plan
              </button>
            </div>
            <div className="mt-4 flex flex-wrap gap-2">
              <span className="rounded-full bg-accent-light px-3 py-1 text-[11px] font-semibold text-accent">{rows.length} plan{rows.length === 1 ? "" : "s"}</span>
              <span className="rounded-full bg-success-light px-3 py-1 text-[11px] font-semibold text-success-text">{rows.filter((plan) => plan.isActive).length} available for signup</span>
              <span className="rounded-full bg-muted px-3 py-1 text-[11px] font-semibold text-muted-foreground">{rows.reduce((total, plan) => total + plan.tenantCount, 0)} institutions covered</span>
            </div>
          </div>

          <div className="mb-4 grid min-w-0 gap-4 lg:grid-cols-3">
            {rows.map((p) => (
              <PlanCard key={p.id} plan={p} onEdit={() => setEditing(p)} />
            ))}
          </div>

          {rows.length > 0 && <PlanMatrix plans={rows} />}
        </div>
      )}
    </Live>
  );
}

function PlanCard({ plan: p, onEdit }: { plan: PlanRow; onEdit: () => void }) {
  return (
    <Card className="min-w-0 overflow-hidden p-0" interactive>
      <div className="h-1.5 bg-accent" />
      <div className="p-5 sm:p-6">
      <div className="flex min-w-0 items-start justify-between gap-2">
        <div><h2 className="font-display text-[17px] font-bold text-foreground">{p.name}</h2><p className="mt-1 font-mono text-[11px] text-muted-foreground">/{p.slug}</p></div>
        <div className="flex flex-col items-end gap-1"><Chip tone={p.isActive ? "success" : "muted"}>{p.isActive ? "Live" : "Inactive"}</Chip><span className="text-[11px] text-muted-foreground">{p.tenantCount} {p.tenantCount === 1 ? "tenant" : "tenants"}</span></div>
      </div>

      <p className="mt-2 font-display text-2xl font-bold text-foreground">
        {compactINR(p.priceMonthly)}
        <span className="text-[13px] font-normal text-muted-foreground">
          {" "}
          /month
        </span>
      </p>
      <p className="text-[12px] text-muted-foreground">
        or {compactINR(p.priceYearly)} / year
      </p>

      <dl className="mt-3 grid grid-cols-3 gap-2 border-t border-border pt-3 text-center">
        {[
          ["Students", planLimit(p.maxStudents)],
          ["Teachers", planLimit(p.maxTeachers)],
          ["Storage", `${p.maxStorageGb} GB`],
        ].map(([k, v]) => (
          <div key={k}>
            <dt className="text-[11px] uppercase tracking-wide text-muted-foreground">
              {k}
            </dt>
            <dd className="text-[13px] font-semibold text-foreground">{v}</dd>
          </div>
        ))}
      </dl>

      <div className="mt-4 rounded-field bg-muted/70 px-3 py-2.5">
        <div className="flex items-center justify-between gap-2"><span className="text-[11px] font-medium text-muted-foreground">Included modules</span><span className="text-[12px] font-bold text-foreground">{p.allowedModules.length} of {ALL_MODULES.length}</span></div>
        <div className="mt-2 flex flex-wrap gap-1">{p.allowedModules.slice(0, 4).map((module) => <span key={module} className="rounded bg-white px-1.5 py-0.5 text-[10px] font-medium text-muted-foreground shadow-sm">{moduleLabel(module)}</span>)}{p.allowedModules.length > 4 && <span className="px-1 py-0.5 text-[10px] font-medium text-muted-foreground">+{p.allowedModules.length - 4} more</span>}</div>
      </div>

      {!p.isActive && (
        <p className="mt-3 text-[12px] font-medium text-destructive-text">
          Inactive — hidden from new signups.
        </p>
      )}
      <button type="button" onClick={onEdit} className="mt-4 inline-flex h-9 w-full items-center justify-center gap-1.5 rounded-field border border-border text-[12px] font-semibold text-muted-foreground transition hover:border-accent hover:bg-accent-light hover:text-accent focus-visible:outline-none focus-visible:ring-3 focus-visible:ring-accent/15">
        <Pencil className="h-3.5 w-3.5" aria-hidden="true" /> Edit plan
      </button>
      </div>
    </Card>
  );
}

type PlanInput = {
  name: string; slug: string; maxStudents: number; maxTeachers: number; maxStorageGb: number;
  priceMonthly: number; priceYearly: number; currency: string; allowedModules: ModuleKey[]; isActive: boolean;
};

function PlanEditor({ plan, busy, onCancel, onSubmit }: { plan: PlanRow | null; busy: boolean; onCancel: () => void; onSubmit: (input: PlanInput) => void }) {
  const [input, setInput] = useState<PlanInput>(() => plan ? {
    name: plan.name, slug: plan.slug, maxStudents: plan.maxStudents, maxTeachers: plan.maxTeachers,
    maxStorageGb: plan.maxStorageGb, priceMonthly: plan.priceMonthly, priceYearly: plan.priceYearly,
    currency: plan.currency, allowedModules: plan.allowedModules, isActive: plan.isActive,
  } : { name: "", slug: "", maxStudents: 100, maxTeachers: 20, maxStorageGb: 10, priceMonthly: 0, priceYearly: 0, currency: "INR", allowedModules: [], isActive: true });
  const set = <K extends keyof PlanInput>(key: K, value: PlanInput[K]) => setInput((current) => ({ ...current, [key]: value }));
  const toggleModule = (key: ModuleKey) => set("allowedModules", input.allowedModules.includes(key) ? input.allowedModules.filter((m) => m !== key) : [...input.allowedModules, key]);

  return (
    <Card className="mb-5 overflow-hidden p-0">
      <div className="flex items-start justify-between gap-3 border-b border-border bg-gradient-to-r from-accent-light to-white px-5 py-4 sm:px-6"><div><p className="mb-1 text-[11px] font-bold uppercase tracking-[0.14em] text-accent">Plan configuration</p><h2 className="font-display text-[18px] font-bold text-foreground">{plan ? `Edit ${plan.name}` : "Create a new plan"}</h2><p className="mt-1 text-[12px] text-muted-foreground">Changes affect future checkouts, not existing subscriptions.</p></div><button type="button" onClick={onCancel} className="rounded-field border border-border bg-white p-1.5 text-muted-foreground transition hover:text-foreground" aria-label="Close plan editor"><X className="h-4 w-4" /></button></div>
      <form onSubmit={(event) => { event.preventDefault(); onSubmit({ ...input, name: input.name.trim(), slug: input.slug.trim().toLowerCase() }); }} className="space-y-5 px-5 py-5 sm:px-6">
        <div><p className="mb-3 text-[11px] font-bold uppercase tracking-[0.12em] text-muted-foreground">Identity, pricing & capacity</p><div className="grid gap-3 sm:grid-cols-2">
          <PlanField label="Plan name"><input required value={input.name} onChange={(e) => set("name", e.target.value)} className={planInputClass} /></PlanField>
          <PlanField label="Slug"><input required disabled={!!plan} pattern="[a-z0-9][a-z0-9-]*" value={input.slug} onChange={(e) => set("slug", e.target.value)} className={planInputClass} /><p className="mt-1 text-[11px] text-muted-foreground">The slug cannot be changed after creation.</p></PlanField>
          <PlanField label="Monthly price"><input required min="0" step="0.01" type="number" value={input.priceMonthly} onChange={(e) => set("priceMonthly", Number(e.target.value))} className={planInputClass} /></PlanField>
          <PlanField label="Yearly price"><input required min="0" step="0.01" type="number" value={input.priceYearly} onChange={(e) => set("priceYearly", Number(e.target.value))} className={planInputClass} /></PlanField>
          <PlanField label="Student seats"><input required min="-1" type="number" value={input.maxStudents} onChange={(e) => set("maxStudents", Number(e.target.value))} className={planInputClass} /></PlanField>
          <PlanField label="Teacher seats"><input required min="-1" type="number" value={input.maxTeachers} onChange={(e) => set("maxTeachers", Number(e.target.value))} className={planInputClass} /></PlanField>
          <PlanField label="Storage (GB)"><input required min="1" type="number" value={input.maxStorageGb} onChange={(e) => set("maxStorageGb", Number(e.target.value))} className={planInputClass} /></PlanField>
          <PlanField label="Currency"><input required maxLength={3} value={input.currency} disabled={!!plan} onChange={(e) => set("currency", e.target.value.toUpperCase())} className={planInputClass} /></PlanField>
        </div><p className="mt-2 text-[11px] text-muted-foreground">Use <strong>-1</strong> for unlimited student or teacher seats.</p></div>
        <fieldset><legend className="mb-1 text-[13px] font-semibold text-foreground">Included modules <span className="font-normal text-muted-foreground">({input.allowedModules.length} selected)</span></legend><p className="mb-3 text-[12px] text-muted-foreground">Institutions can only enable modules included in their plan.</p><div className="grid gap-2 sm:grid-cols-2 lg:grid-cols-4">{ALL_MODULES.map((key) => <label key={key} className={cn("flex cursor-pointer items-center gap-2 rounded-field border px-3 py-2.5 text-[12px] font-medium transition", input.allowedModules.includes(key) ? "border-accent bg-accent-light text-accent" : "border-border bg-white text-muted-foreground hover:border-accent-border")}><input type="checkbox" checked={input.allowedModules.includes(key)} onChange={() => toggleModule(key)} className="h-3.5 w-3.5 accent-accent" />{moduleLabel(key)}</label>)}</div></fieldset>
        <div className="flex flex-wrap items-center justify-between gap-3 border-t border-border pt-4"><label className="flex items-center gap-2 text-[13px] font-medium text-foreground"><input type="checkbox" checked={input.isActive} onChange={(e) => set("isActive", e.target.checked)} className="h-4 w-4 accent-accent" />Available for new signups</label><div className="flex gap-2"><button type="button" onClick={onCancel} className="h-9 rounded-field border border-border px-4 text-[13px] font-semibold text-muted-foreground">Cancel</button><button disabled={busy} className="h-9 rounded-field bg-accent px-4 text-[13px] font-semibold text-white shadow-sm transition hover:bg-accent-hover disabled:opacity-60">{busy ? "Saving…" : plan ? "Save changes" : "Create plan"}</button></div></div>
      </form>
    </Card>
  );
}

const planInputClass = "h-9 w-full rounded-field border border-border bg-white px-3 text-[13px] text-foreground outline-none transition focus:border-accent focus:ring-3 focus:ring-accent/15 disabled:bg-muted disabled:text-muted-foreground";
function PlanField({ label, children }: { label: string; children: React.ReactNode }) { return <label className="block text-[12px] font-medium text-foreground"><span className="mb-1.5 block">{label}</span>{children}</label>; }

/** Feature matrix from `plans.allowed_modules` (§4.1) × the module master list. */
function PlanMatrix({ plans }: { plans: PlanRow[] }) {
  return (
    <Card className="min-w-0 overflow-x-auto p-5 sm:p-6">
      <h2 className="mb-3 font-display text-[15px] font-bold text-foreground">
        Modules by plan
      </h2>
      <table className="w-full min-w-[420px] border-collapse text-[13px]">
        <thead>
          <tr className="border-b border-border text-left">
            <th className="py-2 pr-3 font-medium text-muted-foreground">Module</th>
            {plans.map((p) => (
              <th
                key={p.id}
                className="px-2 py-2 text-center font-medium text-muted-foreground"
              >
                {p.name}
              </th>
            ))}
          </tr>
        </thead>
        <tbody>
          {ALL_MODULES.map((key) => (
            <tr key={key} className="border-b border-border last:border-0">
              <td className="py-2 pr-3 text-foreground">{moduleLabel(key)}</td>
              {plans.map((p) => {
                const on = p.allowedModules.includes(key);
                return (
                  <td key={p.id} className="px-2 py-2 text-center">
                    {on ? (
                      <Check
                        className="mx-auto h-4 w-4 text-success"
                        aria-label="included"
                      />
                    ) : (
                      <Minus
                        className="mx-auto h-4 w-4 text-[#CBD5E1]"
                        aria-label="not included"
                      />
                    )}
                  </td>
                );
              })}
            </tr>
          ))}
        </tbody>
      </table>
    </Card>
  );
}

/* ── C-SA-06 · Platform users ────────────────────────────────────────────── */

export function LivePlatformUsers({ actingRole }: { actingRole: PlatformRole }) {
  const users = usePlatformUsers();
  const action = useAction();
  const [inviting, setInviting] = useState(false);

  return (
    <Live resource={users} label="Loading staff accounts…">
      {(rows, resource) => (
        <>
          <ActionBar action={action} />
          {inviting && (
            <InviteStaff
              busy={action.busy}
              onCancel={() => setInviting(false)}
              onSubmit={(input) =>
                void action
                  .run(
                    () => createPlatformUser(input),
                    `${input.name} invited — a verification email is on its way.`,
                  )
                  .then((ok) => {
                    if (ok) {
                      setInviting(false);
                      void resource.reload();
                    }
                  })
              }
            />
          )}
          <PlatformUsers
            users={rows}
            actingRole={actingRole}
            busy={action.busy}
            onInvite={() => setInviting(true)}
            onToggleActive={(u, next) =>
              void action
                .run(
                  () => updatePlatformUser(u.id, { isActive: next }),
                  `${u.name} ${next ? "reactivated" : "deactivated"}.`,
                )
                .then((ok) => {
                  if (ok) void resource.reload();
                })
            }
          />
        </>
      )}
    </Live>
  );
}

const STAFF_ROLES: PlatformRole[] = [
  "SUPPORT_STAFF",
  "SALES_EXECUTIVE",
  "FINANCE_MANAGER",
  "SUPER_ADMIN",
];

const ROLE_LABEL: Record<string, string> = {
  SUPPORT_STAFF: "Support Staff",
  SALES_EXECUTIVE: "Sales Executive",
  FINANCE_MANAGER: "Finance Manager",
  SUPER_ADMIN: "Super Admin",
};

function InviteStaff({
  onSubmit,
  onCancel,
  busy,
}: {
  onSubmit: (input: { name: string; email: string; role: PlatformRole }) => void;
  onCancel: () => void;
  busy: boolean;
}) {
  const [name, setName] = useState("");
  const [email, setEmail] = useState("");
  const [role, setRole] = useState<PlatformRole>("SUPPORT_STAFF");

  const field =
    "h-10 w-full min-w-0 rounded-field border border-border bg-white px-3 text-[13px] transition placeholder:text-[#94A3B8] focus:border-accent focus:outline-none focus:ring-3 focus:ring-accent/15";

  return (
    <Card className="mb-4 min-w-0 p-5 sm:p-6">
      <h2 className="mb-3 font-display text-[15px] font-bold text-foreground">
        Invite a staff account
      </h2>
      <form
        className="grid min-w-0 gap-3 sm:grid-cols-3"
        onSubmit={(e) => {
          e.preventDefault();
          if (name.trim() && email.trim()) {
            onSubmit({ name: name.trim(), email: email.trim(), role });
          }
        }}
      >
        <div className="min-w-0">
          <label htmlFor="inv-name" className="sr-only">
            Full name
          </label>
          <input
            id="inv-name"
            className={field}
            value={name}
            onChange={(e) => setName(e.target.value)}
            placeholder="Full name"
            required
            minLength={2}
          />
        </div>
        <div className="min-w-0">
          <label htmlFor="inv-email" className="sr-only">
            Work email
          </label>
          <input
            id="inv-email"
            type="email"
            className={field}
            value={email}
            onChange={(e) => setEmail(e.target.value)}
            placeholder={`name@${ROOT_DOMAIN_LABEL}`}
            required
          />
        </div>
        <div className="min-w-0">
          <label htmlFor="inv-role" className="sr-only">
            Role
          </label>
          <select
            id="inv-role"
            className={field}
            value={role}
            onChange={(e) => setRole(e.target.value as PlatformRole)}
          >
            {STAFF_ROLES.map((r) => (
              <option key={r} value={r}>
                {ROLE_LABEL[r]}
              </option>
            ))}
          </select>
        </div>
        <div className="flex gap-2 sm:col-span-3">
          <button
            type="submit"
            disabled={busy}
            className="inline-flex h-10 items-center rounded-field bg-accent px-4 text-sm font-semibold text-white transition-colors hover:bg-accent-hover disabled:opacity-60"
          >
            {busy ? "Inviting…" : "Send invite"}
          </button>
          <button
            type="button"
            onClick={onCancel}
            className="inline-flex h-10 items-center rounded-field border border-border bg-white px-4 text-sm font-medium text-muted-foreground transition hover:border-accent hover:text-accent"
          >
            Cancel
          </button>
        </div>
      </form>
    </Card>
  );
}

/* ── C-SA-07 · Audit logs ────────────────────────────────────────────────── */

export function LiveAuditLogs() {
  // Read-only page (§10.3 append-only), so one unfiltered page is fetched and
  // PlatformAuditView applies its own client-side filters over it.
  const page = useAuditLogs({ limit: 500 });
  const tenants = useTenants();

  return (
    <Live resource={page} label="Loading audit trail…">
      {(p) => (
        <PlatformAuditView
          entries={p.entries}
          tenants={(tenants.data ?? []).map((t) => t.name)}
        />
      )}
    </Live>
  );
}

/* ── C-SA-08 · Settings ──────────────────────────────────────────────────── */

export function LivePlatformSettings() {
  const settings = usePlatformSettings();
  const action = useAction();

  return (
    <Live resource={settings} label="Loading settings…">
      {(s, resource) => (
        <>
          <ActionBar action={action} />
          <SettingsForm
            settings={s}
            busy={action.busy}
            onSave={(patch) =>
              void action
                .run(() => updatePlatformSettings(patch), "Settings saved.")
                .then((ok) => {
                  if (ok) void resource.reload();
                })
            }
          />
        </>
      )}
    </Live>
  );
}

function SettingsForm({
  settings: s,
  onSave,
  busy,
}: {
  settings: PlatformSettings;
  onSave: (patch: UpdateSettingsInput) => void;
  busy: boolean;
}) {
  const [form, setForm] = useState<UpdateSettingsInput>({
    productName: s.productName,
    supportEmail: s.supportEmail,
    defaultTimezone: s.defaultTimezone,
    defaultCurrency: s.defaultCurrency,
    trialLengthDays: s.trialLengthDays,
    brandPrimary: s.brandPrimary,
    brandAccent: s.brandAccent,
  });

  const core = s.allowedModules.filter((m) => m.core);
  const optional = s.allowedModules.filter((m) => !m.core);
  const field =
    "h-10 w-full min-w-0 rounded-field border border-border bg-white px-3 text-[13px] transition focus:border-accent focus:outline-none focus:ring-3 focus:ring-accent/15";
  const label = "mb-1 block text-[11px] font-medium uppercase tracking-wide text-muted-foreground";

  return (
    <div className="mx-auto w-full min-w-0 max-w-3xl">
      <div className="mb-4 min-w-0">
        <h1 className="font-display text-[22px] font-bold text-foreground">
          Platform settings
        </h1>
        <p className="mt-1 text-[13px] text-muted-foreground">
          Global configuration. Changes here affect every institution.
        </p>
      </div>

      <form
        className="grid min-w-0 gap-4"
        onSubmit={(e) => {
          e.preventDefault();
          onSave(form);
        }}
      >
        <Card className="min-w-0 p-5 sm:p-6">
          <h2 className="mb-3 font-display text-[15px] font-bold text-foreground">
            General
          </h2>
          <div className="grid min-w-0 gap-3 sm:grid-cols-2">
            <div className="min-w-0">
              <label htmlFor="s-product" className={label}>
                Product name
              </label>
              <input
                id="s-product"
                className={field}
                value={form.productName ?? ""}
                onChange={(e) => setForm({ ...form, productName: e.target.value })}
              />
            </div>
            <div className="min-w-0">
              <label htmlFor="s-support" className={label}>
                Support email
              </label>
              <input
                id="s-support"
                type="email"
                className={field}
                value={form.supportEmail ?? ""}
                onChange={(e) => setForm({ ...form, supportEmail: e.target.value })}
              />
            </div>
            <div className="min-w-0">
              <label htmlFor="s-tz" className={label}>
                Default timezone
              </label>
              <input
                id="s-tz"
                className={field}
                value={form.defaultTimezone ?? ""}
                onChange={(e) =>
                  setForm({ ...form, defaultTimezone: e.target.value })
                }
              />
            </div>
            <div className="min-w-0">
              <label htmlFor="s-currency" className={label}>
                Default currency
              </label>
              <input
                id="s-currency"
                maxLength={3}
                className={field}
                value={form.defaultCurrency ?? ""}
                onChange={(e) =>
                  setForm({
                    ...form,
                    defaultCurrency: e.target.value.toUpperCase(),
                  })
                }
              />
            </div>
            <div className="min-w-0">
              <label htmlFor="s-trial" className={label}>
                Trial length (days)
              </label>
              <input
                id="s-trial"
                type="number"
                min={0}
                max={365}
                className={field}
                value={form.trialLengthDays ?? 0}
                onChange={(e) =>
                  setForm({ ...form, trialLengthDays: Number(e.target.value) })
                }
              />
            </div>
            <div className="min-w-0">
              <label className={label}>Root domain</label>
              {/* Deployment config (PUBLIC_ROOT_DOMAIN), not a DB setting. */}
              <p className="flex h-10 items-center text-[13px] text-muted-foreground">
                {s.rootDomain}
              </p>
            </div>
          </div>
        </Card>

        <Card className="min-w-0 p-5 sm:p-6">
          <h2 className="mb-3 font-display text-[15px] font-bold text-foreground">
            Branding
          </h2>
          <div className="grid min-w-0 gap-3 sm:grid-cols-2">
            {(
              [
                ["brandPrimary", "Primary colour"],
                ["brandAccent", "Accent colour"],
              ] as const
            ).map(([key, text]) => (
              <div key={key} className="min-w-0">
                <label htmlFor={`s-${key}`} className={label}>
                  {text}
                </label>
                <div className="flex min-w-0 items-center gap-2">
                  <input
                    id={`s-${key}`}
                    type="color"
                    className="h-10 w-12 shrink-0 cursor-pointer rounded-field border border-border bg-white"
                    value={form[key] ?? "#000000"}
                    onChange={(e) => setForm({ ...form, [key]: e.target.value })}
                  />
                  <input
                    aria-label={`${text} hex value`}
                    className={cn(field, "font-mono")}
                    value={form[key] ?? ""}
                    onChange={(e) => setForm({ ...form, [key]: e.target.value })}
                  />
                </div>
              </div>
            ))}
          </div>
        </Card>

        <Card className="min-w-0 p-5 sm:p-6">
          <h2 className="mb-1 font-display text-[15px] font-bold text-foreground">
            Allowed modules
          </h2>
          <p className="mb-3 text-[12px] text-muted-foreground">
            The platform master list. A plan can only offer modules from here,
            and core modules can never be switched off.
          </p>
          <div className="mb-3 flex min-w-0 flex-wrap gap-1.5">
            {core.map((m) => (
              <Chip key={m.key} tone="accent">
                {m.label} · core
              </Chip>
            ))}
          </div>
          <div className="flex min-w-0 flex-wrap gap-1.5">
            {optional.map((m) => (
              <Chip key={m.key} tone="muted">
                {m.label}
              </Chip>
            ))}
          </div>
        </Card>

        <div>
          <button
            type="submit"
            disabled={busy}
            className="inline-flex h-10 items-center rounded-field bg-accent px-5 text-sm font-semibold text-white transition-colors hover:bg-accent-hover disabled:opacity-60"
          >
            {busy ? "Saving…" : "Save settings"}
          </button>
        </div>
      </form>
    </div>
  );
}
