import type { PlanRow, PlatformUserRow, TenantRow } from "@/types/platform";

export function getPlatformStats() {
  return {
    totalTenants: 0,
    activeTenants: 0,
    monthlyRecurringRevenue: 0,
    annualRecurringRevenue: 0,
  };
}

export function getTenants(): TenantRow[] {
  return [];
}

export function getPlans(): PlanRow[] {
  return [];
}

export function getPlatformUsers(): PlatformUserRow[] {
  return [];
}

export function getTenantDetail(_id: string) {
  return null;
}
