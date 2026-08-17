/**
 * Shared presentational bits — mobile port of fontend/components/admin/ui.tsx.
 * Same paddings, radii, borders and text styles as the website.
 */

import { ActivityIndicator, StyleSheet, Text, View, type StyleProp, type ViewStyle } from "react-native";

import { Colors, Radius, Shadow } from "@/theme";

export function PageHeader({
  title,
  subtitle,
  action,
}: {
  title: string;
  subtitle?: string;
  action?: React.ReactNode;
}) {
  return (
    <View style={styles.header}>
      <View style={styles.headerText}>
        <Text style={styles.h1}>{title}</Text>
        {subtitle ? <Text style={styles.subtitle}>{subtitle}</Text> : null}
      </View>
      {action}
    </View>
  );
}

export function Card({
  children,
  style,
  padded = true,
}: {
  children: React.ReactNode;
  style?: StyleProp<ViewStyle>;
  /** `!p-0` cards on the website render unpadded — pass padded={false}. */
  padded?: boolean;
}) {
  return <View style={[styles.card, padded && styles.cardPadded, style]}>{children}</View>;
}

export function Loading({ label = "Loading…" }: { label?: string }) {
  return (
    <View style={styles.loading}>
      <ActivityIndicator size="small" color={Colors.accent} />
      <Text style={styles.loadingLabel}>{label}</Text>
    </View>
  );
}

export function ErrorState({ message }: { message: string }) {
  return (
    <View style={styles.errorState}>
      <Text style={styles.errorText}>{message}</Text>
    </View>
  );
}

export function EmptyState({ text }: { text: string }) {
  return (
    <View style={styles.emptyState}>
      <Text style={styles.emptyText}>{text}</Text>
    </View>
  );
}

const styles = StyleSheet.create({
  header: {
    marginBottom: 24,
    gap: 12,
  },
  headerText: {},
  h1: {
    fontSize: 24,
    fontWeight: "800",
    letterSpacing: -0.4,
    color: Colors.primary,
  },
  subtitle: {
    marginTop: 4,
    fontSize: 14,
    lineHeight: 20,
    color: Colors.mutedForeground,
  },
  card: {
    borderRadius: Radius.card,
    borderWidth: 1,
    borderColor: Colors.border,
    backgroundColor: Colors.card,
    ...Shadow.card,
  },
  cardPadded: {
    padding: 20,
  },
  loading: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    gap: 8,
    borderRadius: Radius.card,
    borderWidth: 1,
    borderColor: Colors.border,
    backgroundColor: Colors.card,
    paddingVertical: 64,
  },
  loadingLabel: {
    fontSize: 14,
    color: Colors.mutedForeground,
  },
  errorState: {
    borderRadius: Radius.card,
    borderWidth: 1,
    borderColor: Colors.destructiveBorder,
    backgroundColor: Colors.destructiveLight,
    paddingHorizontal: 20,
    paddingVertical: 40,
    alignItems: "center",
  },
  errorText: {
    fontSize: 14,
    fontWeight: "500",
    color: Colors.destructiveText,
    textAlign: "center",
  },
  emptyState: {
    borderRadius: Radius.card,
    borderWidth: 1,
    borderColor: Colors.border,
    borderStyle: "dashed",
    backgroundColor: Colors.card,
    paddingHorizontal: 24,
    paddingVertical: 48,
    alignItems: "center",
  },
  emptyText: {
    fontSize: 14,
    color: Colors.mutedForeground,
    textAlign: "center",
  },
});
