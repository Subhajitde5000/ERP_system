import type { ConvertContext, SalesStats, SubscriptionBoard, TrialRow } from "@/types/sales";

export function getSalesStats(): SalesStats {
  return {
    openTrials: 0,
    mine: 0,
    needsAction: 0,
    expired: 0,
    unassigned: 0,
    conversionRate: 0,
    converted: 0,
    lapsed: 0,
    pipelineValue: 0,
    signupTrend: [],
    pipeline: [],
    recentSignups: [],
    renewalsDue: [],
  };
}

export function getSubscriptionBoard(): SubscriptionBoard {
  return {
    accounts: [],
    mrr: 0,
    arr: 0,
    renewalsDue: 0,
    pastDue: 0,
  };
}

export function getConvertContext(id: string): ConvertContext | null {
  return null;
}

export function getTrial(id: string): TrialRow | null {
  return null;
}

export function getTrialIds(): string[] {
  return [];
}

export function getTrials(): TrialRow[] {
  return [];
}

export function getTrialList(): TrialRow[] {
  return [];
}

export function getSubscriptionList(): any[] {
  return [];
}

export function getTrialDetail(_id?: string) {
  return null;
}
