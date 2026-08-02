"use client";

import { useRouter } from "next/navigation";
import { useEffect } from "react";

import { getAccessToken } from "@/lib/auth";
import { fetchSetupState } from "@/lib/setup";

/**
 * Post-login gate for the Institution Admin (Step 10 of the journey):
 * the dashboard stays locked until the setup wizard is complete. Without a
 * session (demo preview mode) the gate is transparent.
 */
export function SetupGate({ children }: { children: React.ReactNode }) {
  const router = useRouter();

  useEffect(() => {
    const token = getAccessToken();
    if (!token) return; // demo mode — no auth, no gate
    let cancelled = false;
    fetchSetupState()
      .then((res) => {
        if (!cancelled && !res.state.completed) {
          router.replace("/setup-wizard");
        }
      })
      .catch(() => {
        /* API unreachable — let the dashboard render */
      });
    return () => {
      cancelled = true;
    };
  }, [router]);

  return <>{children}</>;
}
