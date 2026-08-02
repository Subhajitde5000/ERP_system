"use client";

import Link from "next/link";

import {
  ArrowLeft,
  ArrowRight,
  Building2,
  CalendarRange,
  Check,
  CheckCircle2,
  FileUp,
  GraduationCap,
  Image as ImageIcon,
  LayoutGrid,
  ListChecks,
  Palette,
  PartyPopper,
  School,
  BookOpen,
  Users,
  UserPlus,
  Loader2,
} from "lucide-react";
import { useEffect, useState } from "react";

import { inputClass, PrimaryButton } from "@/components/checkout/checkout-ui";
import { OPTIONAL_MODULES } from "@/lib/session";
import { moduleLabel } from "@/lib/platform-shared";
import { completeSetup, fetchSetupState, saveSetupState } from "@/lib/setup";
import type { SetupState } from "@/lib/setup";
import { getAccessToken } from "@/lib/auth";

/**
 * First-time setup wizard — Step 10 of the institution-admin journey.
 * The admin is sent here instead of the dashboard until the institution is
 * configured. Progress is persisted server-side (tenant_settings) whenever
 * a session exists, with a localStorage mirror so the demo is reviewable
 * without a backend.
 */

const SETUP_STEPS = [
  { title: "Institution Profile", icon: Building2 },
  { title: "Upload Logo", icon: ImageIcon },
  { title: "Academic Year", icon: CalendarRange },
  { title: "Departments", icon: LayoutGrid },
  { title: "Programs/Courses", icon: GraduationCap },
  { title: "Classes & Sections", icon: School },
  { title: "Subjects", icon: BookOpen },
  { title: "Invite Staff", icon: UserPlus },
  { title: "Import Students", icon: Users },
  { title: "Configure Modules", icon: ListChecks },
  { title: "Branding", icon: Palette },
  { title: "Finish", icon: PartyPopper },
] as const;

const LOCAL_KEY = "erp_setup_state";

const EMPTY_STATE: SetupState = {
  completed: false,
  step: 0,
  profile: null,
  logo: null,
  academic_year: null,
  departments: [],
  programs: [],
  classes: [],
  subjects: [],
  staff: [],
  students: [],
  modules: [],
  branding: null,
};

const STAFF_ROLES = [
  "PRINCIPAL",
  "VICE_PRINCIPAL",
  "HOD",
  "TEACHER",
  "EXAM_CONTROLLER",
  "ACADEMIC_COORDINATOR",
  "ACCOUNTANT",
  "LIBRARIAN",
  "HOSTEL_WARDEN",
  "TRANSPORT_MANAGER",
  "PLACEMENT_OFFICER",
  "HR_MANAGER",
  "ADMISSION_OFFICER",
  "STORE_MANAGER",
];

const ROLE_LABEL: Record<string, string> = {
  PRINCIPAL: "Principal",
  VICE_PRINCIPAL: "Vice Principal",
  HOD: "Head of Department",
  TEACHER: "Teacher",
  EXAM_CONTROLLER: "Exam Controller",
  ACADEMIC_COORDINATOR: "Academic Coordinator",
  ACCOUNTANT: "Accountant",
  LIBRARIAN: "Librarian",
  HOSTEL_WARDEN: "Hostel Warden",
  TRANSPORT_MANAGER: "Transport Manager",
  PLACEMENT_OFFICER: "Placement Officer",
  HR_MANAGER: "HR Manager",
  ADMISSION_OFFICER: "Admission Officer",
  STORE_MANAGER: "Store Manager",
};

function loadLocal(): SetupState {
  if (typeof localStorage === "undefined") return EMPTY_STATE;
  try {
    const raw = localStorage.getItem(LOCAL_KEY);
    if (!raw) return EMPTY_STATE;
    return { ...EMPTY_STATE, ...(JSON.parse(raw) as Partial<SetupState>) };
  } catch {
    return EMPTY_STATE;
  }
}

export function SetupWizard() {
  const [state, setState] = useState<SetupState>(EMPTY_STATE);
  const [loaded, setLoaded] = useState(false);
  const [saving, setSaving] = useState(false);
  const [savedAt, setSavedAt] = useState<string | null>(null);
  const [done, setDone] = useState(false);

  // Load state: backend when signed in, localStorage otherwise.
  useEffect(() => {
    let cancelled = false;
    async function load() {
      const token = getAccessToken();
      if (token) {
        try {
          const res = await fetchSetupState();
          if (!cancelled) {
            setState(res.state);
            setLoaded(true);
            return;
          }
        } catch {
          /* fall through to local mirror */
        }
      }
      if (!cancelled) {
        setState(loadLocal());
        setLoaded(true);
      }
    }
    void load();
    return () => {
      cancelled = true;
    };
  }, []);

  // Persist after every change.
  useEffect(() => {
    if (!loaded) return;
    if (typeof localStorage !== "undefined") {
      localStorage.setItem(LOCAL_KEY, JSON.stringify(state));
    }
    const token = getAccessToken();
    if (token) {
      saveSetupState(state)
        .then(() => setSavedAt(new Date().toLocaleTimeString()))
        .catch(() => {
          /* offline — local mirror keeps the draft */
        });
    }
  }, [state, loaded]);

  function patch(p: Partial<SetupState>) {
    setState((s) => ({ ...s, ...p }));
  }

  async function finish() {
    setSaving(true);
    try {
      const token = getAccessToken();
      if (token) {
        await completeSetup();
      }
      setDone(true);
    } catch {
      // Even if the server is unreachable, unlock locally in demo mode.
      setDone(true);
    } finally {
      setSaving(false);
    }
  }

  if (!loaded) {
    return (
      <div className="flex min-h-screen items-center justify-center bg-[#F8FAFC] text-sm text-[#64748B]">
        <Loader2 className="mr-2 h-4 w-4 animate-spin" aria-hidden="true" /> Loading setup…
      </div>
    );
  }

  if (done) {
    return (
      <div className="flex min-h-screen items-center justify-center bg-[#F8FAFC] p-6">
        <div className="w-full max-w-md animate-fade-up rounded-card border border-border bg-white p-8 text-center shadow-card">
          <span className="mx-auto flex h-14 w-14 items-center justify-center rounded-full bg-success-light">
            <CheckCircle2 className="h-7 w-7 text-success-text" aria-hidden="true" />
          </span>
          <h1 className="mt-4 font-display text-2xl font-extrabold text-primary">
            Setup complete!
          </h1>
          <p className="mt-2 text-sm leading-6 text-[#64748B]">
            Your institution structure, people and modules are ready. The dashboard is now
            unlocked.
          </p>
          <Link
            href="/admin/dashboard"
            className="mt-6 inline-flex h-11 items-center gap-2 rounded-field bg-accent px-6 text-sm font-semibold text-white shadow-accent transition hover:bg-accent-hover"
          >
            Go to Dashboard <ArrowRight className="h-4 w-4" aria-hidden="true" />
          </Link>
        </div>
      </div>
    );
  }

  const isDemo = !getAccessToken();
  const current = Math.min(state.step, SETUP_STEPS.length - 1);
  const percent = Math.round((current / (SETUP_STEPS.length - 1)) * 100);

  return (
    <div className="min-h-screen bg-[#F8FAFC]">
      <header className="border-b border-border bg-white">
        <div className="mx-auto flex max-w-6xl items-center justify-between px-5 py-4 sm:px-8">
          <div>
            <h1 className="font-display text-lg font-bold text-primary">
              Welcome to {state.profile?.name || "your institution"}
            </h1>
            <p className="text-xs text-[#64748B]">
              Let&apos;s configure your institution.{" "}
              {isDemo ? (
                <span className="font-medium text-warning-text">Demo mode — saved in this browser.</span>
              ) : (
                <span>{savedAt ? `Saved ${savedAt}` : "Saving…"}</span>
              )}
            </p>
          </div>
          <div className="text-right">
            <p className="font-display text-xl font-extrabold text-accent">{percent}%</p>
            <p className="text-[11px] text-[#64748B]">Completed</p>
          </div>
        </div>
        <div className="h-1.5 w-full bg-[#E2E8F0]">
          <div
            className="h-full bg-accent transition-all duration-500"
            style={{ width: `${percent}%` }}
          />
        </div>
      </header>

      <main className="mx-auto grid max-w-6xl gap-8 px-5 py-8 sm:px-8 lg:grid-cols-[260px_1fr]">
        {/* Step rail */}
        <aside className="hidden lg:block">
          <ol className="space-y-1">
            {SETUP_STEPS.map((step, index) => {
              const active = index === current;
              const visited = index < current;
              const Icon = step.icon;
              return (
                <li key={step.title}>
                  <button
                    type="button"
                    onClick={() => setState((s) => ({ ...s, step: index }))}
                    className={`flex w-full items-center gap-3 rounded-field px-3 py-2.5 text-left text-sm transition ${
                      active
                        ? "bg-accent-light font-semibold text-accent"
                        : visited
                          ? "text-[#475569] hover:bg-[#F1F5F9]"
                          : "text-[#94A3B8] hover:bg-[#F1F5F9]"
                    }`}
                  >
                    <span
                      className={`flex h-6 w-6 shrink-0 items-center justify-center rounded-full text-[11px] font-bold ${
                        visited
                          ? "bg-accent text-white"
                          : active
                            ? "bg-accent text-white"
                            : "bg-[#E2E8F0] text-[#64748B]"
                      }`}
                    >
                      {visited ? <Check className="h-3.5 w-3.5" aria-hidden="true" /> : index + 1}
                    </span>
                    <Icon className="h-4 w-4 shrink-0" aria-hidden="true" />
                    {step.title}
                  </button>
                </li>
              );
            })}
          </ol>
        </aside>

        {/* Step body */}
        <section className="animate-fade-up rounded-card border border-border bg-white p-6 shadow-card sm:p-8">
          {renderStep(current, state, patch)}
          <StepNav
            current={current}
            total={SETUP_STEPS.length}
            onBack={() => setState((s) => ({ ...s, step: Math.max(0, s.step - 1) }))}
            onNext={() => setState((s) => ({ ...s, step: Math.min(s.step + 1, 11) }))}
            onFinish={() => void finish()}
            saving={saving}
            last={current === 11}
          />
        </section>
      </main>
    </div>
  );
}

/* ── Step bodies ─────────────────────────────────────────────────────────── */

function renderStep(
  current: number,
  state: SetupState,
  patch: (p: Partial<SetupState>) => void,
) {
  switch (current) {
    case 0:
      return <ProfileStep state={state} patch={patch} />;
    case 1:
      return <LogoStep state={state} patch={patch} />;
    case 2:
      return <AcademicYearStep state={state} patch={patch} />;
    case 3:
      return <DepartmentsStep state={state} patch={patch} />;
    case 4:
      return <ProgramsStep state={state} patch={patch} />;
    case 5:
      return <ClassesStep state={state} patch={patch} />;
    case 6:
      return <SubjectsStep state={state} patch={patch} />;
    case 7:
      return <StaffStep state={state} patch={patch} />;
    case 8:
      return <StudentsStep state={state} patch={patch} />;
    case 9:
      return <ModulesStep state={state} patch={patch} />;
    case 10:
      return <BrandingStep state={state} patch={patch} />;
    default:
      return <FinishStep state={state} />;
  }
}

function StepTitle({ step, title, copy }: { step: number; title: string; copy: string }) {
  return (
    <div>
      <p className="text-xs font-bold uppercase tracking-[0.14em] text-accent">Step {step + 1}</p>
      <h2 className="mt-1 font-display text-2xl font-extrabold tracking-tight text-primary">
        {title}
      </h2>
      <p className="mt-1 text-sm leading-6 text-[#64748B]">{copy}</p>
    </div>
  );
}

function ProfileStep({ state, patch }: { state: SetupState; patch: (p: Partial<SetupState>) => void }) {
  const p = state.profile ?? {};
  const set = (key: string, value: string | null) =>
    patch({ profile: { ...p, [key]: value } });
  return (
    <div>
      <StepTitle step={0} title="Institution Profile" copy="Review and complete your institution's official details." />
      <div className="mt-6 grid gap-4 sm:grid-cols-2">
        <Field label="Institution Name" value={p.name ?? ""} onChange={(v) => set("name", v)} />
        <Field label="Type" value={p.type ?? "COLLEGE"} onChange={(v) => set("type", v)} select options={[["COLLEGE", "College / University"], ["SCHOOL", "School"]]} />
        <Field label="Official Email" value={p.email ?? ""} onChange={(v) => set("email", v)} />
        <Field label="Phone" value={p.phone ?? ""} onChange={(v) => set("phone", v)} />
        <Field label="Address" value={p.address ?? ""} onChange={(v) => set("address", v)} wide />
        <Field label="City" value={p.city ?? ""} onChange={(v) => set("city", v)} />
        <Field label="State" value={p.state ?? ""} onChange={(v) => set("state", v)} />
        <Field label="Country" value={p.country ?? "India"} onChange={(v) => set("country", v)} />
        <Field label="Pincode" value={p.pincode ?? ""} onChange={(v) => set("pincode", v)} />
        <Field label="Website" value={p.website ?? ""} onChange={(v) => set("website", v)} />
        <Field label="Timezone" value={p.timezone ?? "Asia/Kolkata"} onChange={(v) => set("timezone", v)} />
      </div>
    </div>
  );
}

function LogoStep({ state, patch }: { state: SetupState; patch: (p: Partial<SetupState>) => void }) {
  return (
    <div>
      <StepTitle step={1} title="Upload Logo" copy="Your logo appears in the sign-in page and every report." />
      <div className="mt-6 flex items-start gap-5">
        <div className="flex h-24 w-24 shrink-0 items-center justify-center overflow-hidden rounded-card border border-dashed border-[#CBD5E1] bg-[#F8FAFC]">
          {state.logo ? (
            // eslint-disable-next-line @next/next/no-img-element
            <img src={state.logo} alt="Logo preview" className="h-full w-full object-contain" />
          ) : (
            <ImageIcon className="h-8 w-8 text-[#94A3B8]" aria-hidden="true" />
          )}
        </div>
        <div className="flex-1 space-y-3">
          <label className="inline-flex h-10 cursor-pointer items-center gap-2 rounded-field border border-accent-border bg-accent-light px-4 text-sm font-semibold text-accent transition hover:bg-accent hover:text-white">
            <FileUp className="h-4 w-4" aria-hidden="true" /> Choose image
            <input
              type="file"
              accept="image/*"
              className="hidden"
              onChange={(e) => {
                const file = e.target.files?.[0];
                if (!file) return;
                const reader = new FileReader();
                reader.onload = () => patch({ logo: String(reader.result) });
                reader.readAsDataURL(file);
              }}
            />
          </label>
          <input
            className={inputClass}
            value={state.logo ?? ""}
            onChange={(e) => patch({ logo: e.target.value })}
            placeholder="…or paste an image URL (https://…)"
          />
          <p className="text-xs text-[#64748B]">
            PNG, JPG or SVG up to 2 MB. Preview shown on the left.
          </p>
        </div>
      </div>
    </div>
  );
}

function AcademicYearStep({ state, patch }: { state: SetupState; patch: (p: Partial<SetupState>) => void }) {
  const year = state.academic_year ?? {
    name: `${new Date().getFullYear()}-${String(new Date().getFullYear() + 1).slice(-2)}`,
    start_date: `${new Date().getFullYear()}-06-01`,
    end_date: `${new Date().getFullYear() + 1}-05-31`,
  };
  return (
    <div>
      <StepTitle step={2} title="Academic Year" copy="The current academic year — classes and subjects attach to it." />
      <div className="mt-6 grid gap-4 sm:grid-cols-3">
        <Field label="Year Name" value={year.name} onChange={(v) => patch({ academic_year: { ...year, name: v } })} />
        <Field label="Start Date" value={year.start_date} onChange={(v) => patch({ academic_year: { ...year, start_date: v } })} type="date" />
        <Field label="End Date" value={year.end_date} onChange={(v) => patch({ academic_year: { ...year, end_date: v } })} type="date" />
      </div>
    </div>
  );
}

function DepartmentsStep({ state, patch }: { state: SetupState; patch: (p: Partial<SetupState>) => void }) {
  return (
    <div>
      <StepTitle step={3} title="Departments" copy="Academic units — e.g. Computer Science (CS), Mathematics (MATH)." />
      <ListEditor
        items={state.departments}
        keyLabel="Code"
        empty="No departments yet — add your first one."
        render={(dep, onChange) => (
          <div className="grid gap-3 sm:grid-cols-2">
            <Field label="Name" value={dep.name} onChange={(v) => onChange({ ...dep, name: v })} />
            <Field label="Code" value={dep.code} onChange={(v) => onChange({ ...dep, code: v })} />
          </div>
        )}
        create={() => ({ name: "", code: "" })}
        onList={(list) => patch({ departments: list as never })}
      />
    </div>
  );
}

function ProgramsStep({ state, patch }: { state: SetupState; patch: (p: Partial<SetupState>) => void }) {
  return (
    <div>
      <StepTitle step={4} title="Programs / Courses" copy="Degree or course offerings — e.g. B.Tech CSE, Class 10 (CBSE)." />
      <ListEditor
        items={state.programs}
        keyLabel="Code"
        empty="No programs yet."
        render={(prog, onChange) => (
          <div className="grid gap-3 sm:grid-cols-2">
            <Field label="Name" value={prog.name} onChange={(v) => onChange({ ...prog, name: v })} />
            <Field label="Code" value={prog.code} onChange={(v) => onChange({ ...prog, code: v })} />
          </div>
        )}
        create={() => ({ name: "", code: "" })}
        onList={(list) => patch({ programs: list as never })}
      />
    </div>
  );
}

function ClassesStep({ state, patch }: { state: SetupState; patch: (p: Partial<SetupState>) => void }) {
  return (
    <div>
      <StepTitle step={5} title="Classes & Sections" copy="Sections are their own classes — e.g. Class 10 · A, B.Tech CSE · Sem 3." />
      <ListEditor
        items={state.classes}
        keyLabel="Code"
        empty="No classes yet."
        render={(cls, onChange) => (
          <div className="grid gap-3 sm:grid-cols-2">
            <Field label="Name" value={cls.name} onChange={(v) => onChange({ ...cls, name: v })} />
            <Field label="Code" value={cls.code} onChange={(v) => onChange({ ...cls, code: v })} />
            <Field
              label="Department"
              value={cls.department_code}
              onChange={(v) => onChange({ ...cls, department_code: v })}
              select
              options={state.departments.map((d) => [d.code, `${d.name} (${d.code})`])}
            />
            <Field
              label="Program"
              value={cls.program_code ?? ""}
              onChange={(v) => onChange({ ...cls, program_code: v || null })}
              select
              options={state.programs.map((p) => [p.code, p.name])}
              optional
            />
            <Field label="Section" value={cls.section ?? ""} onChange={(v) => onChange({ ...cls, section: v || null })} optional />
            <Field label="Max Strength" value={String(cls.max_strength)} onChange={(v) => onChange({ ...cls, max_strength: Number(v) || 60 })} type="number" />
          </div>
        )}
        create={() => ({ name: "", code: "", department_code: state.departments[0]?.code ?? "", program_code: null, section: null, max_strength: 60, room_no: null })}
        onList={(list) => patch({ classes: list as never })}
      />
    </div>
  );
}

function SubjectsStep({ state, patch }: { state: SetupState; patch: (p: Partial<SetupState>) => void }) {
  return (
    <div>
      <StepTitle step={6} title="Subjects" copy="Subjects per class — e.g. Data Structures (CS301) for CSE-3." />
      <ListEditor
        items={state.subjects}
        keyLabel="Code"
        empty="No subjects yet."
        render={(sub, onChange) => (
          <div className="grid gap-3 sm:grid-cols-3">
            <Field label="Name" value={sub.name} onChange={(v) => onChange({ ...sub, name: v })} />
            <Field label="Code" value={sub.code} onChange={(v) => onChange({ ...sub, code: v })} />
            <Field
              label="Class"
              value={sub.class_code}
              onChange={(v) => onChange({ ...sub, class_code: v })}
              select
              options={state.classes.map((c) => [c.code, c.name])}
            />
            <Field
              label="Type"
              value={sub.subject_type}
              onChange={(v) => onChange({ ...sub, subject_type: v as SetupState["subjects"][number]["subject_type"] })}
              select
              options={[["THEORY", "Theory"], ["PRACTICAL", "Practical"], ["ELECTIVE", "Elective"], ["PROJECT", "Project"]]}
            />
            <Field label="Max Marks" value={String(sub.max_marks)} onChange={(v) => onChange({ ...sub, max_marks: Number(v) || 100 })} type="number" />
            <Field label="Passing Marks" value={String(sub.passing_marks)} onChange={(v) => onChange({ ...sub, passing_marks: Number(v) || 35 })} type="number" />
          </div>
        )}
        create={() => ({ name: "", code: "", class_code: state.classes[0]?.code ?? "", subject_type: "THEORY" as const, credits: null, max_marks: 100, passing_marks: 35 })}
        onList={(list) => patch({ subjects: list as never })}
      />
    </div>
  );
}

function StaffStep({ state, patch }: { state: SetupState; patch: (p: Partial<SetupState>) => void }) {
  return (
    <div>
      <StepTitle step={7} title="Invite Staff" copy="Add teachers and staff — each gets a role and can sign in immediately." />
      <ListEditor
        items={state.staff}
        keyLabel="Email"
        empty="No staff invited yet."
        render={(member, onChange) => (
          <div className="grid gap-3 sm:grid-cols-3">
            <Field label="Name" value={member.name} onChange={(v) => onChange({ ...member, name: v })} />
            <Field label="Email" value={member.email} onChange={(v) => onChange({ ...member, email: v })} />
            <Field
              label="Role"
              value={member.role}
              onChange={(v) => onChange({ ...member, role: v })}
              select
              options={STAFF_ROLES.map((r) => [r, ROLE_LABEL[r] ?? r])}
            />
          </div>
        )}
        create={() => ({ name: "", email: "", role: "TEACHER" })}
        onList={(list) => patch({ staff: list as never })}
      />
    </div>
  );
}

function StudentsStep({ state, patch }: { state: SetupState; patch: (p: Partial<SetupState>) => void }) {
  const [csv, setCsv] = useState("");

  function parseCsv() {
    const rows: SetupState["students"] = [];
    for (const raw of csv.split(/\r?\n/)) {
      const line = raw.trim();
      if (!line) continue;
      const parts = line.split(/[,|;]/).map((s) => s.trim());
      if (parts.length < 3) continue;
      const [name, email, roll, classCode] = parts;
      if (!name || !roll) continue;
      if (name.toLowerCase() === "name" && email.toLowerCase() === "email") continue; // header
      rows.push({
        name,
        email: email || null,
        roll_no: roll,
        class_code: classCode || (state.classes[0]?.code ?? ""),
        gender: null,
        date_of_birth: null,
      });
    }
    if (rows.length) patch({ students: [...state.students, ...rows] });
    setCsv("");
  }

  return (
    <div>
      <StepTitle step={8} title="Import Students" copy="Paste rows as name, email, roll no, class code — one per line." />
      <div className="mt-6 grid gap-4">
        <div className="rounded-field border border-border bg-[#F8FAFC] px-4 py-3 text-sm">
          <span className="font-semibold text-primary">{state.students.length}</span>{" "}
          <span className="text-[#64748B]">students imported — they appear in the list below.</span>
        </div>
        <textarea
          className={`${inputClass} min-h-28 font-mono text-xs`}
          value={csv}
          onChange={(e) => setCsv(e.target.value)}
          placeholder={"Name, email, roll, class\nAarav Gupta, aarav@green.edu, 2024CS001, CSE-3\nSneha Iyer, sneha@green.edu, 2024CS002, CSE-3"}
        />
        <div>
          <button
            type="button"
            onClick={parseCsv}
            className="inline-flex h-10 items-center gap-2 rounded-field border border-accent-border bg-accent-light px-4 text-sm font-semibold text-accent transition hover:bg-accent hover:text-white"
          >
            <FileUp className="h-4 w-4" aria-hidden="true" /> Parse & add
          </button>
        </div>
        {state.students.length > 0 && (
          <ul className="max-h-48 divide-y divide-border overflow-y-auto rounded-field border border-border">
            {state.students.map((s, i) => (
              <li key={`${s.roll_no}-${i}`} className="flex items-center justify-between gap-3 px-4 py-2 text-sm">
                <span className="font-medium text-primary">{s.name}</span>
                <span className="text-xs text-[#64748B]">{s.roll_no} · {s.class_code}</span>
                <button
                  type="button"
                  onClick={() => patch({ students: state.students.filter((_, j) => j !== i) })}
                  className="text-xs font-semibold text-destructive-text hover:underline"
                >
                  Remove
                </button>
              </li>
            ))}
          </ul>
        )}
      </div>
    </div>
  );
}

function ModulesStep({ state, patch }: { state: SetupState; patch: (p: Partial<SetupState>) => void }) {
  return (
    <div>
      <StepTitle step={9} title="Configure Modules" copy="Core modules are always on. Switch on the optional modules you purchased." />
      <div className="mt-6 grid gap-3 sm:grid-cols-2">
        {OPTIONAL_MODULES.map((key) => {
          const on = state.modules.includes(key);
          return (
            <button
              key={key}
              type="button"
              onClick={() =>
                patch({
                  modules: on
                    ? state.modules.filter((k) => k !== key)
                    : [...state.modules, key],
                })
              }
              className={`flex items-center justify-between rounded-field border px-4 py-3 text-sm font-semibold transition ${
                on ? "border-accent bg-accent-light text-accent" : "border-border text-[#475569] hover:border-accent-border"
              }`}
              aria-pressed={on}
            >
              {moduleLabel(key)}
              <span
                className={`flex h-5 w-5 items-center justify-center rounded border ${
                  on ? "border-accent bg-accent text-white" : "border-[#CBD5E1]"
                }`}
              >
                {on ? <Check className="h-3.5 w-3.5" aria-hidden="true" /> : null}
              </span>
            </button>
          );
        })}
      </div>
    </div>
  );
}

function BrandingStep({ state, patch }: { state: SetupState; patch: (p: Partial<SetupState>) => void }) {
  const b = state.branding ?? {};
  return (
    <div>
      <StepTitle step={10} title="Branding" copy="Pick your primary colour and tagline — the portal adapts." />
      <div className="mt-6 grid gap-4 sm:grid-cols-2">
        <Field label="Primary Colour" value={b.primary_color ?? "#4F46E5"} onChange={(v) => patch({ branding: { ...b, primary_color: v } })} />
        <Field label="Tagline" value={b.tagline ?? ""} onChange={(v) => patch({ branding: { ...b, tagline: v } })} optional />
      </div>
      <div className="mt-4 flex items-center gap-3">
        <span className="text-sm text-[#64748B]">Preview:</span>
        <span
          className="inline-flex h-8 items-center rounded-field px-4 text-xs font-semibold text-white"
          style={{ backgroundColor: b.primary_color || "#4F46E5" }}
        >
          {state.profile?.name || "Your institution"}
        </span>
        {b.tagline ? <span className="text-xs text-[#64748B]">{b.tagline}</span> : null}
      </div>
    </div>
  );
}

function FinishStep({ state }: { state: SetupState }) {
  const counts = [
    ["Departments", state.departments.length],
    ["Programs", state.programs.length],
    ["Classes", state.classes.length],
    ["Subjects", state.subjects.length],
    ["Staff", state.staff.length],
    ["Students", state.students.length],
    ["Modules", state.modules.length + 8],
  ] as const;
  return (
    <div>
      <StepTitle step={11} title="Finish" copy="Everything is ready to be created. Hit Finish to unlock your dashboard." />
      <div className="mt-6 grid grid-cols-2 gap-3 sm:grid-cols-4">
        {counts.map(([label, value]) => (
          <div key={label} className="rounded-field border border-border bg-[#F8FAFC] p-4 text-center">
            <p className="font-display text-2xl font-extrabold text-accent">{value}</p>
            <p className="mt-0.5 text-xs font-medium text-[#64748B]">{label}</p>
          </div>
        ))}
      </div>
    </div>
  );
}

/* ── Shared bits ─────────────────────────────────────────────────────────── */

function StepNav({
  current,
  total,
  onBack,
  onNext,
  onFinish,
  saving,
  last,
}: {
  current: number;
  total: number;
  onBack: () => void;
  onNext: () => void;
  onFinish: () => void;
  saving: boolean;
  last: boolean;
}) {
  return (
    <div className="mt-8 flex items-center justify-between border-t border-border pt-5">
      <button
        type="button"
        onClick={onBack}
        disabled={current === 0 || saving}
        className="inline-flex items-center gap-1.5 text-sm font-medium text-[#64748B] transition hover:text-accent disabled:opacity-40"
      >
        <ArrowLeft className="h-4 w-4" aria-hidden="true" /> Back
      </button>
      <div className="text-xs text-[#94A3B8]">
        Step {current + 1} of {total}
      </div>
      {last ? (
        <PrimaryButton onClick={onFinish} loading={saving}>
          Finish & Unlock <CheckCircle2 className="h-4 w-4" aria-hidden="true" />
        </PrimaryButton>
      ) : (
        <PrimaryButton onClick={onNext}>
          Next <ArrowRight className="h-4 w-4" aria-hidden="true" />
        </PrimaryButton>
      )}
    </div>
  );
}

function Field({
  label,
  value,
  onChange,
  type = "text",
  select,
  options,
  optional,
  wide,
  hint,
}: {
  label: string;
  value: string;
  onChange: (v: string) => void;
  type?: string;
  select?: boolean;
  options?: [string, string][];
  optional?: boolean;
  wide?: boolean;
  hint?: string;
}) {
  return (
    <label className={`block ${wide ? "sm:col-span-2" : ""}`}>
      <span className="mb-1.5 block text-[13px] font-semibold text-[#0F172A]">
        {label}
        {optional ? <span className="font-normal text-[#94A3B8]"> (optional)</span> : <span className="text-destructive"> *</span>}
      </span>
      {select ? (
        <select className={inputClass} value={value} onChange={(e) => onChange(e.target.value)}>
          {options?.length ? (
            options.map(([val, label2]) => (
              <option key={val} value={val}>
                {label2}
              </option>
            ))
          ) : (
            <option value="">—</option>
          )}
        </select>
      ) : (
        <input className={inputClass} type={type} value={value} onChange={(e) => onChange(e.target.value)} />
      )}
      {hint ? <span className="mt-1 block text-xs text-[#64748B]">{hint}</span> : null}
    </label>
  );
}

/** Generic add/remove list editor used by Departments/Programs/Classes/Subjects/Staff. */
function ListEditor<T extends object>({
  items,
  keyLabel,
  render,
  create,
  onList,
  empty,
}: {
  items: T[];
  keyLabel: string;
  render: (item: T, onChange: (next: T) => void) => React.ReactNode;
  create: () => T;
  onList: (list: T[]) => void;
  empty: string;
}) {
  const asRecord = (item: T): Record<string, unknown> => item as Record<string, unknown>;
  return (
    <div className="mt-6 space-y-4">
      {items.length === 0 ? (
        <p className="rounded-field border border-dashed border-[#CBD5E1] px-4 py-6 text-center text-sm text-[#94A3B8]">
          {empty}
        </p>
      ) : (
        items.map((item, index) => (
          <div key={index} className="rounded-field border border-border bg-[#F8FAFC] p-4">
            <div className="mb-3 flex items-center justify-between">
              <p className="text-xs font-bold uppercase tracking-wide text-[#64748B]">
                {keyLabel}: {String(asRecord(item)[keyLabel.toLowerCase()] ?? asRecord(item).code ?? index + 1)}
              </p>
              <button
                type="button"
                onClick={() => onList(items.filter((_, j) => j !== index))}
                className="text-xs font-semibold text-destructive-text hover:underline"
              >
                Remove
              </button>
            </div>
            {render(item, (next) =>
              onList(items.map((it, j) => (j === index ? next : it))),
            )}
          </div>
        ))
      )}
      <button
        type="button"
        onClick={() => onList([...items, create()])}
        className="inline-flex h-10 items-center gap-2 rounded-field border border-accent-border bg-accent-light px-4 text-sm font-semibold text-accent transition hover:bg-accent hover:text-white"
      >
        + Add {keyLabel.toLowerCase() === "email" ? "member" : keyLabel.toLowerCase()}
      </button>
    </div>
  );
}
