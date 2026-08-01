"use client";

import { useMemo, useState } from "react";

import {
  byTriage,
  CURRENT_AGENT,
  isBreaching,
  isOpenTicket,
  TICKET_PRIORITY_LABELS,
  TICKET_STATUS_LABELS,
} from "@/lib/support";
import { Card, EmptyState } from "@/components/dashboard/primitives";
import {
  FilterBar,
  FilterSelect,
  FilterTabs,
  ResultCount,
  SearchBox,
} from "@/components/platform/list-filters";
import { TicketListItem } from "./ticket-bits";
import type { TicketPriority, TicketRow, TicketStatus } from "@/types/support";

/**
 * C-SP-02 — Ticket List.
 * "All tickets: filter by status, priority, institution"
 *
 * Defaults to the open queue rather than everything: an agent opens this page
 * to find work, and a list that leads with closed tickets buries it.
 */
export function TicketList({
  tickets,
  initialAssignee,
}: {
  tickets: TicketRow[];
  /** `?assignee=me` from the dashboard KPI deep-link */
  initialAssignee?: string;
}) {
  const [query, setQuery] = useState("");
  const [status, setStatus] = useState<string>("OPEN_ALL");
  const [priority, setPriority] = useState<string>("ALL");
  const [tenant, setTenant] = useState<string>("ALL");
  const [assignee, setAssignee] = useState<string>(
    initialAssignee === "me" ? "ME" : "ALL",
  );

  const tenants = useMemo(
    () => [...new Set(tickets.map((t) => t.tenantName))].sort(),
    [tickets],
  );

  const shown = useMemo(() => {
    const q = query.trim().toLowerCase();

    return tickets
      .filter((t) => {
        // OPEN_ALL is the working queue: anything not yet resolved
        if (status === "OPEN_ALL" && !isOpenTicket(t)) return false;
        if (status === "BREACHING" && !isBreaching(t)) return false;
        if (status !== "ALL" && status !== "OPEN_ALL" && status !== "BREACHING") {
          if (t.status !== status) return false;
        }
        if (priority !== "ALL" && t.priority !== priority) return false;
        if (tenant !== "ALL" && t.tenantName !== tenant) return false;
        if (assignee === "ME" && t.assignedToId !== CURRENT_AGENT.id) return false;
        if (assignee === "NONE" && t.assignedToId !== null) return false;
        if (!q) return true;
        return (
          t.subject.toLowerCase().includes(q) ||
          t.reference.toLowerCase().includes(q) ||
          t.tenantName.toLowerCase().includes(q) ||
          t.raisedByName.toLowerCase().includes(q)
        );
      })
      .sort(byTriage);
  }, [tickets, query, status, priority, tenant, assignee]);

  const counts = {
    openAll: tickets.filter(isOpenTicket).length,
    breaching: tickets.filter(isBreaching).length,
    all: tickets.length,
  };

  return (
    <div className="mx-auto w-full min-w-0 max-w-5xl">
      <div className="mb-4 min-w-0">
        <h1 className="font-display text-[22px] font-bold text-foreground">
          Tickets
        </h1>
        <p className="mt-1 text-[13px] text-muted-foreground">
          Every ticket raised across the platform, newest problems first.
        </p>
      </div>

      <Card className="min-w-0 p-5 sm:p-6">
        <SearchBox
          id="tkt-search"
          label="Search tickets"
          value={query}
          onChange={setQuery}
          placeholder="Search by subject, reference, institution or person…"
        />

        <FilterBar>
          <FilterTabs
            label="Filter by status"
            value={status}
            onChange={setStatus}
            tabs={[
              ["OPEN_ALL", "Open", counts.openAll],
              ["BREACHING", "Overdue", counts.breaching],
              ["ALL", "All", counts.all],
            ]}
          />

          <FilterSelect
            id="tkt-status"
            label="Status"
            value={status}
            onChange={setStatus}
            options={[
              ["OPEN_ALL", "Any open"],
              ...(["OPEN", "IN_PROGRESS", "RESOLVED", "CLOSED"] as TicketStatus[]).map(
                (s) => [s, TICKET_STATUS_LABELS[s]] as [string, string],
              ),
            ]}
          />

          <FilterSelect
            id="tkt-priority"
            label="Priority"
            value={priority}
            onChange={setPriority}
            allLabel="Any priority"
            options={(["CRITICAL", "HIGH", "MEDIUM", "LOW"] as TicketPriority[]).map(
              (p) => [p, TICKET_PRIORITY_LABELS[p]] as [string, string],
            )}
          />

          <FilterSelect
            id="tkt-tenant"
            label="Institution"
            value={tenant}
            onChange={setTenant}
            allLabel="All institutions"
            options={tenants.map((t) => [t, t] as [string, string])}
          />

          <FilterSelect
            id="tkt-assignee"
            label="Assignee"
            value={assignee}
            onChange={setAssignee}
            allLabel="Anyone"
            options={[
              ["ME", "Assigned to me"],
              ["NONE", "Unassigned"],
            ]}
          />
        </FilterBar>

        <ResultCount count={shown.length} noun="ticket" />

        {shown.length === 0 ? (
          <EmptyState
            message={
              status === "BREACHING"
                ? "Nothing is past its response target."
                : "No tickets match these filters."
            }
          />
        ) : (
          <ul className="min-w-0 divide-y divide-border border-t border-border">
            {shown.map((t) => (
              <TicketListItem key={t.id} ticket={t} />
            ))}
          </ul>
        )}
      </Card>
    </div>
  );
}
