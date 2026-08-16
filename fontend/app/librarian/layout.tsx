"use client";

import { useEffect } from "react";
import { useRouter } from "next/navigation";
import { InstitutionAuthProvider, useInstitutionAuth } from "@/hooks/use-institution-auth";
import { LibraryShell } from "@/components/librarian/library-shell";

function Gate({ children }: { children: React.ReactNode }) {
  const { isAuthenticated, isLoading } = useInstitutionAuth();
  const router = useRouter();
  useEffect(() => { if (!isLoading && !isAuthenticated) router.replace("/login"); }, [isAuthenticated, isLoading, router]);
  if (isLoading || !isAuthenticated) return <div className="flex min-h-screen items-center justify-center bg-background text-sm text-muted-foreground">Loading library…</div>;
  return <LibraryShell>{children}</LibraryShell>;
}

export default function LibraryLayout({ children }: { children: React.ReactNode }) {
  return <InstitutionAuthProvider><Gate>{children}</Gate></InstitutionAuthProvider>;
}
