"use client";

import { useEffect, useRef, useState } from "react";
import Link from "next/link";
import {
  BadgeCheck,
  KeyRound,
  MoreHorizontal,
  Pencil,
  ShieldCheck,
  UserRound,
  UserRoundX,
} from "lucide-react";
import type { LucideIcon } from "lucide-react";

import { cn } from "@/lib/utils";
import { ACTION_LABELS } from "@/lib/user-directory";
import { Button } from "@/components/ui/button";
import type { DirectoryAction, DirectoryUser } from "@/types/user-directory";

/**
 * Row actions — PAGE 12 (C-RB-12).
 *
 * The Institution Admin has five; every other role has one or two. Rendering
 * five buttons per row would make a 25-row table unreadable, so the primary
 * action stays inline and the rest collapse into a menu. Which actions exist
 * at all was already decided server-side — this component only lays them out.
 *
 * Deactivate is destructive and irreversible from the user's point of view
 * (they lose access immediately, §5.5 `is_active`), so it confirms first —
 * the same treatment the module toggle gives disabling a module.
 */

const ICONS: Record<DirectoryAction, LucideIcon> = {
  VIEW_PROFILE: UserRound,
  EDIT: Pencil,
  DEACTIVATE: UserRoundX,
  ASSIGN_ROLES: ShieldCheck,
  RESET_PASSWORD: KeyRound,
  EDIT_HR_PROFILE: BadgeCheck,
  CHECK_ELIGIBILITY: BadgeCheck,
};

/**
 * What each action does once the API exists. Kept beside the labels so the
 * backend contract is visible at the call site rather than buried in a TODO
 * at the top of the file.
 */
function endpointFor(action: DirectoryAction, user: DirectoryUser): string {
  switch (action) {
    case "EDIT":
      // TODO(Dev-A): PATCH /api/v1/users/:id (§5.5)
      return `PATCH /users/${user.id} — API not connected yet (Dev-A, C-IA-08).`;
    case "ASSIGN_ROLES":
      // TODO(Dev-A): POST /api/v1/users/:id/roles (§5.6, C-IA-10)
      return `POST /users/${user.id}/roles — role assignment not connected yet (Dev-A, C-IA-10).`;
    case "RESET_PASSWORD":
      // TODO(Dev-A): POST /api/v1/auth/password-reset — emails a token (§5.5)
      return `POST /auth/password-reset — a reset link would be emailed to ${user.email}.`;
    case "DEACTIVATE":
      // TODO(Dev-A): PATCH /api/v1/users/:id { is_active: false } (§5.5)
      return `PATCH /users/${user.id} { is_active: false } — not connected yet (Dev-A).`;
    default:
      return "Not connected yet.";
  }
}

export function DirectoryRowActions({
  user,
  actions,
  onAction,
}: {
  user: DirectoryUser;
  actions: DirectoryAction[];
  onAction: (message: string) => void;
}) {
  const [menuOpen, setMenuOpen] = useState(false);
  const [confirming, setConfirming] = useState(false);
  const menuRef = useRef<HTMLDivElement>(null);

  // Escape and outside-click both close the menu. A keydown handler on a div
  // that never holds focus is dead code, so this lives on `document`.
  useEffect(() => {
    if (!menuOpen) return;

    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") setMenuOpen(false);
    };
    const onClick = (e: MouseEvent) => {
      if (!menuRef.current?.contains(e.target as Node)) setMenuOpen(false);
    };

    document.addEventListener("keydown", onKey);
    document.addEventListener("mousedown", onClick);
    return () => {
      document.removeEventListener("keydown", onKey);
      document.removeEventListener("mousedown", onClick);
    };
  }, [menuOpen]);

  if (actions.length === 0) return null;

  /* ── The link-shaped actions go straight to the record they own ───────── */

  // "View profile" is a navigation, not a mutation — a real anchor, so
  // middle-click and "open in new tab" work.
  const viewHref = actions.includes("VIEW_PROFILE") ? user.href : null;

  // PAGE 12 gives HR "edit HR profile". That surface is PAGE 20's HR tabs,
  // which already implement masking and the audit trail — linking there beats
  // building a second, weaker HR editor inside a list row.
  const hrHref = actions.includes("EDIT_HR_PROFILE")
    ? `${user.href}?tab=PROFILE`
    : null;

  // Eligibility is shown in the row itself; the action opens the record where
  // the placement history lives.
  const eligibilityHref = actions.includes("CHECK_ELIGIBILITY")
    ? `${user.href}?tab=PLACEMENT`
    : null;

  const menuActions = actions.filter(
    (a) =>
      a !== "VIEW_PROFILE" &&
      a !== "EDIT_HR_PROFILE" &&
      a !== "CHECK_ELIGIBILITY",
  );

  // "View profile" lives in the menu when there is one (the admin's five
  // actions would otherwise crowd the row). With no menu it has to be inline,
  // or a role whose matrix row grants it — HR, Placement — would be left with
  // no way to reach it at all.
  const viewInline = viewHref !== null && menuActions.length === 0;

  return (
    <div className="flex shrink-0 items-center justify-end gap-1">
      {viewInline && <ActionLink href={viewHref} action="VIEW_PROFILE" />}
      {hrHref && <ActionLink href={hrHref} action="EDIT_HR_PROFILE" />}
      {eligibilityHref && (
        <ActionLink href={eligibilityHref} action="CHECK_ELIGIBILITY" />
      )}

      {menuActions.length > 0 && (
        <div ref={menuRef} className="relative">
          <button
            type="button"
            aria-haspopup="menu"
            aria-expanded={menuOpen}
            aria-label={`Actions for ${user.name}`}
            onClick={() => setMenuOpen((v) => !v)}
            className={cn(
              "flex h-8 w-8 items-center justify-center rounded-field border transition focus-visible:outline-none focus-visible:ring-3 focus-visible:ring-accent/15",
              menuOpen
                ? "border-accent bg-accent-light text-accent"
                : "border-border bg-white text-muted-foreground hover:border-accent hover:text-accent",
            )}
          >
            <MoreHorizontal className="h-4 w-4" aria-hidden="true" />
          </button>

          {menuOpen && (
            <div
              role="menu"
              aria-label={`Actions for ${user.name}`}
              className="absolute right-0 top-9 z-20 w-52 overflow-hidden rounded-field border border-border bg-white py-1 shadow-[0_8px_32px_rgba(15,23,42,0.12)]"
            >
              {viewHref && (
                <Link
                  role="menuitem"
                  href={viewHref}
                  onClick={() => setMenuOpen(false)}
                  className="flex w-full items-center gap-2 px-3 py-2 text-left text-[13px] text-[#334155] transition-colors hover:bg-background focus-visible:outline-none focus-visible:bg-background"
                >
                  <UserRound className="h-4 w-4 shrink-0 text-muted-foreground" aria-hidden="true" />
                  {ACTION_LABELS.VIEW_PROFILE}
                </Link>
              )}

              {menuActions.map((a) => {
                const Icon = ICONS[a];
                const destructive = a === "DEACTIVATE";

                return (
                  <button
                    key={a}
                    role="menuitem"
                    type="button"
                    onClick={() => {
                      setMenuOpen(false);
                      if (destructive) setConfirming(true);
                      else onAction(endpointFor(a, user));
                    }}
                    className={cn(
                      "flex w-full items-center gap-2 px-3 py-2 text-left text-[13px] transition-colors hover:bg-background focus-visible:outline-none focus-visible:bg-background",
                      destructive ? "text-destructive" : "text-[#334155]",
                    )}
                  >
                    <Icon
                      className={cn(
                        "h-4 w-4 shrink-0",
                        destructive ? "text-destructive" : "text-muted-foreground",
                      )}
                      aria-hidden="true"
                    />
                    {/* A deactivated account is reactivated, not deactivated
                        again — the label has to follow the row's state. */}
                    {destructive && !user.isActive
                      ? "Reactivate"
                      : ACTION_LABELS[a]}
                  </button>
                );
              })}
            </div>
          )}
        </div>
      )}

      {confirming && (
        <DeactivateDialog
          user={user}
          onCancel={() => setConfirming(false)}
          onConfirm={() => {
            setConfirming(false);
            onAction(endpointFor("DEACTIVATE", user));
          }}
        />
      )}
    </div>
  );
}

function ActionLink({
  href,
  action,
}: {
  href: string;
  action: DirectoryAction;
}) {
  const Icon = ICONS[action];
  const label = ACTION_LABELS[action];

  return (
    <Link
      href={href}
      // The label collapses to an icon under 640px. `aria-label` carries the
      // name in both states, so the link is never announced as just an icon —
      // and there is only ever one copy of the text in the a11y tree.
      aria-label={label}
      data-directory-action={action}
      className="inline-flex h-8 shrink-0 items-center gap-1.5 rounded-field border border-border bg-white px-2.5 text-[12px] font-medium text-muted-foreground transition hover:border-accent hover:text-accent focus-visible:outline-none focus-visible:ring-3 focus-visible:ring-accent/15"
    >
      <Icon className="h-3.5 w-3.5" aria-hidden="true" />
      <span className="hidden sm:inline" aria-hidden="true">
        {label}
      </span>
    </Link>
  );
}

/**
 * Deactivation cuts a real person's access on their next request (§5.5), so
 * it names who, spells out the consequence, and says what is *not* deleted.
 */
function DeactivateDialog({
  user,
  onCancel,
  onConfirm,
}: {
  user: DirectoryUser;
  onCancel: () => void;
  onConfirm: () => void;
}) {
  const reactivating = !user.isActive;

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") onCancel();
    };
    document.addEventListener("keydown", onKey);
    return () => document.removeEventListener("keydown", onKey);
  }, [onCancel]);

  return (
    <div
      role="alertdialog"
      aria-modal="true"
      aria-labelledby="deactivate-title"
      className="fixed inset-0 z-50 flex items-end justify-center bg-primary/40 p-0 sm:items-center sm:p-6"
    >
      <div className="w-full max-w-md rounded-t-card border border-border bg-white p-6 text-left shadow-card sm:rounded-card">
        <div className="flex items-start gap-3">
          <span
            className={cn(
              "flex h-9 w-9 shrink-0 items-center justify-center rounded-full",
              reactivating ? "bg-success-light" : "bg-destructive-light",
            )}
            aria-hidden="true"
          >
            <UserRoundX
              className={cn(
                "h-4 w-4",
                reactivating ? "text-success" : "text-destructive",
              )}
            />
          </span>
          <div className="min-w-0">
            <h2
              id="deactivate-title"
              className="font-display text-[16px] font-bold text-foreground"
            >
              {reactivating ? "Reactivate" : "Deactivate"} {user.name}?
            </h2>
            <p className="mt-1 text-[13px] leading-6 text-muted-foreground">
              {reactivating
                ? "They will be able to sign in again with their existing password, and their previous roles are restored."
                : "They are signed out everywhere and cannot sign in again until the account is reactivated."}
            </p>
          </div>
        </div>

        {!reactivating && (
          <ul className="mt-4 min-w-0 space-y-2 border-t border-border pt-4 text-[13px] leading-6 text-[#334155]">
            <li className="flex min-w-0 gap-2">
              <ShieldCheck
                className="mt-1 h-4 w-4 shrink-0 text-muted-foreground"
                aria-hidden="true"
              />
              <span className="min-w-0">
                Their{" "}
                <strong>
                  {user.roles.length} role
                  {user.roles.length === 1 ? "" : "s"}
                </strong>{" "}
                stay assigned but stop granting access.
              </span>
            </li>
            <li className="flex min-w-0 gap-2">
              <BadgeCheck
                className="mt-1 h-4 w-4 shrink-0 text-muted-foreground"
                aria-hidden="true"
              />
              <span className="min-w-0">
                Their records — attendance, results, payroll — are kept, not
                deleted.
              </span>
            </li>
          </ul>
        )}

        <div className="mt-5 flex flex-wrap justify-end gap-2">
          <button
            type="button"
            onClick={onCancel}
            className="inline-flex h-10 items-center rounded-field border border-border px-4 text-[13px] font-medium text-[#475569] hover:bg-background focus-visible:outline-none focus-visible:ring-3 focus-visible:ring-accent/15"
          >
            Cancel
          </button>
          <Button
            type="button"
            onClick={onConfirm}
            className={cn(
              "h-10 w-auto px-4 text-[13px] shadow-none",
              reactivating
                ? "bg-success hover:bg-[#059669]"
                : "bg-destructive hover:bg-[#DC2626]",
            )}
          >
            {reactivating ? "Reactivate" : "Deactivate"} account
          </Button>
        </div>
      </div>
    </div>
  );
}
