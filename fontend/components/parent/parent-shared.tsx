"use client";

/**
 * Building blocks every parent screen needs, written once.
 *
 * `ChildGate` is the important one: it is where a screen decides whether it can
 * show anything at all, in this order — still loading, no linked child, the
 * school has not granted the module, or here is the data. Getting that order
 * wrong is how a console ends up rendering "no attendance recorded" to a
 * guardian who was never given attendance in the first place, which reads as an
 * accusation against their child rather than a permission setting.
 */

import Link from "next/link";
import { ArrowLeft } from "lucide-react";

import { Card, EmptyState, Loading } from "@/components/admin/ui";
import { ResourceError } from "@/components/principal/principal-ui";
import { useParentConsole } from "./parent-console-context";
import { moduleLabel } from "@/lib/parent";

export function ChildGate({
  module,
  title,
  subtitle,
  children,
}: {
  /** `access_scope` key this screen needs, when it needs one. */
  module?: string;
  title: string;
  subtitle?: string;
  children: React.ReactNode;
}) {
  const { loading, error, reload, activeChild, allows, children: kids } = useParentConsole();

  if (loading) {
    return <Loading label="Loading your child's record…" />;
  }
  if (error) {
    return <ResourceError message={error} onRetry={reload} />;
  }
  if (!activeChild) {
    return (
      <Card>
        <EmptyState text="Link a child to your account first — an activation code from the school is enough." />
        <div className="mt-4">
          <Link
            href="/parent/dashboard"
            className="inline-flex h-10 items-center gap-2 rounded-field bg-accent px-4 text-sm font-semibold text-white"
          >
            Back to my family
          </Link>
        </div>
      </Card>
    );
  }
  if (module && !allows(module)) {
    return <ModuleDenied module={module} childName={activeChild.name} />;
  }

  return (
    <div className="mx-auto max-w-6xl">
      <div className="mb-5 flex flex-wrap items-end justify-between gap-3">
        <div>
          <h1 className="font-display text-2xl font-bold text-primary sm:text-[28px]">
            {title.replace("{child}", activeChild.name)}
          </h1>
          {subtitle ? (
            <p className="mt-1 text-sm text-muted-foreground">
              {subtitle.replace("{child}", activeChild.name)} · {activeChild.class_name ?? "no class set"}
              {activeChild.roll_number ? ` · roll ${activeChild.roll_number}` : ""}
            </p>
          ) : null}
        </div>
        {kids.length > 1 ? (
          <span className="text-xs font-semibold text-muted-foreground">
            Viewing {activeChild.name} ({activeChild.relation}) — switch a child above
          </span>
        ) : null}
      </div>
      {children}
    </div>
  );
}

export function ModuleDenied({ module, childName }: { module: string; childName: string | null }) {
  const label = moduleLabel(module);
  return (
    <div className="mx-auto max-w-6xl">
      <Card>
        <p className="font-display text-base font-bold text-primary">
          {label} is not shared with you
        </p>
        <p className="mt-2 text-sm text-muted-foreground">
          {childName ? `${childName}'s ` : "This student's "}school decides which parts of a record a
          guardian can open. If you need {label.toLowerCase()}, ask the office — they can add it to
          your access without changing anything else.
        </p>
        <Link
          href="/parent/dashboard"
          className="mt-4 inline-flex h-10 items-center gap-2 rounded-field border border-border px-4 text-sm font-semibold text-muted-foreground transition hover:border-accent hover:text-accent"
        >
          <ArrowLeft className="h-4 w-4" aria-hidden="true" /> Back to my family
        </Link>
      </Card>
    </div>
  );
}

/** A key/value block, used where a table would be overkill for two columns. */
export function FactGrid({ facts }: { facts: [string, React.ReactNode][] }) {
  const filled = facts.filter(([, value]) => value !== null && value !== undefined && value !== "");
  if (!filled.length) return <EmptyRow />;
  return (
    <dl className="grid gap-px overflow-hidden rounded-lg bg-border sm:grid-cols-2 lg:grid-cols-3">
      {filled.map(([label, value]) => (
        <div key={label} className="bg-white px-4 py-3">
          <dt className="text-[11px] font-bold uppercase tracking-wide text-muted-foreground">{label}</dt>
          <dd className="mt-1 text-sm font-semibold text-primary">{value}</dd>
        </div>
      ))}
    </dl>
  );
}

export function EmptyRow({ text = "Nothing recorded yet." }: { text?: string }) {
  return (
    <div className="rounded-lg border border-dashed border-border px-4 py-6 text-center text-sm text-muted-foreground">
      {text}
    </div>
  );
}

/** One bordered table with a header row — the shape every list below needs. */
export function ListTable({ head, rows }: { head: string[]; rows: React.ReactNode[][] }) {
  if (!rows.length) return <EmptyRow />;
  return (
    <div className="overflow-x-auto">
      <table className="min-w-full text-sm">
        <thead>
          <tr className="border-b border-border text-left text-[11px] font-bold uppercase tracking-wide text-muted-foreground">
            {head.map((label) => (
              <th key={label} className="px-4 py-3 whitespace-nowrap">
                {label}
              </th>
            ))}
          </tr>
        </thead>
        <tbody className="divide-y divide-border">
          {rows.map((cells, index) => (
            <tr key={index}>
              {cells.map((cell, cellIndex) => (
                <td key={cellIndex} className={`px-4 py-3 ${cellIndex ? "" : "font-semibold text-primary"}`}>
                  {cell}
                </td>
              ))}
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}
