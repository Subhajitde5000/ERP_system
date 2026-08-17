/**
 * Primary button — port of fontend/components/ui/button.tsx (design §6.3).
 * #4F46E5 → active #3730A3 · h-44px · radius 10px · indigo shadow.
 * Loading state disables the button to prevent double submit (§10).
 */

import { ActivityIndicator, StyleSheet, Text, TouchableOpacity, type ViewStyle } from "react-native";

import { Colors, Radius, Shadow } from "@/theme";

export function Button({
  loading = false,
  loadingText = "Please wait…",
  variant = "primary",
  disabled,
  onPress,
  children,
  style,
}: {
  loading?: boolean;
  loadingText?: string;
  variant?: "primary" | "secondary";
  disabled?: boolean;
  onPress?: () => void;
  children: React.ReactNode;
  style?: ViewStyle;
}) {
  const isDisabled = disabled || loading;
  return (
    <TouchableOpacity
      accessibilityRole="button"
      accessibilityState={{ busy: loading || undefined, disabled: isDisabled }}
      activeOpacity={0.8}
      disabled={isDisabled}
      onPress={onPress}
      style={[
        styles.button,
        variant === "primary" ? styles.primary : styles.secondary,
        isDisabled && styles.disabled,
        style,
      ]}
    >
      {loading ? (
        <>
          <ActivityIndicator size="small" color={variant === "primary" ? "#FFFFFF" : Colors.primary} />
          <Text style={[styles.label, variant === "secondary" && styles.labelSecondary]}>
            {loadingText}
          </Text>
        </>
      ) : (
        children
      )}
    </TouchableOpacity>
  );
}

const styles = StyleSheet.create({
  button: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    gap: 8,
    height: 44,
    borderRadius: Radius.field,
    paddingHorizontal: 16,
  },
  primary: {
    backgroundColor: Colors.accent,
    ...Shadow.accent,
  },
  secondary: {
    borderWidth: 1,
    borderColor: "#E2E8F0",
    backgroundColor: "#FFFFFF",
  },
  disabled: {
    opacity: 0.6,
  },
  label: {
    fontSize: 14,
    fontWeight: "600",
    color: "#FFFFFF",
  },
  labelSecondary: {
    color: "#0F172A",
  },
});
