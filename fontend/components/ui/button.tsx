"use client";

import { forwardRef } from "react";
import { cn } from "@/lib/utils";

/**
 * Primary button — design §6.3
 * #4F46E5 → hover #4338CA → active #3730A3 · h-44px · radius 10px · indigo shadow
 * Loading state disables the button to prevent double submit (§10).
 */

interface ButtonProps extends React.ButtonHTMLAttributes<HTMLButtonElement> {
  loading?: boolean;
  loadingText?: string;
  variant?: "primary" | "secondary";
}

export const Button = forwardRef<HTMLButtonElement, ButtonProps>(
  function Button(
    {
      loading = false,
      loadingText = "Please wait…",
      variant = "primary",
      disabled,
      className,
      children,
      ...props
    },
    ref,
  ) {
    return (
      <button
        {...props}
        ref={ref}
        disabled={disabled || loading}
        aria-busy={loading || undefined}
        className={cn(
          // `cn` is a plain join with no Tailwind conflict resolution, so a
          // caller passing `w-auto` can't override a hard-coded `w-full` —
          // both classes land and source order decides. Default the width
          // only when the caller hasn't specified one.
          "flex h-11 items-center justify-center gap-2 rounded-field text-[14px] font-semibold transition-all",
          !/\bw-(auto|fit|\d|\[)/.test(className ?? "") && "w-full",
          "disabled:cursor-not-allowed disabled:opacity-60",
          variant === "primary" &&
            "bg-accent text-white shadow-accent hover:bg-accent-hover active:bg-accent-active",
          variant === "secondary" &&
            "border border-[#E2E8F0] bg-white text-[#0F172A] hover:border-[#CBD5E1] hover:bg-[#F8FAFC]",
          className,
        )}
      >
        {loading ? (
          <>
            <span
              className="h-4 w-4 animate-spin rounded-full border-2 border-white/30 border-t-white"
              aria-hidden="true"
            />
            {loadingText}
          </>
        ) : (
          children
        )}
      </button>
    );
  },
);
