import { AlertCircle, CheckCircle2, Info } from "lucide-react";
import { cn } from "@/lib/utils";

/**
 * Inline form feedback — error / success / info states (design §7).
 * role="alert" so screen readers announce it the moment it appears.
 */

const VARIANTS = {
  error: {
    wrap: "border-destructive-border bg-destructive-light text-[#B91C1C]",
    icon: AlertCircle,
    iconColor: "text-destructive",
  },
  success: {
    wrap: "border-[#A7F3D0] bg-success-light text-[#047857]",
    icon: CheckCircle2,
    iconColor: "text-success",
  },
  info: {
    wrap: "border-accent-border bg-accent-light text-[#3730A3]",
    icon: Info,
    iconColor: "text-accent",
  },
} as const;

export function FormAlert({
  variant = "error",
  children,
  className,
}: {
  variant?: keyof typeof VARIANTS;
  children: React.ReactNode;
  className?: string;
}) {
  const { wrap, icon: Icon, iconColor } = VARIANTS[variant];

  return (
    <div
      role="alert"
      className={cn(
        "flex items-start gap-2.5 rounded-field border px-3.5 py-3 text-[13px] font-medium",
        wrap,
        className,
      )}
    >
      <Icon className={cn("mt-px h-4 w-4 shrink-0", iconColor)} aria-hidden="true" />
      <span>{children}</span>
    </div>
  );
}
