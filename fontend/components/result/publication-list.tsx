"use client";

import { useState } from "react";

import { FormAlert } from "@/components/auth/form-alert";
import { PublicationCard } from "./publication-card";
import type { Publication, ResultPermissions } from "@/types/result";

/**
 * Publication queue — Exam Controller (compile/publish) and Principal/VP
 * (approve). Owns only the action feedback; each row decides its own lever.
 */
export function PublicationList({
  publications,
  perms,
}: {
  publications: Publication[];
  perms: ResultPermissions;
}) {
  const [status, setStatus] = useState<string | null>(null);

  return (
    <div className="grid min-w-0 gap-4">
      {status && <FormAlert variant="info">{status}</FormAlert>}

      {publications.map((p) => (
        <PublicationCard
          key={p.id}
          publication={p}
          perms={perms}
          onAction={setStatus}
        />
      ))}
    </div>
  );
}
