"use client";

import { useEffect } from "react";
import { useRouter } from "next/navigation";

import { OwnerAuthProvider, useOwnerAuth } from "@/hooks/use-owner-auth";
import { OwnerShell } from "@/components/owner/owner-shell";

/**
 * Auth gate for the /account console. Wraps everything in the owner auth
 * provider, waits for the session to resolve, redirects unauthenticated
 * visitors to the platform login, and renders the shell once signed in.
 */
export function AccountGate({ children }: { children: React.ReactNode }) {
  return (
    <OwnerAuthProvider>
      <GateInner>{children}</GateInner>
    </OwnerAuthProvider>
  );
}

function GateInner({ children }: { children: React.ReactNode }) {
  const { isAuthenticated, isLoading } = useOwnerAuth();
  const router = useRouter();

  useEffect(() => {
    if (!isLoading && !isAuthenticated) {
      router.replace("/account/login");
    }
  }, [isLoading, isAuthenticated, router]);

  if (isLoading || !isAuthenticated) {
    return (
      <div className="flex min-h-screen items-center justify-center bg-background">
        <div className="flex flex-col items-center gap-3 text-muted-foreground">
          <span className="h-8 w-8 animate-spin rounded-full border-2 border-accent border-t-transparent" />
          <span className="text-sm">Loading your account…</span>
        </div>
      </div>
    );
  }

  return <OwnerShell>{children}</OwnerShell>;
}
