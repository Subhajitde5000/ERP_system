import { AlertTriangle, Building2 } from "lucide-react";
import type { Tenant } from "@/types/auth";

/**
 * Tenant pill under the welcome heading — design §5, §8.
 * Shows the resolved subdomain, or an amber warning when the slug is unknown.
 */
export function TenantBadge({ tenant }: { tenant: Tenant }) {
  if (tenant.notFound) {
    return (
      <div className="mb-5 inline-flex items-center gap-2 rounded-full border border-[#FDE68A] bg-warning-light px-3 py-1.5">
        <AlertTriangle
          className="h-3.5 w-3.5 shrink-0 text-warning"
          aria-hidden="true"
        />
        <span className="text-[12px] font-medium text-[#B45309]">
          {tenant.host} · not recognised
        </span>
      </div>
    );
  }

  return (
    <div className="mb-5 inline-flex items-center gap-2 rounded-full border border-accent-border bg-accent-light px-3 py-1.5">
      {tenant.isPlatform ? (
        <Building2 className="h-3.5 w-3.5 text-accent" aria-hidden="true" />
      ) : (
        <span
          className="h-2 w-2 animate-pulse rounded-full bg-accent"
          aria-hidden="true"
        />
      )}
      <span className="text-[12px] font-medium text-accent">{tenant.host}</span>
    </div>
  );
}
