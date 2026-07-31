"use client";

import { useState } from "react";

import { cn } from "@/lib/utils";
import { FormAlert } from "@/components/auth/form-alert";
import { ModuleToggleList } from "./module-toggle";
import {
  AcademicYearSection,
  BrandingSection,
  FeeStructureSection,
  GeneralSection,
  LeavePoliciesSection,
  NotificationRulesSection,
  PasswordSection,
  PreferencesSection,
  ProfileLinkSection,
  SalaryDefaultsSection,
} from "./settings-sections";
import type {
  SettingsData,
  SettingsPermissions,
  SettingsSection,
} from "@/types/settings";

/**
 * Settings — role_based_shared_pages.md PAGE 16 (C-RB-16).
 *
 * "One URL. Sections shown/hidden per role." The section list comes from
 * `settingsPermissions()`, resolved server-side; this component renders
 * whatever it was handed and never names a role.
 *
 * Sections the caller doesn't own are absent from the payload, so a student's
 * page carries no institution contact details or fee structure.
 */
export function SettingsView({
  perms,
  sections,
  data,
}: {
  perms: SettingsPermissions;
  /** Already filtered for the tenant's enabled modules */
  sections: SettingsSection[];
  data: SettingsData;
}) {
  const [status, setStatus] = useState<string | null>(null);

  // The jump list is a convenience for the admin's long page, not navigation
  const anchors = sections;

  return (
    <div className="mx-auto w-full min-w-0 max-w-3xl">
      <h1 className="font-display text-[22px] font-bold text-foreground">
        Settings
      </h1>
      <p className="mt-1 text-[13px] text-muted-foreground">{perms.note}</p>

      {status && (
        <FormAlert variant="info" className="mt-4">
          {status}
        </FormAlert>
      )}

      {/* Jump list — a long admin page is hard to scan without one */}
      {anchors.length > 3 && (
        <nav
          aria-label="Settings sections"
          className="-mx-1 mt-4 flex min-w-0 gap-2 overflow-x-auto px-1 pb-1"
        >
          {anchors.map((s) => (
            <a
              key={s.key}
              href={`#${anchorFor(s)}`}
              className={cn(
                "inline-flex h-8 shrink-0 items-center whitespace-nowrap rounded-full border border-border bg-white px-3.5 text-xs font-medium text-muted-foreground transition",
                "hover:border-accent hover:text-accent focus-visible:outline-none focus-visible:ring-3 focus-visible:ring-accent/15",
              )}
            >
              {s.label}
            </a>
          ))}
        </nav>
      )}

      <div className="mt-4 grid min-w-0 gap-4">
        {sections.map((section) => (
          <div key={section.key} className="min-w-0">
            {renderSection(section)}
          </div>
        ))}
      </div>
    </div>
  );

  function renderSection(section: SettingsSection) {
    switch (section.key) {
      case "GENERAL":
        return data.institution ? (
          <GeneralSection institution={data.institution} onAction={setStatus} />
        ) : null;

      case "MODULES":
        return data.modules ? (
          <ModuleToggleList
            modules={data.modules}
            canToggle={perms.canToggleModules}
            onAction={setStatus}
          />
        ) : null;

      case "ACADEMIC_YEAR":
        return data.academicYears ? (
          <AcademicYearSection
            years={data.academicYears}
            readOnly={Boolean(section.readOnly)}
            onAction={setStatus}
          />
        ) : null;

      case "FEES":
        return data.feeHeads ? (
          <FeeStructureSection heads={data.feeHeads} onAction={setStatus} />
        ) : null;

      case "NOTIFICATIONS":
        return data.notificationRules ? (
          <NotificationRulesSection
            rules={data.notificationRules}
            onAction={setStatus}
          />
        ) : null;

      case "BRANDING":
        return data.institution ? (
          <BrandingSection
            institution={data.institution}
            onAction={setStatus}
          />
        ) : null;

      case "LEAVE_POLICIES":
        return data.leavePolicies ? (
          <LeavePoliciesSection
            policies={data.leavePolicies}
            onAction={setStatus}
          />
        ) : null;

      case "SALARY_DEFAULTS":
        return data.salaryDefaults ? (
          <SalaryDefaultsSection
            defaults={data.salaryDefaults}
            onAction={setStatus}
          />
        ) : null;

      case "NOTIFICATION_PREFS":
        return (
          <PreferencesSection
            preferences={data.preferences}
            onAction={setStatus}
          />
        );

      case "PASSWORD":
        return <PasswordSection onAction={setStatus} />;

      case "PROFILE":
        return <ProfileLinkSection />;

      default:
        return null;
    }
  }
}

/** Anchor ids match the `id` each section card renders. */
function anchorFor(section: SettingsSection): string {
  const map: Record<string, string> = {
    GENERAL: "general",
    MODULES: "modules",
    ACADEMIC_YEAR: "academic-year",
    FEES: "fees",
    NOTIFICATIONS: "notifications",
    BRANDING: "branding",
    LEAVE_POLICIES: "leave-policies",
    SALARY_DEFAULTS: "salary-defaults",
    NOTIFICATION_PREFS: "notification-prefs",
    PASSWORD: "password",
    PROFILE: "profile",
  };
  return map[section.key] ?? section.key.toLowerCase();
}
