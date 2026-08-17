/**
 * Async & metric primitives — mobile port of
 * fontend/components/principal/principal-ui.tsx.
 */

import { StyleSheet, Text, TouchableOpacity, View } from "react-native";
import { TriangleAlert, RefreshCw } from "lucide-react-native";

import { Card, ErrorState, Loading } from "./ui";
import { Colors, Radius } from "@/theme";

export function MetricCard({
  label,
  value,
  hint,
  tone = "default",
}: {
  label: string;
  value: string | number;
  hint?: string;
  tone?: "default" | "success" | "warning" | "danger";
}) {
  const valueColor = {
    default: Colors.primary,
    success: Colors.successText,
    warning: Colors.warningText,
    danger: Colors.destructiveText,
  }[tone];
  return (
    <Card style={styles.metric}>
      <Text style={styles.metricLabel}>{label}</Text>
      <Text style={[styles.metricValue, { color: valueColor }]}>{value}</Text>
      {hint ? <Text style={styles.metricHint}>{hint}</Text> : null}
    </Card>
  );
}

export function ResourceError({ message, onRetry }: { message: string; onRetry: () => void }) {
  return (
    <View style={styles.errorWrap}>
      <ErrorState message={message} />
      <TouchableOpacity style={styles.retryButton} onPress={onRetry}>
        <RefreshCw size={14} color={Colors.mutedForeground} />
        <Text style={styles.retryLabel}>Try again</Text>
      </TouchableOpacity>
    </View>
  );
}

export function AsyncState({
  loading,
  error,
  onRetry,
  children,
  loadingLabel,
}: {
  loading: boolean;
  error: string | null;
  onRetry: () => void;
  children: React.ReactNode;
  loadingLabel?: string;
}) {
  if (loading) return <Loading label={loadingLabel} />;
  if (error) return <ResourceError message={error} onRetry={onRetry} />;
  return <>{children}</>;
}

export function EmptyTable({ text }: { text: string }) {
  return (
    <View style={styles.emptyTable}>
      <TriangleAlert size={20} color={Colors.mutedForeground} />
      <Text style={styles.emptyTableText}>{text}</Text>
    </View>
  );
}

const styles = StyleSheet.create({
  metric: {
    padding: 16,
  },
  metricLabel: {
    fontSize: 11,
    fontWeight: "600",
    textTransform: "uppercase",
    letterSpacing: 0.4,
    color: Colors.mutedForeground,
  },
  metricValue: {
    marginTop: 8,
    fontSize: 24,
    fontWeight: "800",
  },
  metricHint: {
    marginTop: 4,
    fontSize: 12,
    lineHeight: 16,
    color: Colors.mutedForeground,
  },
  errorWrap: {
    gap: 12,
  },
  retryButton: {
    flexDirection: "row",
    alignSelf: "flex-start",
    alignItems: "center",
    gap: 6,
    height: 36,
    borderRadius: Radius.field,
    borderWidth: 1,
    borderColor: Colors.border,
    backgroundColor: Colors.card,
    paddingHorizontal: 12,
  },
  retryLabel: {
    fontSize: 14,
    fontWeight: "600",
    color: Colors.foreground,
  },
  emptyTable: {
    flexDirection: "column",
    alignItems: "center",
    justifyContent: "center",
    gap: 8,
    paddingHorizontal: 20,
    paddingVertical: 48,
  },
  emptyTableText: {
    fontSize: 14,
    color: Colors.mutedForeground,
    textAlign: "center",
  },
});
