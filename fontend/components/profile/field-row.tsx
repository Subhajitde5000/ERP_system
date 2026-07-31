import { Lock } from "lucide-react";

import { cn } from "@/lib/utils";

/**
 * Read-only label/value row used by every profile section — PAGE 4.
 * `locked` marks fields the viewer can see but not change, so the
 * "who can edit what" rule is visible rather than implied.
 */
export function FieldRow({
  label,
  value,
  locked = false,
  mono = false,
}: {
  label: React.ReactNode;
  value: React.ReactNode;
  locked?: boolean;
  mono?: boolean;
}) {
  return (
    <div className="flex flex-wrap items-baseline justify-between gap-x-4 gap-y-1 py-2.5">
      <dt className="flex items-center gap-1.5 text-[13px] text-muted-foreground">
        {label}
        {locked && (
          <Lock
            className="h-3 w-3 text-[#94A3B8]"
            aria-label="Read-only — contact your admin to change"
          />
        )}
      </dt>
      <dd
        className={cn(
          "text-right text-[13px] font-medium text-foreground",
          mono && "font-mono tabular-nums",
        )}
      >
        {value || "—"}
      </dd>
    </div>
  );
}

/** Section wrapper — heading + optional description above a field list. */
export function ProfileSectionCard({
  title,
  description,
  action,
  children,
}: {
  title: string;
  description?: string;
  action?: React.ReactNode;
  children: React.ReactNode;
}) {
  return (
    <section className="rounded-card border border-border bg-white p-5 shadow-card sm:p-6">
      <div className="mb-3 flex flex-wrap items-start justify-between gap-3">
        <div>
          <h2 className="font-display text-[15px] font-bold text-foreground">
            {title}
          </h2>
          {description && (
            <p className="mt-0.5 text-[12px] text-muted-foreground">
              {description}
            </p>
          )}
        </div>
        {action}
      </div>
      {children}
    </section>
  );
}
