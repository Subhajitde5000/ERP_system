import Link from "next/link";
import { AlertTriangle, Lock } from "lucide-react";

import { cn } from "@/lib/utils";
import { moduleLabel } from "@/lib/navigation";
import { greeting } from "@/lib/session";
import type { InstitutionRole, ModuleKey } from "@/types/auth";
import type { DashboardConfig } from "@/types/dashboard";
import { Card, Chip, TONE_BG, TONE_TEXT } from "./primitives";
import { DashboardPanel } from "./panel";
import { RoleSwitcher } from "./role-switcher";
import { StatsCard } from "./stats-card";

/**
 * Renders any role dashboard from its config — §3, §5.
 * Greeting → notice → stats row → 12-column panel grid.
 */
export function DashboardView({
  config,
  userName,
  enabledModules,
  roles,
  activeRole,
}: {
  config: DashboardConfig;
  userName: string;
  enabledModules: ModuleKey[];
  /** All roles the user holds — drives the switcher (§1) */
  roles: InstitutionRole[];
  activeRole: InstitutionRole;
}) {
  // Whole dashboard gated behind a module (§5.11)
  if (config.module && !enabledModules.includes(config.module)) {
    return <ModuleDisabledCard module={config.module} />;
  }

  // Hide panels whose module is switched off (§6)
  const panels = config.panels.filter(
    (p) => !p.module || enabledModules.includes(p.module),
  );

  return (
    <div className="space-y-6">
      {/* Role switcher — only for users holding more than one role (§1) */}
      <RoleSwitcher roles={roles} active={activeRole} />

      {/* Greeting */}
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div className="min-w-0">
          <h1 className="font-display text-2xl font-bold text-foreground">
            {greeting()}, {userName} 👋
          </h1>
          <p className="mt-1 text-[13px] text-muted-foreground">
            {config.summary}
          </p>
        </div>

        <div className="flex flex-wrap items-center gap-2">
          {config.scope && <Chip tone="cyan">{config.scope}</Chip>}
          <Chip>{config.roleChip}</Chip>
        </div>
      </div>

      {/* Banner notice — low attendance, etc. (§7) */}
      {config.notice && (
        <div
          className={cn(
            "flex flex-wrap items-center gap-3 rounded-field border p-4",
            TONE_BG[config.notice.tone],
            config.notice.tone === "danger"
              ? "border-destructive-border"
              : config.notice.tone === "warning"
                ? "border-[#FDE68A]"
                : "border-border",
          )}
          role="status"
        >
          <AlertTriangle
            className={cn("h-4 w-4 shrink-0", TONE_TEXT[config.notice.tone])}
            aria-hidden="true"
          />
          <p
            className={cn(
              "min-w-0 flex-1 text-[13px] font-medium",
              config.notice.tone === "danger" ? "text-[#991B1B]" : "text-[#92400E]",
            )}
          >
            {config.notice.title}
          </p>
          {config.notice.action && (
            <Link
              href={config.notice.action.href}
              className="shrink-0 rounded text-[13px] font-medium text-accent transition-colors hover:text-accent-hover"
            >
              {config.notice.action.label}
            </Link>
          )}
        </div>
      )}

      {/* Stats — 1 col at 320px, 2 at sm, 4 at lg (§7) */}
      <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-4">
        {config.stats.map((stat, i) => (
          <StatsCard key={i} stat={stat} />
        ))}
      </div>

      {/* 12-column panel grid */}
      <div className="grid grid-cols-12 gap-4 sm:gap-6">
        {panels.map((panel, i) => (
          <DashboardPanel key={i} panel={panel} />
        ))}
      </div>
    </div>
  );
}

/** Module disabled state — §4.3. */
export function ModuleDisabledCard({ module }: { module: ModuleKey }) {
  const label = moduleLabel(module);

  return (
    <Card className="mx-auto max-w-md p-8 text-center">
      <div className="mx-auto mb-4 flex h-11 w-11 items-center justify-center rounded-full bg-muted">
        <Lock className="h-5 w-5 text-muted-foreground" aria-hidden="true" />
      </div>
      <h2 className="font-display text-[18px] font-bold text-foreground">
        {label} module disabled
      </h2>
      <p className="mt-2 text-[13px] leading-relaxed text-muted-foreground">
        This dashboard needs the {label} module. Enable it in{" "}
        <span className="font-medium text-foreground">Settings → Modules</span>,
        or ask your institution admin.
      </p>
      <Link
        href="/settings/modules"
        className="mt-5 inline-flex h-11 items-center justify-center rounded-field bg-accent px-5 text-[14px] font-semibold text-white shadow-accent transition-colors hover:bg-accent-hover"
      >
        Go to Modules
      </Link>
    </Card>
  );
}
