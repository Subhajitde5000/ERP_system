"use client";

import { AlertTriangle, Download, RefreshCw } from "lucide-react";

import { Card, ErrorState, Loading } from "@/components/admin/ui";

export function MetricCard({
  label,
  value,
  hint,
  tone = "default",
}: {
  label: string;
  value: string | number;
  hint?: string;
  tone?: "default" | "success" | "warning" | "danger";
}) {
  const valueClass = {
    default: "text-primary",
    success: "text-success-text",
    warning: "text-warning-text",
    danger: "text-destructive-text",
  }[tone];
  return (
    <Card className="!p-4">
      <p className="text-[11px] font-semibold uppercase tracking-wide text-muted-foreground">{label}</p>
      <p className={`mt-2 font-display text-2xl font-extrabold ${valueClass}`}>{value}</p>
      {hint ? <p className="mt-1 text-xs text-muted-foreground">{hint}</p> : null}
    </Card>
  );
}

export function ResourceError({ message, onRetry }: { message: string; onRetry: () => void }) {
  return (
    <div className="space-y-3">
      <ErrorState message={message} />
      <button
        type="button"
        onClick={onRetry}
        className="inline-flex h-9 items-center gap-1.5 rounded-field border border-border bg-white px-3 text-sm font-semibold text-foreground transition hover:border-accent hover:text-accent"
      >
        <RefreshCw className="h-3.5 w-3.5" aria-hidden="true" />
        Try again
      </button>
    </div>
  );
}

export function AsyncState({
  loading,
  error,
  onRetry,
  children,
  loadingLabel,
}: {
  loading: boolean;
  error: string | null;
  onRetry: () => void;
  children: React.ReactNode;
  loadingLabel?: string;
}) {
  if (loading) return <Loading label={loadingLabel} />;
  if (error) return <ResourceError message={error} onRetry={onRetry} />;
  return <>{children}</>;
}

export function ExportButton({
  onClick,
  disabled = false,
  label = "Export CSV",
}: {
  onClick: () => void;
  disabled?: boolean;
  label?: string;
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      disabled={disabled}
      className="inline-flex h-10 items-center gap-2 rounded-field border border-border bg-white px-4 text-sm font-semibold text-foreground transition hover:border-accent hover:text-accent disabled:cursor-not-allowed disabled:opacity-50"
    >
      <Download className="h-4 w-4" aria-hidden="true" />
      {label}
    </button>
  );
}

export function EmptyTable({ text }: { text: string }) {
  return (
    <div className="flex flex-col items-center justify-center gap-2 px-5 py-12 text-center text-sm text-muted-foreground">
      <AlertTriangle className="h-5 w-5 text-muted-foreground" aria-hidden="true" />
      <span>{text}</span>
    </div>
  );
}

export function percent(value: number | null | undefined): string {
  return value === null || value === undefined ? "—" : `${value.toFixed(value % 1 ? 1 : 0)}%`;
}

export function dateTime(value: string | null | undefined): string {
  if (!value) return "—";
  const date = new Date(value);
  if (Number.isNaN(date.valueOf())) return "—";
  return new Intl.DateTimeFormat("en-IN", {
    day: "2-digit",
    month: "short",
    year: "numeric",
    hour: "2-digit",
    minute: "2-digit",
  }).format(date);
}

export function dateOnly(value: string | null | undefined): string {
  if (!value) return "—";
  const date = new Date(`${value}T00:00:00`);
  if (Number.isNaN(date.valueOf())) return "—";
  return new Intl.DateTimeFormat("en-IN", {
    day: "2-digit",
    month: "short",
    year: "numeric",
  }).format(date);
}

export function statusLabel(value: string): string {
  return value.toLowerCase().replace(/_/g, " ").replace(/\b\w/g, (letter) => letter.toUpperCase());
}
