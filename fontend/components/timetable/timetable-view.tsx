"use client";

import { useState } from "react";
import Link from "next/link";
import { Repeat, Upload } from "lucide-react";

import { cn } from "@/lib/utils";
import { getClassSlots } from "@/lib/timetable-data";
import { usePreviewHref } from "@/lib/use-preview-href";
import { Card } from "@/components/dashboard/primitives";
import { FormAlert } from "@/components/auth/form-alert";
import { ConflictPanel } from "./conflict-panel";
import { TimetableGrid } from "./timetable-grid";
import type { ChildOption } from "@/types/attendance";
import type {
  ClassOption,
  PeriodRow,
  TimetableConflict,
  TimetablePermissions,
  TimetableSlot,
} from "@/types/timetable";

/**
 * Timetable body — PAGE 10.
 *
 * Owns the client state the grid itself doesn't need: the class picker
 * (builder / HOD / principal), the child switcher (parent) and the builder's
 * action feedback. The grid stays presentational and shared.
 */
export function TimetableView({
  perms,
  periods,
  /** Personal view passes its slots directly; class views resolve by id */
  personalSlots,
  classOptions,
  defaultClassId,
  conflicts,
  childOptions,
}: {
  perms: TimetablePermissions;
  periods: PeriodRow[];
  personalSlots?: TimetableSlot[];
  classOptions?: ClassOption[];
  defaultClassId?: string;
  conflicts?: TimetableConflict[];
  childOptions?: ChildOption[];
}) {
  const [classId, setClassId] = useState(
    defaultClassId ?? classOptions?.[0]?.id ?? "",
  );
  const [activeChildId, setActiveChildId] = useState(
    childOptions?.[0]?.id ?? "",
  );
  const [status, setStatus] = useState<string | null>(null);
  const href = usePreviewHref();

  const slots = personalSlots ?? getClassSlots(classId);
  const activeClass = classOptions?.find((c) => c.id === classId);

  // Substitutions worth surfacing above the grid
  const subs = slots.filter((s) => s.substitution);

  return (
    <div className="grid min-w-0 gap-4">
      {status && <FormAlert variant="info">{status}</FormAlert>}

      {/* Builder toolbar */}
      {(perms.canBulkUpload || perms.canSubstitute) && (
        <div className="flex flex-wrap gap-2">
          {perms.canBulkUpload && (
            <button
              type="button"
              onClick={() =>
                setStatus(
                  "POST /timetable/bulk-upload — API not connected yet (Dev-B).",
                )
              }
              className="inline-flex h-10 items-center gap-1.5 rounded-field border border-border bg-white px-4 text-sm font-semibold text-foreground transition-colors hover:border-accent hover:text-accent"
            >
              <Upload className="h-4 w-4" aria-hidden="true" />
              Bulk upload
            </button>
          )}
          {perms.canSubstitute && (
            // C-AC-06 is a real page now, so this navigates rather than
            // firing a placeholder alert. `usePreviewHref` carries `?role=`
            // — a bare <Link> would arrive as the default role and 403.
            <Link
              href={href("/coordinator/substitutions/new")}
              className="inline-flex h-10 items-center gap-1.5 rounded-field bg-accent px-4 text-sm font-semibold text-white shadow-accent transition-colors hover:bg-accent-hover"
            >
              <Repeat className="h-4 w-4" aria-hidden="true" />
              Add substitution
            </Link>
          )}
        </div>
      )}

      {/* Clash detection — builder only */}
      {conflicts && <ConflictPanel conflicts={conflicts} />}

      {/* Child switcher — parent */}
      {childOptions && childOptions.length > 1 && (
        <div
          role="group"
          aria-label="Select child"
          className="-mx-1 flex min-w-0 gap-2 overflow-x-auto px-1 pb-1"
        >
          {childOptions.map((c) => (
            <button
              key={c.id}
              type="button"
              onClick={() => setActiveChildId(c.id)}
              aria-pressed={c.id === activeChildId}
              className={cn(
                "shrink-0 rounded-full border px-4 py-1.5 text-[12px] font-medium transition",
                c.id === activeChildId
                  ? "border-primary bg-primary text-white"
                  : "border-border bg-white text-muted-foreground hover:border-accent",
              )}
            >
              {c.name}
              <span className="ml-1.5 opacity-70">{c.className}</span>
            </button>
          ))}
        </div>
      )}

      {/* Class picker — builder, HOD, principal */}
      {perms.canSwitchClass && classOptions && classOptions.length > 0 && (
        <div
          role="group"
          aria-label="Select class"
          className="-mx-1 flex min-w-0 gap-2 overflow-x-auto px-1 pb-1"
        >
          {classOptions.map((c) => (
            <button
              key={c.id}
              type="button"
              onClick={() => setClassId(c.id)}
              aria-pressed={c.id === classId}
              className={cn(
                "shrink-0 rounded-full border px-4 py-1.5 text-[12px] font-medium transition",
                c.id === classId
                  ? "border-primary bg-primary text-white"
                  : "border-border bg-white text-muted-foreground hover:border-accent",
              )}
            >
              {c.name}
              <span className="ml-1.5 opacity-70">{c.departmentName}</span>
            </button>
          ))}
        </div>
      )}

      {/* Live substitutions */}
      {subs.length > 0 && (
        <div className="flex flex-wrap items-center gap-3 rounded-field border border-[#FDE68A] bg-warning-light p-4">
          <Repeat className="h-4 w-4 shrink-0 text-warning" aria-hidden="true" />
          <p className="min-w-0 flex-1 text-[13px] font-medium text-[#92400E]">
            {subs.length === 1 ? "1 substitution" : `${subs.length} substitutions`}{" "}
            this week —{" "}
            {subs
              .map(
                (s) =>
                  `${s.subjectCode ?? s.subjectName}: ${s.substitution!.substituteTeacherName} covering ${s.substitution!.originalTeacherName}`,
              )
              .join("; ")}
            .
          </p>
        </div>
      )}

      <Card className="min-w-0 p-4 sm:p-5">
        {activeClass && (
          <h2 className="mb-3 font-display text-[15px] font-bold text-foreground">
            {activeClass.name}
            <span className="ml-2 text-[11px] font-normal text-muted-foreground">
              {activeClass.departmentName}
            </span>
          </h2>
        )}

        {slots.length === 0 ? (
          <p className="py-10 text-center text-[13px] text-muted-foreground">
            No timetable has been set up yet.
          </p>
        ) : (
          <TimetableGrid
            slots={slots}
            periods={periods}
            showClassNotTeacher={perms.view === "PERSONAL"}
            editable={perms.canEdit}
            onEdit={setStatus}
          />
        )}
      </Card>
    </div>
  );
}
