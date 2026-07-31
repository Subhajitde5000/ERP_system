import Link from "next/link";

import { cn } from "@/lib/utils";
import type { Stat } from "@/types/dashboard";
import {
  Card,
  ProgressBar,
  ProgressRing,
  TONE_BG,
  TONE_TEXT,
} from "./primitives";

/** KPI card — §4.1. Renders a value, ring or progress bar from one config. */
export function StatsCard({ stat }: { stat: Stat }) {
  const tone = stat.tone ?? "accent";
  const Icon = stat.icon;

  const body = (
    <>
      <div className="flex items-start justify-between gap-3">
        <span className="text-[11px] font-medium uppercase tracking-wide text-muted-foreground">
          {stat.label}
        </span>
        <span
          className={cn(
            "relative flex h-8 w-8 shrink-0 items-center justify-center rounded-lg",
            TONE_BG[tone],
          )}
        >
          <Icon className={cn("h-4 w-4", TONE_TEXT[tone])} aria-hidden="true" />
          {stat.pulse && (
            <span className="absolute -right-0.5 -top-0.5 flex h-2 w-2">
              <span className="absolute inline-flex h-full w-full animate-ping rounded-full bg-destructive opacity-75" />
              <span className="relative inline-flex h-2 w-2 rounded-full bg-destructive" />
            </span>
          )}
        </span>
      </div>

      <div className="mt-3 flex items-center gap-3">
        {stat.ring && (
          <ProgressRing value={stat.ring.value} max={stat.ring.max} tone={tone} />
        )}
        <div className="min-w-0">
          <p
            className={cn(
              "font-display font-bold text-foreground",
              stat.ring ? "text-[15px]" : "text-2xl",
            )}
          >
            {stat.value}
          </p>
          {stat.delta && (
            <p
              className={cn(
                "mt-0.5 text-[11px]",
                TONE_TEXT[stat.delta.tone ?? "muted"],
              )}
            >
              {stat.delta.text}
            </p>
          )}
        </div>
      </div>

      {stat.progress && (
        <ProgressBar
          value={stat.progress.value}
          max={stat.progress.max}
          tone={tone}
          className="mt-3"
        />
      )}
    </>
  );

  if (stat.href) {
    return (
      <Card interactive className="p-5 transition-colors hover:border-accent">
        <Link href={stat.href} className="block">
          {body}
        </Link>
      </Card>
    );
  }

  return (
    <Card interactive className="p-5">
      {body}
    </Card>
  );
}
