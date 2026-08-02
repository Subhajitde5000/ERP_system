import Link from "next/link";
import { ArrowRight, Building2, FileText, LifeBuoy, Receipt, UserCircle, Wallet, type LucideIcon } from "lucide-react";

import { Card } from "@/components/dashboard/primitives";
import { TenantStateChip } from "@/components/platform/tenant-bits";
import type { TenantRow } from "@/types/platform";

const COPY = {
  institutions: {
    title: "My Institutions",
    subtitle: "Institutions owned by this xyz.com platform account.",
    icon: Building2,
  },
  billing: {
    title: "Billing",
    subtitle: "Payment methods, billing address and account-level billing controls.",
    icon: Wallet,
  },
  subscriptions: {
    title: "Subscriptions",
    subtitle: "Plan renewals and module purchases across all owned institutions.",
    icon: Receipt,
  },
  invoices: {
    title: "Invoices",
    subtitle: "Download GST invoices for every institution under the owner account.",
    icon: FileText,
  },
  tickets: {
    title: "Support Tickets",
    subtitle: "Raise and track support requests without logging into each institution.",
    icon: LifeBuoy,
  },
  profile: {
    title: "Profile",
    subtitle: "Owner name, email verification and platform account security.",
    icon: UserCircle,
  },
} satisfies Record<string, { title: string; subtitle: string; icon: LucideIcon }>;

export type OwnerSection = keyof typeof COPY;

export function OwnerSectionPage({ section, tenants }: { section: OwnerSection; tenants: TenantRow[] }) {
  const meta = COPY[section];
  const Icon = meta.icon;
  const mine = tenants.slice(0, 3);

  return (
    <div className="mx-auto w-full min-w-0 max-w-5xl">
      <div className="mb-4 flex items-start gap-3">
        <span className="flex h-11 w-11 shrink-0 items-center justify-center rounded-xl bg-accent-light text-accent">
          <Icon className="h-5 w-5" aria-hidden="true" />
        </span>
        <div className="min-w-0">
          <h1 className="font-display text-[22px] font-bold text-foreground">{meta.title}</h1>
          <p className="mt-1 text-[13px] text-muted-foreground">{meta.subtitle}</p>
        </div>
      </div>

      {section === "institutions" ? (
        <Card className="min-w-0 p-5 sm:p-6">
          <ul className="divide-y divide-border border-t border-border">
            {mine.map((t) => (
              <li key={t.id} className="py-3">
                <div className="flex min-w-0 items-center gap-3">
                  <div className="min-w-0 flex-1">
                    <p className="truncate text-sm font-semibold text-foreground">{t.name}</p>
                    <p className="truncate font-mono text-[11px] text-muted-foreground">{t.slug}.xyz.com · {t.planName}</p>
                  </div>
                  <TenantStateChip tenant={t} />
                  <Link href={`https://${t.slug}.xyz.com/login`} className="inline-flex items-center gap-1 text-[12px] font-semibold text-accent hover:underline">
                    Go To <ArrowRight className="h-3 w-3" aria-hidden="true" />
                  </Link>
                </div>
              </li>
            ))}
          </ul>
        </Card>
      ) : (
        <Card className="p-6">
          <p className="text-sm leading-6 text-[#475569]">
            This owner page is account-scoped, not tenant-scoped. It belongs to xyz.com/login and can aggregate data for Green College, ABC School and XYZ Academy under the same owner email.
          </p>
          <Link href="/platform/my-institutions" className="mt-4 inline-flex items-center gap-1 text-sm font-semibold text-accent hover:underline">
            Back to My Institutions <ArrowRight className="h-4 w-4" aria-hidden="true" />
          </Link>
        </Card>
      )}
    </div>
  );
}
