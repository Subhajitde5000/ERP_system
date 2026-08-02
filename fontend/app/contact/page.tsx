import type { Metadata } from "next";
import { Mail, MapPin, MessageCircle, Phone } from "lucide-react";

import { MarketingShell, Section, SectionHeading } from "@/components/marketing/marketing-shell";
import { ServiceRequestForm } from "@/components/marketing/service-request-form";

export const metadata: Metadata = {
  title: "Contact — talk to the xyz.com team",
  description:
    "Book a consultation, ask about pricing or partnerships, or get help. We respond within one business day.",
};

const CHANNELS = [
  { icon: Phone, label: "Sales & demos", value: "+91 80 4718 0000", hint: "Mon–Sat, 9:00–18:00 IST" },
  { icon: Mail, label: "Email", value: "hello@xyz.com", hint: "We reply within one business day" },
  { icon: MessageCircle, label: "Existing customer support", value: "From your dashboard → Support", hint: "Signed-in owners can raise tickets" },
  { icon: MapPin, label: "Office", value: "Bengaluru, India", hint: "Remote-first team across India" },
];

export default function ContactPage() {
  return (
    <MarketingShell>
      <Section className="!pb-10">
        <SectionHeading
          eyebrow="Contact"
          title="Let’s talk."
          lede="Book a consultation, ask about pricing or partnerships, or get help with your account. We respond within one business day."
        />
      </Section>

      <section className="bg-[#F8FAFC]">
        <Section className="!py-16">
          <div className="grid gap-10 lg:grid-cols-[.9fr_1.1fr] lg:gap-16">
            <div>
              <h2 className="font-display text-xl font-bold text-primary">Reach us directly</h2>
              <ul className="mt-6 space-y-4">
                {CHANNELS.map((c) => (
                  <li key={c.label} className="flex gap-4 rounded-card border border-border bg-white p-5">
                    <span className="inline-flex rounded-xl bg-accent-light p-2.5 text-accent">
                      <c.icon className="h-5 w-5" aria-hidden="true" />
                    </span>
                    <div>
                      <p className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">{c.label}</p>
                      <p className="mt-0.5 text-sm font-bold text-primary">{c.value}</p>
                      <p className="mt-0.5 text-xs text-muted-foreground">{c.hint}</p>
                    </div>
                  </li>
                ))}
              </ul>
            </div>

            <div className="rounded-[20px] border border-border bg-white p-5 shadow-card sm:p-8">
              <h2 className="font-display text-2xl font-bold text-primary">Book a consultation</h2>
              <p className="mt-2 text-sm leading-6 text-muted-foreground">
                Tell us about your institution and a specialist will reach out with a tailored plan.
              </p>
              <div className="mt-6">
                <ServiceRequestForm />
              </div>
            </div>
          </div>
        </Section>
      </section>
    </MarketingShell>
  );
}
