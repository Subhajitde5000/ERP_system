import { useEffect } from "react";
import { ActivityIndicator, StyleSheet, View } from "react-native";
import { Redirect } from "expo-router";

import { useInstitutionAuth } from "@/lib/session";
import { Colors } from "@/theme";

/** Entry — send the user to the console when signed in, else to login. */
export default function Index() {
  const { isAuthenticated, isLoading, hasRole } = useInstitutionAuth();

  if (isLoading) {
    return (
      <View style={styles.boot}>
        <ActivityIndicator size="large" color={Colors.accent} />
      </View>
    );
  }

  if (isAuthenticated && hasRole("STUDENT")) {
    return <Redirect href="/(student)/dashboard" />;
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
