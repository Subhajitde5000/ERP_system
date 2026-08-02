import Link from "next/link";
import {
  ArrowRight,
  BookOpenCheck,
  Building2,
  CalendarCheck2,
  Check,
  ChevronRight,
  ClipboardCheck,
  GraduationCap,
  HeartHandshake,
  Landmark,
  ShieldCheck,
  UsersRound,
} from "lucide-react";

import { ServiceRequestForm } from "@/components/marketing/service-request-form";

const capabilities = [
  { icon: ClipboardCheck, title: "Academic operations", copy: "Attendance, timetables, assessments and results in one reliable workspace." },
  { icon: BookOpenCheck, title: "Teaching & learning", copy: "Assignments, content, discussions and progress tools that keep learning moving." },
  { icon: Landmark, title: "Institution management", copy: "Admissions, fees, people and optional services, designed around your institution." },
];

const outcomes = [
  "A guided rollout plan built around your academic calendar",
  "Role-based workspaces for staff, learners, families and leadership",
  "A secure multi-tenant platform that scales with your institution",
];

export function LandingPage() {
  return (
    <main className="overflow-hidden bg-white text-primary">
      <header className="mx-auto flex max-w-7xl items-center justify-between px-5 py-5 sm:px-8 lg:px-10">
        <Link href="/" className="flex items-center gap-2" aria-label="xyz.com home">
          <span className="flex h-10 w-10 items-center justify-center rounded-xl bg-primary text-white"><GraduationCap className="h-5 w-5" aria-hidden="true" /></span>
          <span className="font-display text-xl font-bold tracking-tight">xyz.com</span>
        </Link>
        <nav className="hidden items-center gap-7 text-sm font-medium text-[#475569] md:flex" aria-label="Main navigation">
          <a href="#platform" className="hover:text-accent">Platform</a>
          <a href="#why-us" className="hover:text-accent">Why xyz.com</a>
          <a href="#consultation" className="hover:text-accent">Contact</a>
        </nav>
        <Link href="/login" className="rounded-field border border-border px-4 py-2 text-sm font-semibold text-primary transition hover:border-accent hover:text-accent">
          Sign in
        </Link>
      </header>

      <section className="relative isolate border-y border-slate-100 bg-[#F8FAFC]">
        <div className="absolute inset-x-0 top-0 -z-10 h-full bg-[radial-gradient(circle_at_84%_20%,rgba(6,182,212,0.17),transparent_24rem),radial-gradient(circle_at_16%_12%,rgba(79,70,229,0.14),transparent_26rem)]" />
        <div className="mx-auto grid max-w-7xl gap-12 px-5 py-16 sm:px-8 lg:grid-cols-[1.08fr_.92fr] lg:items-center lg:px-10 lg:py-24">
          <div className="max-w-2xl">
            <p className="inline-flex items-center gap-2 rounded-full border border-accent-border bg-white px-3 py-1.5 text-xs font-semibold text-accent-active shadow-sm"><ShieldCheck className="h-3.5 w-3.5" aria-hidden="true" /> Built for modern education institutions</p>
            <h1 className="mt-6 font-display text-4xl font-extrabold leading-[1.08] tracking-tight text-primary sm:text-5xl lg:text-6xl">One calm, connected home for your institution.</h1>
            <p className="mt-6 max-w-xl text-lg leading-8 text-[#475569]">Bring academics, learning and administration together with a platform that gives every team the clarity to do their best work.</p>
            <div className="mt-8 flex flex-col gap-3 sm:flex-row">
              <a href="#consultation" className="inline-flex h-12 items-center justify-center gap-2 rounded-field bg-accent px-5 text-sm font-semibold text-white shadow-accent transition hover:bg-accent-hover">Book a consultation <ArrowRight className="h-4 w-4" aria-hidden="true" /></a>
              <a href="#platform" className="inline-flex h-12 items-center justify-center gap-2 rounded-field border border-border bg-white px-5 text-sm font-semibold text-primary transition hover:border-accent">Explore the platform <ChevronRight className="h-4 w-4" aria-hidden="true" /></a>
            </div>
            <p className="mt-5 flex items-center gap-2 text-sm text-muted-foreground"><Check className="h-4 w-4 text-success-text" aria-hidden="true" /> Guided evaluation. No automatic account creation.</p>
          </div>
          <div className="rounded-[24px] border border-white/80 bg-white p-4 shadow-[0_24px_60px_rgba(15,23,42,0.12)] sm:p-5">
            <div className="rounded-[18px] bg-primary p-5 text-white sm:p-6">
              <div className="flex items-start justify-between"><div><p className="text-xs font-semibold uppercase tracking-[0.16em] text-indigo-200">Institution overview</p><h2 className="mt-2 font-display text-xl font-bold">Everything in its place</h2></div><span className="rounded-lg bg-white/10 p-2"><Building2 className="h-5 w-5" aria-hidden="true" /></span></div>
              <div className="mt-6 grid grid-cols-2 gap-3"><Metric value="24" label="active classes" /><Metric value="96%" label="attendance recorded" /><Metric value="1" label="shared workspace" /><Metric value="4" label="teams connected" /></div>
              <div className="mt-5 rounded-xl bg-white/10 p-4"><div className="flex items-center gap-3"><span className="rounded-lg bg-cyan-400/20 p-2 text-cyan-200"><CalendarCheck2 className="h-4 w-4" aria-hidden="true" /></span><div><p className="text-sm font-semibold">A platform shaped around you</p><p className="mt-0.5 text-xs text-slate-300">Start with the tools your institution needs.</p></div></div></div>
            </div>
          </div>
        </div>
      </section>

      <section id="platform" className="mx-auto max-w-7xl px-5 py-16 sm:px-8 lg:px-10 lg:py-24">
        <div className="max-w-2xl"><p className="text-sm font-bold uppercase tracking-[0.14em] text-accent">The platform</p><h2 className="mt-3 font-display text-3xl font-extrabold tracking-tight sm:text-4xl">Run the day. Support every learner. See what matters.</h2><p className="mt-4 text-base leading-7 text-[#475569]">xyz.com connects the work that is usually spread across paper, spreadsheets and disconnected apps—without asking your teams to change everything at once.</p></div>
        <div className="mt-10 grid gap-5 md:grid-cols-3">{capabilities.map(({ icon: Icon, title, copy }) => <article key={title} className="rounded-card border border-border p-6 transition hover:-translate-y-1 hover:border-accent-border hover:shadow-card"><span className="inline-flex rounded-xl bg-accent-light p-3 text-accent"><Icon className="h-6 w-6" aria-hidden="true" /></span><h3 className="mt-5 font-display text-xl font-bold">{title}</h3><p className="mt-2 text-sm leading-6 text-[#64748B]">{copy}</p></article>)}</div>
      </section>

      <section id="why-us" className="bg-primary py-16 text-white lg:py-24"><div className="mx-auto grid max-w-7xl gap-10 px-5 sm:px-8 lg:grid-cols-2 lg:px-10"><div><p className="text-sm font-bold uppercase tracking-[0.14em] text-cyan-300">A practical partnership</p><h2 className="mt-3 font-display text-3xl font-extrabold tracking-tight sm:text-4xl">Technology is only useful when people can rely on it.</h2><p className="mt-5 max-w-xl leading-7 text-slate-300">Our team helps institution leaders identify the right starting point, align their teams and build a rollout plan that works in the real world.</p></div><ul className="space-y-4">{outcomes.map((outcome) => <li key={outcome} className="flex gap-3 rounded-xl border border-white/10 bg-white/5 p-4 text-sm leading-6 text-slate-200"><span className="mt-0.5 shrink-0 text-cyan-300"><Check className="h-5 w-5" aria-hidden="true" /></span>{outcome}</li>)}</ul></div></section>

      <section id="consultation" className="mx-auto max-w-7xl px-5 py-16 sm:px-8 lg:px-10 lg:py-24"><div className="grid gap-10 lg:grid-cols-[.8fr_1.2fr] lg:gap-16"><div><p className="text-sm font-bold uppercase tracking-[0.14em] text-accent">Talk with us</p><h2 className="mt-3 font-display text-3xl font-extrabold tracking-tight sm:text-4xl">Let&apos;s plan your next step.</h2><p className="mt-4 max-w-md leading-7 text-[#475569]">Tell us a little about your institution. A specialist will help you explore the right platform setup and implementation path.</p><div className="mt-8 space-y-4"><Info icon={UsersRound} title="For institution leaders" copy="Designed for administrators and decision makers." /><Info icon={HeartHandshake} title="Human support" copy="A real conversation, not a self-service signup." /></div></div><div className="rounded-[20px] border border-border bg-[#F8FAFC] p-5 shadow-card sm:p-8"><h3 className="font-display text-2xl font-bold">Book a platform consultation</h3><p className="mt-2 text-sm leading-6 text-muted-foreground">We&apos;ll respond within one business day.</p><div className="mt-6"><ServiceRequestForm /></div></div></div></section>

      <footer className="border-t border-border bg-[#F8FAFC]"><div className="mx-auto flex max-w-7xl flex-col gap-3 px-5 py-7 text-sm text-muted-foreground sm:flex-row sm:items-center sm:justify-between sm:px-8 lg:px-10"><span>© {new Date().getFullYear()} xyz.com. Education, connected.</span><Link href="/login" className="font-medium text-primary hover:text-accent">Existing institution? Sign in</Link></div></footer>
    </main>
  );
}

function Metric({ value, label }: { value: string; label: string }) { return <div className="rounded-xl bg-white/10 p-3"><p className="font-display text-xl font-bold">{value}</p><p className="mt-1 text-[11px] text-slate-300">{label}</p></div>; }
function Info({ icon: Icon, title, copy }: { icon: typeof UsersRound; title: string; copy: string }) { return <div className="flex gap-3"><span className="mt-0.5 rounded-lg bg-accent-light p-2 text-accent"><Icon className="h-4 w-4" aria-hidden="true" /></span><div><h3 className="text-sm font-bold">{title}</h3><p className="mt-1 text-sm text-muted-foreground">{copy}</p></div></div>; }
