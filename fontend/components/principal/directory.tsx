"use client";

import { useState } from "react";
import { ChevronLeft, ChevronRight, Search, X } from "lucide-react";

import { Card, EmptyState, PageHeader, inputClass } from "@/components/admin/ui";
import { useResource } from "@/hooks/use-resource";
import {
  fetchPrincipalStaff,
  fetchPrincipalStaffDetail,
  fetchPrincipalStudentDetail,
  fetchPrincipalStudents,
  type PrincipalPage,
  type PrincipalStaffDetail,
  type PrincipalStaffRow,
  type PrincipalStudentDetail,
  type PrincipalStudentRow,
} from "@/lib/principal";
import { AsyncState, dateOnly, statusLabel } from "./principal-ui";

const PAGE_SIZE = 25;

type DirectoryKind = "staff" | "students";

/** Shared C-PR-05 / C-PR-06 entry point; the API applies the actual audience. */
export function PrincipalDirectoryPage({ kind }: { kind: DirectoryKind }) {
  return kind === "staff" ? <StaffDirectory /> : <StudentDirectory />;
}

function StaffDirectory() {
  const [query, setQuery] = useState("");
  const [offset, setOffset] = useState(0);
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const resource = useResource(
    () => fetchPrincipalStaff({ query: query || undefined, limit: PAGE_SIZE, offset }),
    [query, offset],
  );
  return (
    <DirectoryLayout
      title="Staff directory"
      subtitle="Academic staff profiles across the institution. This directory is read-only."
      query={query}
      onQuery={(value) => { setQuery(value); setOffset(0); }}
      placeholder="Search name, email or employee code"
      resource={resource}
      emptyText="No staff members match this search."
      renderTable={(items) => <StaffTable items={items} onSelect={setSelectedId} />}
      onPrevious={() => setOffset(Math.max(0, offset - PAGE_SIZE))}
      onNext={() => setOffset(offset + PAGE_SIZE)}
    >
      {selectedId ? <StaffDetailDialog id={selectedId} onClose={() => setSelectedId(null)} /> : null}
    </DirectoryLayout>
  );
}

function StudentDirectory() {
  const [query, setQuery] = useState("");
  const [offset, setOffset] = useState(0);
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const resource = useResource(
    () => fetchPrincipalStudents({ query: query || undefined, limit: PAGE_SIZE, offset }),
    [query, offset],
  );
  return (
    <DirectoryLayout
      title="Student directory"
      subtitle="Students across the institution with class and enrolment status. This directory is read-only."
      query={query}
      onQuery={(value) => { setQuery(value); setOffset(0); }}
      placeholder="Search name, email or roll number"
      resource={resource}
      emptyText="No students match this search."
      renderTable={(items) => <StudentTable items={items} onSelect={setSelectedId} />}
      onPrevious={() => setOffset(Math.max(0, offset - PAGE_SIZE))}
      onNext={() => setOffset(offset + PAGE_SIZE)}
    >
      {selectedId ? <StudentDetailDialog id={selectedId} onClose={() => setSelectedId(null)} /> : null}
    </DirectoryLayout>
  );
}

/** Generic table shell keeps filter, async state and pagination in one place. */
function DirectoryLayout<T>({
  title,
  subtitle,
  query,
  onQuery,
  placeholder,
  resource,
  emptyText,
  renderTable,
  onPrevious,
  onNext,
  children,
}: {
  title: string;
  subtitle: string;
  query: string;
  onQuery: (value: string) => void;
  placeholder: string;
  resource: ReturnType<typeof useResource<PrincipalPage<T>>>;
  emptyText: string;
  renderTable: (items: T[]) => React.ReactNode;
  onPrevious: () => void;
  onNext: () => void;
  children: React.ReactNode;
}) {
  return (
    <div className="mx-auto max-w-6xl">
      <PageHeader title={title} subtitle={subtitle} />
      <Card className="mb-5 !p-4">
        <div className="relative">
          <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" aria-hidden="true" />
          <label htmlFor={`${title.toLowerCase().replace(/\s+/g, "-")}-search`} className="sr-only">Search {title}</label>
          <input
            id={`${title.toLowerCase().replace(/\s+/g, "-")}-search`}
            type="search"
            className={`${inputClass} pl-10`}
            value={query}
            onChange={(event) => onQuery(event.target.value)}
            placeholder={placeholder}
          />
        </div>
      </Card>
      <AsyncState loading={resource.loading} error={resource.error} onRetry={resource.reload} loadingLabel={`Loading ${title.toLowerCase()}…`}>
        {resource.data ? resource.data.items.length ? (
          <>
            {renderTable(resource.data.items)}
            <Pagination total={resource.data.total} offset={resource.data.offset} limit={resource.data.limit} onPrevious={onPrevious} onNext={onNext} />
          </>
        ) : <EmptyState text={emptyText} /> : null}
      </AsyncState>
      {children}
    </div>
  );
}

/* The generic layout cannot own offset because it must reset it on a search.
 * Pagination is rendered by the typed directory components below instead. */
function StaffTable({ items, onSelect }: { items: PrincipalStaffRow[]; onSelect: (id: string) => void }) {
  return (
    <div className="overflow-x-auto rounded-card border border-border bg-white">
      <table className="w-full min-w-[880px] text-left text-sm">
        <thead className="bg-muted text-[11px] uppercase tracking-wide text-muted-foreground"><tr><th className="px-4 py-3 font-semibold">Staff member</th><th className="px-4 py-3 font-semibold">Designation</th><th className="px-4 py-3 font-semibold">Department</th><th className="px-4 py-3 font-semibold">Roles</th><th className="px-4 py-3 font-semibold">Status</th><th className="px-4 py-3 text-right font-semibold">Profile</th></tr></thead>
        <tbody className="divide-y divide-border">
          {items.map((staff) => <tr key={staff.id}><td className="px-4 py-3"><p className="font-semibold text-primary">{staff.name}</p><p className="mt-0.5 text-xs text-muted-foreground">{staff.employee_code ?? staff.email ?? "No staff identifier"}</p></td><td className="px-4 py-3 text-muted-foreground">{staff.designation ?? "—"}</td><td className="px-4 py-3 text-muted-foreground">{staff.department_name ?? "—"}</td><td className="px-4 py-3"><div className="flex max-w-56 flex-wrap gap-1">{staff.roles.map((role) => <span key={role} className="rounded-full bg-accent-light px-2 py-0.5 text-[10px] font-bold text-accent">{statusLabel(role)}</span>)}</div></td><td className="px-4 py-3"><span className={staff.is_active ? "text-xs font-semibold text-success-text" : "text-xs font-semibold text-destructive-text"}>{staff.is_active ? "Active" : "Inactive"}</span></td><td className="px-4 py-3 text-right"><button type="button" onClick={() => onSelect(staff.id)} className="text-sm font-semibold text-accent hover:underline">View</button></td></tr>)}
        </tbody>
      </table>
    </div>
  );
}

function StudentTable({ items, onSelect }: { items: PrincipalStudentRow[]; onSelect: (id: string) => void }) {
  return (
    <div className="overflow-x-auto rounded-card border border-border bg-white">
      <table className="w-full min-w-[840px] text-left text-sm">
        <thead className="bg-muted text-[11px] uppercase tracking-wide text-muted-foreground"><tr><th className="px-4 py-3 font-semibold">Student</th><th className="px-4 py-3 font-semibold">Roll number</th><th className="px-4 py-3 font-semibold">Class</th><th className="px-4 py-3 font-semibold">Department</th><th className="px-4 py-3 font-semibold">Enrolment</th><th className="px-4 py-3 text-right font-semibold">Profile</th></tr></thead>
        <tbody className="divide-y divide-border">
          {items.map((student) => <tr key={student.id}><td className="px-4 py-3"><p className="font-semibold text-primary">{student.name}</p><p className="mt-0.5 text-xs text-muted-foreground">{student.email ?? "No email address"}</p></td><td className="px-4 py-3 text-muted-foreground">{student.roll_no ?? student.enrollment?.roll_number ?? "—"}</td><td className="px-4 py-3 text-muted-foreground">{student.enrollment?.class_name ?? "Unassigned"}</td><td className="px-4 py-3 text-muted-foreground">{student.enrollment?.department_name ?? "—"}</td><td className="px-4 py-3"><span className="rounded-full bg-muted px-2.5 py-1 text-[11px] font-bold text-muted-foreground">{student.enrollment?.status ? statusLabel(student.enrollment.status) : "No enrolment"}</span></td><td className="px-4 py-3 text-right"><button type="button" onClick={() => onSelect(student.id)} className="text-sm font-semibold text-accent hover:underline">View</button></td></tr>)}
        </tbody>
      </table>
    </div>
  );
}

function StaffDetailDialog({ id, onClose }: { id: string; onClose: () => void }) {
  const resource = useResource(() => fetchPrincipalStaffDetail(id), [id]);
  return <ProfileDialog title="Staff profile" onClose={onClose} resource={resource}>{(detail) => <StaffDetail detail={detail} />}</ProfileDialog>;
}

function StudentDetailDialog({ id, onClose }: { id: string; onClose: () => void }) {
  const resource = useResource(() => fetchPrincipalStudentDetail(id), [id]);
  return <ProfileDialog title="Student profile" onClose={onClose} resource={resource}>{(detail) => <StudentDetail detail={detail} />}</ProfileDialog>;
}

function ProfileDialog<T>({ title, onClose, resource, children }: { title: string; onClose: () => void; resource: ReturnType<typeof useResource<T>>; children: (value: T) => React.ReactNode }) {
  return (
    <div role="dialog" aria-modal="true" aria-label={title} className="fixed inset-0 z-50 flex items-center justify-center bg-primary/50 p-4">
      <div className="max-h-[90vh] w-full max-w-xl overflow-y-auto rounded-card bg-white p-5 shadow-2xl sm:p-6">
        <div className="mb-5 flex items-center justify-between gap-3"><h2 className="font-display text-lg font-bold text-primary">{title}</h2><button type="button" onClick={onClose} aria-label="Close profile" className="rounded-lg p-2 text-muted-foreground hover:bg-muted hover:text-primary"><X className="h-4 w-4" /></button></div>
        <AsyncState loading={resource.loading} error={resource.error} onRetry={resource.reload} loadingLabel="Loading profile…">
          {resource.data ? children(resource.data) : null}
        </AsyncState>
      </div>
    </div>
  );
}

function StaffDetail({ detail }: { detail: PrincipalStaffDetail }) {
  return <dl className="grid gap-x-6 gap-y-4 sm:grid-cols-2"><Detail label="Name" value={detail.name} /><Detail label="Email" value={detail.email} /><Detail label="Phone" value={detail.phone} /><Detail label="Employee code" value={detail.employee_code} /><Detail label="Designation" value={detail.designation} /><Detail label="Department" value={detail.department_name} /><Detail label="Employment type" value={detail.employment_type ? statusLabel(detail.employment_type) : null} /><Detail label="Joined" value={dateOnly(detail.date_of_joining)} /><Detail label="Qualification" value={detail.qualification} /><Detail label="Experience" value={detail.experience_years === null ? null : `${detail.experience_years} years`} /><Detail label="Roles" value={detail.roles.map(statusLabel).join(", ")} /></dl>;
}

function StudentDetail({ detail }: { detail: PrincipalStudentDetail }) {
  return <dl className="grid gap-x-6 gap-y-4 sm:grid-cols-2"><Detail label="Name" value={detail.name} /><Detail label="Email" value={detail.email} /><Detail label="Phone" value={detail.phone} /><Detail label="Roll number" value={detail.roll_no ?? detail.enrollment?.roll_number} /><Detail label="Class" value={detail.enrollment?.class_name} /><Detail label="Department" value={detail.enrollment?.department_name} /><Detail label="Academic year" value={detail.enrollment?.academic_year_name} /><Detail label="Enrolment status" value={detail.enrollment?.status ? statusLabel(detail.enrollment.status) : null} /><Detail label="Enrolment date" value={dateOnly(detail.enrollment?.enrollment_date)} /><Detail label="Date of birth" value={dateOnly(detail.date_of_birth)} /></dl>;
}

function Detail({ label, value }: { label: string; value: string | null | undefined }) {
  return <div><dt className="text-[11px] font-semibold uppercase tracking-wide text-muted-foreground">{label}</dt><dd className="mt-1 text-sm font-medium text-primary">{value || "—"}</dd></div>;
}

// Pagination is intentionally a presentational component. The API responds
// with offset/limit; each directory owns state so a new search resets it.
function Pagination({ total, offset, limit, onPrevious, onNext }: { total: number; offset: number; limit: number; onPrevious: () => void; onNext: () => void }) {
  if (total <= limit) return null;
  return <div className="mt-4 flex items-center justify-between text-sm text-muted-foreground"><span>Showing {offset + 1}–{Math.min(offset + limit, total)} of {total}</span><span className="flex gap-2"><button type="button" disabled={offset === 0} onClick={onPrevious} className="inline-flex h-9 items-center gap-1 rounded-field border border-border px-3 font-semibold disabled:opacity-40"><ChevronLeft className="h-4 w-4" /> Previous</button><button type="button" disabled={offset + limit >= total} onClick={onNext} className="inline-flex h-9 items-center gap-1 rounded-field border border-border px-3 font-semibold disabled:opacity-40">Next <ChevronRight className="h-4 w-4" /></button></span></div>;
}
