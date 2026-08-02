"use client";

import { useEffect } from "react";
import { useRouter } from "next/navigation";

import {
  InstitutionAuthProvider,
  useInstitutionAuth,
} from "@/hooks/use-institution-auth";
import { PrincipalShell } from "@/components/principal/principal-shell";

/**
 * Authenticated Principal surface.  A query-string preview is deliberately not
 * accepted here: approval controls must never render from a URL role hint.
 */
export default function PrincipalLayout({ children }: { children: React.ReactNode }) {
  return (
    <InstitutionAuthProvider>
      <PrincipalGate>{children}</PrincipalGate>
    </InstitutionAuthProvider>
  );
}

function PrincipalGate({ children }: { children: React.ReactNode }) {
  const { isAuthenticated, isPrincipal, isLoading } = useInstitutionAuth();
  const router = useRouter();

  useEffect(() => {
    if (!isLoading && (!isAuthenticated || !isPrincipal)) router.replace("/login");
  }, [isAuthenticated, isLoading, isPrincipal, router]);

  if (isLoading || !isAuthenticated || !isPrincipal) {
    return (
      <div className="flex min-h-screen items-center justify-center bg-background">
        <div className="flex flex-col items-center gap-3 text-muted-foreground">
          <span className="h-8 w-8 animate-spin rounded-full border-2 border-accent border-t-transparent" />
          <span className="text-sm">Loading Principal console…</span>
        </div>
      </div>
    );
  }

  return <PrincipalShell>{children}</PrincipalShell>;
}
