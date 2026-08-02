import type { Metadata } from "next";
import Link from "next/link";
import { ArrowRight, Check } from "lucide-react";

import { CtaBand, MarketingShell, Section, SectionHeading } from "@/components/marketing/marketing-shell";
import { MODULES } from "@/lib/marketing";

export const metadata: Metadata = {
  title: "Features — 16 modules for the whole institution",
  description:
    "Attendance, examinations, assignments, LMS, fees, admissions, HR, library, hostel, transport, placement and inventory — one connected ERP + LMS.",
};

const PILLARS = [
  {
    title: "Academics & assessment",
    copy: "The everyday engine: attendance, timetables, exams, assignments and results, tied to your academic year.",
    keys: ["attendance", "timetable", "examination", "assignment", "results"],
  },
  {
    title: "Teaching & learning",
    copy: "Content, discussions and notices that keep students, teachers and families in sync.",
    keys: ["content", "discussion", "notice"],
  },
  {
    title: "Administration & finance",
    copy: "Run the institution: collect fees, admit students, pay staff and govern auxiliaries.",
    keys: ["finance", "admission", "hr"],
  },
  {
    title: "Auxiliary services",
    copy: "Switch on what you need — library, hostel, transport, placements and inventory.",
    keys: ["library", "hostel", "transport", "placement", "inventory"],
  },
];

export default function FeaturesPage() {
  const byKey = Object.fromEntries(MODULES.map((m) => [m.key, m]));
  return (
    <MarketingShell>
      <Section className="!pb-10 text-center">
        <SectionHeading
          eyebrow="Features"
          title="One platform for academics, learning and operations."
          lede="Sixteen purpose-built modules share one data model — so a student’s attendance, marks and fees are never in different systems."
          align="center"
        />
        <div className="mt-8 flex justify-center">
          <Link href="/signup" className="inline-flex h-12 items-center justify-center gap-2 rounded-field bg-accent px-6 text-sm font-semibold text-white shadow-accent transition hover:bg-accent-hover">
            Start free trial <ArrowRight className="h-4 w-4" aria-hidden="true" />
          </Link>
        </div>
      </Section>

      {PILLARS.map((pillar, i) => (
        <section
          key={pillar.title}
          id={i === 0 ? "modules" : undefined}
          className={i % 2 === 1 ? "bg-[#F8FAFC]" : ""}
        >
          <Section className="!py-16 lg:!py-20">
            <div className="grid gap-10 lg:grid-cols-[.85fr_1.15fr] lg:items-start lg:gap-16">
              <div className="lg:sticky lg:top-24">
                <p className="text-sm font-bold uppercase tracking-[0.14em] text-accent">
                  Pillar {String(i + 1).padStart(2, "0")}
                </p>
                <h2 className="mt-3 font-display text-3xl font-extrabold tracking-tight text-primary">
                  {pillar.title}
                </h2>
                <p className="mt-4 text-base leading-7 text-[#475569]">{pillar.copy}</p>
              </div>
              <div className="grid gap-4 sm:grid-cols-2">
                {pillar.keys.map((k) => {
                  const m = byKey[k];
                  if (!m) return null;
                  return (
                    <article key={k} className="rounded-card border border-border bg-white p-5 transition hover:border-accent-border hover:shadow-card">
                      <div className="flex items-center gap-3">
                        <span className="inline-flex rounded-xl bg-accent-light p-2.5 text-accent">
                          <m.icon className="h-5 w-5" aria-hidden="true" />
                        </span>
                        <div>
                          <h3 className="font-display text-base font-bold text-primary">{m.name}</h3>
                          <p className="text-[11px] font-semibold uppercase tracking-wide text-muted-foreground">
                            {m.category} module
                          </p>
                        </div>
                      </div>
                      <p className="mt-3 text-sm leading-6 text-[#64748B]">{m.blurb}</p>
                    </article>
                  );
                })}
              </div>
            </div>
          </Section>
        </section>
      ))}

      <section className="bg-primary text-white">
        <Section>
          <SectionHeading
            eyebrow="Role-based workspaces"
            title="The right view for every person."
            tone="light"
          />
          <div className="mt-10 grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
            {[
              "Institution Admin & Principal", "Vice Principal & HOD", "Teacher & Mentor",
              "Exam Controller & Coordinator", "Accountant & Librarian", "Student & Parent",
            ].map((role) => (
              <div key={role} className="flex items-center gap-3 rounded-card border border-white/10 bg-white/5 p-4">
                <Check className="h-5 w-5 shrink-0 text-cyan-300" aria-hidden="true" />
                <span className="text-sm font-medium text-slate-200">{role}</span>
              </div>
            ))}
          </div>
          <p className="mt-6 text-sm text-slate-400">18 fine-grained roles with module.action.scope permissions — people see exactly what their role grants.</p>
        </Section>
      </section>

      <CtaBand
        title="See it on your own institution."
        body="Create an account, spin up an institution, and explore the full module set in minutes."
        primary={{ label: "Start free", href: "/signup" }}
        secondary={{ label: "See pricing", href: "/pricing" }}
      />
    </MarketingShell>
  );
}
