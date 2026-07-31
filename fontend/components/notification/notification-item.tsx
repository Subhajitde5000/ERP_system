import Link from "next/link";

import { cn } from "@/lib/utils";
import { timeAgo } from "@/lib/notices";
import {
  CATEGORY_LABELS,
  CATEGORY_TONE,
  EVENT_META,
  FALLBACK_ICON,
} from "@/lib/notification";
import { TONE_BG, TONE_TEXT } from "@/components/dashboard/primitives";
import type { AppNotification } from "@/types/notification";

/**
 * `<NotificationItem>` — role_based_shared_pages.md PAGE 15.
 *
 * The doc specifies this exactly: "with `type` prop drives the icon, color,
 * and deep-link URL". All three come from EVENT_META, so the row holds no
 * role logic and every role shares it.
 */
export function NotificationItem({
  notification,
  onOpen,
}: {
  notification: AppNotification;
  /** Marks read on click — the row itself stays presentational */
  onOpen: (id: string) => void;
}) {
  const meta = EVENT_META[notification.event];
  const Icon = meta?.icon ?? FALLBACK_ICON;
  const category = meta?.category ?? "SYSTEM";
  const tone = CATEGORY_TONE[category];
  const href = notification.href ?? meta?.href ?? "/dashboard";

  return (
    <li className="min-w-0">
      <Link
        href={href}
        onClick={() => onOpen(notification.id)}
        className={cn(
          "flex min-w-0 gap-3 rounded-field p-3 transition-colors hover:bg-muted",
          !notification.isRead && "bg-accent-light/40",
        )}
      >
        <span
          className={cn(
            "relative flex h-9 w-9 shrink-0 items-center justify-center rounded-field",
            TONE_BG[tone],
          )}
          aria-hidden="true"
        >
          <Icon className={cn("h-4 w-4", TONE_TEXT[tone])} />
          {meta?.urgent && !notification.isRead && (
            <span className="absolute -right-0.5 -top-0.5 h-2 w-2 rounded-full bg-destructive ring-2 ring-white" />
          )}
        </span>

        <div className="min-w-0 flex-1">
          <p className="flex min-w-0 flex-wrap items-center gap-x-2 gap-y-1">
            <span
              className={cn(
                "min-w-0 truncate text-[13px] text-foreground",
                !notification.isRead && "font-semibold",
              )}
            >
              {notification.title}
            </span>
            <span
              className={cn(
                "shrink-0 rounded-full px-1.5 py-px text-[10px] font-medium",
                TONE_BG[tone],
                TONE_TEXT[tone],
              )}
            >
              {CATEGORY_LABELS[category]}
            </span>
          </p>

          <p className="mt-0.5 line-clamp-2 text-[12px] leading-5 text-muted-foreground">
            {notification.body}
          </p>

          <p className="mt-1 text-[11px] text-[#94A3B8]">
            {timeAgo(notification.createdAt)}
          </p>
        </div>

        {!notification.isRead && (
          <span
            className="mt-1 h-2 w-2 shrink-0 rounded-full bg-accent"
            aria-label="Unread"
          />
        )}
      </Link>
    </li>
  );
}
