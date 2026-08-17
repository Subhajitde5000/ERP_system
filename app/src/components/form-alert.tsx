/**
 * Inline form feedback — port of fontend/components/auth/form-alert.tsx
 * (design §7): error / success / info states.
 */

import { StyleSheet, Text, View } from "react-native";
import { CircleAlert, CircleCheck, Info } from "lucide-react-native";

import { Colors, Radius } from "@/theme";

const VARIANTS = {
  error: {
    wrap: { borderColor: Colors.destructiveBorder, backgroundColor: Colors.destructiveLight },
    text: "#B91C1C",
    icon: CircleAlert,
    iconColor: Colors.destructive,
  },
  success: {
    wrap: { borderColor: "#A7F3D0", backgroundColor: Colors.successLight },
    text: "#047857",
    icon: CircleCheck,
    iconColor: Colors.success,
  },
  info: {
    wrap: { borderColor: Colors.accentBorder, backgroundColor: Colors.accentLight },
    text: "#3730A3",
    icon: Info,
    iconColor: Colors.accent,
  },
} as const;

export function FormAlert({
  variant = "error",
  children,
}: {
  variant?: keyof typeof VARIANTS;
  children: React.ReactNode;
}) {
  const { wrap, text, icon: Icon, iconColor } = VARIANTS[variant];
  return (
    <View accessibilityRole="alert" style={[styles.alert, wrap]}>
      <Icon size={16} color={iconColor} style={styles.icon} />
      <Text style={[styles.text, { color: text }]}>{children}</Text>
    </View>
  );
}

const styles = StyleSheet.create({
  alert: {
    flexDirection: "row",
    alignItems: "flex-start",
    gap: 10,
    borderRadius: Radius.field,
    borderWidth: 1,
    paddingHorizontal: 14,
    paddingVertical: 12,
  },
  icon: {
    marginTop: 1,
  },
  text: {
    flex: 1,
    fontSize: 13,
    fontWeight: "500",
    lineHeight: 18,
  },
});
