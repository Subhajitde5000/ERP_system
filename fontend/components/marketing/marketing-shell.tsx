import Link from "next/link";
import { ArrowRight } from "lucide-react";

import { SiteNav } from "./site-nav";
import { SiteFooter } from "./site-footer";

/**
 * Shared page frame for every public marketing page: sticky nav on top, the
 * rich footer at the bottom. Pages pass their content as children.
 */
export function MarketingShell({ children }: { children: React.ReactNode }) {
  return (
    <div className="flex min-h-screen flex-col bg-white">
      <SiteNav />
      <div className="flex-1">{children}</div>
      <SiteFooter />
    </div>
  );
}

/** Section with the standard max-width + vertical rhythm. */
export function Section({
  children,
  className = "",
  id,
}: {
  children: React.ReactNode;
  className?: string;
  id?: string;
}) {
  return (
    <section id={id} className={`mx-auto max-w-7xl px-5 py-16 sm:px-8 lg:px-10 lg:py-24 ${className}`}>
      {children}
    </section>
  );
}

/** Eyebrow + heading + lede block, used to open most sections. */
export function SectionHeading({
  eyebrow,
  title,
  lede,
  align = "left",
  tone = "default",
}: {
  eyebrow?: string;
  title: string;
  lede?: string;
  align?: "left" | "center";
  tone?: "default" | "light";
}) {
  const accent = tone === "light" ? "text-cyan-300" : "text-accent";
  const heading = tone === "light" ? "text-white" : "text-primary";
  const body = tone === "light" ? "text-slate-300" : "text-[#475569]";
  return (
    <div className={`max-w-2xl ${align === "center" ? "mx-auto text-center" : ""}`}>
      {eyebrow ? (
        <p className={`text-sm font-bold uppercase tracking-[0.14em] ${accent}`}>{eyebrow}</p>
      ) : null}
      <h2 className={`mt-3 font-display text-3xl font-extrabold tracking-tight sm:text-4xl ${heading}`}>
        {title}
      </h2>
      {lede ? <p className={`mt-4 text-base leading-7 ${body}`}>{lede}</p> : null}
    </div>
  );
}

/** Reusable conversion band — the closing CTA on most pages. */
export function CtaBand({
  title = "Ready to connect your institution?",
  body = "Create your platform account in minutes, or talk to our team about a guided rollout. No card required to start a 14-day trial.",
  primary = { label: "Start free", href: "/signup" },
  secondary = { label: "Book a demo", href: "/contact" },
}: {
  title?: string;
  body?: string;
  primary?: { label: string; href: string };
  secondary?: { label: string; href: string };
}) {
  return (
    <section className="bg-primary">
      <div className="mx-auto max-w-5xl px-5 py-16 text-center sm:px-8 lg:px-10 lg:py-20">
        <h2 className="font-display text-3xl font-extrabold tracking-tight text-white sm:text-4xl">
          {title}
        </h2>
        <p className="mx-auto mt-4 max-w-2xl text-base leading-7 text-slate-300">{body}</p>
        <div className="mt-8 flex flex-col justify-center gap-3 sm:flex-row">
          <Link
            href={primary.href}
            className="inline-flex h-12 items-center justify-center gap-2 rounded-field bg-accent px-6 text-sm font-semibold text-white shadow-accent transition hover:bg-accent-hover"
          >
            {primary.label} <ArrowRight className="h-4 w-4" aria-hidden="true" />
          </Link>
          <Link
            href={secondary.href}
            className="inline-flex h-12 items-center justify-center rounded-field border border-white/20 bg-white/5 px-6 text-sm font-semibold text-white transition hover:bg-white/10"
          >
            {secondary.label}
          </Link>
        </div>
      </div>
    </section>
  );
}
