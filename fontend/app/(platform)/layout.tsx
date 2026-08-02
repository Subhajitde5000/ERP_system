"use client";

import { Suspense, useEffect } from "react";
import { usePathname, useRouter, useSearchParams } from "next/navigation";

import {
  PlatformAuthProvider,
  usePlatformAuth,
} from "@/hooks/use-platform-auth";

/**
 * Platform console session gate — `app.xyz.com`.
 *
 * Every page under `(platform)` now reads live data over an authenticated
 * API, so the console needs a session provider and a redirect for anonymous
 * visitors. Mirrors `app/admin/layout.tsx`, the same pattern the institution
 * admin console uses.
 *
 * `?role=` still bypasses the gate: the design docs use it to preview a
 * platform role without a backend, and several pages are linked that way from
 * the docs. It is a *rendering* preview only — the API rejects any request
 * whose bearer token is missing or not SUPER_ADMIN with 401/403, so previewing
 * shows the console's empty and error states rather than another tenant's data.
 */
export default function PlatformLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <PlatformAuthProvider>
      {/* `Gate` reads useSearchParams for `?role=`, which opts the tree into
          client rendering; without a boundary the prerender of every platform
          page fails at build time. */}
      <Suspense fallback={<ConsoleSpinner />}>
        <Gate>{children}</Gate>
      </Suspense>
    </PlatformAuthProvider>
  );
}

function ConsoleSpinner() {
  return (
    <div className="flex min-h-screen items-center justify-center bg-background">
      <div className="flex flex-col items-center gap-3 text-muted-foreground">
        <span className="h-8 w-8 animate-spin rounded-full border-2 border-accent border-t-transparent" />
        <span className="text-sm">Loading platform console…</span>
      </div>
    </div>
  );
}

function Gate({ children }: { children: React.ReactNode }) {
  const { isAuthenticated, isLoading } = usePlatformAuth();
  const router = useRouter();
  const pathname = usePathname();
  const params = useSearchParams();

  // Design-doc preview mode — render without a session.
  const preview = params.get("role") !== null;

  useEffect(() => {
    if (!preview && !isLoading && !isAuthenticated) {
      const next = encodeURIComponent(pathname);
      router.replace(`/platform/login?next=${next}`);
    }
  }, [preview, isLoading, isAuthenticated, pathname, router]);

  if (!preview && (isLoading || !isAuthenticated)) {
    return <ConsoleSpinner />;
  }

  return <>{children}</>;
}
