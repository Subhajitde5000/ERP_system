"use client";

/**
 * Support Staff console data hooks — C-SP-01 … C-SP-04.
 *
 * Thin bindings over the shared `useResource` primitive, exactly like the
 * Super Admin and Owner hooks: one place owns loading / error / refetch, so
 * no console repeats it.
 */

import {
  fetchInstitutionSnapshot,
  fetchSupportStats,
  fetchTicketDetail,
  fetchTickets,
  type TicketQuery,
} from "@/lib/platform-api";
import type {
  InstitutionSnapshot,
  SupportStats,
  TicketDetail,
  TicketRow,
} from "@/types/support";
import { useResource, type Resource } from "./use-resource";

export function useSupportStats(): Resource<SupportStats> {
  return useResource(() => fetchSupportStats(), []);
}

export function useTickets(query: TicketQuery = {}): Resource<TicketRow[]> {
  const { status, priority, tenantId, assignedTo, mine, unassigned, search, limit, offset } =
    query;
  return useResource(
    () =>
      fetchTickets({
        status,
        priority,
        tenantId,
        assignedTo,
        mine,
        unassigned,
        search,
        limit,
        offset,
      }),
    [status, priority, tenantId, assignedTo, mine, unassigned, search, limit, offset],
  );
}

export function useTicketDetail(id: string): Resource<TicketDetail> {
  return useResource(() => fetchTicketDetail(id), [id]);
}

export function useInstitutionSnapshot(
  tenantId: string,
): Resource<InstitutionSnapshot> {
  return useResource(() => fetchInstitutionSnapshot(tenantId), [tenantId]);
}
