/**
 * Claim a child with an activation code (C-PA-12, in-console half).
 *
 * Two places need it — the family screen when an invite is already waiting, and
 * "My details" for a second child the office just issued — so it is one component
 * rather than two copies of the same form.
 *
 * Codes are 12 characters printed in blocks of four, and families type them from
 * paper: spaces and dashes are the normal case, not the error case, so they are
 * stripped by `normaliseGuardianCode`, which the public form and the website share so
 * all three read a paste the same way. A wrong code costs one lookup out of the
 * school's hourly limit — the message says what to do next, not "invalid input".
 */

import { useState } from "react";
import { StyleSheet, Text, View } from "react-native";

import { Button } from "@/components/button";
import { FormAlert } from "@/components/form-alert";
import { TextField } from "@/components/text-field";
import { claimChildByCode, normaliseGuardianCode } from "@/lib/parent";

export function ClaimByCode({ onClaimed }: { onClaimed: () => void }) {
  const [code, setCode] = useState("");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [done, setDone] = useState<string | null>(null);

  async function submit() {
    if (code.length < 6) {
      setError("Enter the whole code from the slip — it is 12 characters.");
      return;
    }
    setBusy(true);
    setError(null);
    try {
      const claimed = await claimChildByCode(code);
      setDone(`${claimed.student_name} is now linked to your account.`);
      setCode("");
      onClaimed();
    } catch (caught) {
      setError(caught instanceof Error ? caught.message : "That code could not be used.");
    } finally {
      setBusy(false);
    }
  }

  return (
    <View style={styles.form}>
      <TextField
        label="Activation code"
        value={code}
        onChangeText={(raw) => {
          setCode(normaliseGuardianCode(raw));
          setDone(null);
        }}
        placeholder="7QK4M2XB9RTD"
        autoCapitalize="characters"
        error={error}
      />
      {done ? <FormAlert variant="success">{done}</FormAlert> : null}
      <Button onPress={submit} loading={busy} loadingText="Linking…">
        <Text style={styles.buttonLabel}>Link this child</Text>
      </Button>
    </View>
  );
}

const styles = StyleSheet.create({
  form: { gap: 12, marginTop: 12 },
  buttonLabel: { fontSize: 14, fontWeight: "700", color: "#FFFFFF" },
});
