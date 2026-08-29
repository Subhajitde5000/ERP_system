/**
 * C-PA-12 — guardian activation (mobile port of fontend/app/(auth)/guardian-access).
 *
 * The one public screen of the parent portal, and the reason a school does not have
 * to key four hundred parent passwords: the office issues a 12-character code on the
 * admission slip, the family sets their own password against it, and the account that
 * appears is an ordinary tenant login — lockout, session records and refresh rotation
 * included. No token is handed out here; that would be a second, weaker door into the
 * same account.
 *
 * Two inputs prove the claimer rather than the code alone: the code (only the family
 * has it) and the child's roll number, typed from the same slip. A guessed code
 * therefore produces a 422, not somebody's record. `Check the code` is the optional
 * preview for a family holding two slips.
 *
 * On success the school is remembered as this device's institution, so `Sign in` is
 * one tap rather than a slug typed again. The code never goes in the URL.
 */

import { useState } from "react";
import { KeyboardAvoidingView, Platform, ScrollView, StyleSheet, Text, TouchableOpacity, View } from "react-native";
import { useRouter } from "expo-router";
import { ArrowLeft, CheckCircle2, ShieldCheck } from "lucide-react-native";

import { MobileBanner } from "@/components/brand-banner";
import { Button } from "@/components/button";
import { FormAlert } from "@/components/form-alert";
import { TextField } from "@/components/text-field";
import { APIError } from "@/lib/api-client";
import {
  activateGuardianAccount,
  checkActivationCode,
  GUARDIAN_MIN_PASSWORD,
  normaliseGuardianCode,
  type ParentCodeCheck,
} from "@/lib/parent";
import { useInstitutionAuth } from "@/lib/session";
import { Colors } from "@/theme";

export default function GuardianAccessScreen() {
  const router = useRouter();
  const { setInstitutionSlug } = useInstitutionAuth();
  const [code, setCode] = useState("");
  const [roll, setRoll] = useState("");
  const [name, setName] = useState("");
  const [email, setEmail] = useState("");
  const [phone, setPhone] = useState("");
  const [password, setPassword] = useState("");
  const [confirm, setConfirm] = useState("");
  const [preview, setPreview] = useState<ParentCodeCheck | null>(null);
  const [checking, setChecking] = useState(false);
  const [note, setNote] = useState<string | null>(null);
  const [errors, setErrors] = useState<Record<string, string>>({});
  const [busy, setBusy] = useState(false);
  const [failure, setFailure] = useState<{ status: number; message: string } | null>(null);
  const [done, setDone] = useState<{ slug: string; student: string; institution: string } | null>(null);

  async function handleCheck() {
    if (code.length < 6) {
      setNote("Enter the whole code from the slip — it is 12 characters.");
      return;
    }
    setChecking(true);
    setNote(null);
    try {
      setPreview(await checkActivationCode(code));
    } catch (caught) {
      setPreview(null);
      setNote(messageOf(caught));
    } finally {
      setChecking(false);
    }
  }

  async function handleSubmit() {
    setFailure(null);
    const next: Record<string, string> = {};
    if (code.length < 6) next.code = "Enter the whole code from the slip";
    if (!roll.trim()) next.roll = "Enter your child’s roll number";
    if (name.trim().length < 2) next.name = "Enter your full name";
    if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email.trim())) next.email = "Enter a valid email address";
    if (password.length < GUARDIAN_MIN_PASSWORD) next.password = `Use at least ${GUARDIAN_MIN_PASSWORD} characters`;
    if (confirm !== password) next.confirm = "Both passwords must match";
    setErrors(next);
    if (Object.keys(next).length) return;

    setBusy(true);
    try {
      const result = await activateGuardianAccount({
        code,
        student_roll_no: roll.trim(),
        name: name.trim(),
        email: email.trim(),
        password,
        phone: phone.trim() || null,
      });
      setDone({ slug: result.slug, student: result.student_name, institution: result.institution_name });
      // The device now belongs to this school, so the next screen is a tap and not
      // a slug retyped from memory.
      await setInstitutionSlug(result.slug);
    } catch (caught) {
      setFailure({ status: caught instanceof APIError ? caught.status : 0, message: messageOf(caught) });
    } finally {
      setBusy(false);
    }
  }

  if (done) {
    return (
      <View style={styles.screen}>
        <MobileBanner />
        <View style={styles.doneWrap}>
          <CheckCircle2 size={32} color="#10B981" />
          <Text style={styles.doneTitle}>Your portal is open</Text>
          <Text style={styles.doneBody}>
            {done.student} is linked to this account at {done.institution}. Sign in with the email and password
            you just chose — attendance, timetable, marks and fees are on the other side of it, and nothing else.
          </Text>
          <Button onPress={() => router.replace("/login")} style={styles.doneButton}>
            <Text style={styles.buttonLabel}>Sign in</Text>
          </Button>
        </View>
      </View>
    );
  }

  return (
    <View style={styles.screen}>
      <MobileBanner />
      <KeyboardAvoidingView behavior={Platform.OS === "ios" ? "padding" : undefined} style={styles.flex}>
        <ScrollView contentContainerStyle={styles.content} keyboardShouldPersistTaps="handled">
          <Text style={styles.title}>Open your parent portal</Text>
          <Text style={styles.lede}>
            Use the activation code from your admission slip. It links one account to one child — nothing else on
            the school’s system becomes visible to you.
          </Text>

          {failure ? (
            <FormAlert>
              {failure.message}
              {failure.status === 409 ? " Sign in with that account and enter the code from My details instead." : ""}
            </FormAlert>
          ) : null}

          <View style={styles.fields}>
            <TextField
              label="Activation code"
              value={code}
              onChangeText={(raw) => {
                setCode(normaliseGuardianCode(raw));
                setPreview(null);
                setNote(null);
              }}
              placeholder="7QK4M2XB9RTD"
              autoCapitalize="characters"
              error={errors.code}
            />
            <TouchableOpacity accessibilityRole="button" onPress={handleCheck} disabled={checking} style={styles.checkButton}>
              <Text style={styles.checkLabel}>{checking ? "Checking…" : "Check the invitation first"}</Text>
            </TouchableOpacity>
            {note ? <Text style={styles.noteText}>{note}</Text> : null}
            {preview ? (
              <View style={styles.preview}>
                <Text style={styles.previewTitle}>
                  {preview.student_name}
                  {preview.class_name ? ` · ${preview.class_name}` : ""}
                </Text>
                <Text style={styles.previewMeta}>
                  {preview.institution_name} · addressed to a {preview.relation.toLowerCase()}
                  {preview.is_primary ? " (primary guardian)" : ""}
                  {preview.expires_at ? ` · code expires ${new Date(preview.expires_at).toLocaleDateString()}` : ""}
                </Text>
              </View>
            ) : null}

            <TextField
              label="Child’s roll number"
              value={roll}
              onChangeText={setRoll}
              placeholder="As printed on the slip"
              error={errors.roll}
            />
            <TextField label="Your full name" value={name} onChangeText={setName} error={errors.name} autoCapitalize="words" />
            <TextField label="Email" value={email} onChangeText={setEmail} error={errors.email} keyboardType="email-address" />
            <TextField label="Phone (optional)" value={phone} onChangeText={setPhone} keyboardType="phone-pad" placeholder="+91 98765 43210" />
            <TextField
              label="Choose a password"
              value={password}
              onChangeText={setPassword}
              revealable
              error={errors.password}
              placeholder={`At least ${GUARDIAN_MIN_PASSWORD} characters`}
            />
            <TextField label="Confirm password" value={confirm} onChangeText={setConfirm} revealable error={errors.confirm} />
          </View>

          <Button onPress={handleSubmit} loading={busy} loadingText="Creating your account…" style={styles.submit}>
            <Text style={styles.buttonLabel}>Create account and link</Text>
          </Button>

          <Text style={styles.fine}>
            The school’s server allows twenty code lookups and eight account creations an hour per device. A code
            that has been used will not work twice — the office can reissue one in a minute.
          </Text>

          <TouchableOpacity accessibilityRole="button" onPress={() => router.replace("/login")} style={styles.backLink}>
            <ArrowLeft size={14} color={Colors.accent} />
            <Text style={styles.backLabel}>I already have an account</Text>
          </TouchableOpacity>

          <View style={styles.trustRow}>
            <ShieldCheck size={14} color={Colors.mutedForeground} />
            <Text style={styles.trustText}>No payment is ever requested on this screen.</Text>
          </View>
        </ScrollView>
      </KeyboardAvoidingView>
    </View>
  );
}

function messageOf(caught: unknown): string {
  if (caught instanceof APIError) {
    if (caught.status === 429) return "Too many attempts from this device. Wait a while and try again.";
    return caught.message;
  }
  return caught instanceof Error ? caught.message : "This could not be completed. Try again.";
}

const styles = StyleSheet.create({
  screen: { flex: 1, backgroundColor: Colors.background },
  flex: { flex: 1 },
  content: { padding: 16, gap: 14 },
  title: { fontSize: 24, fontWeight: "800", letterSpacing: -0.4, color: Colors.primary },
  lede: { fontSize: 14, lineHeight: 21, color: Colors.mutedForeground },
  fields: { gap: 14 },
  checkButton: {
    alignSelf: "flex-start",
    paddingHorizontal: 12,
    paddingVertical: 8,
    borderRadius: 10,
    borderWidth: 1,
    borderColor: Colors.border,
    backgroundColor: "#FFFFFF",
  },
  checkLabel: { fontSize: 13, fontWeight: "700", color: Colors.accent },
  noteText: { fontSize: 12, color: Colors.destructiveText },
  preview: {
    padding: 12,
    borderRadius: 12,
    borderWidth: 1,
    borderColor: "#A7F3D0",
    backgroundColor: Colors.successLight,
    gap: 3,
  },
  previewTitle: { fontSize: 14, fontWeight: "700", color: Colors.primary },
  previewMeta: { fontSize: 12, lineHeight: 18, color: Colors.mutedForeground },
  submit: { marginTop: 4 },
  buttonLabel: { fontSize: 14, fontWeight: "700", color: "#FFFFFF" },
  fine: { fontSize: 11, lineHeight: 16, color: Colors.mutedForeground },
  backLink: { flexDirection: "row", alignItems: "center", gap: 6, alignSelf: "center", paddingVertical: 8 },
  backLabel: { fontSize: 13, fontWeight: "600", color: Colors.accent },
  trustRow: { flexDirection: "row", alignItems: "center", gap: 6, justifyContent: "center" },
  trustText: { fontSize: 11, color: Colors.mutedForeground },
  doneWrap: { flex: 1, alignItems: "center", justifyContent: "center", gap: 12, padding: 24, backgroundColor: "#FFFFFF" },
  doneTitle: { fontSize: 20, fontWeight: "800", color: Colors.primary },
  doneBody: { fontSize: 14, lineHeight: 21, color: Colors.mutedForeground, textAlign: "center" },
  doneButton: { alignSelf: "stretch" },
});
