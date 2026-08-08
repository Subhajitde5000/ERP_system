"use client";

/**
 * Academic Groups Wizard — institution-type aware.
 *
 * SCHOOL flow:  Year → Grade (1–12) → Stream (optional) → Sections (A/B/C) → Create
 * COLLEGE flow: Year → Department → Program → Semester → Batches → Create
 *
 * Each successful submission produces one or more `classes` rows (Academic Groups)
 * that are linked to a parent grade or program row in the DB.
 *
 * The lower list shows existing grade/program groups with their sections.
 */

import { useCallback, useEffect, useMemo, useState } from "react";
import { BookOpen, ChevronDown, ChevronRight, GraduationCap, Plus, Trash2, X } from "lucide-react";

import { cn } from "@/lib/utils";
import {
  createGrade,
  createProgram,
  deleteGrade,
  deleteProgram,
  fetchAcademicYears,
  fetchDepartments,
  fetchGrades,
  fetchPrograms,
  fetchStaff,
  type AcademicYear,
  type ClassGradeRecord,
  type ClassProgramRecord,
  type Department,
  type SectionRecord,
  type StaffMember,
} from "@/lib/institution";
import { FormAlert } from "@/components/auth/form-alert";

// ── shared tiny helpers ────────────────────────────────────────────────────

function Panel({ children, className }: { children: React.ReactNode; className?: string }) {
  return (
    <div className={cn("rounded-2xl border border-border bg-card p-6 shadow-sm", className)}>
      {children}
    </div>
  );
}

function Label({ children, htmlFor }: { children: React.ReactNode; htmlFor?: string }) {
  return (
    <label htmlFor={htmlFor} className="mb-1.5 block text-[12px] font-semibold uppercase tracking-wide text-muted-foreground">
      {children}
    </label>
  );
}

const inputCls = (err?: boolean) =>
  cn(
    "h-10 w-full rounded-lg border bg-background px-3 text-[13px] text-foreground outline-none transition",
    err
      ? "border-destructive ring-1 ring-destructive/30 focus:ring-destructive/50"
      : "border-border focus:border-accent focus:ring-2 focus:ring-accent/15",
  );

function FieldErr({ msg }: { msg?: string }) {
  return msg ? <p className="mt-1 text-[11px] text-destructive">{msg}</p> : null;
}

function TagPill({
  label,
  onRemove,
}: {
  label: string;
  onRemove: () => void;
}) {
  return (
    <span className="inline-flex items-center gap-1 rounded-full bg-accent-light px-2.5 py-0.5 text-[12px] font-semibold text-accent">
      {label}
      <button
        type="button"
        onClick={onRemove}
        aria-label={`Remove ${label}`}
        className="ml-0.5 rounded-full p-0.5 hover:bg-accent/20 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-accent/30"
      >
        <X className="h-3 w-3" />
      </button>
    </span>
  );
}

/** Mini tag-input for section/batch labels. */
function TagInput({
  id,
  tags,
  onChange,
  placeholder,
}: {
  id: string;
  tags: string[];
  onChange: (tags: string[]) => void;
  placeholder: string;
}) {
  const [input, setInput] = useState("");

  function add() {
    const val = input.trim().toUpperCase();
    if (!val || tags.includes(val)) { setInput(""); return; }
    onChange([...tags, val]);
    setInput("");
  }

  return (
    <div>
      <div className="flex flex-wrap gap-1.5 mb-2 min-h-[28px]">
        {tags.map((t) => (
          <TagPill key={t} label={t} onRemove={() => onChange(tags.filter((x) => x !== t))} />
        ))}
      </div>
      <div className="flex gap-2">
        <input
          id={id}
          value={input}
          onChange={(e) => setInput(e.target.value.toUpperCase())}
          onKeyDown={(e) => { if (e.key === "Enter" || e.key === ",") { e.preventDefault(); add(); } }}
          placeholder={placeholder}
          className={cn(inputCls(), "flex-1")}
        />
        <button
          type="button"
          onClick={add}
          className="inline-flex h-10 items-center gap-1 rounded-lg bg-accent px-3 text-[13px] font-semibold text-white hover:bg-accent-hover focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-accent/30"
        >
          <Plus className="h-4 w-4" />
          Add
        </button>
      </div>
      <p className="mt-1 text-[11px] text-muted-foreground">Press Enter or comma to add a label.</p>
    </div>
  );
}

// ── Section card (inside an expanded grade/program) ────────────────────────

function SectionCard({ section }: { section: SectionRecord }) {
  return (
    <div className="flex items-center justify-between rounded-lg border border-border bg-background px-4 py-2.5">
      <div>
        <p className="text-[13px] font-semibold text-foreground">{section.name}</p>
        <p className="font-mono text-[11px] text-muted-foreground">{section.code}</p>
      </div>
      <div className="flex items-center gap-4 text-[11px] text-muted-foreground">
        <span>{section.enrolled_count} enrolled</span>
        <span>{section.subject_count} subjects</span>
        {section.class_teacher_name ? (
          <span className="text-foreground">{section.class_teacher_name}</span>
        ) : (
          <span className="text-[#B45309]">No teacher</span>
        )}
      </div>
    </div>
  );
}

// ── Grade group card (school) ──────────────────────────────────────────────

function GradeCard({
  grade,
  onDelete,
}: {
  grade: ClassGradeRecord;
  onDelete: (id: string) => void;
}) {
  const [open, setOpen] = useState(false);
  const totalEnrolled = grade.sections.reduce((a, s) => a + s.enrolled_count, 0);
  const canDelete = totalEnrolled === 0 && grade.sections.every((s) => s.subject_count === 0);

  return (
    <Panel className="!p-0 overflow-hidden">
      <div
        onClick={() => setOpen((v) => !v)}
        className="flex w-full cursor-pointer items-center justify-between gap-3 px-5 py-4 text-left hover:bg-muted/30 transition-colors"
      >
        <div className="flex items-center gap-3">
          <span className="flex h-9 w-9 items-center justify-center rounded-xl bg-accent-light text-accent">
            <BookOpen className="h-4 w-4" />
          </span>
          <div>
            <p className="text-[14px] font-bold text-foreground">
              {grade.name}
              {grade.stream && <span className="ml-2 text-[12px] font-normal text-muted-foreground">· {grade.stream}</span>}
            </p>
            <p className="text-[11px] text-muted-foreground">
              {grade.academic_year_name} · {grade.sections.length} {grade.sections.length === 1 ? "section" : "sections"} · {totalEnrolled} enrolled
            </p>
          </div>
        </div>
        <div className="flex items-center gap-2">
          {canDelete && (
            <button
              type="button"
              onClick={(e) => { e.stopPropagation(); onDelete(grade.id); }}
              aria-label={`Delete ${grade.name}`}
              className="rounded-lg p-1.5 text-muted-foreground hover:bg-destructive-light hover:text-destructive-text focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-destructive/30"
            >
              <Trash2 className="h-4 w-4" />
            </button>
          )}
          {open ? <ChevronDown className="h-4 w-4 text-muted-foreground" /> : <ChevronRight className="h-4 w-4 text-muted-foreground" />}
        </div>
      </div>
      {open && grade.sections.length > 0 && (
        <div className="space-y-2 border-t border-border px-5 py-4">
          {grade.sections.map((s) => <SectionCard key={s.id} section={s} />)}
        </div>
      )}
    </Panel>
  );
}

// ── Program group card (college) ───────────────────────────────────────────

function ProgramCard({
  program,
  onDelete,
}: {
  program: ClassProgramRecord;
  onDelete: (id: string) => void;
}) {
  const [open, setOpen] = useState(false);
  const totalEnrolled = program.batches.reduce((a, b) => a + b.enrolled_count, 0);
  const canDelete = totalEnrolled === 0 && program.batches.every((b) => b.subject_count === 0);

  return (
    <Panel className="!p-0 overflow-hidden">
      <div
        onClick={() => setOpen((v) => !v)}
        className="flex w-full cursor-pointer items-center justify-between gap-3 px-5 py-4 text-left hover:bg-muted/30 transition-colors"
      >
        <div className="flex items-center gap-3">
          <span className="flex h-9 w-9 items-center justify-center rounded-xl bg-[#EDE9FE] text-[#7C3AED]">
            <GraduationCap className="h-4 w-4" />
          </span>
          <div>
            <p className="text-[14px] font-bold text-foreground">
              {program.program_name}
              <span className="ml-2 text-[12px] font-normal text-muted-foreground">· Semester {program.semester_number}</span>
            </p>
            <p className="text-[11px] text-muted-foreground">
              {program.department_name} · {program.academic_year_name} · {program.batches.length} {program.batches.length === 1 ? "batch" : "batches"} · {totalEnrolled} enrolled
            </p>
          </div>
        </div>
        <div className="flex items-center gap-2">
          {canDelete && (
            <button
              type="button"
              onClick={(e) => { e.stopPropagation(); onDelete(program.id); }}
              aria-label={`Delete ${program.program_name} Sem ${program.semester_number}`}
              className="rounded-lg p-1.5 text-muted-foreground hover:bg-destructive-light hover:text-destructive-text focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-destructive/30"
            >
              <Trash2 className="h-4 w-4" />
            </button>
          )}
          {open ? <ChevronDown className="h-4 w-4 text-muted-foreground" /> : <ChevronRight className="h-4 w-4 text-muted-foreground" />}
        </div>
      </div>
      {open && program.batches.length > 0 && (
        <div className="space-y-2 border-t border-border px-5 py-4">
          {program.batches.map((b) => <SectionCard key={b.id} section={b} />)}
        </div>
      )}
    </Panel>
  );
}

// ── SCHOOL wizard form ─────────────────────────────────────────────────────

const STREAMS = ["Science", "Commerce", "Arts", "Humanities", "Vocational"];

function SchoolWizard({
  years,
  departments,
  staff,
  onCreated,
}: {
  years: AcademicYear[];
  departments: Department[];
  staff: StaffMember[];
  onCreated: () => void;
}) {
  const currentYear = years.find((y) => y.is_current);
  const [yearId, setYearId] = useState(currentYear?.id ?? years[0]?.id ?? "");
  const [deptId, setDeptId] = useState(departments[0]?.id ?? "");
  const [grade, setGrade] = useState("1");
  const [stream, setStream] = useState("");
  const [customStream, setCustomStream] = useState("");
  const [sections, setSections] = useState<string[]>(["A"]);
  const [maxStrength, setMaxStrength] = useState("60");
  const [teacherId, setTeacherId] = useState("");
  const [errors, setErrors] = useState<Record<string, string>>({});
  const [busy, setBusy] = useState(false);
  const [notice, setNotice] = useState<string | null>(null);

  const effectiveStream = stream === "__custom__" ? customStream.trim() : stream || undefined;

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    const next: Record<string, string> = {};
    if (!yearId) next.yearId = "Select an academic year";
    if (!deptId) next.deptId = "Select a department";
    if (sections.length === 0) next.sections = "Add at least one section";
    const max = Number(maxStrength);
    if (!Number.isFinite(max) || max <= 0) next.maxStrength = "Must be above zero";
    setErrors(next);
    if (Object.keys(next).length) return;

    setBusy(true);
    setNotice(null);
    try {
      const result = await createGrade({
        academic_year_id: yearId,
        department_id: deptId,
        grade_number: Number(grade),
        stream: effectiveStream,
        sections,
        max_strength: max,
        class_teacher_id: teacherId || undefined,
      });
      setNotice(
        `✓ Class ${grade}${effectiveStream ? ` (${effectiveStream})` : ""} created with ${result.sections.length} section(s).`
      );
      setSections(["A"]);
      setStream("");
      setCustomStream("");
      onCreated();
    } catch (err) {
      setNotice(err instanceof Error ? err.message : "Could not create the grade group.");
    } finally {
      setBusy(false);
    }
  }

  return (
    <form onSubmit={handleSubmit} className="space-y-5" noValidate>
      {notice && (
        <FormAlert variant={notice.startsWith("✓") ? "success" : "error"}>
          {notice}
        </FormAlert>
      )}

      <div className="grid gap-4 sm:grid-cols-2">
        <div>
          <Label htmlFor="sg-year">Academic Year</Label>
          <select id="sg-year" value={yearId} onChange={(e) => setYearId(e.target.value)} className={inputCls(!!errors.yearId)}>
            {years.map((y) => (
              <option key={y.id} value={y.id}>{y.name}{y.is_current ? " (current)" : ""}</option>
            ))}
          </select>
          <FieldErr msg={errors.yearId} />
        </div>

        <div>
          <Label htmlFor="sg-dept">Department</Label>
          <select id="sg-dept" value={deptId} onChange={(e) => setDeptId(e.target.value)} className={inputCls(!!errors.deptId)}>
            {departments.map((d) => (
              <option key={d.id} value={d.id}>{d.code} — {d.name}</option>
            ))}
          </select>
          <FieldErr msg={errors.deptId} />
        </div>

        <div>
          <Label htmlFor="sg-grade">Grade / Class</Label>
          <select id="sg-grade" value={grade} onChange={(e) => setGrade(e.target.value)} className={inputCls()}>
            {Array.from({ length: 12 }, (_, i) => i + 1).map((n) => (
              <option key={n} value={n}>Class {n}</option>
            ))}
          </select>
        </div>

        <div>
          <Label htmlFor="sg-stream">Stream <span className="normal-case font-normal">(optional)</span></Label>
          <select id="sg-stream" value={stream} onChange={(e) => setStream(e.target.value)} className={inputCls()}>
            <option value="">No stream / General</option>
            {STREAMS.map((s) => <option key={s} value={s}>{s}</option>)}
            <option value="__custom__">Custom…</option>
          </select>
        </div>

        {stream === "__custom__" && (
          <div className="sm:col-span-2">
            <Label htmlFor="sg-custom-stream">Custom Stream Name</Label>
            <input id="sg-custom-stream" value={customStream} onChange={(e) => setCustomStream(e.target.value)} placeholder="e.g. Agriculture" className={inputCls()} />
          </div>
        )}
      </div>

      <div>
        <Label htmlFor="sg-sections">Sections</Label>
        <TagInput id="sg-sections" tags={sections} onChange={setSections} placeholder="e.g. A, B, C" />
        <FieldErr msg={errors.sections} />
      </div>

      <div className="grid gap-4 sm:grid-cols-2">
        <div>
          <Label htmlFor="sg-strength">Max Strength per Section</Label>
          <input id="sg-strength" type="number" inputMode="numeric" value={maxStrength}
            onChange={(e) => setMaxStrength(e.target.value)} className={inputCls(!!errors.maxStrength)} />
          <FieldErr msg={errors.maxStrength} />
        </div>

        <div>
          <Label htmlFor="sg-teacher">Default Class Teacher <span className="normal-case font-normal">(optional)</span></Label>
          <select id="sg-teacher" value={teacherId} onChange={(e) => setTeacherId(e.target.value)} className={inputCls()}>
            <option value="">Leave unassigned</option>
            {staff.filter((s) => s.is_active).map((s) => (
              <option key={s.id} value={s.id}>{s.name}{s.department_name ? ` · ${s.department_name}` : ""}</option>
            ))}
          </select>
        </div>
      </div>

      <div className="flex justify-end pt-1">
        <button
          type="submit"
          disabled={busy}
          className="inline-flex h-11 items-center gap-2 rounded-xl bg-accent px-6 text-[14px] font-semibold text-white shadow-sm hover:bg-accent-hover disabled:opacity-60 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-accent/30"
        >
          <Plus className="h-4 w-4" />
          {busy ? "Creating…" : `Create Class ${grade}${effectiveStream ? ` (${effectiveStream})` : ""}`}
        </button>
      </div>
    </form>
  );
}

// ── COLLEGE wizard form ────────────────────────────────────────────────────

function CollegeWizard({
  years,
  departments,
  staff,
  onCreated,
}: {
  years: AcademicYear[];
  departments: Department[];
  staff: StaffMember[];
  onCreated: () => void;
}) {
  const currentYear = years.find((y) => y.is_current);
  const [yearId, setYearId] = useState(currentYear?.id ?? years[0]?.id ?? "");
  const [deptId, setDeptId] = useState(departments[0]?.id ?? "");
  const [programName, setProgramName] = useState("");
  const [programCode, setProgramCode] = useState("");
  const [semester, setSemester] = useState("1");
  const [batches, setBatches] = useState<string[]>(["A"]);
  const [maxStrength, setMaxStrength] = useState("60");
  const [teacherId, setTeacherId] = useState("");
  const [errors, setErrors] = useState<Record<string, string>>({});
  const [busy, setBusy] = useState(false);
  const [notice, setNotice] = useState<string | null>(null);

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    const next: Record<string, string> = {};
    if (!yearId) next.yearId = "Select an academic year";
    if (!deptId) next.deptId = "Select a department";
    if (!programName.trim()) next.programName = "Enter the program name";
    if (!programCode.trim()) next.programCode = "Enter the program code";
    if (batches.length === 0) next.batches = "Add at least one batch";
    const max = Number(maxStrength);
    if (!Number.isFinite(max) || max <= 0) next.maxStrength = "Must be above zero";
    setErrors(next);
    if (Object.keys(next).length) return;

    setBusy(true);
    setNotice(null);
    try {
      const result = await createProgram({
        academic_year_id: yearId,
        department_id: deptId,
        program_name: programName.trim(),
        program_code: programCode.trim().toUpperCase(),
        semester_number: Number(semester),
        batches,
        max_strength: max,
        class_teacher_id: teacherId || undefined,
      });
      setNotice(
        `✓ ${result.program_name} Semester ${result.semester_number} created with ${result.batches.length} batch(es).`
      );
      setBatches(["A"]);
    } catch (err) {
      setNotice(err instanceof Error ? err.message : "Could not create the program group.");
    } finally {
      setBusy(false);
    }
    onCreated();
  }

  return (
    <form onSubmit={handleSubmit} className="space-y-5" noValidate>
      {notice && (
        <FormAlert variant={notice.startsWith("✓") ? "success" : "error"}>
          {notice}
        </FormAlert>
      )}

      <div className="grid gap-4 sm:grid-cols-2">
        <div>
          <Label htmlFor="cg-year">Academic Year</Label>
          <select id="cg-year" value={yearId} onChange={(e) => setYearId(e.target.value)} className={inputCls(!!errors.yearId)}>
            {years.map((y) => (
              <option key={y.id} value={y.id}>{y.name}{y.is_current ? " (current)" : ""}</option>
            ))}
          </select>
          <FieldErr msg={errors.yearId} />
        </div>

        <div>
          <Label htmlFor="cg-dept">Department</Label>
          <select id="cg-dept" value={deptId} onChange={(e) => setDeptId(e.target.value)} className={inputCls(!!errors.deptId)}>
            {departments.map((d) => (
              <option key={d.id} value={d.id}>{d.code} — {d.name}</option>
            ))}
          </select>
          <FieldErr msg={errors.deptId} />
        </div>

        <div>
          <Label htmlFor="cg-program-name">Program Name</Label>
          <input id="cg-program-name" value={programName}
            onChange={(e) => setProgramName(e.target.value)}
            placeholder="B.Tech CSE"
            className={inputCls(!!errors.programName)} />
          <FieldErr msg={errors.programName} />
        </div>

        <div>
          <Label htmlFor="cg-program-code">Program Code</Label>
          <input id="cg-program-code" value={programCode}
            onChange={(e) => setProgramCode(e.target.value.toUpperCase())}
            placeholder="BTCSE"
            className={cn(inputCls(!!errors.programCode), "font-mono")} />
          <FieldErr msg={errors.programCode} />
        </div>

        <div>
          <Label htmlFor="cg-semester">Semester</Label>
          <select id="cg-semester" value={semester} onChange={(e) => setSemester(e.target.value)} className={inputCls()}>
            {Array.from({ length: 12 }, (_, i) => i + 1).map((n) => (
              <option key={n} value={n}>Semester {n}</option>
            ))}
          </select>
        </div>

        <div>
          <Label htmlFor="cg-strength">Max Strength per Batch</Label>
          <input id="cg-strength" type="number" inputMode="numeric" value={maxStrength}
            onChange={(e) => setMaxStrength(e.target.value)} className={inputCls(!!errors.maxStrength)} />
          <FieldErr msg={errors.maxStrength} />
        </div>
      </div>

      <div>
        <Label htmlFor="cg-batches">Batches / Sections</Label>
        <TagInput id="cg-batches" tags={batches} onChange={setBatches} placeholder="e.g. A, B" />
        <FieldErr msg={errors.batches} />
      </div>

      <div>
        <Label htmlFor="cg-teacher">Default Class Teacher <span className="normal-case font-normal">(optional)</span></Label>
        <select id="cg-teacher" value={teacherId} onChange={(e) => setTeacherId(e.target.value)} className={inputCls()}>
          <option value="">Leave unassigned</option>
          {staff.filter((s) => s.is_active).map((s) => (
            <option key={s.id} value={s.id}>{s.name}{s.department_name ? ` · ${s.department_name}` : ""}</option>
          ))}
        </select>
      </div>

      <div className="flex justify-end pt-1">
        <button
          type="submit"
          disabled={busy}
          className="inline-flex h-11 items-center gap-2 rounded-xl bg-[#7C3AED] px-6 text-[14px] font-semibold text-white shadow-sm hover:bg-[#6D28D9] disabled:opacity-60 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#7C3AED]/30"
        >
          <Plus className="h-4 w-4" />
          {busy ? "Creating…" : `Create ${programName || "Program"} — Sem ${semester}`}
        </button>
      </div>
    </form>
  );
}

// ── Main exported component ────────────────────────────────────────────────

export function AcademicGroups({ tenantType }: { tenantType: "SCHOOL" | "COLLEGE" }) {
  const isSchool = tenantType === "SCHOOL";

  const [years, setYears] = useState<AcademicYear[]>([]);
  const [departments, setDepartments] = useState<Department[]>([]);
  const [staff, setStaff] = useState<StaffMember[]>([]);
  const [grades, setGrades] = useState<ClassGradeRecord[]>([]);
  const [programs, setPrograms] = useState<ClassProgramRecord[]>([]);
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);

  const load = useCallback(async () => {
    try {
      const [yearRows, deptRows, staffRows] = await Promise.all([
        fetchAcademicYears(),
        fetchDepartments(),
        fetchStaff(),
      ]);
      setYears(yearRows);
      setDepartments(deptRows.filter((d) => d.is_active));
      setStaff(staffRows);
      if (isSchool) {
        setGrades(await fetchGrades());
      } else {
        setPrograms(await fetchPrograms());
      }
      setError(null);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Could not load data.");
    } finally {
      setLoading(false);
    }
  }, [isSchool]);

  useEffect(() => { load(); }, [load]);

  async function handleDeleteGrade(id: string) {
    try {
      await deleteGrade(id);
      await load();
    } catch (err) {
      setError(err instanceof Error ? err.message : "Could not delete the grade.");
    }
  }

  async function handleDeleteProgram(id: string) {
    try {
      await deleteProgram(id);
      await load();
    } catch (err) {
      setError(err instanceof Error ? err.message : "Could not delete the program.");
    }
  }

  if (loading) {
    return (
      <div className="flex h-32 items-center justify-center">
        <span className="h-6 w-6 animate-spin rounded-full border-2 border-accent border-t-transparent" />
      </div>
    );
  }

  return (
    <div className="space-y-6">
      {error && <FormAlert variant="error">{error}</FormAlert>}

      {/* Wizard */}
      <Panel>
        <h3 className="mb-5 text-[15px] font-bold text-foreground">
          {isSchool ? "Add Grade & Sections" : "Add Program, Semester & Batches"}
        </h3>
        {isSchool ? (
          <SchoolWizard years={years} departments={departments} staff={staff} onCreated={load} />
        ) : (
          <CollegeWizard years={years} departments={departments} staff={staff} onCreated={load} />
        )}
      </Panel>

      {/* Existing groups */}
      {isSchool ? (
        <div>
          <h3 className="mb-3 text-[13px] font-semibold uppercase tracking-wide text-muted-foreground">
            Existing Grade Groups ({grades.length})
          </h3>
          {grades.length === 0 ? (
            <Panel>
              <p className="py-4 text-center text-[13px] text-muted-foreground">
                No grades yet. Create your first class above.
              </p>
            </Panel>
          ) : (
            <div className="space-y-3">
              {grades.map((g) => (
                <GradeCard key={g.id} grade={g} onDelete={handleDeleteGrade} />
              ))}
            </div>
          )}
        </div>
      ) : (
        <div>
          <h3 className="mb-3 text-[13px] font-semibold uppercase tracking-wide text-muted-foreground">
            Existing Programs ({programs.length})
          </h3>
          {programs.length === 0 ? (
            <Panel>
              <p className="py-4 text-center text-[13px] text-muted-foreground">
                No programs yet. Create your first program above.
              </p>
            </Panel>
          ) : (
            <div className="space-y-3">
              {programs.map((p) => (
                <ProgramCard key={p.id} program={p} onDelete={handleDeleteProgram} />
              ))}
            </div>
          )}
        </div>
      )}
    </div>
  );
}
