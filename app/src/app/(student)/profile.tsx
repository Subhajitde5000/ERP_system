/**
 * C-ST-02 profile — port of fontend/components/student/student-profile.tsx.
 * Read-only institute data + editable name/phone/avatar (C-RB-04).
 */

import { useState } from "react";
import { Image, StyleSheet, Text, TouchableOpacity, View } from "react-native";
import { Pencil } from "lucide-react-native";

import { AsyncState } from "@/components/principal-ui";
import { Screen } from "@/components/screen";
import { Button } from "@/components/button";
import { Card, PageHeader } from "@/components/ui";
import { TextField } from "@/components/text-field";
import { dateOnly, statusLabel } from "@/lib/format";
import { fetchStudentProfile, updateStudentProfile } from "@/lib/student";
import { useResource } from "@/hooks/use-resource";
import { Colors, Radius, Shadow } from "@/theme";

export default function StudentProfilePage() {
  const resource = useResource(fetchStudentProfile, []);
  const [editing, setEditing] = useState(false);
  const [form, setForm] = useState({ name: "", phone: "", avatar_url: "" });
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const profile = resource.data;

  function startEdit() {
    if (!profile) return;
    setForm({ name: profile.name, phone: profile.phone ?? "", avatar_url: profile.avatar_url ?? "" });
    setError(null);
    setEditing(true);
  }

  async function save() {
    setBusy(true);
    setError(null);
    try {
      const updated = await updateStudentProfile({
        name: form.name.trim(),
        phone: form.phone.trim() || null,
        avatar_url: form.avatar_url.trim() || null,
      });
      resource.setData(updated);
      setEditing(false);
    } catch (caught) {
      setError(caught instanceof Error ? caught.message : "Could not save your profile.");
    } finally {
      setBusy(false);
    }
  }

  return (
    <Screen>
      <PageHeader
        title="My profile"
        subtitle="Your student record. Only your name, phone and photo are editable — the rest is managed by the institution."
        action={
          profile && !editing ? (
            <TouchableOpacity onPress={startEdit} style={styles.editButton}>
              <Pencil size={16} color="#FFFFFF" />
              <Text style={styles.editButtonLabel}>Edit profile</Text>
            </TouchableOpacity>
          ) : undefined
        }
      />
      <AsyncState
        loading={resource.loading}
        error={resource.error}
        onRetry={resource.reload}
        loadingLabel="Loading your profile…"
      >
        {profile ? (
          <View style={styles.stack}>
            {editing ? (
              <Card>
                <View style={styles.form}>
                  <TextField
                    label="Full name"
                    value={form.name}
                    onChangeText={(name) => setForm({ ...form, name })}
                  />
                  <TextField
                    label="Phone"
                    value={form.phone}
                    onChangeText={(phone) => setForm({ ...form, phone })}
                    keyboardType="phone-pad"
                  />
                  <TextField
                    label="Photo URL"
                    value={form.avatar_url}
                    onChangeText={(avatar_url) => setForm({ ...form, avatar_url })}
                    placeholder="https://…"
                  />
                  {error ? <Text style={styles.formError}>{error}</Text> : null}
                  <View style={styles.formActions}>
                    <Button loading={busy} loadingText="Saving…" onPress={save} style={styles.saveButton}>
                      <Text style={styles.saveLabel}>Save changes</Text>
                    </Button>
                    <TouchableOpacity onPress={() => setEditing(false)} style={styles.cancelButton}>
                      <Text style={styles.cancelLabel}>Cancel</Text>
                    </TouchableOpacity>
                  </View>
                </View>
              </Card>
            ) : null}
            <Card>
              <View style={styles.identity}>
                {profile.avatar_url ? (
                  <Image source={{ uri: profile.avatar_url }} style={styles.avatarImage} />
                ) : (
                  <View style={styles.avatar}>
                    <Text style={styles.avatarText}>{profile.name.charAt(0).toUpperCase()}</Text>
                  </View>
                )}
                <View style={styles.identityText}>
                  <Text style={styles.name}>{profile.name}</Text>
                  <Text style={styles.email}>{profile.email ?? "No email on record"}</Text>
                </View>
              </View>
              <View style={styles.rows}>
                <Row label="Roll number" value={profile.class_info.roll_number ?? profile.student_roll_no ?? "—"} />
                <Row label="Class" value={profile.class_info.class_name ?? "—"} />
                <Row label="Department" value={profile.class_info.department_name ?? "—"} />
                <Row label="Academic year" value={profile.class_info.academic_year ?? "—"} />
                <Row label="Class teacher" value={profile.class_teacher_name ?? "Not assigned"} />
                <Row label="Phone" value={profile.phone ?? "—"} />
                <Row label="Date of birth" value={profile.date_of_birth ? dateOnly(profile.date_of_birth) : "—"} />
                <Row label="Gender" value={profile.gender ? statusLabel(profile.gender) : "—"} />
              </View>
            </Card>
          </View>
        ) : null}
      </AsyncState>
    </Screen>
  );
}

function Row({ label, value }: { label: string; value: string }) {
  return (
    <View style={styles.row}>
      <Text style={styles.rowLabel}>{label}</Text>
      <Text style={styles.rowValue}>{value}</Text>
    </View>
  );
}

const styles = StyleSheet.create({
  stack: {
    gap: 20,
  },
  editButton: {
    flexDirection: "row",
    alignItems: "center",
    gap: 8,
    height: 40,
    borderRadius: Radius.field,
    backgroundColor: Colors.accent,
    paddingHorizontal: 16,
    ...Shadow.accent,
  },
  editButtonLabel: {
    fontSize: 14,
    fontWeight: "600",
    color: "#FFFFFF",
  },
  form: {
    gap: 16,
  },
  formError: {
    fontSize: 14,
    color: Colors.destructiveText,
  },
  formActions: {
    flexDirection: "row",
    flexWrap: "wrap",
    gap: 12,
  },
  saveButton: {
    alignSelf: "flex-start",
  },
  saveLabel: {
    fontSize: 14,
    fontWeight: "600",
    color: "#FFFFFF",
  },
  cancelButton: {
    height: 44,
    borderRadius: Radius.field,
    borderWidth: 1,
    borderColor: Colors.border,
    paddingHorizontal: 20,
    alignItems: "center",
    justifyContent: "center",
  },
  cancelLabel: {
    fontSize: 14,
    fontWeight: "600",
    color: Colors.mutedForeground,
  },
  identity: {
    flexDirection: "row",
    alignItems: "center",
    gap: 16,
  },
  avatarImage: {
    width: 64,
    height: 64,
    borderRadius: 32,
    borderWidth: 1,
    borderColor: Colors.border,
  },
  avatar: {
    width: 64,
    height: 64,
    borderRadius: 32,
    backgroundColor: Colors.accentLight,
    alignItems: "center",
    justifyContent: "center",
  },
  avatarText: {
    fontSize: 20,
    fontWeight: "700",
    color: Colors.accent,
  },
  identityText: {
    flex: 1,
  },
  name: {
    fontSize: 20,
    fontWeight: "700",
    color: Colors.primary,
  },
  email: {
    fontSize: 14,
    color: Colors.mutedForeground,
  },
  rows: {
    marginTop: 24,
    gap: 12,
  },
  row: {
    flexDirection: "row",
    gap: 12,
    borderBottomWidth: 1,
    borderBottomColor: Colors.border,
    paddingBottom: 10,
  },
  rowLabel: {
    width: 128,
    fontSize: 14,
    fontWeight: "500",
    color: Colors.mutedForeground,
  },
  rowValue: {
    flex: 1,
    fontSize: 14,
    fontWeight: "500",
    color: Colors.primary,
  },
});
