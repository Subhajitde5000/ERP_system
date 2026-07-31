import Link from "next/link";
import { ShieldOff } from "lucide-react";

import { Card } from "@/components/dashboard/primitives";

/** 403 state — Notice_Board_design.md §5 (C-PB-06). */
export function PermissionDenied({
  message,
  backHref = "/notices",
  backLabel = "Back to Notice Board",
}: {
  message: string;
  backHref?: string;
  backLabel?: string;
}) {
  return (
    <Card className="mx-auto max-w-md p-8 text-center">
      <div className="mx-auto mb-4 flex h-11 w-11 items-center justify-center rounded-full bg-muted">
        <ShieldOff className="h-5 w-5 text-muted-foreground" aria-hidden="true" />
      </div>
      <h1 className="font-display text-[18px] font-bold text-foreground">
        Permission denied
      </h1>
      <p className="mt-2 text-[13px] leading-relaxed text-muted-foreground">
        {message}
      </p>
      <Link
        href={backHref}
        className="mt-5 inline-flex h-11 items-center justify-center rounded-field bg-accent px-5 text-[14px] font-semibold text-white shadow-accent transition-colors hover:bg-accent-hover"
      >
        {backLabel}
      </Link>
    </Card>
  );
}
