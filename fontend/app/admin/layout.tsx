"use client";

import { useEffect } from "react";
import { useRouter } from "next/navigation";

import { InstitutionAuthProvider, useInstitutionAuth } from "@/hooks/use-institution-auth";
import { AdminShell } from "@/components/admin/admin-shell";

/**
 * /admin console gate. Waits for the tenant session to resolve, sends
 * unauthenticated or non-admin visitors to the institution login, and renders
 * the admin shell once an INSTITUTION_ADMIN is signed in.
 */
export default function AdminLayout({ children }: { children: React.ReactNode }) {
  return (
    <InstitutionAuthProvider>
      <Gate>{children}</Gate>
    </InstitutionAuthProvider>
  );
}

function Gate({ children }: { children: React.ReactNode }) {
  const { isAuthenticated, isAdmin, isLoading } = useInstitutionAuth();
  const router = useRouter();

  useEffect(() => {
    if (!isLoading && (!isAuthenticated || !isAdmin)) {
      router.replace("/login");
    }
  }, [isLoading, isAuthenticated, isAdmin, router]);

  if (isLoading || !isAuthenticated || !isAdmin) {
    return (
      <div className="flex min-h-screen items-center justify-center bg-background">
        <div className="flex flex-col items-center gap-3 text-muted-foreground">
          <span className="h-8 w-8 animate-spin rounded-full border-2 border-accent border-t-transparent" />
          <span className="text-sm">Loading admin console…</span>
        </div>
      </div>
    );
  }

  return <AdminShell>{children}</AdminShell>;
}
