/**
 * C-PA-03 — the guardian's own account (mobile port of ParentGuardianPage).
 *
 * Two fields are editable: phone and address. A name on this platform is the
 * identity printed on the admission record and quoted in the audit trail, so changing
 * it is an office job backed by documents — the screen says that instead of leaving a
 * greyed-out box to discover.
 *
 * The phone is also the alert number, which is why saving a new one has to be
 * confirmed before absence and exam messages move to it.
 */

import { useState } from "react";
import { StyleSheet, Text, View } from "react-native";

import { AsyncState } from "@/components/principal-ui";
import { Button } from "@/components/button";
import { ClaimByCode } from "@/components/parent-claim";
import { Chip, FactRow } from "@/components/parent-ui";
import { FormAlert } from "@/components/form-alert";
import { Screen } from "@/components/screen";
import { Card, EmptyState, Loading, PageHeader } from "@/components/ui";
import { TextField } from "@/components/text-field";
import { dateOnly, dateTime, statusLabel } from "@/lib/format";
import { fetchGuardianProfile, moduleLabel, updateGuardianProfile } from "@/lib/parent";
import { useParentConsole } from "@/lib/parent-console";
import { useResource } from "@/hooks/use-resource";
import { Colors, Radius } from "@/theme";

export default function ParentMePage() {
  const profile = useResource(fetchGuardianProfile, []);
  const { data: roster, reload } = useParentConsole();
  const [form, setForm] = useState<{ phone: string; address: string } | null>(null);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [saved, setSaved] = useState(false);

  const editing = form ?? (profile.data ? { phone: profile.data.phone ?? "", address: profile.data.address ?? "" } : null);

  async function save() {
    setBusy(true);
    setError(null);
    setSaved(false);
    try {
      const updated = await updateGuardianProfile({
        phone: (editing?.phone ?? "").trim() || null,
        address: (editing?.address ?? "").trim() || null,
      });
      profile.setData(updated);
      setForm(null);
      setSaved(true);
    } catch (caught) {
      setError(caught instanceof Error ? caught.message : "Your details could not be saved.");
    } finally {
      setBusy(false);
    }
  }

  return (
    <Screen>
      <PageHeader
        title="My details"
        subtitle="How the school reaches you, and what each child’s link allows"
      />

      <View style={styles.stack}>
        {profile.loading ? (
          <Loading label="Loading your details…" />
        ) : profile.error ? (
          <AsyncState loading={false} error={profile.error} onRetry={profile.reload}>{null}</AsyncState>
        ) : profile.data ? (
          <>
            <Card>
              <View style={styles.identity}>
                <View style={styles.identityText}>
                  <Text style={styles.name}>{profile.data.name}</Text>
                  <Text style={styles.email}>
                    {profile.data.email ?? "No email on file"} · {profile.data.children_count} student
                    {profile.data.children_count === 1 ? "" : "s"} linked
                  </Text>
                  <Text style={styles.login}>
                    Last signed in {profile.data.last_login_at ? dateTime(profile.data.last_login_at) : "for the first time"}
                  </Text>
                </View>
                {profile.data.can_edit_contact ? (
                  <Text
                    accessibilityRole="button"
                    onPress={() =>
                      setForm(
                        form
                          ? null
                          : { phone: profile.data?.phone ?? "", address: profile.data?.address ?? "" },
                      )
                    }
                    style={styles.editLink}
                  >
                    {form ? "Close" : "Edit"}
                  </Text>
                ) : null}
              </View>

              {form && editing ? (
                <View style={styles.form}>
                  <TextField
                    label="Phone"
                    value={editing.phone}
                    onChangeText={(phone) => setForm({ ...editing, phone })}
                    keyboardType="phone-pad"
                    placeholder="+91 98765 43210"
                    hint="Absence and exam alerts go to this number. A new one stays unverified until you confirm it."
                  />
                  <TextField
                    label="Address"
                    value={editing.address}
                    onChangeText={(address) => setForm({ ...editing, address })}
                    multiline
                  />
                  {error ? <FormAlert>{error}</FormAlert> : null}
                  {saved ? <FormAlert variant="success">Saved.</FormAlert> : null}
                  <Button onPress={save} loading={busy} loadingText="Saving…">
                    <Text style={styles.buttonLabel}>Save</Text>
                  </Button>
                </View>
              ) : (
                <View>
                  <FactRow label="Phone" value={profile.data.phone ?? "Not recorded"} />
                  <FactRow label="Address" value={profile.data.address ?? "Not recorded"} />
                  <Text style={styles.note}>
                    Your name is printed from the admission record and quoted in the audit trail, so it is changed
                    by the office with documents — not from here.
                  </Text>
                </View>
              )}
            </Card>

            <Card>
              <Text style={styles.cardTitle}>What the school shares with you</Text>
              {roster?.children.length ? (
                roster.children.map((child) => (
                  <View key={child.link_id} style={styles.shareRow}>
                    <View style={styles.shareHead}>
                      <Text style={styles.shareName}>{child.name}</Text>
                      <Text style={styles.shareMeta}>
                        {child.relation} · {child.access_upto ? `ends ${dateOnly(child.access_upto)}` : "no end date"}
                      </Text>
                    </View>
                    {!child.is_live ? (
                      <Chip label={`Paused — ${statusLabel(child.blocked_reason ?? "")}`} tone="warning" />
                    ) : (
                      <View style={styles.chips}>
                        {child.access_scope.map((module) => (
                          <Chip key={module} label={moduleLabel(module)} />
                        ))}
                      </View>
                    )}
                  </View>
                ))
              ) : (
                <EmptyState text="No student is linked to your account yet." />
              )}
              <Text style={styles.note}>
                Set per child by the school, not by you. A second guardian of the same child can legitimately
                hold a different list.
              </Text>
            </Card>

            <Card>
              <Text style={styles.cardTitle}>Another child at this school?</Text>
              <Text style={styles.note}>
                If the office gave you an activation code for a sibling or a nephew, enter it here to link them to
                this account. One account can hold several children.
              </Text>
              <ClaimByCode onClaimed={() => void reload()} />
            </Card>
          </>
        ) : null}
      </View>
    </Screen>
  );
}

const styles = StyleSheet.create({
  stack: { gap: 16 },
  identity: { flexDirection: "row", alignItems: "flex-start", gap: 12 },
  identityText: { flex: 1, minWidth: 0, gap: 2 },
  name: { fontSize: 18, fontWeight: "800", color: Colors.primary },
  email: { fontSize: 13, color: Colors.mutedForeground },
  login: { fontSize: 11, color: Colors.mutedForeground, marginTop: 2 },
  editLink: {
    fontSize: 13,
    fontWeight: "700",
    color: Colors.accent,
    paddingVertical: 6,
    paddingHorizontal: 12,
    borderRadius: Radius.field,
    borderWidth: 1,
    borderColor: Colors.border,
    overflow: "hidden",
  },
  form: { gap: 12, marginTop: 16, paddingTop: 16, borderTopWidth: StyleSheet.hairlineWidth, borderTopColor: Colors.border },
  buttonLabel: { fontSize: 14, fontWeight: "700", color: "#FFFFFF" },
  cardTitle: { fontSize: 15, fontWeight: "800", color: Colors.primary, marginBottom: 8 },
  shareRow: { gap: 6, paddingVertical: 10, borderTopWidth: StyleSheet.hairlineWidth, borderTopColor: Colors.border },
  shareHead: { flexDirection: "row", alignItems: "baseline", justifyContent: "space-between", gap: 12 },
  shareName: { fontSize: 14, fontWeight: "700", color: Colors.foreground, flexShrink: 1 },
  shareMeta: { fontSize: 11, color: Colors.mutedForeground },
  chips: { flexDirection: "row", flexWrap: "wrap", gap: 6 },
  note: { fontSize: 11, lineHeight: 16, color: Colors.mutedForeground, marginTop: 10 },
});
