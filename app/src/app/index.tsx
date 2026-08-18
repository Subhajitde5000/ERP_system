import { ActivityIndicator, StyleSheet, View } from "react-native";
import { Redirect } from "expo-router";

import { useInstitutionAuth } from "@/lib/session";
import { consoleHref } from "@/lib/roles";
import { Colors } from "@/theme";

/** Entry — send the user to the matching console when signed in, else to login. */
export default function Index() {
  const { isAuthenticated, isLoading, user, institutionSlug } = useInstitutionAuth();

  if (isLoading) {
    return (
      <View style={styles.boot}>
        <ActivityIndicator size="large" color={Colors.accent} />
      </View>
    );
  }

  if (isAuthenticated) {
    const href = consoleHref(user?.roles);
    if (href) return <Redirect href={href} />;
  }

  if (!institutionSlug) {
    return <Redirect href="/institution" />;
  }

  return <Redirect href="/login" />;
}

const styles = StyleSheet.create({
  boot: {
    flex: 1,
    alignItems: "center",
    justifyContent: "center",
    backgroundColor: Colors.background,
  },
});
