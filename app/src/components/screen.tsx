/**
 * Screen scroller — the app counterpart of the website's `<main>` area
 * (flex-1 p-4 on mobile, page background #F8FAFC).
 */

import { ScrollView, StyleSheet, type ViewStyle } from "react-native";

import { Colors } from "@/theme";

export function Screen({
  children,
  style,
}: {
  children: React.ReactNode;
  style?: ViewStyle;
}) {
  return (
    <ScrollView
      style={styles.scroll}
      contentContainerStyle={[styles.content, style]}
      keyboardShouldPersistTaps="handled"
    >
      {children}
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  scroll: {
    flex: 1,
    backgroundColor: Colors.background,
  },
  content: {
    padding: 16,
  },
});
