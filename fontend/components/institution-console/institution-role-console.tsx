"use client";

/**
 * One authenticated role gate for every production institution console.
 *
 * The Admin, Principal and Vice Principal consoles have different navigation
 * and policies, but all must hydrate the same tenant session, reject a URL
 * role hint, redirect unauthenticated visitors and show a consistent loading
 * state. Keeping that security boundary here prevents the three layouts from
 * drifting apart.
 */

import { useEffect, type ComponentType, type ReactNode } from "react";
import { useRouter } from "next/navigation";

import {
  InstitutionAuthProvider,
  useInstitutionAuth,
} from "@/hooks/use-institution-auth";

type ProtectedInstitutionRole =
  | "INSTITUTION_ADMIN"
  | "PRINCIPAL"
  | "VICE_PRINCIPAL"
  | "HOD"
  | "ACADEMIC_COORDINATOR"
  | "EXAM_CONTROLLER";

export function InstitutionRoleConsole({
  children,
  requiredRole,
  loadingLabel,
  Shell,
}: {
  children: ReactNode;
  requiredRole: ProtectedInstitutionRole;
  loadingLabel: string;
  Shell: ComponentType<{ children: ReactNode }>;
}) {
  return (
    <InstitutionAuthProvider>
      <InstitutionRoleGate
        requiredRole={requiredRole}
        loadingLabel={loadingLabel}
        Shell={Shell}
      >
        {children}
      </InstitutionRoleGate>
    </InstitutionAuthProvider>
  );
}

function InstitutionRoleGate({
  children,
  requiredRole,
  loadingLabel,
  Shell,
}: {
  children: ReactNode;
  requiredRole: ProtectedInstitutionRole;
  loadingLabel: string;
  Shell: ComponentType<{ children: ReactNode }>;
}) {
  const { isAuthenticated, isLoading, hasRole } = useInstitutionAuth();
  const router = useRouter();
  const authorised = hasRole(requiredRole);

  useEffect(() => {
    if (!isLoading && (!isAuthenticated || !authorised)) router.replace("/login");
  }, [authorised, isAuthenticated, isLoading, router]);

  if (isLoading || !isAuthenticated || !authorised) {
    return (
      <div className="flex min-h-screen items-center justify-center bg-background">
        <div className="flex flex-col items-center gap-3 text-muted-foreground">
          <span className="h-8 w-8 animate-spin rounded-full border-2 border-accent border-t-transparent" />
          <span className="text-sm">{loadingLabel}</span>
        </div>
      </div>
    );
  }

  return <Shell>{children}</Shell>;
}
