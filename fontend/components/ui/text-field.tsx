"use client";

import { forwardRef, useId, useState } from "react";
import { Eye, EyeOff } from "lucide-react";
import { cn } from "@/lib/utils";

/**
 * Input field — design §6.2
 * h-44px · radius 10px · border #E2E8F0 · focus indigo ring 3px
 * Errors are wired through aria-describedby / aria-invalid (§10).
 *
 * `labelAction` (e.g. the "Forgot?" link) renders visually in the label row but
 * sits after the input in the DOM, so keyboard focus reaches the field before
 * the escape hatch — WCAG 2.4.3 Focus Order.
 */

interface TextFieldProps
  extends Omit<React.InputHTMLAttributes<HTMLInputElement>, "id"> {
  label: string;
  error?: string | null;
  /** Rendered at the top-right of the field, e.g. the "Forgot?" link */
  labelAction?: React.ReactNode;
  /** Adds a show/hide toggle and manages the input type */
  revealable?: boolean;
}

export const TextField = forwardRef<HTMLInputElement, TextFieldProps>(
  function TextField(
    { label, error, labelAction, revealable, className, type = "text", ...props },
    ref,
  ) {
    const id = useId();
    const errorId = `${id}-error`;
    const [revealed, setRevealed] = useState(false);

    const resolvedType = revealable ? (revealed ? "text" : "password") : type;

    return (
      <div className="relative">
        <label htmlFor={id} className="text-[13px] font-medium text-[#334155]">
          {label}
        </label>

        <div className="relative mt-1.5">
          <input
            {...props}
            id={id}
            ref={ref}
            type={resolvedType}
            aria-invalid={error ? true : undefined}
            aria-describedby={error ? errorId : undefined}
            className={cn(
              "h-11 w-full rounded-field border bg-white px-3.5 text-[14px] text-[#0F172A]",
              "placeholder:text-[#94A3B8] transition",
              "focus:outline-none focus:ring-3",
              revealable && "pr-11",
              error
                ? "border-destructive focus:border-destructive focus:ring-destructive/15"
                : "border-[#E2E8F0] focus:border-accent focus:ring-accent/15",
              className,
            )}
          />

          {revealable && (
            <button
              type="button"
              onClick={() => setRevealed((v) => !v)}
              aria-label={revealed ? "Hide password" : "Show password"}
              aria-pressed={revealed}
              tabIndex={-1}
              className="absolute right-3 top-1/2 -translate-y-1/2 rounded p-0.5 text-[#94A3B8] transition-colors hover:text-[#64748B] focus-visible:text-accent"
            >
              {revealed ? (
                <EyeOff className="h-4 w-4" aria-hidden="true" />
              ) : (
                <Eye className="h-4 w-4" aria-hidden="true" />
              )}
            </button>
          )}
        </div>

        {error && (
          <p
            id={errorId}
            className="mt-1.5 text-[12px] font-medium text-destructive-text"
          >
            {error}
          </p>
        )}

        {/* Visually top-right, but after the input in tab order */}
        {labelAction && (
          <div className="absolute right-0 top-0">{labelAction}</div>
        )}
      </div>
    );
  },
);
