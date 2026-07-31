"use client";

import { useMemo, useState } from "react";
import { BellOff, CheckCheck } from "lucide-react";

import { cn } from "@/lib/utils";
import {
  CATEGORY_LABELS,
  EVENT_META,
  categoriesIn,
  groupByAge,
} from "@/lib/notification";
import { Card } from "@/components/dashboard/primitives";
import { NotificationItem } from "./notification-item";
import type { AppNotification, NotificationCategory } from "@/types/notification";

/**
 * Notification inbox — PAGE 15.
 *
 * "Same layout, different notification types per role" — so there is one
 * inbox for all 18 roles; only the incoming events differ. Filters are built
 * from the categories actually present, so a Teacher never sees an empty
 * "Fees" tab.
 */
export function NotificationInbox({
  notifications,
  heading,
}: {
  notifications: AppNotification[];
  /** Page heading, rendered here so it can host the mark-all action */
  heading: string;
}) {
  const [items, setItems] = useState(notifications);
  const [filter, setFilter] = useState<NotificationCategory | "ALL" | "UNREAD">(
    "ALL",
  );

  const categories = useMemo(() => categoriesIn(items), [items]);
  const unreadCount = items.filter((i) => !i.isRead).length;

  const visible = useMemo(() => {
    if (filter === "ALL") return items;
    if (filter === "UNREAD") return items.filter((i) => !i.isRead);
    return items.filter(
      (i) => (EVENT_META[i.event]?.category ?? "SYSTEM") === filter,
    );
  }, [items, filter]);

  const groups = useMemo(() => groupByAge(visible), [visible]);

  function markRead(id: string) {
    // TODO(Dev-B): PATCH /api/v1/notifications/:id/read
    setItems((list) =>
      list.map((n) => (n.id === id ? { ...n, isRead: true } : n)),
    );
  }

  function markAllRead() {
    // TODO(Dev-B): PATCH /api/v1/notifications/read-all
    setItems((list) => list.map((n) => ({ ...n, isRead: true })));
  }

  return (
    <div className="grid min-w-0 gap-4">
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div>
          <h1 className="font-display text-[22px] font-bold text-foreground">
            {heading}
          </h1>
          <p className="mt-1 text-[13px] text-muted-foreground">
            {unreadCount > 0
              ? `${unreadCount} unread — tap any item to open it.`
              : "You're all caught up."}
          </p>
        </div>

        {unreadCount > 0 && (
          <button
            type="button"
            onClick={markAllRead}
            className="inline-flex h-10 shrink-0 items-center gap-1.5 rounded-field border border-border bg-white px-4 text-[13px] font-medium text-accent transition-colors hover:border-accent hover:bg-accent-light"
          >
            <CheckCheck className="h-4 w-4" aria-hidden="true" />
            Mark all read
          </button>
        )}
      </div>

      {/* Filters — full width; the mark-all action lives in the page header */}
      <div className="min-w-0">
        <div
          role="group"
          aria-label="Filter notifications"
          className="-mx-1 flex min-w-0 gap-2 overflow-x-auto px-1 pb-1"
        >
          <FilterPill
            active={filter === "ALL"}
            onClick={() => setFilter("ALL")}
            label="All"
            count={items.length}
          />
          <FilterPill
            active={filter === "UNREAD"}
            onClick={() => setFilter("UNREAD")}
            label="Unread"
            count={unreadCount}
          />
          {categories.map((c) => (
            <FilterPill
              key={c}
              active={filter === c}
              onClick={() => setFilter(c)}
              label={CATEGORY_LABELS[c]}
              count={
                items.filter(
                  (i) => (EVENT_META[i.event]?.category ?? "SYSTEM") === c,
                ).length
              }
            />
          ))}
        </div>

      </div>

      {groups.length === 0 ? (
        <Card className="border-dashed py-14 text-center">
          <BellOff
            className="mx-auto mb-3 h-5 w-5 text-muted-foreground"
            aria-hidden="true"
          />
          <p className="font-display text-[15px] font-bold text-foreground">
            {filter === "UNREAD" ? "You're all caught up" : "No notifications"}
          </p>
          <p className="mx-auto mt-1.5 max-w-[300px] text-[13px] text-muted-foreground">
            {filter === "UNREAD"
              ? "Every notification has been read."
              : "Notifications will appear here as things happen."}
          </p>
        </Card>
      ) : (
        groups.map((group) => (
          <Card key={group.label} className="min-w-0 p-4 sm:p-5">
            <h2 className="mb-2 px-1 text-[11px] font-semibold uppercase tracking-wide text-muted-foreground">
              {group.label}
            </h2>
            <ul className="min-w-0 space-y-1">
              {group.items.map((n) => (
                <NotificationItem
                  key={n.id}
                  notification={n}
                  onOpen={markRead}
                />
              ))}
            </ul>
          </Card>
        ))
      )}
    </div>
  );
}

function FilterPill({
  active,
  onClick,
  label,
  count,
}: {
  active: boolean;
  onClick: () => void;
  label: string;
  count: number;
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      aria-pressed={active}
      className={cn(
        "h-8 shrink-0 whitespace-nowrap rounded-full border px-3.5 text-xs font-medium transition",
        active
          ? "border-primary bg-primary text-white"
          : "border-border bg-white text-muted-foreground hover:border-accent hover:text-foreground",
      )}
    >
      {label}
      <span className="ml-1.5 opacity-70">{count}</span>
    </button>
  );
}
