"use client";

import { useRef, useState } from "react";
import Link from "next/link";
import { ArrowLeft, MailCheck } from "lucide-react";

import { Button } from "@/components/ui/button";
import { TextField } from "@/components/ui/text-field";
import { FormAlert } from "./form-alert";
import { TenantBadge } from "./tenant-badge";
import { requestPasswordReset } from "@/lib/auth";
import { identifierLabel, identifierPlaceholder } from "@/lib/tenant";
import type { Tenant } from "@/types/auth";

/** Password reset request — mirrors the login card styling (design §7). */
export function ForgotPasswordForm({ tenant }: { tenant: Tenant }) {
  const [submitting, setSubmitting] = useState(false);
  const [sent, setSent] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const inputRef = useRef<HTMLInputElement>(null);

  async function handleSubmit(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const identifier = inputRef.current?.value.trim() ?? "";

    if (!identifier) {
      setError("Enter your email or roll number");
      inputRef.current?.focus();
      return;
    }

    setError(null);
    setSubmitting(true);
    // TODO(Dev-A): POST /api/v1/auth/forgot-password
    await requestPasswordReset(identifier, tenant.slug);
    setSubmitting(false);
    setSent(true);
  }

  if (sent) {
    return (
      <div className="rounded-card bg-white p-0 lg:border lg:border-[#E2E8F0] lg:p-8 lg:shadow-card">
        <div className="mb-5 flex h-11 w-11 items-center justify-center rounded-full bg-success-light">
          <MailCheck className="h-5 w-5 text-success" aria-hidden="true" />
        </div>

        <h1 className="font-display text-[22px] font-bold text-[#0F172A]">
          Check your inbox
        </h1>
        <p className="mt-2 text-[13px] leading-relaxed text-[#64748B]">
          If an account matches what you entered, we&apos;ve sent a reset link.
          It expires in 30 minutes.
        </p>

        <Link
          href="/login"
          className="mt-6 inline-flex items-center gap-1.5 rounded text-[13px] font-medium text-accent transition-colors hover:text-accent-hover"
        >
          <ArrowLeft className="h-4 w-4" aria-hidden="true" />
          Back to sign in
        </Link>
      </div>
    );
  }

  return (
    <div className="rounded-card bg-white p-0 lg:border lg:border-[#E2E8F0] lg:p-8 lg:shadow-card">
      <div className="mb-7">
        <h1 className="font-display text-[22px] font-bold text-[#0F172A]">
          Reset your password
        </h1>
        <p className="mt-1 text-[13px] text-[#64748B]">
          We&apos;ll email you a secure link to set a new one.
        </p>
      </div>

      <TenantBadge tenant={tenant} />

      {error && (
        <FormAlert variant="error" className="mb-5">
          {error}
        </FormAlert>
      )}

      <form onSubmit={handleSubmit} noValidate className="space-y-4">
        <TextField
          ref={inputRef}
          name="identifier"
          label={identifierLabel(tenant)}
          placeholder={identifierPlaceholder(tenant)}
          autoComplete="username"
          autoCapitalize="none"
          spellCheck={false}
          enterKeyHint="go"
          disabled={submitting}
          onChange={() => setError(null)}
        />

        <Button type="submit" loading={submitting} loadingText="Sending…">
          Send reset link
        </Button>

        <div className="pt-2 text-center">
          <Link
            href="/login"
            className="inline-flex items-center gap-1.5 rounded text-[13px] font-medium text-accent transition-colors hover:text-accent-hover"
          >
            <ArrowLeft className="h-4 w-4" aria-hidden="true" />
            Back to sign in
          </Link>
        </div>
      </form>
    </div>
  );
}
