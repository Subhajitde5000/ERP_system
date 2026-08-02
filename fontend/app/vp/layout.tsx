"use client";

import { useEffect } from "react";
import { useRouter } from "next/navigation";

import {
  InstitutionAuthProvider,
  useInstitutionAuth,
} from "@/hooks/use-institution-auth";
import { VicePrincipalShell } from "@/components/vice-principal/vice-principal-shell";

/** Authenticated, delegated Vice Principal surface — URL params never grant access. */
export default function VicePrincipalLayout({ children }: { children: React.ReactNode }) {
  return (
    <InstitutionAuthProvider>
      <VicePrincipalGate>{children}</VicePrincipalGate>
    </InstitutionAuthProvider>
  );
}

function VicePrincipalGate({ children }: { children: React.ReactNode }) {
  const { isAuthenticated, isVicePrincipal, isLoading } = useInstitutionAuth();
  const router = useRouter();

  useEffect(() => {
    if (!isLoading && (!isAuthenticated || !isVicePrincipal)) router.replace("/login");
  }, [isAuthenticated, isLoading, isVicePrincipal, router]);

  if (isLoading || !isAuthenticated || !isVicePrincipal) {
    return (
      <div className="flex min-h-screen items-center justify-center bg-background">
        <div className="flex flex-col items-center gap-3 text-muted-foreground">
          <span className="h-8 w-8 animate-spin rounded-full border-2 border-accent border-t-transparent" />
          <span className="text-sm">Loading Vice Principal console…</span>
        </div>
      </div>
    );
  }

  return <VicePrincipalShell>{children}</VicePrincipalShell>;
}
