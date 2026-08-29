import { Suspense } from "react";

import { ParentConsoleProvider } from "@/components/parent/parent-console-context";
import { ParentShell } from "@/components/parent/parent-shell";

/**
 * The parent console. Everything below this layout is one guardian's console: the
 * provider fetches the family roster once, and each page reads the child selected
 * in the header instead of re-fetching it.
 *
 * The Suspense boundary is required because the selected child lives in the URL's
 * search params and these pages are prerendered.
 */
export default function ParentLayout({ children }: { children: React.ReactNode }) {
  return (
    <Suspense fallback={null}>
      <ParentConsoleProvider>
        <ParentShell>{children}</ParentShell>
      </ParentConsoleProvider>
    </Suspense>
  );
}
