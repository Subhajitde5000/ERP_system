"use client";

/**
 * C-PA-12 — Guardian activation (`/guardian-access`).
 *
 * The one public screen of the parent portal. It exists so a school does not have
 * to key four hundred parent passwords: the office issues a 12-character code on the
 * admission slip, the family sets their own password against it, and the account
 * that appears is an ordinary tenant login — lockout, session records and refresh
 * rotation included. This page hands out no token of its own; that would be a
 * second, weaker door into the same account.
 *
 * Two inputs prove the claimer, not the code alone: the code (which only the family
 * receives) and the child's roll number, typed from the same slip. A guessed code
 * therefore produces a 422 rather than somebody's record. `Check the invitation` is
 * the optional preview in front of that — worth one round trip when a family holds
 * two slips, and the reason the backend publishes `/access/check-code` separately.
 *
 * The code is never read from the URL. Mail links deliberately omit it: a code in a
 * query string is a code in browser history, in the server's access log and in any
 * `Referer` the page's assets leak.
 */

import { useRef, useState } from "react";
import Link from "next/link";
import { ArrowLeft, CheckCircle2, Search } from "lucide-react";

import { Button } from "@/components/ui/button";
import { TextField } from "@/components/ui/text-field";
import { FormAlert } from "./form-alert";
import { TenantBadge } from "./tenant-badge";
import { APIError } from "@/lib/api-client";
import {
  activateGuardianAccount,
  checkActivationCode,
  GUARDIAN_MIN_PASSWORD,
  normaliseGuardianCode,
  type ParentCodeCheck,
} from "@/lib/parent";
import type { Tenant } from "@/types/auth";

export function GuardianAccessForm({ tenant, initialCode }: { tenant: Tenant; initialCode: string }) {
  const [code, setCode] = useState(initialCode);
  const [roll, setRoll] = useState("");
  const [name, setName] = useState("");
  const [email, setEmail] = useState("");
  const [phone, setPhone] = useState("");
  const [preview, setPreview] = useState<ParentCodeCheck | null>(null);
  const [checking, setChecking] = useState(false);
  const [checkError, setCheckError] = useState<string | null>(null);
  const [errors, setErrors] = useState<{ code?: string; roll?: string; name?: string; email?: string; password?: string; confirm?: string }>({});
  const [submitting, setSubmitting] = useState(false);
  const [failure, setFailure] = useState<{ status: number; message: string } | null>(null);
  const [done, setDone] = useState<{ student: string; institution: string; email: string } | null>(null);

  const passwordRef = useRef<HTMLInputElement>(null);
  const confirmRef = useRef<HTMLInputElement>(null);

  function onCodeChange(raw: string) {
    setCode(normaliseGuardianCode(raw));
    setPreview(null);
    setCheckError(null);
  }

  async function handleCheck() {
    if (code.length < 6) {
      setCheckError("Enter the whole code from the slip — it is 12 characters.");
      return;
    }
    setChecking(true);
    setCheckError(null);
    try {
      setPreview(await checkActivationCode(code));
    } catch (caught) {
      setPreview(null);
      setCheckError(messageOf(caught));
    } finally {
      setChecking(false);
    }
  }

  async function handleSubmit(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setFailure(null);

    const password = passwordRef.current?.value ?? "";
    const confirm = confirmRef.current?.value ?? "";
    const next: typeof errors = {};
    if (code.length < 6) next.code = "Enter the whole code from the slip";
    if (!roll.trim()) next.roll = "Enter your child's roll number";
    if (name.trim().length < 2) next.name = "Enter your full name";
    if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email.trim())) next.email = "Enter a valid email address";
    if (password.length < GUARDIAN_MIN_PASSWORD) next.password = `Use at least ${GUARDIAN_MIN_PASSWORD} characters`;
    if (confirm !== password) next.confirm = "Both passwords must match";

    setErrors(next);
    if (Object.keys(next).length) {
      (next.password ? passwordRef : confirmRef).current?.focus();
      return;
    }

    setSubmitting(true);
    try {
      const result = await activateGuardianAccount({
        code,
        student_roll_no: roll.trim(),
        name: name.trim(),
        email: email.trim(),
        password,
        phone: phone.trim() || null,
      });
      setDone({ student: result.student_name, institution: result.institution_name, email: result.email });
    } catch (caught) {
      setFailure({ status: caught instanceof APIError ? caught.status : 0, message: messageOf(caught) });
    } finally {
      setSubmitting(false);
    }
  }

  if (done) {
    return (
      <Panel
        icon={<CheckCircle2 className="h-5 w-5 text-success" aria-hidden="true" />}
        iconClass="bg-success-light"
        title="Your portal is open"
        body={`${done.student} is linked to ${done.email}. Sign in to see attendance, marks and fees — the password you just chose is the only one you need, and nothing about ${done.institution}'s other records comes with it.`}
      >
        <Link
          href={`/login${tenant.slug ? `?tenant=${encodeURIComponent(tenant.slug)}` : ""}`}
          className="mt-6 inline-flex h-11 w-full items-center justify-center rounded-field bg-accent px-5 text-[14px] font-semibold text-white shadow-accent transition-colors hover:bg-accent-hover"
        >
          Sign in
        </Link>
      </Panel>
    );
  }

  return (
    <div className="rounded-card bg-white p-0 lg:border lg:border-[#E2E8F0] lg:p-8 lg:shadow-card">
      <div className="mb-6">
        <h1 className="font-display text-[22px] font-bold text-[#0F172A]">Open your parent portal</h1>
        <p className="mt-1 text-[13px] text-[#64748B]">
          Use the activation code from your admission slip. It links one account to
          one child — nothing else on the school&apos;s system becomes visible to you.
        </p>
      </div>

      <TenantBadge tenant={tenant} />

      {failure ? (
        <FormAlert variant="error" className="mb-5">
          {failure.message}
          {failure.status === 409 ? (
            <>
              {" "}
              <Link href="/login" className="font-semibold underline">
                Sign in
              </Link>{" "}
              and enter the code from your profile instead.
            </>
          ) : null}
          {failure.status === 404 ? (
            <> If the code was issued some time ago, the office can send a fresh one in a minute.</>
          ) : null}
        </FormAlert>
      ) : null}

      <form onSubmit={handleSubmit} noValidate className="space-y-4">
        <div className="space-y-2">
          <TextField
            name="code"
            label="Activation code"
            placeholder="e.g. 7QK4M2XB9RTD"
            value={code}
            onChange={(event) => onCodeChange(event.target.value)}
            error={errors.code}
            autoComplete="one-time-code"
            inputMode="text"
            enterKeyHint="next"
            spellCheck={false}
            disabled={submitting}
          />
          <div className="flex flex-wrap items-center gap-2">
            <button
              type="button"
              onClick={handleCheck}
              disabled={checking}
              className="inline-flex items-center gap-1.5 rounded text-[12px] font-semibold text-accent transition-colors hover:text-accent-hover disabled:opacity-60"
            >
              <Search className="h-3.5 w-3.5" aria-hidden="true" />
              {checking ? "Checking…" : "Check the invitation first"}
            </button>
            {checkError ? <span className="text-[12px] text-destructive-text">{checkError}</span> : null}
          </div>
          {preview ? (
            <div className="rounded-panel border border-success/30 bg-success-light/60 px-4 py-3 text-[12px] leading-relaxed text-[#0F172A]">
              <p className="font-semibold">
                {preview.student_name}
                {preview.class_name ? ` · ${preview.class_name}` : ""}
              </p>
              <p className="mt-0.5 text-[#475569]">
                {preview.institution_name} · addressed to a {preview.relation.toLowerCase()}
                {preview.is_primary ? " (primary guardian)" : ""}
                {preview.expires_at
                  ? ` · code expires ${new Date(preview.expires_at).toLocaleDateString()}`
                  : ""}
              </p>
            </div>
          ) : null}
        </div>

        <TextField
          name="roll"
          label="Child's roll number"
          placeholder="As printed on the slip"
          value={roll}
          onChange={(event) => setRoll(event.target.value)}
          error={errors.roll}
          autoComplete="off"
          enterKeyHint="next"
          disabled={submitting}
        />

        <TextField
          name="guardianName"
          label="Your full name"
          placeholder="Name as it should appear on the portal"
          value={name}
          onChange={(event) => setName(event.target.value)}
          error={errors.name}
          autoComplete="name"
          enterKeyHint="next"
          disabled={submitting}
        />

        <TextField
          name="email"
          label="Email"
          placeholder="you@example.com"
          type="email"
          value={email}
          onChange={(event) => setEmail(event.target.value)}
          error={errors.email}
          autoComplete="email"
          enterKeyHint="next"
          disabled={submitting}
        />

        <TextField
          name="phone"
          label="Phone (optional)"
          placeholder="+91 98765 43210"
          type="tel"
          value={phone}
          onChange={(event) => setPhone(event.target.value)}
          autoComplete="tel"
          enterKeyHint="next"
          disabled={submitting}
        />

        <TextField
          ref={passwordRef}
          name="password"
          label="Choose a password"
          placeholder={`At least ${GUARDIAN_MIN_PASSWORD} characters`}
          revealable
          autoComplete="new-password"
          enterKeyHint="next"
          disabled={submitting}
          error={errors.password}
          onChange={() => setErrors((prev) => ({ ...prev, password: undefined }))}
        />

        <TextField
          ref={confirmRef}
          name="confirmPassword"
          label="Confirm password"
          placeholder="Type it again"
          revealable
          autoComplete="new-password"
          enterKeyHint="go"
          disabled={submitting}
          error={errors.confirm}
          onChange={() => setErrors((prev) => ({ ...prev, confirm: undefined }))}
        />

        <Button type="submit" loading={submitting} loadingText="Creating your account…">
          Create account and link
        </Button>

        <p className="text-[11px] leading-relaxed text-[#64748B]">
          This page allows twenty code lookups an hour per device and eight account
          creations, and both limits are enforced on the school&rsquo;s server. A code that has
          already been used will not work twice — the office can reissue one in a minute.
        </p>

        <div className="pt-1 text-center">
          <Link
            href="/login"
            className="inline-flex items-center gap-1.5 rounded text-[13px] font-medium text-accent transition-colors hover:text-accent-hover"
          >
            <ArrowLeft className="h-4 w-4" aria-hidden="true" />
            I already have an account
          </Link>
        </div>
      </form>
    </div>
  );
}

function messageOf(caught: unknown): string {
  if (caught instanceof APIError) {
    if (caught.status === 429) return "Too many attempts from this device. Wait a while and try again.";
    return caught.message;
  }
  return caught instanceof Error ? caught.message : "This could not be completed. Try again.";
}

/** Same shell as the reset-password dead states, so the auth screens are one family. */
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
      <div className={`mb-5 flex h-11 w-11 items-center justify-center rounded-full ${iconClass}`}>{icon}</div>
      <h1 className="font-display text-[22px] font-bold text-[#0F172A]">{title}</h1>
      <p className="mt-2 text-[13px] leading-relaxed text-[#64748B]">{body}</p>
      {children}
    </div>
  );
}
