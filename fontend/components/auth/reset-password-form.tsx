"use client";

import { useRef, useState } from "react";
import Link from "next/link";
import { ArrowLeft, CheckCircle2, Link2Off, TimerOff } from "lucide-react";

import { Button } from "@/components/ui/button";
import { TextField } from "@/components/ui/text-field";
import { FormAlert } from "./form-alert";
import { TenantBadge } from "./tenant-badge";
import {
  MIN_PASSWORD_LENGTH,
  submitPasswordReset,
  type ResetTokenState,
} from "@/lib/auth";
import type { Tenant } from "@/types/auth";

/**
 * C-PB-03 — Reset Password. "Set new password via token from email"
 *
 * Reached only from the link `/forgot-password` promises, so it opens in one
 * of three states decided on the server from `?token=`: a usable token, no
 * token at all, or one past `users.password_reset_expires` (DB §4.3). The
 * dead-link states are rendered here rather than 404ing, because a 404 tells
 * someone whose link merely aged out that the page is broken.
 */
export function ResetPasswordForm({
  tenant,
  token,
  state,
}: {
  tenant: Tenant;
  token: string;
  state: ResetTokenState;
}) {
  const [submitting, setSubmitting] = useState(false);
  const [done, setDone] = useState(false);
  const [errors, setErrors] = useState<{
    password?: string;
    confirm?: string;
  }>({});

  const passwordRef = useRef<HTMLInputElement>(null);
  const confirmRef = useRef<HTMLInputElement>(null);

  async function handleSubmit(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const password = passwordRef.current?.value ?? "";
    const confirm = confirmRef.current?.value ?? "";

    const next: typeof errors = {};
    if (!password) next.password = "Enter a new password";
    else if (password.length < MIN_PASSWORD_LENGTH)
      next.password = `Password must be at least ${MIN_PASSWORD_LENGTH} characters`;
    if (!confirm) next.confirm = "Re-enter the password";
    else if (password && confirm !== password)
      next.confirm = "Both passwords must match";

    setErrors(next);
    if (Object.keys(next).length) {
      (next.password ? passwordRef : confirmRef).current?.focus();
      return;
    }

    setSubmitting(true);
    // TODO(Dev-A): POST /api/v1/auth/reset-password
    await submitPasswordReset(token, password);
    setSubmitting(false);
    setDone(true);
  }

  /* ── Dead link: no token ─────────────────────────────────────────────── */
  if (state === "MISSING") {
    return (
      <Panel
        icon={<Link2Off className="h-5 w-5 text-destructive" aria-hidden="true" />}
        iconClass="bg-destructive-light"
        title="This link isn't complete"
        body="Open the reset link from your email exactly as it was sent, or request a new one."
      >
        <Link
          href="/forgot-password"
          className="mt-6 inline-flex h-11 w-full items-center justify-center rounded-field bg-accent px-5 text-[14px] font-semibold text-white shadow-accent transition-colors hover:bg-accent-hover"
        >
          Request a new link
        </Link>
        <BackToSignIn />
      </Panel>
    );
  }

  /* ── Dead link: expired ──────────────────────────────────────────────── */
  if (state === "EXPIRED") {
    return (
      <Panel
        icon={<TimerOff className="h-5 w-5 text-warning" aria-hidden="true" />}
        iconClass="bg-warning-light"
        title="This link has expired"
        body="Reset links are valid for 30 minutes. Request a new one and it will arrive straight away."
      >
        <Link
          href="/forgot-password"
          className="mt-6 inline-flex h-11 w-full items-center justify-center rounded-field bg-accent px-5 text-[14px] font-semibold text-white shadow-accent transition-colors hover:bg-accent-hover"
        >
          Request a new link
        </Link>
        <BackToSignIn />
      </Panel>
    );
  }

  /* ── Done ────────────────────────────────────────────────────────────── */
  if (done) {
    return (
      <Panel
        icon={<CheckCircle2 className="h-5 w-5 text-success" aria-hidden="true" />}
        iconClass="bg-success-light"
        title="Password changed"
        body="You can now sign in with your new password. Any other devices you were signed in on have been signed out."
      >
        <Link
          href="/login"
          className="mt-6 inline-flex h-11 w-full items-center justify-center rounded-field bg-accent px-5 text-[14px] font-semibold text-white shadow-accent transition-colors hover:bg-accent-hover"
        >
          Sign in
        </Link>
      </Panel>
    );
  }

  /* ── The form ────────────────────────────────────────────────────────── */
  return (
    <div className="rounded-card bg-white p-0 lg:border lg:border-[#E2E8F0] lg:p-8 lg:shadow-card">
      <div className="mb-7">
        <h1 className="font-display text-[22px] font-bold text-[#0F172A]">
          Set a new password
        </h1>
        <p className="mt-1 text-[13px] text-[#64748B]">
          Choose something you haven&apos;t used here before.
        </p>
      </div>

      <TenantBadge tenant={tenant} />

      {(errors.password || errors.confirm) && (
        <FormAlert variant="error" className="mb-5">
          {errors.password ?? errors.confirm}
        </FormAlert>
      )}

      <form onSubmit={handleSubmit} noValidate className="space-y-4">
        <TextField
          ref={passwordRef}
          name="password"
          label="New password"
          placeholder="At least 6 characters"
          revealable
          autoComplete="new-password"
          enterKeyHint="next"
          disabled={submitting}
          error={errors.password}
          onChange={() => setErrors((p) => ({ ...p, password: undefined }))}
        />

        <TextField
          ref={confirmRef}
          name="confirmPassword"
          label="Confirm new password"
          placeholder="Type it again"
          revealable
          autoComplete="new-password"
          enterKeyHint="go"
          disabled={submitting}
          error={errors.confirm}
          onChange={() => setErrors((p) => ({ ...p, confirm: undefined }))}
        />

        <Button type="submit" loading={submitting} loadingText="Saving…">
          Change password
        </Button>

        <div className="pt-2 text-center">
          <BackToSignIn />
        </div>
      </form>
    </div>
  );
}

/** Shared shell for the three non-form states. */
function Panel({
  icon,
  iconClass,
  title,
  body,
  children,
}: {
  icon: React.ReactNode;
  iconClass: string;
  title: string;
  body: string;
  children?: React.ReactNode;
}) {
  return (
    <div className="rounded-card bg-white p-0 lg:border lg:border-[#E2E8F0] lg:p-8 lg:shadow-card">
      <div
        className={`mb-5 flex h-11 w-11 items-center justify-center rounded-full ${iconClass}`}
      >
        {icon}
      </div>
      <h1 className="font-display text-[22px] font-bold text-[#0F172A]">
        {title}
      </h1>
      <p className="mt-2 text-[13px] leading-relaxed text-[#64748B]">{body}</p>
      {children}
    </div>
  );
}

function BackToSignIn() {
  return (
    <Link
      href="/login"
      className="mt-6 inline-flex items-center gap-1.5 rounded text-[13px] font-medium text-accent transition-colors hover:text-accent-hover"
    >
      <ArrowLeft className="h-4 w-4" aria-hidden="true" />
      Back to sign in
    </Link>
  );
}
