/**
 * Shared teacher-console primitives — chips, pills, action buttons and
 * form bits reused across C-TC screens so every page matches the website.
 */

import { StyleSheet, Text, TextInput, TouchableOpacity, View } from "react-native";
import { Check } from "lucide-react-native";
import type { LucideIcon } from "lucide-react-native";

import { Colors, Radius, Shadow } from "@/theme";

export function FilterChips({
  options,
  value,
  onChange,
}: {
  options: { value: string; label: string }[];
  value: string;
  onChange: (value: string) => void;
}) {
  return (
    <View style={styles.chipRow}>
      {options.map((option) => {
        const active = value === option.value;
        return (
          <TouchableOpacity
            key={option.value || "ALL"}
            accessibilityState={{ selected: active }}
            onPress={() => onChange(option.value)}
            style={[styles.chip, active && styles.chipActive]}
          >
            <Text style={[styles.chipLabel, active && styles.chipLabelActive]}>{option.label}</Text>
          </TouchableOpacity>
        );
      })}
    </View>
  );
}

export function StatusPill({
  label,
  tone = "muted",
}: {
  label: string;
  tone?: "muted" | "accent" | "success" | "warning" | "danger";
}) {
  const palette = {
    muted: { backgroundColor: Colors.muted, color: Colors.mutedForeground },
    accent: { backgroundColor: Colors.accentLight, color: Colors.accent },
    success: { backgroundColor: Colors.successLight, color: Colors.successText },
    warning: { backgroundColor: Colors.warningLight, color: Colors.warningText },
    danger: { backgroundColor: Colors.destructiveLight, color: Colors.destructiveText },
  }[tone];
  return (
    <View style={[styles.pill, { backgroundColor: palette.backgroundColor }]}>
      <Text style={[styles.pillText, { color: palette.color }]}>{label}</Text>
    </View>
  );
}

export function examStatusTone(status: string): "muted" | "accent" | "success" | "warning" | "danger" {
  if (status === "DRAFT") return "muted";
  if (status === "PUBLISHED" || status === "ONGOING") return "accent";
  if (status === "RESULTS_RELEASED") return "success";
  if (status === "CANCELLED") return "danger";
  return "warning";
}

export function assignmentStatusTone(status: string): "muted" | "accent" | "success" | "warning" | "danger" {
  if (status === "PUBLISHED") return "success";
  if (status === "DRAFT") return "muted";
  return "warning";
}

export function submissionStatusTone(status: string): "muted" | "accent" | "success" | "warning" | "danger" {
  if (status === "APPROVED") return "success";
  if (status === "REJECTED") return "danger";
  if (status === "RESUBMIT_REQUESTED" || status === "CHANGES_REQUESTED") return "warning";
  if (status === "UNDER_REVIEW") return "accent";
  return "muted";
}

export function leaveStatusTone(status: string): "muted" | "accent" | "success" | "warning" | "danger" {
  if (status === "PENDING") return "warning";
  if (status === "APPROVED") return "success";
  if (status === "REJECTED") return "danger";
  return "muted";
}

export function PrimaryButton({
  label,
  onPress,
  icon: Icon,
  loading,
  disabled,
}: {
  label: string;
  onPress: () => void;
  icon?: LucideIcon;
  loading?: boolean;
  disabled?: boolean;
}) {
  const isDisabled = disabled || loading;
  return (
    <TouchableOpacity
      disabled={isDisabled}
      onPress={onPress}
      style={[styles.primaryBtn, isDisabled && styles.disabled]}
    >
      {Icon ? <Icon size={16} color="#FFFFFF" /> : null}
      <Text style={styles.primaryBtnLabel}>{loading ? "Please wait…" : label}</Text>
    </TouchableOpacity>
  );
}

export function OutlineButton({
  label,
  onPress,
  icon: Icon,
  disabled,
  danger,
  warning,
}: {
  label: string;
  onPress: () => void;
  icon?: LucideIcon;
  disabled?: boolean;
  danger?: boolean;
  warning?: boolean;
}) {
  return (
    <TouchableOpacity
      disabled={disabled}
      onPress={onPress}
      style={[
        styles.outlineBtn,
        danger && styles.outlineDanger,
        warning && styles.outlineWarning,
        disabled && styles.disabled,
      ]}
    >
      {Icon ? (
        <Icon
          size={14}
          color={danger ? Colors.destructiveText : warning ? Colors.warningText : Colors.primary}
        />
      ) : null}
      <Text
        style={[
          styles.outlineBtnLabel,
          danger && { color: Colors.destructiveText },
          warning && { color: Colors.warningText },
        ]}
      >
        {label}
      </Text>
    </TouchableOpacity>
  );
}

export function CheckboxRow({
  label,
  checked,
  onChange,
  disabled,
}: {
  label: string;
  checked: boolean;
  onChange: (next: boolean) => void;
  disabled?: boolean;
}) {
  return (
    <TouchableOpacity
      accessibilityRole="checkbox"
      accessibilityState={{ checked, disabled }}
      disabled={disabled}
      onPress={() => onChange(!checked)}
      style={[styles.checkRow, disabled && styles.disabled]}
    >
      <View style={[styles.checkbox, checked && styles.checkboxChecked]}>
        {checked ? <Check size={12} color="#FFFFFF" strokeWidth={3} /> : null}
      </View>
      <Text style={styles.checkLabel}>{label}</Text>
    </TouchableOpacity>
  );
}

export function ActionError({ message }: { message: string | null }) {
  if (!message) return null;
  return <Text style={styles.actionError}>{message}</Text>;
}

export function SuccessNote({ message }: { message: string | null }) {
  if (!message) return null;
  return <Text style={styles.successNote}>{message}</Text>;
}

export function WarningBanner({ children }: { children: React.ReactNode }) {
  return (
    <View style={styles.warningBanner}>
      <Text style={styles.warningBannerText}>{children}</Text>
    </View>
  );
}

export function CardHeading({
  title,
  subtitle,
  action,
}: {
  title: string;
  subtitle?: string;
  action?: React.ReactNode;
}) {
  return (
    <View style={styles.cardHeading}>
      <View style={styles.cardHeadingText}>
        <Text style={styles.cardTitle}>{title}</Text>
        {subtitle ? <Text style={styles.cardSubtitle}>{subtitle}</Text> : null}
      </View>
      {action}
    </View>
  );
}

export function MetaRow({ label, value }: { label: string; value: string }) {
  return (
    <View style={styles.metaRow}>
      <Text style={styles.metaLabel}>{label}</Text>
      <Text style={styles.metaValue}>{value}</Text>
    </View>
  );
}

export function SearchField({
  value,
  onChange,
  placeholder,
  accessibilityLabel,
}: {
  value: string;
  onChange: (value: string) => void;
  placeholder: string;
  accessibilityLabel?: string;
}) {
  return (
    <TextInput
      accessibilityLabel={accessibilityLabel ?? placeholder}
      value={value}
      onChangeText={onChange}
      placeholder={placeholder}
      placeholderTextColor={Colors.placeholder}
      autoCapitalize="none"
      autoCorrect={false}
      style={styles.search}
    />
  );
}

export function assignmentKey(subjectId: string, classId: string): string {
  return `${subjectId}:${classId}`;
}

export function splitAssignmentKey(value: string): { subjectId: string; classId: string } | null {
  const [subjectId, classId] = value.split(":");
  if (!subjectId || !classId) return null;
  return { subjectId, classId };
}

const styles = StyleSheet.create({
  chipRow: {
    flexDirection: "row",
    flexWrap: "wrap",
    gap: 8,
    marginBottom: 20,
  },
  chip: {
    height: 36,
    borderRadius: Radius.field,
    borderWidth: 1,
    borderColor: Colors.border,
    paddingHorizontal: 16,
    alignItems: "center",
    justifyContent: "center",
  },
  chipActive: {
    borderColor: Colors.accent,
    backgroundColor: Colors.accentLight,
  },
  chipLabel: {
    fontSize: 12,
    fontWeight: "600",
    color: Colors.mutedForeground,
  },
  chipLabelActive: {
    color: Colors.accent,
  },
  pill: {
    alignSelf: "flex-start",
    borderRadius: 999,
    paddingHorizontal: 10,
    paddingVertical: 4,
  },
  pillText: {
    fontSize: 11,
    fontWeight: "700",
  },
  primaryBtn: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    gap: 8,
    minHeight: 40,
    borderRadius: Radius.field,
    backgroundColor: Colors.accent,
    paddingHorizontal: 16,
    paddingVertical: 10,
    ...Shadow.accent,
  },
  primaryBtnLabel: {
    fontSize: 14,
    fontWeight: "600",
    color: "#FFFFFF",
  },
  outlineBtn: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    gap: 6,
    minHeight: 36,
    borderRadius: Radius.field,
    borderWidth: 1,
    borderColor: Colors.border,
    paddingHorizontal: 12,
    paddingVertical: 8,
    backgroundColor: Colors.card,
  },
  outlineDanger: {
    borderColor: Colors.destructiveBorder,
  },
  outlineWarning: {
    borderColor: Colors.warningBorder,
  },
  outlineBtnLabel: {
    fontSize: 12,
    fontWeight: "600",
    color: Colors.primary,
  },
  disabled: {
    opacity: 0.6,
  },
  checkRow: {
    flexDirection: "row",
    alignItems: "center",
    gap: 8,
    paddingVertical: 4,
  },
  checkbox: {
    width: 16,
    height: 16,
    borderRadius: 4,
    borderWidth: 1,
    borderColor: "#CBD5E1",
    backgroundColor: "#FFFFFF",
    alignItems: "center",
    justifyContent: "center",
  },
  checkboxChecked: {
    backgroundColor: Colors.accent,
    borderColor: Colors.accent,
  },
  checkLabel: {
    flex: 1,
    fontSize: 14,
    fontWeight: "500",
    color: Colors.primary,
  },
  actionError: {
    marginBottom: 12,
    fontSize: 14,
    color: Colors.destructiveText,
  },
  successNote: {
    marginBottom: 12,
    fontSize: 14,
    color: Colors.successText,
  },
  warningBanner: {
    borderRadius: Radius.field,
    borderWidth: 1,
    borderColor: Colors.warningBorder,
    backgroundColor: Colors.warningLight,
    paddingHorizontal: 16,
    paddingVertical: 10,
    marginBottom: 16,
  },
  warningBannerText: {
    fontSize: 14,
    color: Colors.warningText,
  },
  cardHeading: {
    flexDirection: "row",
    alignItems: "flex-start",
    justifyContent: "space-between",
    gap: 12,
    marginBottom: 16,
  },
  cardHeadingText: {
    flex: 1,
  },
  cardTitle: {
    fontSize: 16,
    fontWeight: "700",
    color: Colors.primary,
  },
  cardSubtitle: {
    marginTop: 4,
    fontSize: 12,
    color: Colors.mutedForeground,
  },
  metaRow: {
    flexDirection: "row",
    gap: 8,
    paddingVertical: 2,
  },
  metaLabel: {
    width: 112,
    fontSize: 14,
    fontWeight: "500",
    color: Colors.mutedForeground,
  },
  metaValue: {
    flex: 1,
    fontSize: 14,
    fontWeight: "500",
    color: Colors.primary,
  },
  search: {
    height: 44,
    borderRadius: Radius.field,
    borderWidth: 1,
    borderColor: "#E2E8F0",
    backgroundColor: "#FFFFFF",
    paddingHorizontal: 14,
    fontSize: 14,
    color: Colors.primary,
  },
});
