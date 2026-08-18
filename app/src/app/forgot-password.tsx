import { useEffect, useState } from "react";
import {
  Alert,
  KeyboardAvoidingView,
  Platform,
  ScrollView,
  StyleSheet,
  Text,
  TouchableOpacity,
  View,
} from "react-native";
import { useRouter } from "expo-router";
import { ArrowLeft, Building2, MailCheck, Send } from "lucide-react-native";

import { MobileBanner } from "@/components/brand-banner";
import { Button } from "@/components/button";
import { FormAlert } from "@/components/form-alert";
import { TextField } from "@/components/text-field";
import { AuthError, ERROR_MESSAGES, requestPasswordReset } from "@/lib/auth";
import { useInstitutionAuth } from "@/lib/session";
import { Colors } from "@/theme";

export default function ForgotPasswordScreen() {
  const router = useRouter();
  const { institutionSlug, isLoading } = useInstitutionAuth();
  const [identifier, setIdentifier] = useState("");
  const [submitting, setSubmitting] = useState(false);
  const [sent, setSent] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [fieldErrors, setFieldErrors] = useState<{
    identifier?: string;
  }>({});

  useEffect(() => {
    if (!isLoading && !institutionSlug) {
      router.replace("/institution");
    }
  }, [isLoading, institutionSlug, router]);

  async function handleSubmit() {
    if (submitting) return;

    if (!institutionSlug) {
      router.replace("/institution");
      return;
    }

    const errors: typeof fieldErrors = {};
    if (!identifier.trim()) {
      errors.identifier = "Enter your email or roll number";
    }

    setFieldErrors(errors);
    if (Object.keys(errors).length > 0) {
      return;
    }

    setError(null);
    setSubmitting(true);

    try {
      await requestPasswordReset(identifier.trim(), institutionSlug.trim());
      setSubmitting(false);
      setSent(true);
    } catch (err) {
      setSubmitting(false);
      const message =
        err instanceof AuthError
          ? err.message || ERROR_MESSAGES[err.code]
          : ERROR_MESSAGES.UNKNOWN;
      setError(message);
    }
  }

  function handleContactAdmin() {
    Alert.alert(
      "Contact Institution Admin",
      "If you cannot access your registered email or don't know your credentials, please contact your school or college IT Helpdesk / Academic Office.\n\nThey can verify your identity and reset your password directly from the administrative console.",
      [{ text: "OK" }]
    );
  }

  return (
    <View style={styles.screen}>
      <MobileBanner />
      <KeyboardAvoidingView
        style={styles.flex}
        behavior={Platform.OS === "ios" ? "padding" : undefined}
      >
        <ScrollView
          contentContainerStyle={styles.main}
          keyboardShouldPersistTaps="handled"
        >
          <View style={styles.cardWrap}>
            <View style={styles.card}>
              {sent ? (
                <View style={styles.sentContainer}>
                  <View style={styles.iconCircle}>
                    <MailCheck size={28} color={Colors.success} />
                  </View>

                  <Text style={styles.h1}>Check your inbox</Text>
                  <Text style={styles.subtitle}>
                    If an account matches what you entered, we&apos;ve sent a password
                    reset link. The link expires in 30 minutes.
                  </Text>

                  <TouchableOpacity
                    style={styles.backButton}
                    onPress={() => router.replace("/login")}
                    accessibilityRole="button"
                  >
                    <ArrowLeft size={16} color={Colors.accent} />
                    <Text style={styles.backButtonText}>Back to sign in</Text>
                  </TouchableOpacity>
                </View>
              ) : (
                <>
                  <View style={styles.heading}>
                    <Text style={styles.h1}>Reset your password</Text>
                    <Text style={styles.subtitle}>
                      Enter your email or roll number to receive a secure reset link.
                    </Text>
                    {institutionSlug ? (
                      <View style={styles.institutionPill}>
                        <Building2 size={14} color={Colors.accent} />
                        <Text style={styles.institutionPillText}>{institutionSlug}</Text>
                      </View>
                    ) : null}
                  </View>

                  {error ? (
                    <View style={styles.alertGap}>
                      <FormAlert variant="error">{error}</FormAlert>
                    </View>
                  ) : null}

                  <View style={styles.form}>
                    <TextField
                      label="Email or Roll Number"
                      placeholder="you@college.edu or ROLL123"
                      value={identifier}
                      onChangeText={(value) => {
                        setIdentifier(value);
                        setFieldErrors((p) => ({ ...p, identifier: undefined }));
                        setError(null);
                      }}
                      error={fieldErrors.identifier}
                      editable={!submitting}
                    />

                    <Button
                      loading={submitting}
                      loadingText="Sending reset link…"
                      onPress={handleSubmit}
                    >
                      <Text style={styles.buttonLabel}>Send reset link</Text>
                      <Send size={15} color="#FFFFFF" />
                    </Button>

                    <TouchableOpacity
                      style={styles.backToLoginRow}
                      onPress={() => router.replace("/login")}
                      accessibilityRole="button"
                    >
                      <ArrowLeft size={15} color={Colors.accent} />
                      <Text style={styles.backLink}>Back to sign in</Text>
                    </TouchableOpacity>

                    <Text style={styles.help}>
                      Having trouble?{" "}
                      <Text
                        style={styles.helpLink}
                        onPress={handleContactAdmin}
                        accessibilityRole="button"
                      >
                        Contact Institution Admin
                      </Text>
                    </Text>
                  </View>
                </>
              )}
            </View>

            <Text style={styles.footer}>
              Protected by tenant isolation · All password resets are audited
            </Text>
          </View>
        </ScrollView>
      </KeyboardAvoidingView>
    </View>
  );
}

const styles = StyleSheet.create({
  screen: {
    flex: 1,
    backgroundColor: Colors.background,
  },
  flex: {
    flex: 1,
  },
  main: {
    flexGrow: 1,
    alignItems: "center",
    backgroundColor: "#FFFFFF",
    padding: 24,
  },
  cardWrap: {
    width: "100%",
    maxWidth: 400,
  },
  card: {
    backgroundColor: "#FFFFFF",
  },
  heading: {
    marginBottom: 24,
  },
  h1: {
    fontSize: 22,
    fontWeight: "700",
    color: "#0F172A",
  },
  subtitle: {
    marginTop: 6,
    fontSize: 13,
    lineHeight: 18,
    color: "#64748B",
  },
  institutionPill: {
    marginTop: 10,
    alignSelf: "flex-start",
    flexDirection: "row",
    alignItems: "center",
    gap: 6,
    paddingVertical: 4,
    paddingHorizontal: 10,
    backgroundColor: "rgba(79, 70, 229, 0.08)",
    borderRadius: 8,
    borderWidth: 1,
    borderColor: "rgba(79, 70, 229, 0.2)",
  },
  institutionPillText: {
    fontSize: 13,
    fontWeight: "600",
    color: Colors.accent,
  },
  alertGap: {
    marginBottom: 20,
  },
  form: {
    gap: 16,
  },
  buttonLabel: {
    fontSize: 14,
    fontWeight: "600",
    color: "#FFFFFF",
  },
  backToLoginRow: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    gap: 6,
    paddingVertical: 6,
  },
  backLink: {
    fontSize: 13,
    fontWeight: "600",
    color: Colors.accent,
  },
  help: {
    paddingTop: 8,
    textAlign: "center",
    fontSize: 12,
    color: "#64748B",
  },
  helpLink: {
    fontWeight: "600",
    color: Colors.accent,
  },
  sentContainer: {
    alignItems: "flex-start",
    paddingVertical: 12,
  },
  iconCircle: {
    width: 48,
    height: 48,
    borderRadius: 24,
    backgroundColor: "#DCFCE7",
    alignItems: "center",
    justifyContent: "center",
    marginBottom: 16,
  },
  backButton: {
    marginTop: 24,
    flexDirection: "row",
    alignItems: "center",
    gap: 6,
    paddingVertical: 8,
  },
  backButtonText: {
    fontSize: 14,
    fontWeight: "600",
    color: Colors.accent,
  },
  footer: {
    marginTop: 32,
    textAlign: "center",
    fontSize: 11,
    lineHeight: 16,
    color: "#475569",
  },
});
