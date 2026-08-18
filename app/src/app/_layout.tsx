import { useEffect } from "react";
import { Stack, ThemeProvider, DefaultTheme, type Theme } from "expo-router";
import * as SplashScreen from "expo-splash-screen";
import { StatusBar } from "expo-status-bar";

import { InstitutionAuthProvider } from "@/lib/session";
import { Colors } from "@/theme";

SplashScreen.preventAutoHideAsync();

/** The website's student console is light-only — lock the app to the same. */
const AppTheme: Theme = {
  ...DefaultTheme,
  dark: false,
  colors: {
    ...DefaultTheme.colors,
    primary: Colors.primary,
    background: Colors.background,
    card: Colors.card,
    text: Colors.foreground,
    border: Colors.border,
  },
};

export default function RootLayout() {
  useEffect(() => {
    SplashScreen.hideAsync();
  }, []);

  return (
    <ThemeProvider value={AppTheme}>
      <InstitutionAuthProvider>
        <StatusBar style="dark" />
        <Stack screenOptions={{ headerShown: false }}>
          <Stack.Screen name="index" />
          <Stack.Screen name="institution" />
          <Stack.Screen name="login" />
          <Stack.Screen name="forgot-password" />
          <Stack.Screen name="(student)" />
        </Stack>
      </InstitutionAuthProvider>
    </ThemeProvider>
  );
}
